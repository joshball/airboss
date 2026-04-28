import { requireRole } from '@ab/auth';
import { countUsersByRole, listUsers, USERS_LIST_LIMIT } from '@ab/bc-hangar';
import { QUERY_PARAMS, ROLES } from '@ab/constants';
import type { PageServerLoad } from './$types';

/**
 * Read-only users directory. Lists every `bauth_user` with a `lastSeenAt`
 * derived from `bauth_session`. Search (by name or email) runs server-
 * side via Drizzle `ilike` -- same pattern as `/glossary`.
 *
 * Gated to ADMIN-only. The parent `(app)/+layout.server.ts` allows
 * AUTHOR | OPERATOR | ADMIN, but user data is more sensitive than
 * reference content so this surface narrows the floor.
 */
export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.ADMIN);
	const search = event.url.searchParams.get(QUERY_PARAMS.SEARCH)?.trim() ?? '';

	const [users, roleCounts] = await Promise.all([
		listUsers({ search: search || undefined }),
		countUsersByRole({ search: search || undefined }),
	]);

	return {
		users: users.map((u) => ({
			id: u.id,
			email: u.email,
			name: u.name,
			role: u.role,
			banned: u.banned,
			createdAt: u.createdAt.toISOString(),
			lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
		})),
		roleCounts,
		filters: { search },
		limit: USERS_LIST_LIMIT,
		/**
		 * `true` when the result set was capped by the hard limit. UI shows
		 * a "showing first N" hint so the operator knows the list is not
		 * complete. Real pagination is the obvious follow-up; today's
		 * hangar authoring set fits comfortably under the cap.
		 */
		truncated: users.length === USERS_LIST_LIMIT,
	};
};
