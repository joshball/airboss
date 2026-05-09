/**
 * JSON endpoint for the audit-explorer actor typeahead.
 *
 * GET `/api/audit-actors?q=<term>` returns up to AUDIT_ACTOR_SEARCH_LIMIT
 * matching `bauth_user` rows (id + name + email). Used by the
 * `/admin/audit` filter bar to resolve a free-text actor search to a
 * concrete user id, which is the value that survives in the URL
 * (`?actor=<id>`).
 *
 * ADMIN-only. The (app) layout already gates AUTHOR | OPERATOR | ADMIN;
 * raw user-id discovery for audit lookups should not leak below the same
 * floor as the audit data itself.
 *
 * Lives under `/api/` (sibling of `/admin/`) rather than nested under
 * `/admin/audit/` so the dynamic `/admin/audit/[id]` detail route has
 * no static-segment shadow.
 */

import { requireRole } from '@ab/auth';
import { searchActorIds } from '@ab/bc-hangar/server';
import { QUERY_PARAMS, ROLES } from '@ab/constants';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	requireRole(event, ROLES.ADMIN);
	const term = event.url.searchParams.get(QUERY_PARAMS.SEARCH);
	const hits = await searchActorIds(term);
	return json({
		results: hits.map((h) => ({ id: h.id, name: h.name, email: h.email })),
	});
};
