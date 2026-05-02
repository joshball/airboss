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
 *
 * Terminal-state writes are wrapped in a single transaction with their
 * audit emission AND gated on `where status = running` -- that's how a
 * user-cancel that flips the row mid-flight wins ahead of a handler that
 * happens to complete a few seconds later. Without the gate, the worker
 * silently overwrites the cancellation back to `complete` / `failed`.
 */

import { AUDIT_OPS, auditWrite } from '@ab/audit';
import { hangarJob, hangarJobLog } from '@ab/bc-hangar/schema';
import { AUDIT_TARGETS, JOB_LOG_STREAMS, JOB_STATUSES, OUTPUT_BYTE_CAPS } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { createLogger, generateHangarJobLogId } from '@ab/utils';
import { and, asc, eq, inArray, isNull, notInArray, or } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { recoverOrphanedRunning } from './enqueue';
import type { JobContext, JobHandlers, JobProgress } from './types';

const log = createLogger('hangar:worker');

/** Cap a single line's bytes; truncated content marks itself in-band. */
function capLine(line: string, max: number = OUTPUT_BYTE_CAPS.LOG_LINE_BYTES): string {
	if (line.length <= max) return line;
	return `${line.slice(0, max)}... [truncated]`;
}

/** Cap an aggregated error/result blob. */
function capBlob(text: string, max: number = OUTPUT_BYTE_CAPS.JOB_ERROR_BYTES): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max)}\n... [truncated to ${max} bytes]`;
}

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
/** Drain-loop sleep on graceful shutdown -- short so stop() returns quickly. */
const DRAIN_POLL_INTERVAL_MS = 25;
/** Heartbeat cadence -- updates `hangar.job.last_heartbeat_at` while a handler is running. */
const HEARTBEAT_INTERVAL_MS = 5000;

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
		const conditions = [eq(hangarJob.status, JOB_STATUSES.QUEUED)];
		if (lockedTargets.length > 0) {
			const orClause = or(isNull(hangarJob.targetId), notInArray(hangarJob.targetId, lockedTargets));
			if (orClause) conditions.push(orClause);
		}
		const [candidate] = await db
			.select()
			.from(hangarJob)
			.where(and(...conditions))
			.orderBy(asc(hangarJob.createdAt))
			.limit(1);
		if (!candidate) return undefined;
		// Race-safe claim: only pick it up if still queued.
		const now = new Date();
		const [claimed] = await db
			.update(hangarJob)
			.set({ status: JOB_STATUSES.RUNNING, startedAt: now, lastHeartbeatAt: now })
			.where(and(eq(hangarJob.id, candidate.id), eq(hangarJob.status, JOB_STATUSES.QUEUED)))
			.returning();
		return claimed;
	}

	function makeContext(job: typeof hangarJob.$inferSelect): JobContext {
		// Per-job monotonic counter. Calls are serialised by `await` chains in
		// handlers; concurrent `Promise.all([logStdout(a), logStdout(b)])`
		// would race, but the `(job_id, seq)` unique constraint causes the
		// loser to fail loudly rather than silently corrupt the cursor.
		let seq = 0;
		async function writeLine(stream: string, line: string): Promise<void> {
			await db.insert(hangarJobLog).values({
				id: generateHangarJobLogId(),
				jobId: job.id,
				seq: seq++,
				stream,
				line: capLine(line),
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

	/**
	 * Atomically transition a `running` job to a terminal state and emit the
	 * matching audit row in a single transaction. Gated on `status = running`
	 * so a user-cancel that flipped the row mid-flight is preserved (cancelJob
	 * sets `cancelled`; a 0-row update here means cancellation already won).
	 *
	 * Returns true when the transition committed; false when the row was
	 * already in a terminal state (cancelled most commonly).
	 */
	async function commitTerminal(
		job: typeof hangarJob.$inferSelect,
		patch: { status: string; result?: Record<string, unknown> | null; error?: string | null },
		auditMetadata: Record<string, unknown>,
	): Promise<boolean> {
		try {
			return await db.transaction(async (tx) => {
				const [updated] = await tx
					.update(hangarJob)
					.set({
						status: patch.status,
						result: patch.result ?? null,
						error: patch.error ?? null,
						finishedAt: new Date(),
					})
					.where(and(eq(hangarJob.id, job.id), eq(hangarJob.status, JOB_STATUSES.RUNNING)))
					.returning({ id: hangarJob.id });
				if (!updated) return false;
				await auditWrite(
					{
						actorId: job.actorId,
						op: AUDIT_OPS.UPDATE,
						targetType: AUDIT_TARGETS.HANGAR_JOB,
						targetId: job.id,
						metadata: auditMetadata,
					},
					tx as unknown as Db,
				);
				return true;
			});
		} catch (txErr) {
			// Last-resort breadcrumb -- the transaction failing is precisely the
			// "ghost running job" case. Don't rethrow; the loop must continue.
			log.error(
				'terminal transition failed',
				{ metadata: { jobId: job.id } },
				txErr instanceof Error ? txErr : undefined,
			);
			return false;
		}
	}

	async function runJob(job: typeof hangarJob.$inferSelect): Promise<void> {
		const handler = handlers[job.kind];
		if (!handler) {
			await commitTerminal(
				job,
				{ status: JOB_STATUSES.FAILED, error: `no handler registered for kind '${job.kind}'` },
				{ status: JOB_STATUSES.FAILED, reason: 'no-handler' },
			);
			return;
		}
		const ctx = makeContext(job);
		// Heartbeat -- runs while the handler is in flight so external
		// monitors and the /jobs page can detect a stuck handler.
		const heartbeat = setInterval(() => {
			void db
				.update(hangarJob)
				.set({ lastHeartbeatAt: new Date() })
				.where(and(eq(hangarJob.id, job.id), eq(hangarJob.status, JOB_STATUSES.RUNNING)))
				.catch((err) => {
					log.error('heartbeat update failed', { metadata: { jobId: job.id } }, err instanceof Error ? err : undefined);
				});
		}, HEARTBEAT_INTERVAL_MS);
		try {
			await ctx.logEvent('started');
			const result = await handler(ctx);
			const transitioned = await commitTerminal(
				job,
				{ status: JOB_STATUSES.COMPLETE, result: result ?? null },
				{ status: JOB_STATUSES.COMPLETE },
			);
			if (transitioned) {
				await ctx.logEvent('completed').catch((logErr) => {
					log.error(
						'post-complete log failed',
						{ metadata: { jobId: job.id } },
						logErr instanceof Error ? logErr : undefined,
					);
				});
			} else {
				// Row is no longer `running` -- cancelJob beat us.
				await ctx.logEvent('preempted by cancel (handler completed after cancellation)').catch(() => {});
			}
		} catch (err) {
			const rawMessage = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
			const message = capBlob(rawMessage);
			await ctx.logStderr(message).catch((logErr) => {
				log.error('stderr log failed', { metadata: { jobId: job.id } }, logErr instanceof Error ? logErr : undefined);
			});
			const transitioned = await commitTerminal(
				job,
				{ status: JOB_STATUSES.FAILED, error: message },
				{ status: JOB_STATUSES.FAILED, error: message },
			);
			if (!transitioned) {
				log.error(
					'handler threw on already-terminal job',
					{ metadata: { jobId: job.id } },
					err instanceof Error ? err : undefined,
				);
			}
		} finally {
			clearInterval(heartbeat);
		}
	}

	async function loop(): Promise<void> {
		// Recover any orphaned `running` rows once at boot.
		try {
			await recoverOrphanedRunning(db);
		} catch (err) {
			log.error('recoverOrphanedRunning threw at boot', undefined, err instanceof Error ? err : undefined);
		}
		while (!stopping) {
			let picked = 0;
			while (!stopping && runningIds.size < concurrency) {
				let job: typeof hangarJob.$inferSelect | undefined;
				try {
					job = await claimNext();
				} catch (err) {
					log.error('claimNext threw', undefined, err instanceof Error ? err : undefined);
					break;
				}
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
		while (runningIds.size > 0) await sleep(DRAIN_POLL_INTERVAL_MS);
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
