import { requireRole } from '@ab/auth';
import {
	type AdminAuthApi,
	BanUserInputSchema,
	BetterAuthApiError,
	banUserAction,
	getUser,
	LastAdminError,
	listRecentUserAudits,
	listRecentUserSessions,
	RevokeAllUserSessionsInputSchema,
	RevokeUserSessionInputSchema,
	revokeAllUserSessions,
	revokeUserSession,
	SelfTargetForbiddenError,
	SetUserRoleInputSchema,
	setUserRole,
	UnbanUserInputSchema,
	unbanUserAction,
} from '@ab/bc-hangar';
import { ROLES, ROUTES, type Role } from '@ab/constants';
import { error, fail, type RequestEvent, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

/**
 * Better-auth's admin plugin types its `setRole` body with the plugin's
 * default role union (`'admin' | 'user'`). Our app uses a richer
 * `Role` union and configures the plugin with custom roles, so the
 * runtime accepts what we send. The cast bridges the type gap.
 */
const authApi = auth.api as unknown as AdminAuthApi;

/**
 * Read-only detail view for a single user, plus the five admin-write
 * form actions that mutate `bauth_user`.
 *
 * Gated to ADMIN-only -- matches the floor on `/users`. User session +
 * audit data is sensitive enough that AUTHOR/OPERATOR roles shouldn't
 * see it. The session token is NEVER shipped client-side; the row id
 * is the handle the form actions use to look up the token server-side.
 *
 * Every form action posts an audit row AFTER better-auth's admin plugin
 * call returns successfully -- if better-auth throws, no audit row.
 * See decisions (a)-(j) in docs/work-packages/hangar-users-editing/spec.md.
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
			banReason: user.banReason,
			banExpires: user.banExpires?.toISOString() ?? null,
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

/**
 * Map a thrown BC error into a SvelteKit `fail()` response. Self-target,
 * last-admin, not-found, and admin-plugin failures are 409; Zod validation
 * is 400. Anything else re-throws so the SvelteKit error handler logs it.
 */
function failFromError(err: unknown): ReturnType<typeof fail> {
	if (err instanceof SelfTargetForbiddenError) {
		return fail(409, { error: err.message });
	}
	if (err instanceof LastAdminError) {
		return fail(409, { error: err.message });
	}
	if (err instanceof BetterAuthApiError) {
		return fail(409, { error: err.message });
	}
	throw err;
}

/**
 * Common request-shaped extras (requestId, user-agent, actor identity)
 * threaded into every BC write so the audit row carries the same context
 * as a sibling write from a different surface.
 */
function buildActorContext(event: RequestEvent) {
	const session = event.locals.session;
	const user = event.locals.user;
	if (!session || !user) {
		throw error(401, 'Not signed in');
	}
	return {
		actorId: user.id,
		actorEmail: user.email,
		currentSessionId: session.id,
		requestId: event.locals.requestId ?? null,
		userAgent: event.request.headers.get('user-agent'),
		headers: event.request.headers,
	};
}

export const actions: Actions = {
	setRole: async (event) => {
		requireRole(event, ROLES.ADMIN);
		const ctx = buildActorContext(event);
		const formData = await event.request.formData();

		const parsed = SetUserRoleInputSchema.safeParse({
			targetUserId: formData.get('targetUserId'),
			newRole: formData.get('newRole'),
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid input' });
		}

		try {
			await setUserRole({
				auth: { api: authApi },
				actorId: ctx.actorId,
				actorEmail: ctx.actorEmail,
				targetUserId: parsed.data.targetUserId,
				newRole: parsed.data.newRole as Role,
				headers: ctx.headers,
				requestId: ctx.requestId,
				userAgent: ctx.userAgent,
			});
		} catch (err) {
			return failFromError(err);
		}

		return { ok: true, op: 'set-role' as const };
	},

	ban: async (event) => {
		requireRole(event, ROLES.ADMIN);
		const ctx = buildActorContext(event);
		const formData = await event.request.formData();

		const parsed = BanUserInputSchema.safeParse({
			targetUserId: formData.get('targetUserId'),
			reason: formData.get('reason'),
			expiresAt: formData.get('expiresAt'),
			confirmEmail: formData.get('confirmedTarget') ?? formData.get('confirmEmail'),
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid input' });
		}

		const target = await getUser(parsed.data.targetUserId);
		if (!target) return fail(404, { error: 'User not found' });
		if (parsed.data.confirmEmail !== target.email) {
			return fail(400, { error: 'Typed confirmation does not match the user email' });
		}

		try {
			await banUserAction({
				auth: { api: authApi },
				actorId: ctx.actorId,
				actorEmail: ctx.actorEmail,
				targetUserId: parsed.data.targetUserId,
				reason: parsed.data.reason,
				expiresAt: parsed.data.expiresAt ?? null,
				headers: ctx.headers,
				requestId: ctx.requestId,
				userAgent: ctx.userAgent,
			});
		} catch (err) {
			return failFromError(err);
		}

		return { ok: true, op: 'ban' as const };
	},

	unban: async (event) => {
		requireRole(event, ROLES.ADMIN);
		const ctx = buildActorContext(event);
		const formData = await event.request.formData();

		const parsed = UnbanUserInputSchema.safeParse({
			targetUserId: formData.get('targetUserId'),
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid input' });
		}

		try {
			await unbanUserAction({
				auth: { api: authApi },
				actorId: ctx.actorId,
				actorEmail: ctx.actorEmail,
				targetUserId: parsed.data.targetUserId,
				headers: ctx.headers,
				requestId: ctx.requestId,
				userAgent: ctx.userAgent,
			});
		} catch (err) {
			return failFromError(err);
		}

		return { ok: true, op: 'unban' as const };
	},

	revokeSession: async (event) => {
		requireRole(event, ROLES.ADMIN);
		const ctx = buildActorContext(event);
		const formData = await event.request.formData();

		const parsed = RevokeUserSessionInputSchema.safeParse({
			targetUserId: formData.get('targetUserId'),
			sessionId: formData.get('sessionId'),
			confirmEmail: formData.get('confirmedTarget') ?? formData.get('confirmEmail'),
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid input' });
		}

		const target = await getUser(parsed.data.targetUserId);
		if (!target) return fail(404, { error: 'User not found' });
		if (parsed.data.confirmEmail !== target.email) {
			return fail(400, { error: 'Typed confirmation does not match the user email' });
		}

		try {
			await revokeUserSession({
				auth: { api: authApi },
				actorId: ctx.actorId,
				actorEmail: ctx.actorEmail,
				targetUserId: parsed.data.targetUserId,
				sessionId: parsed.data.sessionId,
				headers: ctx.headers,
				requestId: ctx.requestId,
				userAgent: ctx.userAgent,
			});
		} catch (err) {
			return failFromError(err);
		}

		// If the admin just revoked their own current session, redirect to login.
		if (parsed.data.sessionId === ctx.currentSessionId) {
			throw redirect(303, ROUTES.LOGIN);
		}

		return { ok: true, op: 'revoke-session' as const };
	},

	revokeAllSessions: async (event) => {
		requireRole(event, ROLES.ADMIN);
		const ctx = buildActorContext(event);
		const formData = await event.request.formData();

		const parsed = RevokeAllUserSessionsInputSchema.safeParse({
			targetUserId: formData.get('targetUserId'),
			confirmEmail: formData.get('confirmedTarget') ?? formData.get('confirmEmail'),
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid input' });
		}

		const target = await getUser(parsed.data.targetUserId);
		if (!target) return fail(404, { error: 'User not found' });
		if (parsed.data.confirmEmail !== target.email) {
			return fail(400, { error: 'Typed confirmation does not match the user email' });
		}

		let result: { revokedCount: number; revokedOwn: boolean };
		try {
			result = await revokeAllUserSessions({
				auth: { api: authApi },
				actorId: ctx.actorId,
				actorEmail: ctx.actorEmail,
				targetUserId: parsed.data.targetUserId,
				currentSessionId: ctx.currentSessionId,
				headers: ctx.headers,
				requestId: ctx.requestId,
				userAgent: ctx.userAgent,
			});
		} catch (err) {
			return failFromError(err);
		}

		// Bulk revoke that included the calling admin's session -> bounce to /login.
		if (result.revokedOwn) {
			throw redirect(303, ROUTES.LOGIN);
		}

		return { ok: true, op: 'revoke-all-sessions' as const, revokedCount: result.revokedCount };
	},
};
