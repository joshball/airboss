import { requireRole } from '@ab/auth';
import { ROLES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { getUser, listRecentUserAudits, listRecentUserSessions } from '$lib/server/users';
import type { PageServerLoad } from './$types';

/**
 * Read-only detail view for a single user. Shows the basic identity card,
 * the most recent N sessions (id + ip + ua + timestamps), and the
 * most recent M audit rows the user authored. No edit affordances yet.
 *
 * Gated to ADMIN-only -- matches the floor on `/users`. User session +
 * audit data is sensitive enough that AUTHOR/OPERATOR roles shouldn't
 * see it. The session token is NEVER shipped client-side; the row id
 * is the handle for any future revoke action.
 */
export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.ADMIN);

	const userId = event.params.id;
	const user = await getUser(userId);
	if (!user) error(404, 'User not found');

	const [sessions, audits] = await Promise.all([listRecentUserSessions(userId), listRecentUserAudits(userId)]);

	return {
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			banned: user.banned,
			createdAt: user.createdAt.toISOString(),
			updatedAt: user.updatedAt.toISOString(),
			lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
		},
		sessions: sessions.map((s) => ({
			id: s.id,
			ipAddress: s.ipAddress,
			userAgent: s.userAgent,
			createdAt: s.createdAt.toISOString(),
			expiresAt: s.expiresAt.toISOString(),
		})),
		audits: audits.map((a) => ({
			id: a.id,
			timestamp: a.timestamp.toISOString(),
			op: a.op,
			targetType: a.targetType,
			targetId: a.targetId,
		})),
	};
};
