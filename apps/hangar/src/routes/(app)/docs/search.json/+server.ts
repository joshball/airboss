/**
 * `/docs/search.json` -- typeahead JSON endpoint for the docs search box.
 * Reads `?q=...`, runs `searchDocs()`, returns hits as JSON.
 *
 * Auth: same `(app)` role gate as every other hangar page (re-checked here
 * because `+server.ts` endpoints don't walk the layout load).
 */

import { requireRole } from '@ab/auth';
import { searchDocs } from '@ab/bc-hangar';
import { ROLES } from '@ab/constants';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const q = event.url.searchParams.get('q') ?? '';
	const hits = await searchDocs(q);
	return json({ hits });
};
