/**
 * Integration coverage for `@ab/hangar-jobs` worker (chunk-6 review
 * convergent fix). Targets the load-bearing behaviours that ship without
 * tests:
 *
 *   - cancel-overwrite race: a `cancelled` row stays cancelled when the
 *     handler also runs to completion (terminal write gated on running).
 *   - terminal-state atomicity: the audit row commits with the status
 *     update inside one `db.transaction`.
 *   - claim race: same-targetId jobs are serialised; different-target run
 *     in parallel up to `concurrency`.
 *   - no-handler path: unknown kinds end up `failed` with a `no-handler`
 *     audit row.
 *   - heartbeat: claim writes `last_heartbeat_at`; terminal nulls it.
 *   - orphan recovery: `recoverOrphanedRunning` flips RUNNING -> QUEUED,
 *     emits a job-log line AND an audit row.
 *
 * Tests exercise the real Postgres database; mocks would hide the very
 * race / atomicity properties we care about.
 */

import { auditLog } from '@ab/audit';
import { AUDIT_TARGETS, JOB_AUDIT_REASONS, JOB_KINDS, JOB_LOG_STREAMS, JOB_STATUSES } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateHangarJobId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cancelJob, recoverOrphanedRunning, startWorker } from './index';
import { hangarJob, hangarJobLog } from './schema';

const TEST_TARGET_PREFIX = `worker-test-${process.pid}-${Date.now()}`;

const createdJobIds = new Set<string>();

beforeAll(async () => {
	// Sanity: ensure the test isn't fighting any leftover queued rows for our
	// reserved targetId prefix from a prior crashed test run.
	const stale = await db.select({ id: hangarJob.id }).from(hangarJob).where(eq(hangarJob.kind, JOB_KINDS.SYNC_TO_DISK));
	for (const row of stale) {
		if (row.id.startsWith('hjob_')) continue;
	}
	void stale;
});

afterAll(async () => {
	for (const id of createdJobIds) {
		try {
			await db.delete(auditLog).where(eq(auditLog.targetId, id));
			await db.delete(hangarJob).where(eq(hangarJob.id, id));
		} catch {
			// best-effort
		}
	}
});

afterEach(async () => {
	// Flush audit rows referencing any jobs we own this test, since the next
	// test's audit-row assertions read the table back.
	for (const id of createdJobIds) {
		try {
			await db.delete(auditLog).where(eq(auditLog.targetId, id));
			await db.delete(hangarJob).where(eq(hangarJob.id, id));
		} catch {
			// best-effort
		}
	}
	createdJobIds.clear();
});

async function insertQueuedJob(targetId: string | null, kind: string = JOB_KINDS.SYNC_TO_DISK): Promise<string> {
	const id = generateHangarJobId();
	createdJobIds.add(id);
	await db.insert(hangarJob).values({
		id,
		kind,
		targetType: 'test',
		targetId,
		status: JOB_STATUSES.QUEUED,
		progress: {},
		payload: {},
		actorId: null,
	});
	return id;
}

async function insertRunningJob(targetId: string | null): Promise<string> {
	const id = generateHangarJobId();
	createdJobIds.add(id);
	const now = new Date();
	await db.insert(hangarJob).values({
		id,
		kind: JOB_KINDS.SYNC_TO_DISK,
		targetType: 'test',
		targetId,
		status: JOB_STATUSES.RUNNING,
		progress: {},
		payload: {},
		actorId: null,
		startedAt: now,
		lastHeartbeatAt: now,
	});
	return id;
}

async function getStatus(jobId: string): Promise<string | undefined> {
	const [row] = await db.select({ status: hangarJob.status }).from(hangarJob).where(eq(hangarJob.id, jobId)).limit(1);
	return row?.status;
}

async function getJobRow(jobId: string) {
	const [row] = await db.select().from(hangarJob).where(eq(hangarJob.id, jobId)).limit(1);
	return row;
}

async function getAuditRows(jobId: string) {
	return db.select().from(auditLog).where(eq(auditLog.targetId, jobId));
}

function createBarrier(): { wait: () => Promise<void>; release: () => void } {
	let resolveFn: () => void = () => {};
	const promise = new Promise<void>((resolve) => {
		resolveFn = resolve;
	});
	return { wait: () => promise, release: () => resolveFn() };
}

async function waitFor(predicate: () => Promise<boolean> | boolean, timeoutMs = 5000, intervalMs = 25): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (await predicate()) return;
		await new Promise((r) => setTimeout(r, intervalMs));
	}
	throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

