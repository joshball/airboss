/**
 * Review queue loader.
 *
 * Walks the discovery rules, upserts `review_item` rows into the singleton
 * `Hangar Review` board, soft-prunes items whose source artifact has
 * disappeared, and populates the docs FTS index. Idempotent: safe to run on
 * boot, on /review page load (debounced via the boot Promise), and via the
 * "Refresh" admin button.
 *
 * Atomicity: the item upsert + soft-prune pair runs inside `db.transaction`
 * so external readers see one consistent snapshot. The FTS rebuild stays
 * outside the transaction (its row-by-row upsert is large and `path`-keyed;
 * a long-held tx hurts more than the partial visibility for FTS).
 *
 * Server-only: imports `node:fs/promises` (discovery rules + FTS scan).
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, posix, resolve, sep } from 'node:path';
import { DOCS_SEARCH_ROOTS } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { createLogger, parseFrontmatter } from '@ab/utils';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { bustDocsTreeCache } from './docs-tree';
import { getOrCreateBoard, seedDefaultBuckets, softDeleteItem, upsertItem } from './review';
import { type DiscoveryError, discoverAllItems } from './review-discovery';
import { hangarDocsSearchIndex, hangarReviewItem } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

const logger = createLogger('review-loader');

export interface LoaderResult {
	readonly added: number;
	readonly updated: number;
	readonly removed: number;
	readonly fts: { readonly added: number; readonly updated: number; readonly removed: number };
	readonly errors: readonly DiscoveryError[];
	readonly durationMs: number;
}

/**
 * Last-run snapshot for the admin loader page. Process-local cache (not
 * persisted) so a hangar restart resets it -- the spec calls this out as
 * a v1 simplification (no `review_loader` table). Surfaces (run-at,
 * counts, error list) for the admin UI; the page also lets the user
 * trigger a fresh run via the existing form action.
 */
export interface LastLoaderRun {
	readonly ranAt: string;
	readonly result: LoaderResult;
}

let lastLoaderRun: LastLoaderRun | null = null;

export function getLastLoaderRun(): LastLoaderRun | null {
	return lastLoaderRun;
}

/**
 * Module-private writer for the last-run cache. Only `runLoader` should call
 * this -- a public re-export would let any caller pollute the admin "Last
 * run" panel with a synthesized result. Stays private to enforce that.
 */
function setLastLoaderRun(result: LoaderResult): void {
	lastLoaderRun = { ranAt: new Date().toISOString(), result };
}

/**
 * In-flight singleton, keyed on `Db` identity so per-test transaction-scoped
 * callers don't share results with concurrent live-DB callers. The `WeakMap`
 * clears entries automatically when callers release their `Db` reference.
 */
const inflight: WeakMap<Db, Promise<LoaderResult>> = new WeakMap();

/**
 * Load review items + FTS index. Concurrent calls against the same `db`
 * share the same in-flight promise, so a stampede on hangar boot doesn't
 * fan out to N parallel scans. Concurrent calls with different `db` args
 * (e.g. test transaction vs live default) get independent loader runs.
 */
export async function loadReviewItems(repoRoot: string, db: Db = defaultDb): Promise<LoaderResult> {
	const existing = inflight.get(db);
	if (existing) return existing;
	const promise = runLoader(repoRoot, db)
		.then((result) => {
			// Snapshot the most-recent run for the admin loader page. Live
			// runs against the test transaction also hit this snapshot, so
			// callers in tests should expect prior runs to be visible
			// across `getLastLoaderRun()`. The admin page calls
			// `loadReviewItems(REPO_ROOT, defaultDb)` only.
			setLastLoaderRun(result);
			return result;
		})
		.catch((err) => {
			// Surface the rejection so a failed boot scan is visible (rather
			// than silently swallowed by a fire-and-forget caller).
			logger.error('runLoader rejected', undefined, err instanceof Error ? err : new Error(String(err)));
			throw err;
		})
		.finally(() => {
			inflight.delete(db);
		});
	inflight.set(db, promise);
	return promise;
}

async function runLoader(repoRoot: string, db: Db): Promise<LoaderResult> {
	const started = Date.now();
	const board = await getOrCreateBoard(db);
	await seedDefaultBuckets(board.id, db);
	const discovery = await discoverAllItems(repoRoot, db);
	// Wrap the upsert + prune pass in a single transaction so external
	// readers don't observe partial state during a refresh.
	const { added, updated, removed } = await db.transaction(async (tx) => {
		// Live items currently in the DB for this board.
		const liveItems = await tx
			.select({ id: hangarReviewItem.id, kindId: hangarReviewItem.kindId, ref: hangarReviewItem.ref })
			.from(hangarReviewItem)
			.where(and(eq(hangarReviewItem.boardId, board.id), isNull(hangarReviewItem.deletedAt)));
		// Map keyed on `(kindId, ref)` -- O(1) lookup per discovered item.
		const liveByKey = new Map<string, { id: string; kindId: string }>();
		for (const row of liveItems) {
			liveByKey.set(`${row.kindId} ${row.ref}`, { id: row.id, kindId: row.kindId });
		}
		const seenKeys = new Set<string>();
		let addedLocal = 0;
		let updatedLocal = 0;
		for (const discovered of discovery.items) {
			const key = `${discovered.kindId} ${discovered.ref}`;
			seenKeys.add(key);
			const existing = liveByKey.get(key);
			await upsertItem(
				{
					boardId: board.id,
					kindId: discovered.kindId,
					ref: discovered.ref,
					title: discovered.title,
					frontmatterStatus: discovered.frontmatterStatus,
					reviewStatus: discovered.reviewStatus,
					cachedFields: { otherFields: discovered.otherFields },
				},
				tx,
			);
			if (existing) updatedLocal += 1;
			else addedLocal += 1;
		}
		// Soft-prune anything live that the discovery pass didn't see, EXCEPT
		// `ad_hoc` items -- those are user-created and never have a source on disk.
		let removedLocal = 0;
		for (const live of liveItems) {
			if (live.kindId === 'ad_hoc') continue;
			const key = `${live.kindId} ${live.ref}`;
			if (seenKeys.has(key)) continue;
			await softDeleteItem(live.id, tx);
			removedLocal += 1;
		}
		return { added: addedLocal, updated: updatedLocal, removed: removedLocal };
	});
	const fts = await rebuildDocsSearchIndex(repoRoot, db);
	// Loader is the only writer to the docs corpus during a dev session;
	// bust the file-tree cache so the next page render walks fresh disk
	// state rather than serving the pre-loader snapshot.
	bustDocsTreeCache(repoRoot);
	return {
		added,
		updated,
		removed,
		fts,
		errors: discovery.errors,
		durationMs: Date.now() - started,
	};
}

