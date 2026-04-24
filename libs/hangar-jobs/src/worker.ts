/**
 * In-process job worker loop. Polls `hangar.job` for the oldest queued
 * job whose `targetId` isn't already running, marks it `running`, invokes
 * the registered handler, captures stdout / stderr / event lines into
 * `hangar.job_log`, and terminates the row as `complete` or `failed`.
 *
 * Rationale for in-process + polling (locked in the companion plan):
 *   - Zero new infra (no Redis, no BullMQ) for the MVP surface.
 *   - The hangar is single-host for now; crossing that line means moving
 *     to an external queue, which this design doesn't fight.
 *   - Polling at 1 Hz is plenty: the UI already polls `/jobs/[id]` at 1
 *     Hz, so the perceived latency is dominated by that.
 *
 * Concurrency rule: no two jobs with the same `targetId` run at once.
 * Different `targetId`s (and null `targetId` jobs) run in parallel up to
 * `concurrency`.
 */

import { AUDIT_OPS, auditWrite } from '@ab/audit';
import { AUDIT_TARGETS, JOB_LOG_STREAMS, JOB_STATUSES } from '@ab/constants';
import { db as defaultDb, hangarJob, hangarJobLog } from '@ab/db';
import { generateHangarJobLogId } from '@ab/utils';
import { and, asc, eq, inArray, isNotNull, isNull, notInArray, or } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { recoverOrphanedRunning } from './enqueue';
import type { JobContext, JobHandlers, JobProgress } from './types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export interface WorkerOptions {
	handlers: JobHandlers;
	/** Max jobs to run in parallel across different target ids. */
	concurrency?: number;
	/** Polling interval between queue sweeps, in milliseconds. */
	pollIntervalMs?: number;
	/** Provide the db handle (tests use a separate instance). */
	db?: Db;
	/** Called after each loop iteration for observability. */
	onIteration?: (info: { picked: number; running: number }) => void;
}

export interface WorkerHandle {
	/** Stop the worker at the next safe point. */
	stop(): Promise<void>;
	/** Resolves when the worker loop has fully exited. */
	readonly stopped: Promise<void>;
	/** Current in-memory running-job count (diagnostic). */
	runningCount(): number;
}

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_POLL_INTERVAL_MS = 1000;

/**
 * Start a worker. Returns a handle the hangar server shutdown hook uses
 * to drain gracefully. Safe to call multiple times in tests: each handle
 * is independent.
 */
