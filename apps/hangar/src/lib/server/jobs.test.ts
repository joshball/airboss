/**
 * Integration tests for the /jobs wiring:
 *
 * - `enqueueJob({ kind: SYNC_TO_DISK })` produces a `hangar.job` row (as the
 *   /glossary Sync-all-pending form action would).
 * - Cursor-based log polling reads only rows with `seq > sinceSeq` (no
 *   duplicates on subsequent polls).
 */

import { bauthUser } from '@ab/auth/schema';
import { JOB_KINDS, JOB_STATUSES } from '@ab/constants';
import { db, hangarJob } from '@ab/db';
import { appendJobLog, enqueueJob, readJobLog } from '@ab/hangar-jobs';
import { generateAuthId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `hangar-jobs-test-${TEST_USER_ID}@airboss.test`;
const createdJobs: string[] = [];

beforeAll(async () => {
	const now = new Date();
	await db
		.insert(bauthUser)
		.values({
			id: TEST_USER_ID,
			email: TEST_EMAIL,
			emailVerified: false,
			name: 'Hangar jobs test',
			firstName: 'Hangar',
			lastName: 'Jobs',
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
});

afterAll(async () => {
	for (const id of createdJobs) {
		// cascade deletes the job_log rows via the FK.
		await db.delete(hangarJob).where(eq(hangarJob.id, id));
	}
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

describe('sync-all-pending enqueue', () => {
	it('creates a queued hangar.job row with kind=sync-to-disk', async () => {
		const job = await enqueueJob({
			kind: JOB_KINDS.SYNC_TO_DISK,
			targetType: 'registry',
			targetId: 'registry',
			actorId: TEST_USER_ID,
			payload: {},
		});
		createdJobs.push(job.id);

		expect(job.kind).toBe(JOB_KINDS.SYNC_TO_DISK);
		expect(job.status).toBe(JOB_STATUSES.QUEUED);
		expect(job.actorId).toBe(TEST_USER_ID);

		const [row] = await db.select().from(hangarJob).where(eq(hangarJob.id, job.id)).limit(1);
		expect(row?.kind).toBe(JOB_KINDS.SYNC_TO_DISK);
		expect(row?.status).toBe(JOB_STATUSES.QUEUED);
	});
});

describe('job-log cursor polling', () => {
	it('returns only rows with seq > sinceSeq on subsequent reads', async () => {
		const job = await enqueueJob({
			kind: JOB_KINDS.SYNC_TO_DISK,
			targetType: 'registry',
			targetId: `registry-log-${TEST_USER_ID}`,
			actorId: TEST_USER_ID,
			payload: {},
		});
		createdJobs.push(job.id);

		await appendJobLog({ jobId: job.id, stream: 'event', line: 'started' });
		await appendJobLog({ jobId: job.id, stream: 'stdout', line: 'step 1 complete' });
		await appendJobLog({ jobId: job.id, stream: 'stdout', line: 'step 2 complete' });

		// First poll: sinceSeq = -1 (client has nothing yet).
		const first = await readJobLog(job.id, { sinceSeq: -1 });
		expect(first.length).toBeGreaterThanOrEqual(3);
		const maxSeq = Math.max(...first.map((r) => r.seq));

		// Second poll: same cursor -> no rows.
		const empty = await readJobLog(job.id, { sinceSeq: maxSeq });
		expect(empty.length).toBe(0);

		// Append one more -> only the new row comes back.
		await appendJobLog({ jobId: job.id, stream: 'event', line: 'completed' });
		const fresh = await readJobLog(job.id, { sinceSeq: maxSeq });
		expect(fresh.length).toBe(1);
		expect(fresh[0]?.stream).toBe('event');
		expect(fresh[0]?.line).toBe('completed');
	});

	it('duplicates are impossible across two polls at the same cursor', async () => {
		const job = await enqueueJob({
			kind: JOB_KINDS.SYNC_TO_DISK,
			targetType: 'registry',
			targetId: `registry-dup-${TEST_USER_ID}`,
			actorId: TEST_USER_ID,
			payload: {},
		});
		createdJobs.push(job.id);

		await appendJobLog({ jobId: job.id, stream: 'stdout', line: 'line-a' });
		await appendJobLog({ jobId: job.id, stream: 'stdout', line: 'line-b' });

		const first = await readJobLog(job.id, { sinceSeq: -1 });
		const second = await readJobLog(job.id, { sinceSeq: first[first.length - 1]?.seq ?? -1 });

		expect(second.length).toBe(0);
		const firstLines = first.map((r) => r.line);
		expect(new Set(firstLines).size).toBe(firstLines.length);
	});
});
