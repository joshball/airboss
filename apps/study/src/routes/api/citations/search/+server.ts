import { requireAuth } from '@ab/auth';
import {
	type KnowledgeNodeSearchResult,
	type SectionSearchResult,
	searchKnowledgeNodes,
	searchReferenceSections,
} from '@ab/bc-study';
import {
	CITATION_SEARCH_QUERY_MAX_LENGTH,
	CITATION_TARGET_TYPES,
	type CitationTargetType,
	QUERY_PARAMS,
} from '@ab/constants';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Citation picker search endpoint. Reads `target` + `q` from the query
 * string and dispatches to the per-target-type search helper in the
 * bc-study citations module. The polymorphic `reference_section` target
 * type covers every corpus-backed citation (CFR / handbook / AC / ACS /
 * AIM / NTSB / SAFO / InFO) via one search box. External refs are not
 * searched (the picker collects URL + title inline) so the endpoint
 * returns an empty result set for them.
 */
export const GET: RequestHandler = async (event) => {
	// Auth gate: only the owning user should be issuing citation searches.
	requireAuth(event);

	const url = event.url;
	const target = url.searchParams.get(QUERY_PARAMS.TARGET);
	// Cap query length so a logged-in caller cannot force the BC into
	// a multi-MB LIKE scan by passing an oversized `q`. Trim incidental
	// whitespace so the BC's substring match isn't anchored on spaces.
	const q = (url.searchParams.get(QUERY_PARAMS.SEARCH) ?? '').trim().slice(0, CITATION_SEARCH_QUERY_MAX_LENGTH);

	if (!target) throw error(400, 'missing target');

	let results: SectionSearchResult[] | KnowledgeNodeSearchResult[] = [];
	switch (target as CitationTargetType) {
		case CITATION_TARGET_TYPES.REFERENCE_SECTION:
			results = await searchReferenceSections(q);
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
