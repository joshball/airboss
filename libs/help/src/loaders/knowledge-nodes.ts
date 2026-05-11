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
import { ilike, or, type SQL } from 'drizzle-orm';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, SearchResult } from '../schema/result-types';
import { bodySnippet, bucketByMatch, buildIlikePattern, type LoaderDb, MIN_BODY_NEEDLE_LENGTH } from './_shared';

const LOADER_LIMIT = 30;

export async function loadKnowledgeNodes(
	parsed: ParsedQuery,
	host: PaletteHost,
	db: LoaderDb = defaultDb,
): Promise<readonly SearchResult[]> {
	void host;
	const needle = parsed.freeText.trim();
	if (needle.length === 0) return [];

	const pattern = buildIlikePattern(needle);
	const fieldMatches: SQL[] = [ilike(knowledgeNode.id, pattern), ilike(knowledgeNode.title, pattern)];
	if (needle.length >= MIN_BODY_NEEDLE_LENGTH) {
		fieldMatches.push(ilike(knowledgeNode.contentMd, pattern));
	}

	const rows = await db
		.select({
			id: knowledgeNode.id,
			title: knowledgeNode.title,
			domain: knowledgeNode.domain,
			contentMd: knowledgeNode.contentMd,
		})
		.from(knowledgeNode)
		.where(or(...fieldMatches))
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
			rankBucket: bucketByMatch(needle, r.id, r.title),
		};
		out.push(result);
	}
	return out;
}
