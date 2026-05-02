/**
 * BC write helpers for the user-detail editing surface (`/users/[id]`).
 *
 * Sibling to read-only `users.ts`. Each helper:
 *
 *   1. Runs guard checks (self-target, last-admin) before mutating
 *   2. Reads a pre-snapshot of the columns the op will touch
 *   3. Calls the better-auth admin plugin (the source of truth for
 *      `bauth_user` and `bauth_session` mutations)
 *   4. Reads a post-snapshot
 *   5. Emits one `audit_log` row with `before` / `after` / `metadata.subKind`
 *
 * Better-auth runs its own admin-plugin gate (verifies the caller is an
 * admin via the request headers). The form action also runs the per-page
 * `requireRole(ADMIN)` gate. Belt-and-suspenders.
 *
 * See `docs/work-packages/hangar-users-editing/spec.md`.
 */

import { AUDIT_OPS, auditWrite } from '@ab/audit';
import { bauthSession, bauthUser } from '@ab/auth';
import { AUDIT_TARGETS, HANGAR_USER_OP_SUBKINDS, type HangarUserOpSubkind, ROLES, type Role } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { countUserSessions, countUsersByRole, getUser, hasUserSessionWithId, type UserDirectoryRow } from './users';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/**
 * Kinds of self-target the guard distinguishes. Self-targeting on
 * session-revoke (single + bulk) is allowed -- killing your own stale
 * device is a real use case. Self set-role and self ban are blocked.
 */
export type SelfTargetGuardOp = 'set-role' | 'ban';

/** Thrown when an admin tries to set their own role or ban themselves. */
export class SelfTargetForbiddenError extends Error {
	constructor(public readonly op: SelfTargetGuardOp) {
		const verb = op === 'set-role' ? 'change your own role' : 'ban yourself';
		super(`Cannot ${verb}.`);
		this.name = 'SelfTargetForbiddenError';
	}
}

/** Thrown when a role change would leave the system with zero admins. */
export class LastAdminError extends Error {
	constructor() {
		super('Cannot demote the last admin.');
		this.name = 'LastAdminError';
	}
}

/**
 * Wrapper around the admin plugin's thrown error so the form action can
 * map it to a 409 fail without leaking better-auth internals. The
 * underlying message comes through unchanged for the user.
 */
export class BetterAuthApiError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = 'BetterAuthApiError';
	}
}

/** Hard-blocks self role-change and self-ban. */
export function assertSelfTargetAllowed(input: { actorId: string; targetUserId: string; op: SelfTargetGuardOp }): void {
	if (input.actorId === input.targetUserId) {
		throw new SelfTargetForbiddenError(input.op);
	}
}

/**
 * Refuses a role change that would leave zero admins. Runs:
 *
 *   - If `newRole === ADMIN`: never fails (promotion can't strip admins).
 *   - Else: read target's current role; if not currently admin, no-op
 *     (the change isn't a demotion).
 *   - Else: count the admin tally; if `<= 1`, throw.
 *
 * Counts are read inside the same call so a concurrent demotion is best-
 * effort detected; a hard guarantee against the simultaneous-demote race
 * is deferred to a serializable-tx mitigation if/when the bug surfaces.
 */
export async function assertNotLastAdmin(input: { targetUserId: string; newRole: Role; db?: Db }): Promise<void> {
	const db = input.db ?? defaultDb;
	if (input.newRole === ROLES.ADMIN) return;
	const target = await getUser(input.targetUserId, db);
	if (!target || target.role !== ROLES.ADMIN) return;
	const counts = await countUsersByRole({}, db);
	if (counts.admin <= 1) {
		throw new LastAdminError();
	}
}

/** Snapshot helpers -- export only the touched columns into the audit row. */
export type RoleSnapshot = { role: Role | null };
export type BanSnapshot = {
	banned: boolean;
	banReason: string | null;
	banExpires: Date | null;
};

