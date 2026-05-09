/**
 * Postgres FTS-backed search over `hangar.docs_search_index`.
 *
 * The loader (review-loader.ts) populates `(path, title, body, frontmatter)`
 * for every `.md` file under `DOCS_SEARCH_ROOTS`. Postgres maintains the
 * `tsv` generated column (setweight A on title, B on body) + a GIN index;
 * this BC layer wraps `plainto_tsquery` + `ts_rank` + `ts_headline` so the
 * `/docs` search box can query without writing raw SQL on the page.
 *
 * Quoting policy: `plainto_tsquery` already sanitises arbitrary user input
 * by treating each token as a separate AND-ed term. We trim and clamp the
 * query to `DOCS_SEARCH_MAX_QUERY_LEN` characters so a malicious / accidental
 * megabyte query doesn't blow up planning time.
 *
 * Snippet safety: `ts_headline` does not HTML-escape body content -- it
 * splices the configured StartSel/StopSel markers into the raw text. A
 * markdown body that contains literal `<` / `>` (code samples, ADR snippets)
 * would otherwise emit live HTML when the client `{@html}`s the snippet,
 * which is an XSS hazard. We make `ts_headline` mark up the body with a
 * sentinel pair, then HTML-escape the result + replace the sentinels with
 * safe `<mark>` tags. The contract returned to the client is then literally:
 * "only `<mark>` / `</mark>` survive; everything else is text".
 */

import { DOCS_SEARCH_HEADLINE_BYTES, DOCS_SEARCH_LIMIT, DOCS_SEARCH_MAX_QUERY_LEN } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { hangarDocsSearchIndex } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Sentinels chosen so they cannot occur in extractor output. Replaced with
 * real `<mark>` / `</mark>` tags after `escapeHtml` runs. Exported for tests
 * that round-trip the contract end-to-end. */
export const MARK_OPEN_SENTINEL = 'MARK_OPEN';
export const MARK_CLOSE_SENTINEL = 'MARK_CLOSE';

const HTML_ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/**
 * Apply the post-process: HTML-escape any literal markup that survived
 * `ts_headline`, then convert the sentinel pair back into real `<mark>` tags.
 * Result is HTML-safe but still preserves the highlight markers the client
 * styles in `.hit-snippet :global(mark)`. Exported for tests.
 */
export function safelyMarkSnippet(raw: string): string {
	return escapeHtml(raw).replaceAll(MARK_OPEN_SENTINEL, '<mark>').replaceAll(MARK_CLOSE_SENTINEL, '</mark>');
}

export interface DocsSearchHit {
	readonly path: string;
	readonly title: string;
	/** HTML-bracket-marked snippet from `ts_headline`, post-escaped so only
	 * `<mark>` / `</mark>` are live HTML. Safe to `{@html}` on the client. */
	readonly snippet: string;
	readonly rank: number;
}

/**
 * Run a docs FTS query. Empty / whitespace-only queries return `[]`
 * immediately (no DB round-trip). Query is trimmed + length-clamped before
 * the call so a maliciously long input cannot reach the planner.
 *
 * Results are ranked by `ts_rank_cd(tsv, query)` descending and capped at
 * `DOCS_SEARCH_LIMIT` (or the caller-supplied limit, whichever is smaller).
 *
 * Implementation: `ts_headline` runs against a body slice
 * (`DOCS_SEARCH_HEADLINE_BYTES`) so a 658 KB regulation file doesn't blow
 * the typeahead budget. Postgres folds `IMMUTABLE` `plainto_tsquery` calls
 * in the planner so repeating it across SELECT/WHERE/ORDER BY is free.
 */
export async function searchDocs(
	rawQuery: string,
	options: { limit?: number } = {},
	db: Db = defaultDb,
): Promise<readonly DocsSearchHit[]> {
	const query = rawQuery.trim().slice(0, DOCS_SEARCH_MAX_QUERY_LEN);
	if (query === '') return [];
	const limit = Math.max(1, Math.min(options.limit ?? DOCS_SEARCH_LIMIT, DOCS_SEARCH_LIMIT));
	const tsv = hangarDocsSearchIndex.tsv;
	const path = hangarDocsSearchIndex.path;
	const title = hangarDocsSearchIndex.title;
	const body = hangarDocsSearchIndex.body;
	const headlineConfig = `StartSel=${MARK_OPEN_SENTINEL}, StopSel=${MARK_CLOSE_SENTINEL}, MaxWords=24, MinWords=10, ShortWord=3, MaxFragments=2`;
	const result = await db
		.select({
			path,
			title,
			snippet: sql<string>`
				ts_headline(
					'english',
					substring(${body}, 1, ${DOCS_SEARCH_HEADLINE_BYTES}),
					plainto_tsquery('english', ${query}),
					${headlineConfig}
				)
			`,
			rank: sql<number>`ts_rank_cd(${tsv}, plainto_tsquery('english', ${query}))`,
		})
		.from(hangarDocsSearchIndex)
		.where(sql`${tsv} @@ plainto_tsquery('english', ${query})`)
		.orderBy(sql`ts_rank_cd(${tsv}, plainto_tsquery('english', ${query})) DESC`)
		.limit(limit);
	// Sanitise snippets server-side so the client `{@html}` contract is
	// "only `<mark>` survives; everything else is HTML-escaped text".
	return result.map((row) => ({
		path: row.path,
		title: row.title,
		snippet: safelyMarkSnippet(row.snippet),
		rank: row.rank,
	}));
}

/** Count rows in the docs index. Used by the empty-state UI to surface
 * "Index not built -- run loader" when zero. At current scale a `count(*)`
 * is the fastest path Postgres has for this question; if the index ever
 * grows past ~1M rows, switch to `SELECT EXISTS (SELECT 1 ...)` -- the
 * landing page only needs the boolean. */
export async function countDocsIndex(db: Db = defaultDb): Promise<number> {
	const rows = await db.select({ count: sql<number>`count(*)::int` }).from(hangarDocsSearchIndex);
	return rows[0]?.count ?? 0;
}

/**
 * Read a single doc body + frontmatter from the FTS index. The loader is
 * authoritative for `(body, frontmatter)`, so the `/docs/[...path]` page can
 * read from one indexed lookup instead of going to the filesystem on every
 * navigation. Returns `null` when the path is not in the index.
 */
export async function readIndexedDoc(
	repoRelPath: string,
	db: Db = defaultDb,
): Promise<{ readonly body: string; readonly frontmatter: Record<string, string> } | null> {
	const rows = await db
		.select({ body: hangarDocsSearchIndex.body, frontmatter: hangarDocsSearchIndex.frontmatter })
		.from(hangarDocsSearchIndex)
		.where(sql`${hangarDocsSearchIndex.path} = ${repoRelPath}`)
		.limit(1);
	const row = rows[0];
	if (!row) return null;
	const fmRaw = row.frontmatter;
	const fm: Record<string, string> = {};
	if (fmRaw && typeof fmRaw === 'object' && !Array.isArray(fmRaw)) {
		for (const [k, v] of Object.entries(fmRaw as Record<string, unknown>)) {
			if (typeof v === 'string') fm[k] = v;
			else if (typeof v === 'number' || typeof v === 'boolean') fm[k] = String(v);
		}
	}
	return { body: row.body, frontmatter: fm };
}
