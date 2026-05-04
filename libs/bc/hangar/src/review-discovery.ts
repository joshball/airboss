/**
 * Discovery rules for the review queue loader.
 *
 * Each rule emits `(kindId, ref, title, frontmatterStatus, reviewStatus,
 * cachedFields)` tuples that `loadReviewItems()` upserts as `review_item`
 * rows. Rules are layered:
 *
 * - `wp_spec` -- one row per `docs/work-packages/<name>/spec.md`
 * - `wp_test_plan` -- one row per sibling `docs/work-packages/<name>/test-plan.md`
 * - `knowledge_node` -- one row per `course/knowledge/**\/node.md` (we emit
 *   ALL nodes regardless of `discovery_review:` frontmatter; the reviewer
 *   flips state via the per-kind view -- see Phase 1 spec gap #1)
 * - `reference_toc` -- one row per `hangar.reference` row whose `verbatim`
 *   jsonb has a TOC-shaped block (a `toc` key, OR a `kind: 'toc'` discriminator,
 *   OR a `tableOfContents` key). "Needs review" is derived in the bucket
 *   filter via `noPassingSession: true` -- not the discovery rule (avoids
 *   the chicken-and-egg query against `review_session`; spec gap #2).
 * - `ad_hoc` -- hand-created via the "+ Ad-hoc" button; no discovery
 *
 * Server-only: the filesystem rules use `node:fs/promises`; the
 * `reference_toc` rule queries the DB. Lives in the BC.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, posix, relative, resolve, sep } from 'node:path';
import {
	FRONTMATTER_REVIEW_STATUS_VALUES,
	FRONTMATTER_STATUS_VALUES,
	type FrontmatterReviewStatus,
	type FrontmatterStatus,
	type ReviewKind,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { parseFrontmatter } from '@ab/utils';
import { and, isNull, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { hangarReference } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export interface DiscoveredItem {
	readonly kindId: ReviewKind;
	/** Stable id passed as `review_item.ref` (path for FS kinds, DB id for refs). */
	readonly ref: string;
	readonly title: string;
	readonly frontmatterStatus: FrontmatterStatus | null;
	readonly reviewStatus: FrontmatterReviewStatus | null;
	readonly otherFields: Readonly<Record<string, string>>;
}

export interface DiscoveryError {
	readonly kindId: ReviewKind;
	readonly ref: string;
	readonly message: string;
	/** ENOENT, EACCES, etc. when the underlying error was a `NodeJS.ErrnoException`. */
	readonly code?: string;
}

export interface DiscoveryResult {
	readonly items: readonly DiscoveredItem[];
	readonly errors: readonly DiscoveryError[];
}

/**
 * Run every discovery rule against the repo rooted at `repoRoot`. Returns the
 * full union of items (callers diff against the live `review_item` rows to
 * compute add/update/prune sets).
 */
export async function discoverAllItems(repoRoot: string, db: Db = defaultDb): Promise<DiscoveryResult> {
	const items: DiscoveredItem[] = [];
	const errors: DiscoveryError[] = [];
	const wpResult = await discoverWorkPackages(repoRoot);
	items.push(...wpResult.items);
	errors.push(...wpResult.errors);
	const knResult = await discoverKnowledgeNodes(repoRoot);
	items.push(...knResult.items);
	errors.push(...knResult.errors);
	const tocResult = await discoverReferenceTocs(db);
	items.push(...tocResult.items);
	errors.push(...tocResult.errors);
	return { items, errors };
}

// ---------------------------------------------------------------------------
// Work packages: spec.md + test-plan.md
// ---------------------------------------------------------------------------

const WP_DIR = posix.join('docs', 'work-packages');

