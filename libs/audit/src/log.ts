import { db as defaultDb } from '@ab/db/connection';
import { generateAuditLogId } from '@ab/utils';
import { and, count, desc, eq, gte } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type AuditLogRow, type AuditOp, auditLog } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/**
 * Write one audit row. Intentionally non-transactional -- callers pass their
 * own `db` (usually a transaction scope) so the audit row commits or rolls
 * back alongside the mutation it describes.
 *
 * Not awaited by hot paths that can't tolerate the latency hit: those callers
 * can `void auditWrite(...)` and live with best-effort capture.
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
 */
export async function auditRecent(
	input: { targetType: string; targetId?: string | null; limit?: number },
	db: Db = defaultDb,
): Promise<AuditLogRow[]> {
	const limit = input.limit ?? 10;
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
