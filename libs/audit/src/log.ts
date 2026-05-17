import { AUDIT_LIST_HARD_CAP, AUDIT_TARGET_VALUES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { generateAuditLogId } from '@ab/utils';
import { and, count, desc, eq, gte } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type AuditLogRow, type AuditOp, auditLog } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Raised when `auditWrite` is called with a `targetType` outside AUDIT_TARGET_VALUES. */
export class InvalidAuditTargetError extends Error {
	readonly code = 'INVALID_AUDIT_TARGET';
	constructor(targetType: string) {
		super(
			`auditWrite: targetType '${targetType}' is not in AUDIT_TARGET_VALUES (${AUDIT_TARGET_VALUES.join(', ')}). Add it to AUDIT_TARGETS in @ab/constants before emitting.`,
		);
		this.name = 'InvalidAuditTargetError';
	}
}

const AUDIT_TARGET_SET: ReadonlySet<string> = new Set(AUDIT_TARGET_VALUES);

/**
 * Write one audit row. Intentionally non-transactional -- callers pass their
 * own `db` (usually a transaction scope) so the audit row commits or rolls
 * back alongside the mutation it describes.
 *
 * Not awaited by hot paths that can't tolerate the latency hit: those callers
 * can `void auditWrite(...)` and live with best-effort capture.
 *
 * The DB-level CHECK on `target_type` was dropped per the 2026-05-06 review §J
 * (AUDIT_TARGET_VALUES grows with every new BC; CHECK was a migration burden
 * paying for one bad audit row per typo). The write gate moves here: the BC
 * validates `targetType` against `AUDIT_TARGET_VALUES` and throws
 * `InvalidAuditTargetError` if it doesn't match.
 */
export async function auditWrite(
	input: {
		actorId: string | null;
		op: AuditOp;
		targetType: string;
		targetId: string | null;
		before?: unknown;
		after?: unknown;
		metadata?: Record<string, unknown>;
	},
	db: Db = defaultDb,
): Promise<AuditLogRow> {
	if (!AUDIT_TARGET_SET.has(input.targetType)) throw new InvalidAuditTargetError(input.targetType);
	const [row] = await db
		.insert(auditLog)
		.values({
			id: generateAuditLogId(),
			actorId: input.actorId,
			op: input.op,
			targetType: input.targetType,
			targetId: input.targetId,
			before: input.before ?? null,
			after: input.after ?? null,
			metadata: input.metadata ?? {},
		})
		.returning();
	return row;
}

/** Default page size for `auditRecent` when no `limit` is supplied. */
const AUDIT_RECENT_DEFAULT_LIMIT = 10;

/**
 * Read the most recent audit rows for a given `targetType`. Used by admin
 * surfaces (hangar) to show the last N actions on a resource. Optional
 * `targetId` filter scopes to a single row of that targetType.
 *
 * `targetType` is always required and is always part of the filter -- prior
 * versions of this function dropped the targetType clause whenever a
 * targetId was supplied, which is wrong: targetIds are not unique across
 * types (a 'study.card' and a 'hangar.source' can share the same ULID-ish
 * prefix), so the unfiltered query could return rows from a different
 * resource family.
 *
 * `limit` is clamped to `[1, AUDIT_LIST_HARD_CAP]`. A caller passing an
 * unbounded, negative, or non-finite value would otherwise feed it straight
 * into the SQL `LIMIT` clause -- a negative/NaN value errors at the driver,
 * a huge value is an unbounded scan. The clamp keeps the helper safe under
 * any caller input without each call site repeating the guard.
 */
export async function auditRecent(
	input: { targetType: string; targetId?: string | null; limit?: number },
	db: Db = defaultDb,
): Promise<AuditLogRow[]> {
	const requested = input.limit ?? AUDIT_RECENT_DEFAULT_LIMIT;
	const limit = Number.isFinite(requested)
		? Math.min(Math.max(Math.floor(requested), 1), AUDIT_LIST_HARD_CAP)
		: AUDIT_RECENT_DEFAULT_LIMIT;
	const where =
		input.targetId != null
			? and(eq(auditLog.targetType, input.targetType), eq(auditLog.targetId, input.targetId))
			: eq(auditLog.targetType, input.targetType);
	return db.select().from(auditLog).where(where).orderBy(desc(auditLog.timestamp)).limit(limit);
}

/**
 * Count audit rows whose timestamp is at or after `since`. Used by the hangar
 * admin home for a "recent activity in the last N hours" tile.
 */
export async function countAuditEntriesSince(since: Date, db: Db = defaultDb): Promise<number> {
	const rows = await db.select({ c: count() }).from(auditLog).where(gte(auditLog.timestamp, since));
	// drizzle's pg `count()` returns a `number`; the previous `Number(...)` cast
	// was a no-op. Branch on bigint defensively in case a future driver swap
	// changes the shape, but otherwise return the value directly.
	const c = rows[0]?.c ?? 0;
	return typeof c === 'bigint' ? Number(c) : c;
}