export type AuditMetaCommon = {
	requestId: string | null;
	userAgent: string | null;
	actorEmail: string;
	subKind: HangarUserOpSubkind;
};

/** Build the common audit metadata block from a request-shaped input. */
export function buildAuditMeta(input: {
	requestId: string | null;
	userAgent: string | null;
	actorEmail: string;
	subKind: HangarUserOpSubkind;
	extras?: Record<string, unknown>;
}): AuditMetaCommon & Record<string, unknown> {
	return {
		requestId: input.requestId,
		userAgent: input.userAgent,
		actorEmail: input.actorEmail,
		subKind: input.subKind,
		...(input.extras ?? {}),
	};
}

/* ----------------------------------------------------------------------------
 * Better-auth admin-plugin call surface (typed shim).
 *
 * The BC accepts an `auth` object that exposes the admin-plugin endpoints.
 * The shim type lets the unit tests mock the surface without dragging in the
 * full better-auth types; production callers pass the real `auth` instance
 * from `apps/hangar/src/lib/server/auth.ts`.
 * -------------------------------------------------------------------------- */

export interface AdminAuthApi {
	setRole(args: { body: { userId: string; role: Role }; headers: Headers }): Promise<unknown>;
	banUser(args: {
		body: { userId: string; banReason?: string; banExpiresIn?: number };
		headers: Headers;
	}): Promise<unknown>;
	unbanUser(args: { body: { userId: string }; headers: Headers }): Promise<unknown>;
	revokeUserSession(args: { body: { sessionToken: string }; headers: Headers }): Promise<unknown>;
	revokeUserSessions(args: { body: { userId: string }; headers: Headers }): Promise<unknown>;
}

export interface AdminAuthBundle {
	api: AdminAuthApi;
}

/** Wrap any thrown error from the admin plugin in our typed wrapper. */
async function callAdmin<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Better-auth admin call failed';
		throw new BetterAuthApiError(message, err);
	}
}

/* ----------------------------------------------------------------------------
 * Write helpers
 * -------------------------------------------------------------------------- */

export interface SetUserRoleInput {
	auth: AdminAuthBundle;
	actorId: string;
	actorEmail: string;
	targetUserId: string;
	newRole: Role;
	headers: Headers;
	requestId: string | null;
	userAgent: string | null;
}

/** Set the target user's `role` column via better-auth. Audits the result. */
export async function setUserRole(input: SetUserRoleInput, db: Db = defaultDb): Promise<{ user: UserDirectoryRow }> {
	assertSelfTargetAllowed({ actorId: input.actorId, targetUserId: input.targetUserId, op: 'set-role' });
	await assertNotLastAdmin({ targetUserId: input.targetUserId, newRole: input.newRole, db });

	const before = await getUser(input.targetUserId, db);
	if (!before) {
		throw new BetterAuthApiError(`User ${input.targetUserId} not found.`);
	}

	await callAdmin(() =>
		input.auth.api.setRole({
			body: { userId: input.targetUserId, role: input.newRole },
			headers: input.headers,
		}),
	);

	const after = await getUser(input.targetUserId, db);
	if (!after) {
		throw new BetterAuthApiError(`User ${input.targetUserId} not found after role assignment.`);
	}

	await auditWrite(
		{
			actorId: input.actorId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.HANGAR_USER,
			targetId: input.targetUserId,
			before: { role: before.role } satisfies RoleSnapshot,
			after: { role: after.role } satisfies RoleSnapshot,
			metadata: buildAuditMeta({
				requestId: input.requestId,
				userAgent: input.userAgent,
				actorEmail: input.actorEmail,
				subKind: HANGAR_USER_OP_SUBKINDS.ROLE_ASSIGN,
			}),
		},
		db,
	);

	return { user: after };
}

export interface BanUserActionInput {
	auth: AdminAuthBundle;
	actorId: string;
	actorEmail: string;
	targetUserId: string;
	reason: string;
	expiresAt?: Date | null;
	headers: Headers;
	requestId: string | null;
	userAgent: string | null;
}

