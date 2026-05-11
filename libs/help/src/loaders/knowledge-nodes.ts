// @browser-globals: server-only -- never imported by client .svelte
/**
 * Knowledge-nodes loader (DB-backed). Walks `study.knowledge_node` matching
 * `id` (slug) + `title` + the FTS-soft `content_md` body. Returns
 * `airboss.knode` rows for the Airboss Content column.
 *
 * Knowledge is small (tens of nodes) so an ilike scan is adequate; the
 * existing `searchKnowledgeNodes` primitive in
 * `libs/bc/study/src/citations/search.ts` runs the same shape for the citation
 * picker. The palette adds body matching so a learner can land on the right
 * node from a phrase inside the discovery walk.
 *
 * Server-only -- imports `@ab/db/connection`.
 */

import { knowledgeNode } from '@ab/bc-study';
import { ROUTES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { ilike, or } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, RankBucket, SearchResult } from '../schema/result-types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

const LOADER_LIMIT = 30;

function bucketFor(needle: string, id: string, title: string): RankBucket {
	if (needle.length === 0) return 4;
	const n = needle.toLowerCase();
	if (id.toLowerCase() === n) return 1;
	if (title.toLowerCase() === n) return 1;
	if (id.toLowerCase().startsWith(n)) return 2;
	if (title.toLowerCase().startsWith(n)) return 2;
	if (title.toLowerCase().includes(n) || id.toLowerCase().includes(n)) return 3;
	return 5;
}

function escapePattern(s: string): string {
	return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function bodySnippet(body: string, needle: string): string {
	if (body.length === 0) return '';
	const idx = needle.length > 0 ? body.toLowerCase().indexOf(needle.toLowerCase()) : -1;
	const start = idx < 0 ? 0 : Math.max(0, idx - 30);
	const end = Math.min(body.length, start + 140);
	const slice = body.slice(start, end).replace(/\s+/g, ' ').trim();
	return start === 0 ? slice : `…${slice}`;
}

export async function loadKnowledgeNodes(
	parsed: ParsedQuery,
	host: PaletteHost,
	db: Db = defaultDb,
): Promise<readonly SearchResult[]> {
	void host;
	const needle = parsed.freeText.trim();
	if (needle.length === 0) return [];

	const pattern = `%${escapePattern(needle)}%`;
	const rows = await db
		.select({
			id: knowledgeNode.id,
			title: knowledgeNode.title,
			domain: knowledgeNode.domain,
			contentMd: knowledgeNode.contentMd,
		})
		.from(knowledgeNode)
		.where(
			or(
				ilike(knowledgeNode.id, pattern),
				ilike(knowledgeNode.title, pattern),
				ilike(knowledgeNode.contentMd, pattern),
			),
		)
		.orderBy(knowledgeNode.title)
		.limit(LOADER_LIMIT);

	const out: SearchResult[] = [];
	for (const r of rows) {
		const result: SearchResult = {
			id: r.id,
			type: 'airboss.knode',
			title: r.title,
			subtitle: `Knowledge - ${r.domain}`,
			snippet: bodySnippet(r.contentMd, needle),
			href: ROUTES.REFERENCE_KNOWLEDGE_SLUG(r.id),
			rankBucket: bucketFor(needle, r.id, r.title),
		};
		out.push(result);
	}
	return out;
}
