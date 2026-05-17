/**
 * Enqueue + query helpers for the `hangar.job` + `hangar.job_log` tables.
 *
 * All writes go through these helpers so id generation, default shape, and
 * audit hooks stay consistent across callers (form actions, CLIs,
 * recovery, the worker itself).
 */

import { AUDIT_OPS } from '@ab/audit';
import { auditWrite } from '@ab/audit/server';
import {
	AUDIT_TARGETS,
	JOB_AUDIT_REASONS,
	JOB_HEARTBEAT_STALE_MS,
	JOB_LOG_STREAMS,
	JOB_STATUSES,
	type JobKind,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { generateHangarJobId, generateHangarJobLogId } from '@ab/utils';
import { and, asc, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type HangarJobLogRow, type HangarJobRow, hangarJob, hangarJobLog } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export interface EnqueueInput {
	kind: JobKind;
	targetType?: string | null;
	targetId?: string | null;
	actorId: string | null;
	payload?: Record<string, unknown>;
}

/**
 * Insert one queued job row. Returns the created row. Also writes one
 * `hangar.job` audit row (op = create) so the queue activity is visible
 * in the cross-cutting audit log alongside reference/source writes.
 *
 * Both writes go through a single `db.transaction` so the audit row never
 * lags or vanishes when the audit insert fails after the job insert
 * commits (chunk-6 backend review: terminal-state transitions non-atomic
 * with audit emissions).
 */
export async function enqueueJob(input: EnqueueInput, db: Db = defaultDb): Promise<HangarJobRow> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.insert(hangarJob)
			.values({
				id: generateHangarJobId(),
				kind: input.kind,
				targetType: input.targetType ?? null,
				targetId: input.targetId ?? null,
				status: JOB_STATUSES.QUEUED,
				progress: {},
				payload: input.payload ?? {},
				actorId: input.actorId,
			})
			.returning();
		await auditWrite(
			{
				actorId: input.actorId,
				op: AUDIT_OPS.CREATE,
				targetType: AUDIT_TARGETS.HANGAR_JOB,
				targetId: row.id,
				after: {
					kind: row.kind,
					targetType: row.targetType,
					targetId: row.targetId,
					status: row.status,
				},
			},
			tx,
		);
		return row;
	});
}

export async function getJob(id: string, db: Db = defaultDb): Promise<HangarJobRow | undefined> {
	const [row] = await db.select().from(hangarJob).where(eq(hangarJob.id, id)).limit(1);
	return row;
}

export interface ListJobsOptions {
	kind?: JobKind;
	status?: string;
	actorId?: string;
	limit?: number;
}

export async function listJobs(options: ListJobsOptions = {}, db: Db = defaultDb): Promise<HangarJobRow[]> {
	const limit = options.limit ?? 100;
	const conditions = [];
	if (options.kind !== undefined) conditions.push(eq(hangarJob.kind, options.kind));
	if (options.status !== undefined) conditions.push(eq(hangarJob.status, options.status));
	if (options.actorId !== undefined) conditions.push(eq(hangarJob.actorId, options.actorId));
	const base = db.select().from(hangarJob);
	const filtered = conditions.length === 0 ? base : base.where(and(...conditions));
	return filtered.orderBy(desc(hangarJob.createdAt)).limit(limit);
}

/**
 * Read job-log lines for a job, newest-last, with an optional cursor for
 * polling clients (`sinceSeq` returns rows with `seq > sinceSeq`).
 */
export async function readJobLog(
	jobId: string,
	options: { sinceSeq?: number; limit?: number } = {},
	db: Db = defaultDb,
): Promise<HangarJobLogRow[]> {
	const limit = options.limit ?? 500;
	// Real `seq` values start at 0; `-1` is the "from the beginning" sentinel
	// so the `seq > sinceSeq` predicate yields every row when no cursor was
	// supplied.
	const sinceSeq = options.sinceSeq ?? -1;
	return db
		.select()
		.from(hangarJobLog)
		.where(and(eq(hangarJobLog.jobId, jobId), gt(hangarJobLog.seq, sinceSeq)))
		.orderBy(asc(hangarJobLog.seq))
		.limit(limit);
}