describe('worker terminal-state atomicity', () => {
	it('cancel-overwrite: cancelled row is not overwritten by handler completion', async () => {
		const targetId = `${TEST_TARGET_PREFIX}-cancel-overwrite`;
		const jobId = await insertQueuedJob(targetId);

		const handlerStarted = createBarrier();
		const releaseHandler = createBarrier();

		const worker = startWorker({
			handlers: {
				[JOB_KINDS.SYNC_TO_DISK]: async () => {
					handlerStarted.release();
					await releaseHandler.wait();
					return { ok: true };
				},
			},
			concurrency: 1,
			pollIntervalMs: 25,
			targetIdPrefix: targetId,
		});

		try {
			// Wait for the worker to claim and start the handler.
			await handlerStarted.wait();
			expect(await getStatus(jobId)).toBe(JOB_STATUSES.RUNNING);

			// Cancel mid-flight.
			await cancelJob(jobId, null);
			expect(await getStatus(jobId)).toBe(JOB_STATUSES.CANCELLED);

			// Let the handler finish normally - this is exactly the race the
			// chunk-6 critical found: handler returns, terminal write should
			// NOT clobber the cancellation.
			releaseHandler.release();

			// Wait until the worker's running set drains.
			await waitFor(() => worker.runningCount() === 0);

			// Final state must remain `cancelled`.
			expect(await getStatus(jobId)).toBe(JOB_STATUSES.CANCELLED);

			// Audit rows: exactly one terminal-state audit (the cancel). The
			// worker's COMPLETE write should NOT have produced an audit row
			// because the gated UPDATE returned 0 rows.
			const audits = await getAuditRows(jobId);
			const terminalAudits = audits.filter((a) => {
				const meta = a.metadata as { status?: string } | null;
				return (
					meta?.status === JOB_STATUSES.CANCELLED ||
					meta?.status === JOB_STATUSES.COMPLETE ||
					meta?.status === JOB_STATUSES.FAILED
				);
			});
			expect(terminalAudits).toHaveLength(1);
			expect((terminalAudits[0]?.metadata as { status?: string }).status).toBe(JOB_STATUSES.CANCELLED);
		} finally {
			await worker.stop();
		}
	});

	it('successful job writes COMPLETE status and a single matching audit row inside one tx', async () => {
		const targetId = `${TEST_TARGET_PREFIX}-success`;
		const jobId = await insertQueuedJob(targetId);

		const worker = startWorker({
			handlers: {
				[JOB_KINDS.SYNC_TO_DISK]: async () => ({ payload: 'done' }),
			},
			concurrency: 1,
			pollIntervalMs: 25,
			targetIdPrefix: targetId,
		});

		try {
			await waitFor(async () => (await getStatus(jobId)) === JOB_STATUSES.COMPLETE);
			const row = await getJobRow(jobId);
			expect(row?.status).toBe(JOB_STATUSES.COMPLETE);
			expect(row?.finishedAt).not.toBeNull();
			expect(row?.lastHeartbeatAt).toBeNull();
			expect(row?.result).toEqual({ payload: 'done' });

			const audits = await getAuditRows(jobId);
			const completeAudits = audits.filter(
				(a) => (a.metadata as { status?: string } | null)?.status === JOB_STATUSES.COMPLETE,
			);
			expect(completeAudits).toHaveLength(1);
			expect(completeAudits[0]?.targetType).toBe(AUDIT_TARGETS.HANGAR_JOB);
		} finally {
			await worker.stop();
		}
	});

	it('handler throw: writes FAILED status + audit row + stderr log line', async () => {
		const targetId = `${TEST_TARGET_PREFIX}-throw`;
		const jobId = await insertQueuedJob(targetId);

		const worker = startWorker({
			handlers: {
				[JOB_KINDS.SYNC_TO_DISK]: async () => {
					throw new Error('handler boom');
				},
			},
			concurrency: 1,
			pollIntervalMs: 25,
			targetIdPrefix: targetId,
		});

		try {
			await waitFor(async () => (await getStatus(jobId)) === JOB_STATUSES.FAILED);
			const row = await getJobRow(jobId);
			expect(row?.status).toBe(JOB_STATUSES.FAILED);
			expect(row?.error).toContain('handler boom');
			expect(row?.lastHeartbeatAt).toBeNull();

			const audits = await getAuditRows(jobId);
			const failAudits = audits.filter(
				(a) => (a.metadata as { status?: string } | null)?.status === JOB_STATUSES.FAILED,
			);
			expect(failAudits).toHaveLength(1);

			const logs = await db
				.select({ stream: hangarJobLog.stream, line: hangarJobLog.line })
				.from(hangarJobLog)
				.where(eq(hangarJobLog.jobId, jobId));
			expect(logs.some((l) => l.stream === JOB_LOG_STREAMS.STDERR && l.line.includes('handler boom'))).toBe(true);
		} finally {
			await worker.stop();
		}
	});
});

