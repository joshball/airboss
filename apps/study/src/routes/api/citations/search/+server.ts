import { requireAuth } from '@ab/auth';
import {
	type RegulationSearchResult,
	searchAcReferences,
	searchKnowledgeNodes,
	searchRegulationNodes,
} from '@ab/bc-citations';
import { CITATION_TARGET_TYPES, type CitationTargetType } from '@ab/constants';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Citation picker search endpoint. Reads `target` + `q` from the query
 * string and dispatches to the per-target-type search helper in
 * `@ab/bc-citations`. Returns `{ results: RegulationSearchResult[] }`.
 *
 * External refs are not searched (the picker collects URL + title inline),
 * so the endpoint returns an empty result set for them.
 */
export const GET: RequestHandler = async (event) => {
	// Auth gate: only the owning user should be issuing citation searches.
	requireAuth(event);

	const url = event.url;
	const target = url.searchParams.get('target');
	const q = url.searchParams.get('q') ?? '';

	if (!target) throw error(400, 'missing target');

	let results: RegulationSearchResult[] = [];
	switch (target as CitationTargetType) {
		case CITATION_TARGET_TYPES.REGULATION_NODE:
			results = await searchRegulationNodes(q);
			break;
		case CITATION_TARGET_TYPES.AC_REFERENCE:
			results = await searchAcReferences(q);
			break;
		case CITATION_TARGET_TYPES.KNOWLEDGE_NODE:
			results = await searchKnowledgeNodes(q);
			break;
		case CITATION_TARGET_TYPES.EXTERNAL_REF:
			// External refs: caller types URL + title inline; no server search.
			results = [];
			break;
		default:
			throw error(400, 'invalid target');
	}

	return json({ results });
};
