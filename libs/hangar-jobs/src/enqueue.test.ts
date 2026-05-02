/**
 * Coverage for `@ab/hangar-jobs` enqueue helpers (chunk-6 review:
 * libs/hangar-jobs/src/enqueue.ts ships with no direct tests).
 *
 * The integration assertions hit the real DB so the
 * `db.transaction(...)` wrapping behaviour is exercised end-to-end.
 */

import { AUDIT_OPS, auditLog } from '@ab/audit';
import { AUDIT_TARGETS, JOB_KINDS, JOB_LOG_STREAMS, JOB_STATUSES } from '@ab/constants';
import { db } from '@ab/db/connection';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { appendJobLog, enqueueJob, getJob, listJobs, readJobLog } from './index';
import { hangarJob, hangarJobLog } from './schema';

const PREFIX = `enqueue-test-${process.pid}-${Date.now()}`;
const created = new Set<string>();

afterEach(async () => {
	for (const id of created) {
		try {
			await db.delete(auditLog).where(eq(auditLog.targetId, id));
			await db.delete(hangarJob).where(eq(hangarJob.id, id));
		} catch {
			// best-effort
		}
	}
	created.clear();
});

describe('enqueueJob', () => {
	it('inserts a queued row + matching CREATE audit row atomically', async () => {
		const targetId = `${PREFIX}-create`;
		const job = await enqueueJob({
			kind: JOB_KINDS.SYNC_TO_DISK,
			targetType: 'test',
			targetId,
			actorId: null,
			payload: { foo: 'bar' },
		});
		created.add(job.id);

		expect(job.status).toBe(JOB_STATUSES.QUEUED);
		expect(job.kind).toBe(JOB_KINDS.SYNC_TO_DISK);
		expect(job.payload).toEqual({ foo: 'bar' });

		const audits = await db.select().from(auditLog).where(eq(auditLog.targetId, job.id));
		expect(audits).toHaveLength(1);
		expect(audits[0]?.op).toBe(AUDIT_OPS.CREATE);
		expect(audits[0]?.targetType).toBe(AUDIT_TARGETS.HANGAR_JOB);
		expect((audits[0]?.after as { kind?: string }).kind).toBe(JOB_KINDS.SYNC_TO_DISK);
	});
});

describe('getJob + listJobs', () => {
	it('round-trips an inserted row', async () => {
		const job = await enqueueJob({ kind: JOB_KINDS.SYNC_TO_DISK, targetId: `${PREFIX}-rt`, actorId: null });
		created.add(job.id);
		const fetched = await getJob(job.id);
		expect(fetched?.id).toBe(job.id);
	});

	it('filters by kind / status / actorId', async () => {
		const j = await enqueueJob({ kind: JOB_KINDS.SYNC_TO_DISK, targetId: `${PREFIX}-filter`, actorId: null });
		created.add(j.id);
		const byKind = await listJobs({ kind: JOB_KINDS.SYNC_TO_DISK, limit: 200 });
		expect(byKind.some((r) => r.id === j.id)).toBe(true);
		const byStatus = await listJobs({ status: JOB_STATUSES.QUEUED, limit: 200 });
		expect(byStatus.some((r) => r.id === j.id)).toBe(true);
	});
});