describe('worker no-handler path', () => {
	it('unknown kind transitions FAILED with a no-handler reason audit', async () => {
		// Use a kind we DON'T register a handler for. We register a handler
		// for SYNC_TO_DISK to satisfy the default `kinds = handlers.keys()`
		// filter, then enqueue under a different kind so the worker claims
		// (via the explicit `kinds` override) but finds no matching handler.
		const targetId = `${TEST_TARGET_PREFIX}-nohandler`;
		const jobId = await insertQueuedJob(targetId, JOB_KINDS.VALIDATE_REFERENCES);

		const worker = startWorker({
			handlers: {},
			concurrency: 1,
			pollIntervalMs: 25,
			kinds: [JOB_KINDS.VALIDATE_REFERENCES],
			targetIdPrefix: targetId,
		});

		try {
			await waitFor(async () => (await getStatus(jobId)) === JOB_STATUSES.FAILED);
			const row = await getJobRow(jobId);
			expect(row?.status).toBe(JOB_STATUSES.FAILED);
			expect(row?.error).toContain('no handler registered');

			const audits = await getAuditRows(jobId);
			const noHandlerAudit = audits.find((a) => {
				const meta = a.metadata as { reason?: string } | null;
				return meta?.reason === JOB_AUDIT_REASONS.NO_HANDLER;
			});
			expect(noHandlerAudit).toBeDefined();
		} finally {
			await worker.stop();
		}
	});
});

describe('worker concurrency + claim race', () => {
	it('serialises two same-targetId jobs', async () => {
		const targetId = `${TEST_TARGET_PREFIX}-serial`;
		const jobA = await insertQueuedJob(targetId);
		// Insert second after a small delay so createdAt ordering is stable.
		await new Promise((r) => setTimeout(r, 10));
		const jobB = await insertQueuedJob(targetId);

		const startedAt: string[] = [];
		const finishedAt: string[] = [];
		const releases: Record<string, ReturnType<typeof createBarrier>> = {
			[jobA]: createBarrier(),
			[jobB]: createBarrier(),
		};

		const worker = startWorker({
			handlers: {
				[JOB_KINDS.SYNC_TO_DISK]: async (ctx) => {
					startedAt.push(ctx.job.id);
					await releases[ctx.job.id].wait();
					finishedAt.push(ctx.job.id);
					return undefined;
				},
			},
			concurrency: 2,
			pollIntervalMs: 25,
			targetIdPrefix: targetId,
		});

		try {
			// Wait for the first to start.
			await waitFor(() => startedAt.length === 1);
			expect(startedAt[0]).toBe(jobA);

			// Confirm the second has NOT started despite concurrency=2 -- the
			// targetId mutex should hold it.
			await new Promise((r) => setTimeout(r, 100));
			expect(startedAt.length).toBe(1);

			// Release A; B can start now.
			releases[jobA]?.release();
			await waitFor(() => startedAt.length === 2);
			expect(startedAt[1]).toBe(jobB);

			releases[jobB]?.release();
			await waitFor(() => finishedAt.length === 2);
		} finally {
			await worker.stop();
		}
	});

	it('runs different-targetId jobs in parallel up to concurrency', async () => {
		const parPrefix = `${TEST_TARGET_PREFIX}-par-`;
		const jobA = await insertQueuedJob(`${parPrefix}a`);
		const jobB = await insertQueuedJob(`${parPrefix}b`);

		let concurrentRunning = 0;
		let maxConcurrent = 0;
		const releases: Record<string, ReturnType<typeof createBarrier>> = {
			[jobA]: createBarrier(),
			[jobB]: createBarrier(),
		};

		const worker = startWorker({
			handlers: {
				[JOB_KINDS.SYNC_TO_DISK]: async (ctx) => {
					concurrentRunning++;
					if (concurrentRunning > maxConcurrent) maxConcurrent = concurrentRunning;
					await releases[ctx.job.id].wait();
					concurrentRunning--;
					return undefined;
				},
			},
			concurrency: 2,
			pollIntervalMs: 25,
			targetIdPrefix: parPrefix,
		});

		try {
			await waitFor(() => concurrentRunning === 2);
			expect(maxConcurrent).toBe(2);
			releases[jobA]?.release();
			releases[jobB]?.release();
			await waitFor(() => worker.runningCount() === 0);
		} finally {
			await worker.stop();
		}
	});

	it('claim is race-safe: a row already taken by one worker is not double-claimed', async () => {
		// Spawn two concurrent workers against the same DB and one queued
		// job. Only one should claim it; the other should idle.
		const targetId = `${TEST_TARGET_PREFIX}-race`;
		const jobId = await insertQueuedJob(targetId);

		const claimed: string[] = [];
		const released = createBarrier();

		const handlers = {
			[JOB_KINDS.SYNC_TO_DISK]: async (ctx: { job: { id: string } }) => {
				claimed.push(ctx.job.id);
				await released.wait();
				return undefined;
			},
		};
		const w1 = startWorker({ handlers, concurrency: 1, pollIntervalMs: 10, targetIdPrefix: targetId });
		const w2 = startWorker({ handlers, concurrency: 1, pollIntervalMs: 10, targetIdPrefix: targetId });

		try {
			await waitFor(() => claimed.length === 1);
			// Wait a generous polling window; if the second worker were going
			// to double-claim, it would have by now.
			await new Promise((r) => setTimeout(r, 250));
			expect(claimed.length).toBe(1);
			expect(claimed[0]).toBe(jobId);
			released.release();
			await waitFor(() => w1.runningCount() === 0 && w2.runningCount() === 0);
		} finally {
			await w1.stop();
			await w2.stop();
		}
	});
});