/**
 * Read the columns the ban op touches into the audit-row before snapshot.
 * Better-auth's table is the source of truth, so we read directly via
 * Drizzle. The `users.ts` helpers don't expose `banReason` / `banExpires`
 * (the directory page doesn't surface them), so this is a tighter read.
 */
async function readBanSnapshot(targetUserId: string, db: Db): Promise<BanSnapshot> {
	const [row] = await db
		.select({
			banned: bauthUser.banned,
			banReason: bauthUser.banReason,
			banExpires: bauthUser.banExpires,
		})
		.from(bauthUser)
		.where(eq(bauthUser.id, targetUserId))
		.limit(1);
	if (!row) {
		throw new BetterAuthApiError(`User ${targetUserId} not found.`);
	}
	return {
		banned: row.banned === true,
		banReason: row.banReason ?? null,
		banExpires: row.banExpires ?? null,
	};
}

/**
 * Convert the form's optional future Date to better-auth's `banExpiresIn`
 * (seconds from now). null/undefined = permanent ban.
 */
export function expiresAtToBanExpiresIn(
	expiresAt: Date | null | undefined,
	now: Date = new Date(),
): number | undefined {
	if (!expiresAt) return undefined;
	const seconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
	return seconds > 0 ? seconds : undefined;
}

export async function banUserAction(
	input: BanUserActionInput,
	db: Db = defaultDb,
): Promise<{ user: UserDirectoryRow; before: BanSnapshot; after: BanSnapshot }> {
	assertSelfTargetAllowed({ actorId: input.actorId, targetUserId: input.targetUserId, op: 'ban' });

	const before = await readBanSnapshot(input.targetUserId, db);

	await callAdmin(() =>
		input.auth.api.banUser({
			body: {
				userId: input.targetUserId,
				banReason: input.reason,
				banExpiresIn: expiresAtToBanExpiresIn(input.expiresAt ?? null),
			},
			headers: input.headers,
		}),
	);

	const after = await readBanSnapshot(input.targetUserId, db);
	const userAfter = await getUser(input.targetUserId, db);
	if (!userAfter) {
		throw new BetterAuthApiError(`User ${input.targetUserId} not found after ban.`);
	}

	await auditWrite(
		{
			actorId: input.actorId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.HANGAR_USER,
			targetId: input.targetUserId,
			before,
			after,
			metadata: buildAuditMeta({
				requestId: input.requestId,
				userAgent: input.userAgent,
				actorEmail: input.actorEmail,
				subKind: HANGAR_USER_OP_SUBKINDS.BAN,
			}),
		},
		db,
	);

	return { user: userAfter, before, after };
}

export interface UnbanUserActionInput {
	auth: AdminAuthBundle;
	actorId: string;
	actorEmail: string;
	targetUserId: string;
	headers: Headers;
	requestId: string | null;
	userAgent: string | null;
}

export async function unbanUserAction(
	input: UnbanUserActionInput,
	db: Db = defaultDb,
): Promise<{ user: UserDirectoryRow; before: BanSnapshot; after: BanSnapshot }> {
	const before = await readBanSnapshot(input.targetUserId, db);

	await callAdmin(() =>
		input.auth.api.unbanUser({
			body: { userId: input.targetUserId },
			headers: input.headers,
		}),
	);

	const after = await readBanSnapshot(input.targetUserId, db);
	const userAfter = await getUser(input.targetUserId, db);
	if (!userAfter) {
		throw new BetterAuthApiError(`User ${input.targetUserId} not found after unban.`);
	}

	await auditWrite(
		{
			actorId: input.actorId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.HANGAR_USER,
			targetId: input.targetUserId,
			before,
			after,
			metadata: buildAuditMeta({
				requestId: input.requestId,
				userAgent: input.userAgent,
				actorEmail: input.actorEmail,
				subKind: HANGAR_USER_OP_SUBKINDS.UNBAN,
			}),
		},
		db,
	);

	return { user: userAfter, before, after };
}

