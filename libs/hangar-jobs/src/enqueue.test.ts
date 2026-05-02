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
import { appendJobLog, enqueueJob, getJob, listJobs, readJobLog, writeJobLogRow } from './index';
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

describe('appendJobLog + writeJobLogRow + readJobLog', () => {
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

	it('writeJobLogRow honours the supplied seq', async () => {
		const j = await enqueueJob({ kind: JOB_KINDS.SYNC_TO_DISK, targetId: `${PREFIX}-explicit-seq`, actorId: null });
		created.add(j.id);
		await writeJobLogRow({ jobId: j.id, seq: 7, stream: JOB_LOG_STREAMS.STDERR, line: 'manual' });
		const rows = await db
			.select({ seq: hangarJobLog.seq, line: hangarJobLog.line })
			.from(hangarJobLog)
			.where(eq(hangarJobLog.jobId, j.id));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.seq).toBe(7);
		expect(rows[0]?.line).toBe('manual');
	});
});