async function discoverWorkPackages(repoRoot: string): Promise<DiscoveryResult> {
	const root = resolve(repoRoot, WP_DIR);
	const items: DiscoveredItem[] = [];
	const errors: DiscoveryError[] = [];
	const wpDirs = await safeReadDir(root);
	for (const wpName of wpDirs) {
		// Skip dotfiles + the `.archive/` directory.
		if (wpName.startsWith('.')) continue;
		const wpDir = join(root, wpName);
		const wpStat = await safeStat(wpDir);
		if (!wpStat?.isDirectory()) continue;
		const specPath = join(wpDir, 'spec.md');
		const tpPath = join(wpDir, 'test-plan.md');
		const specRef = toRepoRelative(repoRoot, specPath);
		const tpRef = toRepoRelative(repoRoot, tpPath);
		const specRow = await readMarkdownItem(specPath, 'wp_spec', specRef, wpName);
		if (specRow.kind === 'item') items.push(specRow.item);
		// spec.md is conventional but not enforced; some early WPs only carry
		// design / tasks / test-plan. Treat ENOENT as skip, not error -- by
		// error code, not message substring (libuv message text is not
		// part of Node's contract).
		else if (specRow.error.code !== 'ENOENT') errors.push(specRow.error);
		const tpRow = await readMarkdownItem(tpPath, 'wp_test_plan', tpRef, `${wpName} (test plan)`);
		if (tpRow.kind === 'item') items.push(tpRow.item);
		// Test plans are optional per spec; ENOENT is the silent-skip path.
		else if (tpRow.error.code !== 'ENOENT') errors.push(tpRow.error);
	}
	return { items, errors };
}

// ---------------------------------------------------------------------------
// Knowledge nodes: course/knowledge/**\/node.md
// ---------------------------------------------------------------------------

const KN_DIR = posix.join('course', 'knowledge');

async function discoverKnowledgeNodes(repoRoot: string): Promise<DiscoveryResult> {
	const root = resolve(repoRoot, KN_DIR);
	const items: DiscoveredItem[] = [];
	const errors: DiscoveryError[] = [];
	for await (const path of walkForFile(root, 'node.md')) {
		const ref = toRepoRelative(repoRoot, path);
		const row = await readMarkdownItem(path, 'knowledge_node', ref, basenameWithoutExt(ref) || ref);
		if (row.kind === 'item') items.push(row.item);
		else errors.push(row.error);
	}
	return { items, errors };
}

// ---------------------------------------------------------------------------
// Reference TOCs: hangar.reference rows with non-null `verbatim`
// ---------------------------------------------------------------------------

/**
 * Predicate: does this `hangar.reference.verbatim` jsonb describe a TOC?
 * Three accepted shapes (the ingestion pipeline doesn't enforce one):
 *
 *   - `{ toc: [...] }` -- direct TOC array
 *   - `{ kind: 'toc', ... }` -- discriminator
 *   - `{ tableOfContents: ... }` -- legacy verbose shape
 *
 * We filter at the SQL layer (`jsonb -> 'toc' IS NOT NULL OR ...`) so the
 * loader walks only TOC-shaped rows -- a reference with a generic verbatim
 * block (e.g. a CFR snippet, a prose excerpt) is NOT discovered as a
 * reviewable TOC.
 */
