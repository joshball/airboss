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
 *   jsonb has TOC content; "needs review" is derived in the bucket filter,
 *   not the discovery rule (avoids the chicken-and-egg query against
 *   `review_session` -- spec gap #2)
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
import { and, eq, isNull, sql } from 'drizzle-orm';
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
		if ('item' in specRow) items.push(specRow.item);
		// spec.md is conventional but not enforced; some early WPs only carry
		// design / tasks / test-plan. Treat "missing" as skip, not error.
		else if (specRow.error && !specRow.error.message.includes('ENOENT')) errors.push(specRow.error);
		const tpRow = await readMarkdownItem(tpPath, 'wp_test_plan', tpRef, `${wpName} (test plan)`);
		if ('item' in tpRow) items.push(tpRow.item);
		// Test plans are optional per spec; only surface a real read error,
		// not "file not found".
		else if (tpRow.error && !tpRow.error.message.includes('ENOENT')) errors.push(tpRow.error);
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
		if ('item' in row) items.push(row.item);
		else if (row.error) errors.push(row.error);
	}
	return { items, errors };
}

// ---------------------------------------------------------------------------
// Reference TOCs: hangar.reference rows with non-null `verbatim`
// ---------------------------------------------------------------------------

async function discoverReferenceTocs(db: Db): Promise<DiscoveryResult> {
	const rows = await db
		.select({ id: hangarReference.id, displayName: hangarReference.displayName })
		.from(hangarReference)
		.where(and(sql`${hangarReference.verbatim} IS NOT NULL`, isNull(hangarReference.deletedAt)))
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

// Silence unused-import warning when only `eq` is used in nested helpers.
void eq;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readMarkdownItem(
	absPath: string,
	kindId: ReviewKind,
	ref: string,
	fallbackTitle: string,
): Promise<{ item: DiscoveredItem } | { error?: DiscoveryError }> {
	let text: string;
	try {
		text = await readFile(absPath, 'utf8');
	} catch (err) {
		return { error: { kindId, ref, message: describeError(err) } };
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
