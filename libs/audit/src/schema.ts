/**
 * Audit schema -- cross-cutting change-log substrate for every airboss app.
 *
 * Lives under `@ab/audit` rather than `@ab/db` or a specific BC because audit
 * is a capability every BC depends on. The table is namespaced under `audit`
 * (see ADR 004) so it never collides with per-BC tables.
 *
 * Design intent (matches the schema review 2026-04-22):
 *   - One generic `audit_log` row per mutation captured via `auditWrite`.
 *   - `before` / `after` are `jsonb` snapshots so a reader can reconstruct a
 *     row's state at any point without joining back to the mutable table.
 *   - `metadata` carries out-of-band context (requestId, userAgent, reason).
 *   - `actorId` is NULLABLE: some writes are system-owned (migrations,
 *     scheduled jobs). When present it FKs to `bauth_user` with
 *     `onDelete: 'set null'` so a user delete doesn't erase the audit trail.
 */

import { bauthUser } from '@ab/auth/schema';
import { SCHEMAS } from '@ab/constants';
import { index, jsonb, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

export const auditSchema = pgSchema(SCHEMAS.AUDIT);

/**
 * Operation classifier. Keep the set tight so aggregate reads stay cheap;
 * use `metadata.subKind` for finer buckets.
 */
export const AUDIT_OPS = {
	CREATE: 'create',
	UPDATE: 'update',
	DELETE: 'delete',
	/** Non-mutating action worth recording (login, export, impersonation). */
	ACTION: 'action',
} as const;

export type AuditOp = (typeof AUDIT_OPS)[keyof typeof AUDIT_OPS];
export const AUDIT_OP_VALUES: readonly AuditOp[] = Object.values(AUDIT_OPS);

export const auditLog = auditSchema.table(
	'audit_log',
	{
		id: text('id').primaryKey(),
		/** When the mutation was observed (server clock). */
		timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
		/**
		 * User who performed the action. Nullable for system writes.
		 * `set null` on delete preserves the trail; the referenced user row
		 * being gone is itself audit-worthy, not a reason to erase history.
		 */
		actorId: text('actor_id').references(() => bauthUser.id, { onDelete: 'set null', onUpdate: 'cascade' }),
		/** One of AUDIT_OP_VALUES. */
		op: text('op').notNull(),
		/** Table or resource the action targets (e.g. 'study.card', 'hangar.source'). */
		targetType: text('target_type').notNull(),
		/** Primary key of the target row. Null for actions without a row scope (login). */
		targetId: text('target_id'),
		/** Row snapshot before the mutation; null for creates + actions. */
		before: jsonb('before'),
		/** Row snapshot after the mutation; null for deletes + actions. */
		after: jsonb('after'),
		/** Request-id, user-agent, reason, anything else. */
		metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
	},
	(t) => ({
		auditActorIdx: index('audit_log_actor_idx').on(t.actorId, t.timestamp),
		auditTargetIdx: index('audit_log_target_idx').on(t.targetType, t.targetId, t.timestamp),
	}),
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