// ---------------------------------------------------------------------------
// FTS index
// ---------------------------------------------------------------------------

/**
 * Chunk size for batched FTS upserts. Drizzle's bulk `.values(rows)` keeps
 * the round-trip count `rows.length / FTS_UPSERT_CHUNK_SIZE` rather than
 * one round-trip per row.
 */
const FTS_UPSERT_CHUNK_SIZE = 500;

async function rebuildDocsSearchIndex(
	repoRoot: string,
	db: Db,
): Promise<{ added: number; updated: number; removed: number }> {
	const seenPaths: string[] = [];
	const rows: Array<{ path: string; title: string; body: string; frontmatter: Readonly<Record<string, string>> }> = [];
	for (const root of DOCS_SEARCH_ROOTS) {
		const absRoot = resolve(repoRoot, root);
		for await (const path of walkMarkdownFiles(absRoot)) {
			const repoRel = toRepoRelative(repoRoot, path);
			let text: string;
			try {
				text = await readFile(path, 'utf8');
			} catch {
				continue;
			}
			// Parse once; reuse `parsed.body` and `parsed.entries` for both the
			// title heuristic and the body / frontmatter columns.
			const parsed = parseFrontmatter(text);
			const fm = new Map<string, string>();
			for (const entry of parsed.entries) fm.set(entry.key, entry.value);
			const title = fm.get('title') ?? extractFirstHeading(parsed.body) ?? posix.basename(repoRel);
			const frontmatter: Record<string, string> = {};
			for (const entry of parsed.entries) frontmatter[entry.key] = entry.value;
			rows.push({ path: repoRel, title, body: parsed.body, frontmatter });
			seenPaths.push(repoRel);
		}
	}
	// Diff against the existing index to compute counts.
	const existing = await db.select({ path: hangarDocsSearchIndex.path }).from(hangarDocsSearchIndex);
	const existingSet = new Set(existing.map((r) => r.path));
	let added = 0;
	let updated = 0;
	if (rows.length > 0) {
		for (const row of rows) {
			if (existingSet.has(row.path)) updated += 1;
			else added += 1;
		}
		// Chunked batch upsert with `excluded.*` so each chunk is one DB
		// round-trip rather than one round-trip per row.
		for (let i = 0; i < rows.length; i += FTS_UPSERT_CHUNK_SIZE) {
			const chunk = rows.slice(i, i + FTS_UPSERT_CHUNK_SIZE);
			await db
				.insert(hangarDocsSearchIndex)
				.values(chunk)
				.onConflictDoUpdate({
					target: hangarDocsSearchIndex.path,
					set: {
						title: sql`excluded.title`,
						body: sql`excluded.body`,
						frontmatter: sql`excluded.frontmatter`,
					},
				});
		}
	}
	let removed = 0;
	const seenSet = new Set(seenPaths);
	const stale = existing.filter((r) => !seenSet.has(r.path)).map((r) => r.path);
	if (stale.length > 0) {
		// Postgres caps `IN (...)` parameter lists; chunk to be safe.
		for (let i = 0; i < stale.length; i += FTS_UPSERT_CHUNK_SIZE) {
			const chunk = stale.slice(i, i + FTS_UPSERT_CHUNK_SIZE);
			await db.delete(hangarDocsSearchIndex).where(inArray(hangarDocsSearchIndex.path, chunk));
			removed += chunk.length;
		}
	}
	return { added, updated, removed };
}

async function* walkMarkdownFiles(dir: string): AsyncGenerator<string> {
	const stack: string[] = [dir];
	while (stack.length > 0) {
		const cur = stack.pop();
		if (cur === undefined) continue;
		let entries: string[];
		try {
			entries = await readdir(cur);
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry.startsWith('.')) continue;
			const path = join(cur, entry);
			let st: Awaited<ReturnType<typeof stat>>;
			try {
				st = await stat(path);
			} catch {
				continue;
			}
			if (st.isDirectory()) stack.push(path);
			else if (st.isFile() && path.endsWith('.md')) yield path;
		}
	}
}

function toRepoRelative(repoRoot: string, absPath: string): string {
	const root = resolve(repoRoot);
	const rel = absPath.startsWith(root + sep) ? absPath.slice(root.length + 1) : absPath;
	return rel.split(sep).join(posix.sep);
}

function extractFirstHeading(body: string): string | null {
	const lines = body.split(/\r?\n/);
	for (const line of lines) {
		const m = line.match(/^#\s+(.+?)\s*$/);
		if (m) return (m[1] ?? '').trim();
	}
	return null;
}
