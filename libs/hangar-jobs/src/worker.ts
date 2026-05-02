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
 * Terminal-state contract (chunk-6 review convergent fix):
 *   - The status update + audit emission run inside a single
 *     `db.transaction` so an audit-write failure never leaves the row
 *     mutated without a corresponding audit entry.
 *   - Every terminal write is gated on `status = running` so a concurrent
 *     `cancelJob` always wins. When the gate misses (0 rows updated), the
 *     handler outcome is recorded as a job-log event but NOT audited as a
 *     terminal transition - the cancel already wrote that audit row.
 *   - `runningTargets` releases AFTER the post-handler writes commit, so
 *     a queued same-target job can never start before the prior is fully
 *     terminated.
 */

import { AUDIT_OPS, auditWrite } from '@ab/audit';
import { AUDIT_TARGETS, JOB_AUDIT_REASONS, JOB_LOG_STREAMS, JOB_STATUSES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { createLogger, generateHangarJobLogId } from '@ab/utils';
import { and, asc, eq, inArray, isNotNull, isNull, like, notInArray, or } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { recoverOrphanedRunning } from './enqueue';
import { hangarJob, hangarJobLog } from './schema';
import type { JobContext, JobHandlers, JobProgress } from './types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

const log = createLogger('hangar-jobs');

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
	/**
	 * Optional list of `kind` values to claim. Defaults to "every kind in
	 * `handlers`" so a worker only claims jobs it can run; passing a tighter
	 * subset is useful for kind-pooled workers and for tests that want the
	 * worker to ignore queued rows seeded by neighbouring suites.
	 */
	kinds?: readonly string[];
	/**
	 * Test-only knob: when set, the worker only claims rows whose `targetId`
	 * is non-null and starts with the given prefix. Production should leave
	 * this undefined; integration tests use it to isolate their seeded rows
	 * from rows other tests wrote concurrently against the shared DB.
	 */
	targetIdPrefix?: string;
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
	// Default: claim only kinds we have a handler for. A worker that
	// processes "everything queued" but has no handler for some kinds would
	// flood the audit log with no-handler failures for kinds another worker
	// owns -- that pattern is opt-in via a wider `kinds` list.
	const kindFilter = options.kinds ?? Object.keys(handlers);

	const runningTargets = new Set<string>();
	const runningIds = new Set<string>();
	let stopping = false;
	let stopResolve: () => void = () => {};
	const stopped = new Promise<void>((resolve) => {
		stopResolve = resolve;
	});

	async function claimNext(): Promise<typeof hangarJob.$inferSelect | undefined> {
		// Find a queued job whose targetId is not currently running. Null-
		// target jobs share a slot per kind so multiple can run. Constrain
		// to the configured `kinds` so multiple workers can split the queue
		// without trampling each other's domains.
		if (kindFilter.length === 0) return undefined;
		const lockedTargets = Array.from(runningTargets);
		const conditions = [
			eq(hangarJob.status, JOB_STATUSES.QUEUED),
			inArray(hangarJob.kind, kindFilter as string[]),
			lockedTargets.length === 0
				? isNotNull(hangarJob.id)
				: or(isNull(hangarJob.targetId), notInArray(hangarJob.targetId, lockedTargets)),
		];
		if (options.targetIdPrefix !== undefined) {
			conditions.push(isNotNull(hangarJob.targetId));
			conditions.push(like(hangarJob.targetId, `${options.targetIdPrefix}%`));
		}
		const base = db
			.select()
			.from(hangarJob)
			.where(and(...conditions))
			.orderBy(asc(hangarJob.createdAt))
			.limit(1);
		const [candidate] = await base;
		if (!candidate) return undefined;
		// Race-safe claim: only pick it up if still queued.
		const startedAt = new Date();
		const [claimed] = await db
			.update(hangarJob)
			.set({ status: JOB_STATUSES.RUNNING, startedAt, lastHeartbeatAt: startedAt })
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

	/**
	 * Atomically transition a `running` row to a terminal status and write
	 * the matching audit row. Returns whether the gate matched (i.e. we
	 * actually wrote the terminal state). When false, the row was already
	 * transitioned by some other actor (typically `cancelJob`) and the
	 * caller MUST NOT emit the audit row a second time.
	 */
	async function commitTerminal(input: {
		jobId: string;
		actorId: string | null;
		status: typeof JOB_STATUSES.COMPLETE | typeof JOB_STATUSES.FAILED;
		result?: Record<string, unknown> | null;
		error?: string | null;
		metadata: Record<string, unknown>;
	}): Promise<boolean> {
		const finishedAt = new Date();
		try {
			return await db.transaction(async (tx) => {
				const updated = await tx
					.update(hangarJob)
					.set({
						status: input.status,
						result: input.result ?? null,
						error: input.error ?? null,
						finishedAt,
						lastHeartbeatAt: null,
					})
					.where(and(eq(hangarJob.id, input.jobId), eq(hangarJob.status, JOB_STATUSES.RUNNING)))
					.returning({ id: hangarJob.id });
				if (updated.length === 0) return false;
				await auditWrite(
					{
						actorId: input.actorId,
						op: AUDIT_OPS.UPDATE,
						targetType: AUDIT_TARGETS.HANGAR_JOB,
						targetId: input.jobId,
						metadata: { status: input.status, ...input.metadata },
					},
					tx,
				);
				return true;
			});
		} catch (err) {
			// Last-ditch breadcrumb so a 2am operator finds the trace even
			// when the transaction itself failed (db disconnect, deadlock).
			log.error(
				'terminal-state transaction failed',
				{ metadata: { jobId: input.jobId, status: input.status } },
				err instanceof Error ? err : undefined,
			);
			throw err;
		}
	}

	async function safeLog(emit: (line: string) => Promise<void>, line: string, jobId: string): Promise<void> {
		try {
			await emit(line);
		} catch (err) {
			log.warn('job-log write failed', {
				metadata: { jobId, err: err instanceof Error ? err.message : String(err) },
			});
		}
	}

	async function runJob(job: typeof hangarJob.$inferSelect): Promise<void> {
		const handler = handlers[job.kind];
		if (!handler) {
			let wrote = false;
			try {
				wrote = await commitTerminal({
					jobId: job.id,
					actorId: job.actorId,
					status: JOB_STATUSES.FAILED,
					error: `no handler registered for kind '${job.kind}'`,
					metadata: { reason: JOB_AUDIT_REASONS.NO_HANDLER },
				});
			} catch (txErr) {
				log.error(
					'no-handler terminal transaction failed',
					{ metadata: { jobId: job.id } },
					txErr instanceof Error ? txErr : undefined,
				);
			}
			if (!wrote) {
				// Either preempted by cancel or the transaction failed; leave
				// a breadcrumb but don't audit again (cancel already audited
				// or the failure path is the audit absence itself).
				try {
					await db.insert(hangarJobLog).values({
						id: generateHangarJobLogId(),
						jobId: job.id,
						seq: 0,
						stream: JOB_LOG_STREAMS.EVENT,
						line: 'no-handler outcome not recorded as terminal (preempted or tx failed)',
					});
				} catch (err) {
					log.warn('failed to log no-handler preemption event', {
						metadata: { jobId: job.id, err: err instanceof Error ? err.message : String(err) },
					});
				}
			}
			return;
		}
		const ctx = makeContext(job);
		try {
			await ctx.logEvent('started');
			const result = await handler(ctx);
			let wrote = false;
			try {
				wrote = await commitTerminal({
					jobId: job.id,
					actorId: job.actorId,
					status: JOB_STATUSES.COMPLETE,
					result: result ?? null,
					metadata: {},
				});
			} catch (txErr) {
				log.error(
					'terminal COMPLETE transaction failed',
					{ metadata: { jobId: job.id } },
					txErr instanceof Error ? txErr : undefined,
				);
			}
			await safeLog(ctx.logEvent.bind(ctx), wrote ? 'completed' : 'preempted by cancel', job.id);
		} catch (err) {
			const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
			// Order matters: write FAILED + audit FIRST (atomically), THEN
			// best-effort stderr log line. If logStderr fails, the job is
			// still terminated correctly. The transaction itself is wrapped
			// so a tx failure tries a bare status update as a last resort.
			let wrote = false;
			try {
				wrote = await commitTerminal({
					jobId: job.id,
					actorId: job.actorId,
					status: JOB_STATUSES.FAILED,
					error: message,
					metadata: { error: message },
				});
			} catch (txErr) {
				log.error(
					'terminal FAILED transaction failed; attempting bare status update',
					{ metadata: { jobId: job.id } },
					txErr instanceof Error ? txErr : undefined,
				);
				try {
					await db
						.update(hangarJob)
						.set({
							status: JOB_STATUSES.FAILED,
							error: message,
							finishedAt: new Date(),
							lastHeartbeatAt: null,
						})
						.where(and(eq(hangarJob.id, job.id), eq(hangarJob.status, JOB_STATUSES.RUNNING)));
				} catch (bareErr) {
					log.error(
						'bare FAILED status update also failed; row may be stuck running until next worker boot',
						{ metadata: { jobId: job.id } },
						bareErr instanceof Error ? bareErr : undefined,
					);
				}
			}
			await safeLog(ctx.logStderr.bind(ctx), message, job.id);
			if (!wrote) {
				await safeLog(ctx.logEvent.bind(ctx), 'preempted by cancel after handler error', job.id);
			}
		}
	}

	async function heartbeat(jobId: string): Promise<void> {
		try {
			await db
				.update(hangarJob)
				.set({ lastHeartbeatAt: new Date() })
				.where(and(eq(hangarJob.id, jobId), eq(hangarJob.status, JOB_STATUSES.RUNNING)));
		} catch (err) {
			log.warn('heartbeat write failed', {
				metadata: { jobId, err: err instanceof Error ? err.message : String(err) },
			});
		}
	}

	async function loop(): Promise<void> {
		// Recover any orphaned `running` rows once at boot.
		try {
			await recoverOrphanedRunning(db);
		} catch (err) {
			log.error('orphan recovery on boot failed', undefined, err instanceof Error ? err : undefined);
		}
		while (!stopping) {
			let picked = 0;
			try {
				while (!stopping && runningIds.size < concurrency) {
					const job = await claimNext();
					if (!job) break;
					picked++;
					runningIds.add(job.id);
					if (job.targetId != null) runningTargets.add(job.targetId);
					void runJob(job).finally(() => {
						// IMPORTANT: release the targetId AFTER runJob's terminal
						// writes have committed, so a queued same-target job can
						// not be claimed until the prior fully terminates.
						runningIds.delete(job.id);
						if (job.targetId != null) runningTargets.delete(job.targetId);
					});
				}
				// Heartbeat every running job so external probes can flag
				// stuck handlers (handler not emitting log lines + stale
				// heartbeat = stuck). Best-effort - never blocks the loop.
				if (runningIds.size > 0) {
					await Promise.all(Array.from(runningIds).map((id) => heartbeat(id)));
				}
			} catch (err) {
				log.error(
					'worker loop iteration failed',
					{ metadata: { picked, running: runningIds.size } },
					err instanceof Error ? err : undefined,
				);
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

/**
 * Mark a job cancelled. Worker stops polling it on the next `isCancelled`
 * check. Status update + audit are atomic so we never end up with a
 * `cancelled` row missing its audit predecessor.
 */
export async function cancelJob(jobId: string, actorId: string | null, db: Db = defaultDb): Promise<void> {
	await db.transaction(async (tx) => {
		const rows = await tx
			.update(hangarJob)
			.set({ status: JOB_STATUSES.CANCELLED, finishedAt: new Date(), lastHeartbeatAt: null })
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
			tx,
		);
	});
}
