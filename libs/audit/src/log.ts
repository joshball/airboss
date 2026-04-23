import { db as defaultDb } from '@ab/db';
import { generateAuditLogId } from '@ab/utils';
import { desc, eq } from 'drizzle-orm';
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
 * `targetId` filter scopes to a single row.
 */
export async function auditRecent(
	input: { targetType: string; targetId?: string | null; limit?: number },
	db: Db = defaultDb,
): Promise<AuditLogRow[]> {
	const limit = input.limit ?? 10;
	const base = db.select().from(auditLog);
	const filtered =
		input.targetId != null
			? base.where(eq(auditLog.targetId, input.targetId))
			: base.where(eq(auditLog.targetType, input.targetType));
	return filtered.orderBy(desc(auditLog.timestamp)).limit(limit);
}