export function startWorker(options: WorkerOptions): WorkerHandle {
	const db = options.db ?? defaultDb;
	const handlers = options.handlers;
	const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
	const pollInterval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

	const runningTargets = new Set<string>();
	const runningIds = new Set<string>();
	let stopping = false;
	let stopResolve: () => void = () => {};
	const stopped = new Promise<void>((resolve) => {
		stopResolve = resolve;
	});

	async function claimNext(): Promise<typeof hangarJob.$inferSelect | undefined> {
		// Find a queued job whose targetId is not currently running. Null-
		// target jobs share a slot per kind so multiple can run.
		const lockedTargets = Array.from(runningTargets);
		const base = db
			.select()
			.from(hangarJob)
			.where(
				and(
					eq(hangarJob.status, JOB_STATUSES.QUEUED),
					lockedTargets.length === 0
						? isNotNull(hangarJob.id)
						: or(isNull(hangarJob.targetId), notInArray(hangarJob.targetId, lockedTargets)),
				),
			)
			.orderBy(asc(hangarJob.createdAt))
			.limit(1);
		const [candidate] = await base;
		if (!candidate) return undefined;
		// Race-safe claim: only pick it up if still queued.
		const [claimed] = await db
			.update(hangarJob)
			.set({ status: JOB_STATUSES.RUNNING, startedAt: new Date() })
			.where(and(eq(hangarJob.id, candidate.id), eq(hangarJob.status, JOB_STATUSES.QUEUED)))
			.returning();
		return claimed;
	}

	function makeContext(job: typeof hangarJob.$inferSelect): JobContext {
		let seq = 0;
		async function writeLine(stream: string, line: string): Promise<void> {
			await db.insert(hangarJobLog).values({
				id: generateHangarJobLogId(),
				jobId: job.id,
				seq: seq++,
				stream,
				line,
			});
		}
		return {
			job,
			async reportProgress(progress: JobProgress): Promise<void> {
				await db
					.update(hangarJob)
					.set({
						progress: {
							step: progress.step,
							total: progress.total ?? null,
							message: progress.message,
							extra: progress.extra ?? null,
						},
					})
					.where(eq(hangarJob.id, job.id));
			},
			logStdout(line: string): Promise<void> {
				return writeLine(JOB_LOG_STREAMS.STDOUT, line);
			},
			logStderr(line: string): Promise<void> {
				return writeLine(JOB_LOG_STREAMS.STDERR, line);
			},
			logEvent(line: string): Promise<void> {
				return writeLine(JOB_LOG_STREAMS.EVENT, line);
			},
			async isCancelled(): Promise<boolean> {
				const [row] = await db
					.select({ status: hangarJob.status })
					.from(hangarJob)
					.where(eq(hangarJob.id, job.id))
					.limit(1);
				return row?.status === JOB_STATUSES.CANCELLED;
			},
		};
	}

	async function runJob(job: typeof hangarJob.$inferSelect): Promise<void> {
		const handler = handlers[job.kind];
		if (!handler) {
			await db
				.update(hangarJob)
				.set({
					status: JOB_STATUSES.FAILED,
					error: `no handler registered for kind '${job.kind}'`,
					finishedAt: new Date(),
				})
				.where(eq(hangarJob.id, job.id));
			await auditWrite(
				{
					actorId: job.actorId,
					op: AUDIT_OPS.UPDATE,
					targetType: AUDIT_TARGETS.HANGAR_JOB,
					targetId: job.id,
					metadata: { status: JOB_STATUSES.FAILED, reason: 'no-handler' },
				},
				db,
			);
			return;
		}
		const ctx = makeContext(job);
		try {
			await ctx.logEvent('started');
			const result = await handler(ctx);
			await db
				.update(hangarJob)
				.set({
					status: JOB_STATUSES.COMPLETE,
					result: result ?? null,
					finishedAt: new Date(),
				})
				.where(eq(hangarJob.id, job.id));
			await ctx.logEvent('completed');
			await auditWrite(
				{
					actorId: job.actorId,
					op: AUDIT_OPS.UPDATE,
					targetType: AUDIT_TARGETS.HANGAR_JOB,
					targetId: job.id,
					metadata: { status: JOB_STATUSES.COMPLETE },
				},
				db,
			);
		} catch (err) {
			const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
			await ctx.logStderr(message);
			await db
				.update(hangarJob)
				.set({
					status: JOB_STATUSES.FAILED,
					error: message,
					finishedAt: new Date(),
				})
				.where(eq(hangarJob.id, job.id));
			await auditWrite(
				{
					actorId: job.actorId,
					op: AUDIT_OPS.UPDATE,
					targetType: AUDIT_TARGETS.HANGAR_JOB,
					targetId: job.id,
					metadata: { status: JOB_STATUSES.FAILED, error: message },
				},
				db,
			);
		}
	}

	async function loop(): Promise<void> {
		// Recover any orphaned `running` rows once at boot.
		await recoverOrphanedRunning(db);
		while (!stopping) {
			let picked = 0;
			while (!stopping && runningIds.size < concurrency) {
				const job = await claimNext();
				if (!job) break;
				picked++;
				runningIds.add(job.id);
				if (job.targetId != null) runningTargets.add(job.targetId);
				void runJob(job).finally(() => {
					runningIds.delete(job.id);
					if (job.targetId != null) runningTargets.delete(job.targetId);
				});
			}
			options.onIteration?.({ picked, running: runningIds.size });
			if (stopping) break;
			await sleep(pollInterval);
		}
		// Wait for any in-flight jobs to complete before signalling stop.
		while (runningIds.size > 0) await sleep(25);
		stopResolve();
	}

	void loop();

	return {
		async stop(): Promise<void> {
			stopping = true;
			await stopped;
		},
		stopped,
		runningCount(): number {
			return runningIds.size;
		},
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

/** Mark a job cancelled. Worker stops polling it on the next `isCancelled` check. */
export async function cancelJob(jobId: string, actorId: string | null, db: Db = defaultDb): Promise<void> {
	const rows = await db
		.update(hangarJob)
		.set({ status: JOB_STATUSES.CANCELLED, finishedAt: new Date() })
		.where(and(eq(hangarJob.id, jobId), inArray(hangarJob.status, [JOB_STATUSES.QUEUED, JOB_STATUSES.RUNNING])))
		.returning({ id: hangarJob.id });
	if (rows.length === 0) return;
	await auditWrite(
		{
			actorId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.HANGAR_JOB,
			targetId: jobId,
			metadata: { status: JOB_STATUSES.CANCELLED },
		},
		db,
	);
}
