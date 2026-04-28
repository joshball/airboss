/**
 * Enqueue + query helpers for the `hangar.job` + `hangar.job_log` tables.
 *
 * All writes go through these helpers so id generation, default shape, and
 * audit hooks stay consistent across callers (form actions, CLIs,
 * recovery, the worker itself).
 */

import { AUDIT_OPS, auditWrite } from '@ab/audit';
import { type HangarJobLogRow, type HangarJobRow, hangarJob, hangarJobLog } from '@ab/bc-hangar/schema';
import { AUDIT_TARGETS, JOB_STATUSES, type JobKind } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { generateHangarJobId, generateHangarJobLogId } from '@ab/utils';
import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

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
 */
export async function enqueueJob(input: EnqueueInput, db: Db = defaultDb): Promise<HangarJobRow> {
	const [row] = await db
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
		db,
	);
	return row;
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
	const sinceSeq = options.sinceSeq ?? -1;
	return db
		.select()
		.from(hangarJobLog)
		.where(and(eq(hangarJobLog.jobId, jobId), gt(hangarJobLog.seq, sinceSeq)))
		.orderBy(asc(hangarJobLog.seq))
		.limit(limit);
}

/**
 * Append one log line. Caller supplies the monotonic seq (the worker owns
 * a counter per job; callers outside the worker should use `appendJobLog`
 * which grabs MAX(seq)+1 atomically).
 */
export async function writeJobLogRow(
	input: { jobId: string; seq: number; stream: string; line: string },
	db: Db = defaultDb,
): Promise<void> {
	await db.insert(hangarJobLog).values({
		id: generateHangarJobLogId(),
		jobId: input.jobId,
		seq: input.seq,
		stream: input.stream,
		line: input.line,
	});
}

/**
 * Append a single log line with MAX(seq)+1 computed server-side. Safe for
 * callers without a local counter (e.g. enqueue-time events).
 */
export async function appendJobLog(
	input: { jobId: string; stream: string; line: string },
	db: Db = defaultDb,
): Promise<void> {
	const nextSeq = sql<number>`coalesce((select max(${hangarJobLog.seq}) from ${hangarJobLog} where ${hangarJobLog.jobId} = ${input.jobId}), -1) + 1`;
	await db.insert(hangarJobLog).values({
		id: generateHangarJobLogId(),
		jobId: input.jobId,
		seq: nextSeq,
		stream: input.stream,
		line: input.line,
	});
}

/**
 * Mark any `running` jobs as `queued` with a `recovered` log line. Call on
 * worker boot so a crashed process never leaves a ghost running job.
 */
export async function recoverOrphanedRunning(db: Db = defaultDb): Promise<number> {
	const orphaned = await db
		.select({ id: hangarJob.id })
		.from(hangarJob)
		.where(eq(hangarJob.status, JOB_STATUSES.RUNNING));
	if (orphaned.length === 0) return 0;
	await db
		.update(hangarJob)
		.set({ status: JOB_STATUSES.QUEUED, startedAt: null })
		.where(
			inArray(
				hangarJob.id,
				orphaned.map((r) => r.id),
			),
		);
	for (const { id } of orphaned) {
		await appendJobLog({ jobId: id, stream: 'event', line: 'recovered from worker restart' }, db);
	}
	return orphaned.length;
}
