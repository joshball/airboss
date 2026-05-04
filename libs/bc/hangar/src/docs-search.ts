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
 * query to `DOCS_SEARCH_MAX_LEN` characters so a malicious / accidental
 * megabyte query doesn't blow up planning time.
 */

import { DOCS_SEARCH_LIMIT } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { hangarDocsSearchIndex } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Max characters accepted in a single `searchDocs` query. Defends against
 * accidental paste of an entire document. */
const DOCS_SEARCH_MAX_LEN = 200;

export interface DocsSearchHit {
	readonly path: string;
	readonly title: string;
	/** HTML-bracket-marked snippet from `ts_headline`. */
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
 */
export async function searchDocs(
	rawQuery: string,
	options: { limit?: number } = {},
	db: Db = defaultDb,
): Promise<readonly DocsSearchHit[]> {
	const query = rawQuery.trim().slice(0, DOCS_SEARCH_MAX_LEN);
	if (query === '') return [];
	const limit = Math.max(1, Math.min(options.limit ?? DOCS_SEARCH_LIMIT, DOCS_SEARCH_LIMIT));
	const tsv = hangarDocsSearchIndex.tsv;
	const path = hangarDocsSearchIndex.path;
	const title = hangarDocsSearchIndex.title;
	const body = hangarDocsSearchIndex.body;
	const result = await db
		.select({
			path,
			title,
			snippet: sql<string>`
				ts_headline(
					'english',
					${body},
					plainto_tsquery('english', ${query}),
					'StartSel=<mark>, StopSel=</mark>, MaxWords=24, MinWords=10, ShortWord=3, MaxFragments=2'
				)
			`,
			rank: sql<number>`ts_rank_cd(${tsv}, plainto_tsquery('english', ${query}))`,
		})
		.from(hangarDocsSearchIndex)
		.where(sql`${tsv} @@ plainto_tsquery('english', ${query})`)
		.orderBy(sql`ts_rank_cd(${tsv}, plainto_tsquery('english', ${query})) DESC`)
		.limit(limit);
	return result;
}

/** Count rows in the docs index. Used by the empty-state UI to surface
 * "Index not built -- run loader" when zero. */
export async function countDocsIndex(db: Db = defaultDb): Promise<number> {
	const rows = await db.select({ count: sql<number>`count(*)::int` }).from(hangarDocsSearchIndex);
	return rows[0]?.count ?? 0;
}