async function discoverReferenceTocs(db: Db): Promise<DiscoveryResult> {
	const rows = await db
		.select({ id: hangarReference.id, displayName: hangarReference.displayName })
		.from(hangarReference)
		.where(
			and(
				sql`${hangarReference.verbatim} IS NOT NULL`,
				sql`(
					jsonb_typeof(${hangarReference.verbatim}->'toc') IS NOT NULL
					OR ${hangarReference.verbatim}->>'kind' = 'toc'
					OR jsonb_typeof(${hangarReference.verbatim}->'tableOfContents') IS NOT NULL
				)`,
				isNull(hangarReference.deletedAt),
			),
		)
		.orderBy(hangarReference.id);
	const items: DiscoveredItem[] = rows.map((row) => ({
		kindId: 'reference_toc',
		ref: row.id,
		title: row.displayName,
		frontmatterStatus: null,
		reviewStatus: null,
		otherFields: {},
	}));
	return { items, errors: [] };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Discriminated union return: either an `item` was successfully read or an
 * `error` describes why not. The `kind` discriminator lets callers narrow
 * without `'item' in row` checks; `error.code` lets the caller treat
 * ENOENT as skip-not-error without string-matching the message.
 */
type ReadMarkdownResult = { kind: 'item'; item: DiscoveredItem } | { kind: 'error'; error: DiscoveryError };

async function readMarkdownItem(
	absPath: string,
	kindId: ReviewKind,
	ref: string,
	fallbackTitle: string,
): Promise<ReadMarkdownResult> {
	let text: string;
	try {
		text = await readFile(absPath, 'utf8');
	} catch (err) {
		const code = errorCode(err);
		return {
			kind: 'error',
			error: { kindId, ref, message: describeError(err), ...(code !== undefined ? { code } : {}) },
		};
	}
	const parsed = parseFrontmatter(text);
	const fmMap = new Map<string, string>();
	for (const entry of parsed.entries) fmMap.set(entry.key, entry.value);
	const title = fmMap.get('title') ?? fallbackTitle;
	const status = normalizeFrontmatterStatus(fmMap.get('status'));
	const reviewStatus = normalizeReviewStatus(fmMap.get('review_status'));
	const otherFields: Record<string, string> = {};
	for (const entry of parsed.entries) {
		if (entry.key !== 'status' && entry.key !== 'review_status' && entry.key !== 'title') {
			otherFields[entry.key] = entry.value;
		}
	}
	return {
		kind: 'item',
		item: {
			kindId,
			ref,
			title,
			frontmatterStatus: status,
			reviewStatus,
			otherFields,
		},
	};
}

function errorCode(err: unknown): string | undefined {
	if (typeof err !== 'object' || err === null) return undefined;
	const candidate = err as { code?: unknown };
	return typeof candidate.code === 'string' ? candidate.code : undefined;
}

function normalizeFrontmatterStatus(raw: string | undefined): FrontmatterStatus | null {
	if (raw === undefined) return null;
	const v = raw.trim().toLowerCase();
	if (v === '') return null;
	return (FRONTMATTER_STATUS_VALUES as readonly string[]).includes(v) ? (v as FrontmatterStatus) : null;
}

function normalizeReviewStatus(raw: string | undefined): FrontmatterReviewStatus | null {
	if (raw === undefined) return null;
	const v = raw.trim().toLowerCase();
	if (v === '') return null;
	return (FRONTMATTER_REVIEW_STATUS_VALUES as readonly string[]).includes(v) ? (v as FrontmatterReviewStatus) : null;
}

async function safeReadDir(dir: string): Promise<readonly string[]> {
	try {
		return await readdir(dir);
	} catch {
		return [];
	}
}

async function safeStat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean } | null> {
	try {
		return await stat(path);
	} catch {
		return null;
	}
}

async function* walkForFile(root: string, name: string): AsyncGenerator<string> {
	const stack: string[] = [root];
	while (stack.length > 0) {
		const dir = stack.pop();
		if (dir === undefined) continue;
		const entries = await safeReadDir(dir);
		for (const entry of entries) {
			if (entry.startsWith('.')) continue;
			const path = join(dir, entry);
			const st = await safeStat(path);
			if (!st) continue;
			if (st.isDirectory()) {
				stack.push(path);
			} else if (st.isFile() && entry === name) {
				yield path;
			}
		}
	}
}

function toRepoRelative(repoRoot: string, absPath: string): string {
	const rel = relative(resolve(repoRoot), absPath);
	// Normalise to POSIX path separators so the same file produces the same
	// `ref` on Windows + macOS + Linux.
	return rel.split(sep).join(posix.sep);
}

function basenameWithoutExt(repoRel: string): string {
	const base = posix.basename(repoRel);
	return base.replace(/\.md$/, '');
}

function describeError(err: unknown): string {
	if (err instanceof Error) return `${err.name}: ${err.message}`;
	return String(err);
}
