/**
 * `/docs/search.json` -- typeahead JSON endpoint for the docs search box.
 * Reads `?q=...`, runs `searchDocs()`, returns hits as JSON.
 *
 * Auth: same `(app)` role gate as every other hangar page (re-checked here
 * because `+server.ts` endpoints don't walk the layout load).
 *
 * Cache: short `cache-control: private, max-age=N` so the typeahead burst
 * window reuses recent responses (the server endpoint is the one piece of
 * the surface that benefits from a tiny browser-side cache; navigation
 * through the same query within the burst window goes to memory).
 */

import { requireRole } from '@ab/auth';
import { searchDocs } from '@ab/bc-hangar/server';
import { DOCS_SEARCH_CACHE_MAX_AGE_S, ROLES } from '@ab/constants';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const q = event.url.searchParams.get('q') ?? '';
	const hits = await searchDocs(q);
	return json(
		{ hits },
		{
			headers: {
				'cache-control': `private, max-age=${DOCS_SEARCH_CACHE_MAX_AGE_S}`,
			},
		},
	);
};