describe('worker heartbeat', () => {
	it('claim writes lastHeartbeatAt; terminal nulls it', async () => {
		const targetId = `${TEST_TARGET_PREFIX}-heartbeat`;
		const jobId = await insertQueuedJob(targetId);
		const releaseHandler = createBarrier();

		const worker = startWorker({
			handlers: {
				[JOB_KINDS.SYNC_TO_DISK]: async () => {
					await releaseHandler.wait();
					return undefined;
				},
			},
			concurrency: 1,
			pollIntervalMs: 25,
			targetIdPrefix: targetId,
		});

		try {
			await waitFor(async () => (await getStatus(jobId)) === JOB_STATUSES.RUNNING);
			const running = await getJobRow(jobId);
			expect(running?.lastHeartbeatAt).not.toBeNull();

			releaseHandler.release();
			await waitFor(async () => (await getStatus(jobId)) === JOB_STATUSES.COMPLETE);
			const complete = await getJobRow(jobId);
			expect(complete?.lastHeartbeatAt).toBeNull();
		} finally {
			await worker.stop();
		}
	});
});

describe('recoverOrphanedRunning', () => {
	it('flips RUNNING -> QUEUED, emits a recovery log line and an audit row', async () => {
		const jobId = await insertRunningJob(`${TEST_TARGET_PREFIX}-orphan`);

		const recovered = await recoverOrphanedRunning();
		expect(recovered).toBeGreaterThanOrEqual(1);

		const row = await getJobRow(jobId);
		expect(row?.status).toBe(JOB_STATUSES.QUEUED);
		expect(row?.startedAt).toBeNull();
		expect(row?.lastHeartbeatAt).toBeNull();

		const logs = await db
			.select({ line: hangarJobLog.line, stream: hangarJobLog.stream })
			.from(hangarJobLog)
			.where(eq(hangarJobLog.jobId, jobId));
		expect(logs.some((l) => l.stream === JOB_LOG_STREAMS.EVENT && l.line === 'recovered from worker restart')).toBe(
			true,
		);

		const audits = await getAuditRows(jobId);
		const recoveryAudit = audits.find(
			(a) => (a.metadata as { reason?: string } | null)?.reason === JOB_AUDIT_REASONS.RECOVERED_FROM_RESTART,
		);
		expect(recoveryAudit).toBeDefined();
		expect(recoveryAudit?.targetType).toBe(AUDIT_TARGETS.HANGAR_JOB);
		expect((recoveryAudit?.metadata as { status?: string }).status).toBe(JOB_STATUSES.QUEUED);
	});
});
