/**
 * Users directory queries -- read-only views over `bauth_user` and
 * `bauth_session`. Powers the `/users` admin surface.
 *
 * Stays read-only by design: better-auth owns those tables and the
 * directory page is a view, not an editor. Mutating operations (role
 * change, ban toggle, session revoke, invite flow) are deferred to a
 * follow-up that resolves the auth-policy questions surfaced in the
 * read-only PR.
 */

import { auditLog } from '@ab/audit';
import { bauthSession, bauthUser } from '@ab/auth';
import { ROLE_VALUES, type Role } from '@ab/constants';
import { escapeLikePattern } from '@ab/db';
import { db as defaultDb } from '@ab/db/connection';
import { and, asc, desc, eq, ilike, max, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/**
 * Hard cap on the number of rows the directory page renders. The hangar
 * authoring set is small today; if the platform grows past this the
 * page surfaces a "showing first N" hint and a follow-up adds real
 * pagination. Keep in sync with the page-side label.
 */
export const USERS_LIST_LIMIT = 200;

/** Recent sessions shown on the user-detail page. */
export const USER_DETAIL_SESSION_LIMIT = 10;

/** Recent audit rows shown on the user-detail page. */
export const USER_DETAIL_AUDIT_LIMIT = 20;

export interface ListUsersOptions {
	/** Free-text search; matches `name` or `email` case-insensitively. */
	search?: string;
	/** Cap; defaults to {@link USERS_LIST_LIMIT}. */
	limit?: number;
}

export interface UserDirectoryRow {
	id: string;
	email: string;
	name: string;
	role: Role | null;
	banned: boolean;
	createdAt: Date;
	updatedAt: Date;
	/** Most recent `bauth_session.created_at` for this user; null if none. */
	lastSeenAt: Date | null;
}

export interface UserSessionRow {
	id: string;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: Date;
	expiresAt: Date;
}

export interface UserAuditRow {
	id: string;
	timestamp: Date;
	op: string;
	targetType: string;
	targetId: string | null;
}

/**
 * WHERE fragment for the search filter. Exposed so the unit test can
 * assert the shape (search vs no-search) without spinning up Postgres.
 */
export function buildUserSearchWhere(searchRaw: string | undefined) {
	const search = searchRaw?.trim();
	if (!search) return undefined;
	const pattern = `%${escapeLikePattern(search)}%`;
	return or(ilike(bauthUser.name, pattern), ilike(bauthUser.email, pattern));
}

/**
 * Coerce the `bauth_user.role` text column to a typed `Role` (or null).
 * Better-auth stores roles as plain text, so we narrow at the read edge
 * to keep the rest of the pipeline typed. Any unrecognised role value
 * collapses to `null` -- that's the safe default; the directory page
 * shows "no role" in that case.
 */
export function narrowRole(value: string | null): Role | null {
	if (value == null) return null;
	return (ROLE_VALUES as readonly string[]).includes(value) ? (value as Role) : null;
}

/**
 * List users with last-seen aggregated from sessions. Single round trip:
 * left-joins a per-user MAX(session.created_at) subquery so users with
 * no sessions still appear with `lastSeenAt === null`.
 */
export async function listUsers(options: ListUsersOptions = {}, db: Db = defaultDb): Promise<UserDirectoryRow[]> {
	const limit = options.limit ?? USERS_LIST_LIMIT;
	const lastSeen = db
		.select({
			userId: bauthSession.userId,
			lastSeenAt: max(bauthSession.createdAt).as('last_seen_at'),
		})
		.from(bauthSession)
		.groupBy(bauthSession.userId)
		.as('last_seen');

	const where = buildUserSearchWhere(options.search);
	const rows = await db
		.select({
			id: bauthUser.id,
			email: bauthUser.email,
			name: bauthUser.name,
			role: bauthUser.role,
			banned: bauthUser.banned,
			createdAt: bauthUser.createdAt,
			updatedAt: bauthUser.updatedAt,
			lastSeenAt: lastSeen.lastSeenAt,
		})
		.from(bauthUser)
		.leftJoin(lastSeen, eq(lastSeen.userId, bauthUser.id))
		.where(where)
		.orderBy(asc(bauthUser.name), asc(bauthUser.email))
		.limit(limit);

	return rows.map((row) => ({
		id: row.id,
		email: row.email,
		name: row.name,
		role: narrowRole(row.role),
		banned: row.banned === true,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		lastSeenAt: row.lastSeenAt ?? null,
	}));
}

/**
 * Per-role tallies for the count summary line. Only enumerates the
 * canonical {@link ROLE_VALUES}; rows with an unrecognised role are
 * excluded (same narrowing as the list).
 */
export async function countUsersByRole(
	options: Pick<ListUsersOptions, 'search'> = {},
	db: Db = defaultDb,
): Promise<Record<Role, number>> {
	const where = buildUserSearchWhere(options.search);
	const rows = await db
		.select({ role: bauthUser.role, c: sql<number>`count(*)::int` })
		.from(bauthUser)
		.where(where)
		.groupBy(bauthUser.role);

	const result: Record<Role, number> = { learner: 0, author: 0, operator: 0, admin: 0 };
	for (const row of rows) {
		const role = narrowRole(row.role);
		if (role) result[role] = row.c;
	}
	return result;
}

export async function getUser(id: string, db: Db = defaultDb): Promise<UserDirectoryRow | null> {
	const lastSeen = db
		.select({
			userId: bauthSession.userId,
			lastSeenAt: max(bauthSession.createdAt).as('last_seen_at'),
		})
		.from(bauthSession)
		.where(eq(bauthSession.userId, id))
		.groupBy(bauthSession.userId)
		.as('last_seen');

	const [row] = await db
		.select({
			id: bauthUser.id,
			email: bauthUser.email,
			name: bauthUser.name,
			role: bauthUser.role,
			banned: bauthUser.banned,
			createdAt: bauthUser.createdAt,
			updatedAt: bauthUser.updatedAt,
			lastSeenAt: lastSeen.lastSeenAt,
		})
		.from(bauthUser)
		.leftJoin(lastSeen, eq(lastSeen.userId, bauthUser.id))
		.where(eq(bauthUser.id, id))
		.limit(1);

	if (!row) return null;
	return {
		id: row.id,
		email: row.email,
		name: row.name,
		role: narrowRole(row.role),
		banned: row.banned === true,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		lastSeenAt: row.lastSeenAt ?? null,
	};
}

export async function listRecentUserSessions(
	userId: string,
	limit = USER_DETAIL_SESSION_LIMIT,
	db: Db = defaultDb,
): Promise<UserSessionRow[]> {
	const rows = await db
		.select({
			id: bauthSession.id,
			ipAddress: bauthSession.ipAddress,
			userAgent: bauthSession.userAgent,
			createdAt: bauthSession.createdAt,
			expiresAt: bauthSession.expiresAt,
		})
		.from(bauthSession)
		.where(eq(bauthSession.userId, userId))
		.orderBy(desc(bauthSession.createdAt))
		.limit(limit);
	return rows;
}

/**
 * Recent audit rows authored by the user (`actorId === userId`).
 * `auditRecent` filters by target, not actor, so we run the small
 * actor-scoped query here.
 */
export async function listRecentUserAudits(
	userId: string,
	limit = USER_DETAIL_AUDIT_LIMIT,
	db: Db = defaultDb,
): Promise<UserAuditRow[]> {
	const rows = await db
		.select({
			id: auditLog.id,
			timestamp: auditLog.timestamp,
			op: auditLog.op,
			targetType: auditLog.targetType,
			targetId: auditLog.targetId,
		})
		.from(auditLog)
		.where(and(eq(auditLog.actorId, userId)))
		.orderBy(desc(auditLog.timestamp))
		.limit(limit);
	return rows;
}