export interface RevokeUserSessionInput {
	auth: AdminAuthBundle;
	actorId: string;
	actorEmail: string;
	targetUserId: string;
	sessionId: string;
	headers: Headers;
	requestId: string | null;
	userAgent: string | null;
}

/**
 * Revoke a single named session. Better-auth's `revokeUserSession` keys
 * by `sessionToken`, so we look the token up via `bauth_session` for the
 * target user + session id pair before delegating. If no row matches,
 * the session never belonged to the target (or has already been
 * revoked) -- 404-shaped failure.
 */
export async function revokeUserSession(
	input: RevokeUserSessionInput,
	db: Db = defaultDb,
): Promise<{ revokedSessionId: string }> {
	const [row] = await db
		.select({ token: bauthSession.token, userId: bauthSession.userId })
		.from(bauthSession)
		.where(and(eq(bauthSession.id, input.sessionId), eq(bauthSession.userId, input.targetUserId)))
		.limit(1);

	if (!row) {
		throw new BetterAuthApiError(`Session ${input.sessionId} not found for user ${input.targetUserId}.`);
	}

	await callAdmin(() =>
		input.auth.api.revokeUserSession({
			body: { sessionToken: row.token },
			headers: input.headers,
		}),
	);

	await auditWrite(
		{
			actorId: input.actorId,
			op: AUDIT_OPS.ACTION,
			targetType: AUDIT_TARGETS.HANGAR_USER,
			targetId: input.targetUserId,
			before: null,
			after: null,
			metadata: buildAuditMeta({
				requestId: input.requestId,
				userAgent: input.userAgent,
				actorEmail: input.actorEmail,
				subKind: HANGAR_USER_OP_SUBKINDS.SESSION_REVOKE,
				extras: { revokedSessionId: input.sessionId },
			}),
		},
		db,
	);

	return { revokedSessionId: input.sessionId };
}

export interface RevokeAllUserSessionsInput {
	auth: AdminAuthBundle;
	actorId: string;
	actorEmail: string;
	targetUserId: string;
	/**
	 * Current session id of the calling admin. Used to flag `revokedOwn`
	 * when the admin is revoking their own active session as part of the
	 * bulk revoke -- the form action then redirects to /login.
	 */
	currentSessionId: string | null;
	headers: Headers;
	requestId: string | null;
	userAgent: string | null;
}

export async function revokeAllUserSessions(
	input: RevokeAllUserSessionsInput,
	db: Db = defaultDb,
): Promise<{ revokedCount: number; revokedOwn: boolean }> {
	// Compute `revokedCount` (better-auth returns `{ success }`, not a count)
	// and detect whether the actor's own current session is in the set.
	// Two cheap aggregate / index-hit queries, run concurrently -- replaces
	// a previous full-row scan that selected every session column with
	// `LIMIT Number.MAX_SAFE_INTEGER` just to call `.length` and `.some()`.
	const [revokedCount, revokedOwn] = await Promise.all([
		countUserSessions(input.targetUserId, db),
		input.currentSessionId !== null
			? hasUserSessionWithId(input.targetUserId, input.currentSessionId, db)
			: Promise.resolve(false),
	]);

	await callAdmin(() =>
		input.auth.api.revokeUserSessions({
			body: { userId: input.targetUserId },
			headers: input.headers,
		}),
	);

	await auditWrite(
		{
			actorId: input.actorId,
			op: AUDIT_OPS.ACTION,
			targetType: AUDIT_TARGETS.HANGAR_USER,
			targetId: input.targetUserId,
			before: null,
			after: null,
			metadata: buildAuditMeta({
				requestId: input.requestId,
				userAgent: input.userAgent,
				actorEmail: input.actorEmail,
				subKind: HANGAR_USER_OP_SUBKINDS.SESSION_REVOKE_ALL,
				extras: { revokedCount, revokedOwn },
			}),
		},
		db,
	);

	return { revokedCount, revokedOwn };
}