/**
 * Append a single log line with MAX(seq)+1 computed server-side, atomically.
 *
 * Atomic seq allocation strategy (chunk-6 schema critical fix):
 *
 *   1. Open a transaction.
 *   2. `SELECT id ... FOR UPDATE` on the parent `hangar.job` row. This takes a
 *      row-level lock that serialises every concurrent appender for the same
 *      `jobId` (orphan recovery loop, the worker's per-handler stream, the
 *      no-handler terminal-event path) against each other, while leaving
 *      different `jobId`s parallel.
 *   3. Compute `seq = COALESCE(MAX(seq) + 1, 0)` from `hangar.job_log` for
 *      this job inside the same transaction. The row lock guarantees no other
 *      appender can land an insert between the SELECT and the INSERT.
 *   4. Insert the log row. The `(job_id, seq)` UNIQUE constraint is the
 *      safety net: if any path ever bypasses this helper and races, the
 *      offender fails fast with a 23505 instead of silently corrupting the
 *      polling cursor.
 *
 * Why a row lock instead of a `bigserial` per-job side counter (e.g. a
 * `next_log_seq integer` on `hangar.job` bumped by `UPDATE ... RETURNING`):
 * the row-lock + MAX pattern keeps `seq` continuous (no gaps when an INSERT
 * fails post-lock), keeps `hangar.job` writes scoped to status/result/
 * progress, and avoids a parallel "what's authoritative" question between
 * the column and the actual log rows. The `UPDATE ... RETURNING` approach
 * also requires a column migration we don't want to ship today; a row-level
 * lock on the parent gets the atomicity at zero schema cost.
 *
 * The worker's per-handler `makeContext` previously held an in-memory `seq++`
 * counter shared across N concurrent writes per job. That counter could
 * collide with the orphan-recovery loop (different process, same job) and
 * with the no-handler terminal-event insert (worker.ts hardcoded `seq: 0`).
 * Both of those paths now route through this single atomic helper, so there
 * is exactly ONE seq generator per `(jobId, transaction)`.
 */
export async function appendJobLog(
	input: { jobId: string; stream: string; line: string },
	db: Db = defaultDb,
): Promise<void> {
	await db.transaction(async (tx) => {
		// Row lock on the parent so concurrent appenders for the same job
		// serialise on this SELECT. Different jobIds keep running in parallel.
		await tx.execute(sql`select ${hangarJob.id} from ${hangarJob} where ${hangarJob.id} = ${input.jobId} for update`);
		const [maxRow] = await tx
			.select({ maxSeq: sql<number | null>`max(${hangarJobLog.seq})` })
			.from(hangarJobLog)
			.where(eq(hangarJobLog.jobId, input.jobId));
		const nextSeq = (maxRow?.maxSeq ?? -1) + 1;
		await tx.insert(hangarJobLog).values({
			id: generateHangarJobLogId(),
			jobId: input.jobId,
			seq: nextSeq,
			stream: input.stream,
			line: input.line,
		});
	});
}

/**
 * Mark genuinely-orphaned `running` jobs as `queued` with a `recovered`
 * log line and an audit row. Call on worker boot so a crashed process
 * never leaves a ghost running job. The audit row preserves the "every
 * state transition is audited" contract that audit-explorer relies on
 * (chunk-6 correctness major: orphaned-running recovery never updates
 * audit log).
 *
 * A row is "orphaned" only when its `lastHeartbeatAt` is null or older
 * than `JOB_HEARTBEAT_STALE_MS`. A running row with a fresh heartbeat is
 * owned by a LIVE worker -- another worker handle booting (the API
 * supports multiple handles) must NOT steal it, or the job runs twice.
 *
 * The status flip + audit write per row run inside one transaction so a
 * crash mid-recovery never leaves an audit row orphaned of its job (or
 * vice versa). The transaction's `WHERE` re-checks the staleness
 * predicate so a heartbeat landing between the SELECT and the UPDATE
 * still wins.
 */
export async function recoverOrphanedRunning(db: Db = defaultDb): Promise<number> {
	const staleBefore = new Date(Date.now() - JOB_HEARTBEAT_STALE_MS);
	const orphanGate = or(isNull(hangarJob.lastHeartbeatAt), lt(hangarJob.lastHeartbeatAt, staleBefore));
	const orphaned = await db
		.select({ id: hangarJob.id, actorId: hangarJob.actorId, startedAt: hangarJob.startedAt })
		.from(hangarJob)
		.where(and(eq(hangarJob.status, JOB_STATUSES.RUNNING), orphanGate));
	if (orphaned.length === 0) return 0;
	let recovered = 0;
	for (const orphan of orphaned) {
		const wasRecovered = await db.transaction(async (tx) => {
			const updated = await tx
				.update(hangarJob)
				.set({ status: JOB_STATUSES.QUEUED, startedAt: null, lastHeartbeatAt: null })
				.where(and(eq(hangarJob.id, orphan.id), eq(hangarJob.status, JOB_STATUSES.RUNNING), orphanGate))
				.returning({ id: hangarJob.id });
			if (updated.length === 0) return false;
			await auditWrite(
				{
					actorId: orphan.actorId,
					op: AUDIT_OPS.UPDATE,
					targetType: AUDIT_TARGETS.HANGAR_JOB,
					targetId: orphan.id,
					metadata: {
						status: JOB_STATUSES.QUEUED,
						reason: JOB_AUDIT_REASONS.RECOVERED_FROM_RESTART,
						priorStartedAt: orphan.startedAt?.toISOString() ?? null,
					},
				},
				tx,
			);
			return true;
		});
		// Only log the recovery event for rows the transaction actually
		// re-queued; a row whose heartbeat refreshed between the SELECT and
		// the UPDATE is owned by a live worker and left untouched.
		if (wasRecovered) {
			recovered += 1;
			await appendJobLog(
				{ jobId: orphan.id, stream: JOB_LOG_STREAMS.EVENT, line: 'recovered from worker restart' },
				db,
			);
		}
	}
	return recovered;
}
