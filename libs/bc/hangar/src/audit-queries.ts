/**
 * Cross-cutting audit-log read queries powering the hangar `/admin/audit`
 * surface (see [docs/work-packages/hangar-audit-explorer/spec.md]).
 *
 * Pure read consumer of `audit.audit_log`. No writes happen here -- writes
 * are scattered across BC modules (each one calls `auditWrite` next to its
 * mutation). This module is the third audit reader in the codebase
 * alongside:
 *
 *   - `auditRecent` (`@ab/audit`)            -- target-scoped, last N rows.
 *   - `listRecentUserAudits` (`./users.ts`)  -- actor-scoped, last N rows.
 *   - `listAuditEntries` (this file)         -- combined filters + cursor
 *                                                pagination across every
 *                                                target / actor / op / window.
 *
 * Cursor encoding: `${timestampISO}::${id}`. Decoded into the keyset compare
 * `(timestamp, id) < (cursorTs, cursorId)` so deterministic order survives
 * even when two rows share a millisecond timestamp. The id tiebreaker comes
 * from the auditLog primary key (an aud_ ULID, lexicographically time-
 * monotonic).
 */

import { auditLog } from '@ab/audit';
import { bauthUser } from '@ab/auth/schema';
import { AUDIT_ACTOR_SEARCH_LIMIT, AUDIT_LIST_DEFAULT_LIMIT, AUDIT_LIST_HARD_CAP } from '@ab/constants';
import { escapeLikePattern } from '@ab/db';
import { db as defaultDb } from '@ab/db/connection';
import { and, asc, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Sentinel value for "system-write only" (`actor_id IS NULL`). */
export const AUDIT_ACTOR_SYSTEM = 'null';

/**
 * Filters consumed by {@link listAuditEntries}. Every field is optional --
 * an empty filter set returns rows newest-first across the entire log
 * (subject to the hard cap).
 */
export interface AuditFilters {
	/**
	 * Actor user id; `AUDIT_ACTOR_SYSTEM` filters to system writes
	 * (`actor_id IS NULL`); `undefined` is "any actor".
	 */
	actorId?: string;
	/** `audit_log.target_type` exact match. */
	targetType?: string;
	/** `audit_log.target_id` exact match. */
	targetId?: string;
	/** `audit_log.op` exact match -- one of `AUDIT_OP_VALUES`. */
	op?: string;
	/** Inclusive lower bound on `audit_log.timestamp`. */
	from?: Date;
	/** Inclusive upper bound on `audit_log.timestamp`. */
	to?: Date;
	/** Cursor: `${timestampISO}::${id}` from a previous page. */
	cursor?: string;
	/** Page size; defaults to {@link AUDIT_LIST_DEFAULT_LIMIT}, capped at {@link AUDIT_LIST_HARD_CAP}. */
	limit?: number;
}

/** Compact list-row shape returned by {@link listAuditEntries}. */
export interface AuditEntryRow {
	id: string;
	timestamp: Date;
	actorId: string | null;
	actorName: string | null;
	actorEmail: string | null;
	op: string;
	targetType: string;
	targetId: string | null;
	/** Truncated to a small preview on the list page; full payload on detail. */
	metadataPreview: Record<string, unknown>;
}

/** Page result with optional cursor for the next page. */
export interface AuditEntriesPage {
	rows: AuditEntryRow[];
	nextCursor: string | null;
}

/** Decoded cursor parts: timestamp + id pair from a previous-page row. */
export interface DecodedAuditCursor {
	timestamp: Date;
	id: string;
}

/** Cursor delimiter: see file-header docstring. */
const CURSOR_DELIMITER = '::';

/**
 * Decode a cursor string into a `(timestamp, id)` tuple. Returns `null` if
 * the string isn't well-formed -- the caller treats that as "no cursor"
 * rather than a hard error so a stale URL still loads page 1.
 *
 * Splits on the **last** occurrence of `::`. The id half (an `aud_<ULID>`)
 * never contains `::`, but a malformed/crafted cursor that smuggles an
 * extra `::` into the timestamp half would otherwise produce a partial
 * timestamp the keyset compare silently runs against -- matching nothing
 * for the rest of the user's session. Splitting on lastIndexOf keeps the
 * well-formed happy path correct (`<ISO>::<id>`) and forces the
 * timestamp-half parse to fail cleanly on crafted input, so the caller
 * resets to page 1 instead of paginating into a dead window.
 */
export function decodeAuditCursor(raw: string | undefined | null): DecodedAuditCursor | null {
	if (!raw) return null;
	const idx = raw.lastIndexOf(CURSOR_DELIMITER);
	if (idx <= 0) return null;
	const tsPart = raw.slice(0, idx);
	const id = raw.slice(idx + CURSOR_DELIMITER.length);
	if (!id) return null;
	const ts = new Date(tsPart);
	if (Number.isNaN(ts.getTime())) return null;
	return { timestamp: ts, id };
}

/** Encode a `(timestamp, id)` tuple as a cursor string. */
export function encodeAuditCursor(timestamp: Date, id: string): string {
	return `${timestamp.toISOString()}${CURSOR_DELIMITER}${id}`;
}

/** Clamp an arbitrary requested limit to the spec's bounds. */
export function clampAuditLimit(requested: number | undefined): number {
	if (requested === undefined || !Number.isFinite(requested) || requested <= 0) {
		return AUDIT_LIST_DEFAULT_LIMIT;
	}
	return Math.min(Math.floor(requested), AUDIT_LIST_HARD_CAP);
}

/**
 * Compose the WHERE clause for {@link listAuditEntries}. Exposed so the
 * unit test can assert filter composition (which clauses survive given a
 * filter set) without a live database.
 */
export function buildAuditWhere(filters: AuditFilters) {
	const clauses = [];

	if (filters.actorId === AUDIT_ACTOR_SYSTEM) {
		clauses.push(isNull(auditLog.actorId));
	} else if (filters.actorId !== undefined) {
		clauses.push(eq(auditLog.actorId, filters.actorId));
	}
	if (filters.targetType !== undefined) {
		clauses.push(eq(auditLog.targetType, filters.targetType));
	}
	if (filters.targetId !== undefined) {
		clauses.push(eq(auditLog.targetId, filters.targetId));
	}
	if (filters.op !== undefined) {
		clauses.push(eq(auditLog.op, filters.op));
	}
	if (filters.from !== undefined) {
		clauses.push(gte(auditLog.timestamp, filters.from));
	}
	if (filters.to !== undefined) {
		clauses.push(lte(auditLog.timestamp, filters.to));
	}

	const cursor = decodeAuditCursor(filters.cursor);
	if (cursor !== null) {
		// Keyset pagination: rows newer than the cursor have already been
		// shown. The compare uses `(timestamp, id) < (cursorTs, cursorId)`
		// so two rows sharing a millisecond timestamp still order
		// deterministically by id. Drizzle's row-value compare is `sql`
		// -- there's no first-class helper for tuple `<`.
		clauses.push(
			sql`(${auditLog.timestamp}, ${auditLog.id}) < (${cursor.timestamp.toISOString()}::timestamptz, ${cursor.id})`,
		);
	}

	if (clauses.length === 0) return undefined;
	if (clauses.length === 1) return clauses[0];
	return and(...clauses);
}

/**
 * Render the metadata preview shipped to the list page. The full jsonb
 * payload is deferred to the detail page; the list page only needs enough
 * to scan -- `requestId` is the load-bearing hint.
 */
function metadataPreview(metadata: Record<string, unknown> | null): Record<string, unknown> {
	if (!metadata) return {};
	const out: Record<string, unknown> = {};
	if ('requestId' in metadata) out.requestId = metadata.requestId;
	if ('reason' in metadata) out.reason = metadata.reason;
	return out;
}

/**
 * Cursor-paginated list of audit-log rows newest-first, joined with the
 * actor's name + email so the UI doesn't need a second query.
 *
 * Fetches `limit + 1` rows: the extra row tells us whether more pages
 * exist without running a separate `count(*)`. If we got an extra, drop
 * it from the result and emit `nextCursor`.
 */
export async function listAuditEntries(filters: AuditFilters, db: Db = defaultDb): Promise<AuditEntriesPage> {
	const limit = clampAuditLimit(filters.limit);
	const where = buildAuditWhere(filters);

	const baseQuery = db
		.select({
			id: auditLog.id,
			timestamp: auditLog.timestamp,
			actorId: auditLog.actorId,
			actorName: bauthUser.name,
			actorEmail: bauthUser.email,
			op: auditLog.op,
			targetType: auditLog.targetType,
			targetId: auditLog.targetId,
			metadata: auditLog.metadata,
		})
		.from(auditLog)
		.leftJoin(bauthUser, eq(bauthUser.id, auditLog.actorId));

	const ordered = (where ? baseQuery.where(where) : baseQuery)
		.orderBy(desc(auditLog.timestamp), desc(auditLog.id))
		.limit(limit + 1);

	const rows = await ordered;

	const hasMore = rows.length > limit;
	const trimmed = hasMore ? rows.slice(0, limit) : rows;

	const last = trimmed[trimmed.length - 1];
	const nextCursor = hasMore && last ? encodeAuditCursor(last.timestamp, last.id) : null;

	return {
		rows: trimmed.map((row) => ({
			id: row.id,
			timestamp: row.timestamp,
			actorId: row.actorId,
			actorName: row.actorName,
			actorEmail: row.actorEmail,
			op: row.op,
			targetType: row.targetType,
			targetId: row.targetId,
			metadataPreview: metadataPreview(row.metadata),
		})),
		nextCursor,
	};
}

/** Full row shape returned by {@link getAuditEntry}. Detail page consumes this. */
export interface AuditEntryDetail {
	id: string;
	timestamp: Date;
	actorId: string | null;
	actorName: string | null;
	actorEmail: string | null;
	actorRole: string | null;
	op: string;
	targetType: string;
	targetId: string | null;
	before: unknown;
	after: unknown;
	metadata: Record<string, unknown>;
}

/**
 * Fetch one audit row in full, joined with the actor's identity so the
 * detail page renders without a second query. Returns `null` when the id
 * is unknown -- the route maps that to a 404.
 */
export async function getAuditEntry(id: string, db: Db = defaultDb): Promise<AuditEntryDetail | null> {
	const [row] = await db
		.select({
			id: auditLog.id,
			timestamp: auditLog.timestamp,
			actorId: auditLog.actorId,
			actorName: bauthUser.name,
			actorEmail: bauthUser.email,
			actorRole: bauthUser.role,
			op: auditLog.op,
			targetType: auditLog.targetType,
			targetId: auditLog.targetId,
			before: auditLog.before,
			after: auditLog.after,
			metadata: auditLog.metadata,
		})
		.from(auditLog)
		.leftJoin(bauthUser, eq(bauthUser.id, auditLog.actorId))
		.where(eq(auditLog.id, id))
		.limit(1);

	if (!row) return null;

	return {
		id: row.id,
		timestamp: row.timestamp,
		actorId: row.actorId,
		actorName: row.actorName,
		actorEmail: row.actorEmail,
		actorRole: row.actorRole,
		op: row.op,
		targetType: row.targetType,
		targetId: row.targetId,
		before: row.before,
		after: row.after,
		metadata: row.metadata ?? {},
	};
}

/** Single hit in the actor-typeahead. */
export interface ActorSearchHit {
	id: string;
	name: string;
	email: string;
}

/**
 * Better-auth user ids are unprefixed lowercase ULIDs -- 26 chars of
 * Crockford base32 (`[0-9a-z]` minus `i`, `l`, `o`, `u`). The audit
 * explorer encodes the actor filter as `?actor=<id>`, so the deep-link
 * resolver can recognise an id-shaped value cheaply and skip the
 * name/email ILIKE query (which would never match by definition).
 *
 * The check is intentionally cheap and shape-only: it doesn't certify
 * that the id exists in `bauth_user`, just that it could plausibly be
 * one. {@link getActorById} is the lookup; this is the gatekeeper that
 * picks between the id path and the search path.
 */
const AUTH_ID_REGEX = /^[0-9abcdefghjkmnpqrstvwxyz]{26}$/;

/**
 * Cheap shape check for a better-auth user id. See {@link AUTH_ID_REGEX}.
 * Exposed so the deep-link resolver in the audit-page loader can route a
 * `?actor=<value>` to {@link getActorById} (exact-match) when the value
 * looks like an id, and fall back to {@link searchActorIds} (name/email
 * ILIKE) otherwise.
 */
export function isLikelyAuthId(value: string | undefined | null): boolean {
	if (!value) return false;
	return AUTH_ID_REGEX.test(value);
}

/**
 * Exact-match lookup of a single `bauth_user` row by id, returning the
 * same shape as {@link searchActorIds} so the audit-page deep-link
 * resolver can swap in/out without re-shaping the result. Returns an
 * empty array when the id is unknown -- callers iterate the result, the
 * "not found" case looks identical to "no match" from the search path.
 *
 * Lives next to `searchActorIds` because the two are siblings: same row
 * shape, same caller (the actor-chip resolver in the audit-page loader),
 * different match strategies. The split exists because the URL
 * (`?actor=<id>`) carries a better-auth id, which never matches a
 * name/email ILIKE.
 */
export async function getActorById(id: string | undefined | null, db: Db = defaultDb): Promise<ActorSearchHit[]> {
	if (!id) return [];
	const trimmed = id.trim();
	if (!trimmed) return [];
	return db
		.select({ id: bauthUser.id, name: bauthUser.name, email: bauthUser.email })
		.from(bauthUser)
		.where(eq(bauthUser.id, trimmed))
		.limit(1);
}

/**
 * Resolve an `?actor=<value>` deep-link to the matching actor chip.
 * Routes id-shaped values to {@link getActorById} (the encoded form the
 * URL carries when the user picked a typeahead hit) and falls back to
 * {@link searchActorIds} (name/email ILIKE) for free-text values
 * bookmarked from older URLs or hand-edited.
 *
 * The system-write sentinel ({@link AUDIT_ACTOR_SYSTEM}) and empty
 * input both yield `[]` -- the caller renders no chip in those cases.
 */
export async function resolveActorForChip(
	value: string | undefined | null,
	db: Db = defaultDb,
): Promise<ActorSearchHit[]> {
	if (!value || value === AUDIT_ACTOR_SYSTEM) return [];
	if (isLikelyAuthId(value)) return getActorById(value, db);
	return searchActorIds(value, 1, db);
}

/**
 * Typeahead helper for the filter-bar actor search. Matches `name` or
 * `email` case-insensitively, capped at {@link AUDIT_ACTOR_SEARCH_LIMIT}
 * rows. Wildcards in the search term are escaped via `escapeLikePattern`
 * so a literal `%` doesn't match every user.
 *
 * Returns an empty list (never `null`) on empty input -- callers always
 * iterate the result; making them check for `null` first is friction.
 */
export async function searchActorIds(
	searchTerm: string | undefined | null,
	limit = AUDIT_ACTOR_SEARCH_LIMIT,
	db: Db = defaultDb,
): Promise<ActorSearchHit[]> {
	const trimmed = searchTerm?.trim();
	if (!trimmed) return [];
	const pattern = `%${escapeLikePattern(trimmed)}%`;
	const cap = Math.min(Math.max(1, Math.floor(limit)), AUDIT_ACTOR_SEARCH_LIMIT);

	return db
		.select({ id: bauthUser.id, name: bauthUser.name, email: bauthUser.email })
		.from(bauthUser)
		.where(or(ilike(bauthUser.name, pattern), ilike(bauthUser.email, pattern)))
		.orderBy(asc(bauthUser.name), asc(bauthUser.email))
		.limit(cap);
}