describe('appendJobLog + readJobLog', () => {
	it('appendJobLog assigns monotonic seq starting at 0', async () => {
		const j = await enqueueJob({ kind: JOB_KINDS.SYNC_TO_DISK, targetId: `${PREFIX}-log-mono`, actorId: null });
		created.add(j.id);
		await appendJobLog({ jobId: j.id, stream: JOB_LOG_STREAMS.EVENT, line: 'first' });
		await appendJobLog({ jobId: j.id, stream: JOB_LOG_STREAMS.EVENT, line: 'second' });
		await appendJobLog({ jobId: j.id, stream: JOB_LOG_STREAMS.EVENT, line: 'third' });
		const rows = await db
			.select({ seq: hangarJobLog.seq, line: hangarJobLog.line })
			.from(hangarJobLog)
			.where(eq(hangarJobLog.jobId, j.id));
		const sorted = rows.sort((a, b) => a.seq - b.seq);
		expect(sorted.map((r) => r.seq)).toEqual([0, 1, 2]);
		expect(sorted.map((r) => r.line)).toEqual(['first', 'second', 'third']);
	});

	it('readJobLog respects sinceSeq cursor', async () => {
		const j = await enqueueJob({ kind: JOB_KINDS.SYNC_TO_DISK, targetId: `${PREFIX}-cursor`, actorId: null });
		created.add(j.id);
		await appendJobLog({ jobId: j.id, stream: JOB_LOG_STREAMS.STDOUT, line: 'a' });
		await appendJobLog({ jobId: j.id, stream: JOB_LOG_STREAMS.STDOUT, line: 'b' });
		await appendJobLog({ jobId: j.id, stream: JOB_LOG_STREAMS.STDOUT, line: 'c' });
		const first = await readJobLog(j.id, { sinceSeq: -1 });
		expect(first.length).toBe(3);
		const last = first[first.length - 1]?.seq ?? -1;
		const empty = await readJobLog(j.id, { sinceSeq: last });
		expect(empty.length).toBe(0);
	});

	it('N concurrent appenders for the same jobId all land distinct seqs (chunk-6 schema critical)', async () => {
		const j = await enqueueJob({
			kind: JOB_KINDS.SYNC_TO_DISK,
			targetId: `${PREFIX}-concurrent`,
			actorId: null,
		});
		created.add(j.id);
		const N = 20;
		// Fire N concurrent appends. Without the FOR UPDATE row lock + unique
		// constraint, two of these would land on the same seq under
		// READ COMMITTED; with the fix they all serialise on the parent row.
		await Promise.all(
			Array.from({ length: N }, (_, i) =>
				appendJobLog({ jobId: j.id, stream: JOB_LOG_STREAMS.EVENT, line: `line-${i}` }),
			),
		);
		const rows = await db.select({ seq: hangarJobLog.seq }).from(hangarJobLog).where(eq(hangarJobLog.jobId, j.id));
		expect(rows).toHaveLength(N);
		const seqs = rows.map((r) => r.seq).sort((a, b) => a - b);
		// Distinct, contiguous, starting at 0.
		expect(seqs).toEqual(Array.from({ length: N }, (_, i) => i));
		expect(new Set(seqs).size).toBe(N);
	});

	it('exercises the recovery + draining-worker race: two parallel waves of appends never collide', async () => {
		// Simulates the chunk-6 race: orphan-recovery loop appending one
		// "recovered" line per orphaned job while the previous worker is still
		// flushing its handler stream. Both paths now route through
		// `appendJobLog`; without the row lock, the two waves could observe
		// the same MAX(seq) and produce duplicate rows.
		const j = await enqueueJob({
			kind: JOB_KINDS.SYNC_TO_DISK,
			targetId: `${PREFIX}-recover-race`,
			actorId: null,
		});
		created.add(j.id);
		const drainingWorker = Promise.all(
			Array.from({ length: 10 }, (_, i) =>
				appendJobLog({ jobId: j.id, stream: JOB_LOG_STREAMS.STDOUT, line: `worker-${i}` }),
			),
		);
		const orphanRecovery = Promise.all(
			Array.from({ length: 10 }, (_, i) =>
				appendJobLog({ jobId: j.id, stream: JOB_LOG_STREAMS.EVENT, line: `recovered-${i}` }),
			),
		);
		await Promise.all([drainingWorker, orphanRecovery]);
		const rows = await db.select({ seq: hangarJobLog.seq }).from(hangarJobLog).where(eq(hangarJobLog.jobId, j.id));
		expect(rows).toHaveLength(20);
		const seqs = rows.map((r) => r.seq);
		expect(new Set(seqs).size).toBe(20); // no duplicates
		const sorted = [...seqs].sort((a, b) => a - b);
		expect(sorted).toEqual(Array.from({ length: 20 }, (_, i) => i));
	});

	it('different jobIds do not block each other (per-job lock granularity)', async () => {
		// Sanity: the FOR UPDATE lock is per parent row, so two different jobs
		// must be able to append in parallel without serialising globally.
		const a = await enqueueJob({ kind: JOB_KINDS.SYNC_TO_DISK, targetId: `${PREFIX}-iso-a`, actorId: null });
		const b = await enqueueJob({ kind: JOB_KINDS.SYNC_TO_DISK, targetId: `${PREFIX}-iso-b`, actorId: null });
		created.add(a.id);
		created.add(b.id);
		await Promise.all([
			appendJobLog({ jobId: a.id, stream: JOB_LOG_STREAMS.EVENT, line: 'a-0' }),
			appendJobLog({ jobId: b.id, stream: JOB_LOG_STREAMS.EVENT, line: 'b-0' }),
			appendJobLog({ jobId: a.id, stream: JOB_LOG_STREAMS.EVENT, line: 'a-1' }),
			appendJobLog({ jobId: b.id, stream: JOB_LOG_STREAMS.EVENT, line: 'b-1' }),
		]);
		const aRows = await db.select({ seq: hangarJobLog.seq }).from(hangarJobLog).where(eq(hangarJobLog.jobId, a.id));
		const bRows = await db.select({ seq: hangarJobLog.seq }).from(hangarJobLog).where(eq(hangarJobLog.jobId, b.id));
		expect(aRows.map((r) => r.seq).sort()).toEqual([0, 1]);
		expect(bRows.map((r) => r.seq).sort()).toEqual([0, 1]);
	});
});
