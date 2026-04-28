/**
 * Read-side helpers around `hangar.job`.
 *
 * `getActiveJobForTarget` is the load-bearing one -- the source-detail action
 * uses it to gate 409-vs-accept on duplicate enqueue, so its filter must
 * include QUEUED + RUNNING and exclude every terminal status.
 */

import { bauthUser } from '@ab/auth/schema';
import { JOB_KINDS, JOB_STATUSES } from '@ab/constants';
import { db } from '@ab/db';
import { generateAuthId, generateHangarJobId } from '@ab/utils';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	getActiveJobForTarget,
	getLatestCompleteJobByKind,
	getLatestCompleteJobForTarget,
	listRecentJobsForTarget,
	listRunningJobs,
} from './jobs-queries';
import { hangarJob } from './schema';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `hangar-jobs-queries-${TEST_USER_ID}@airboss.test`;

const jobIds: string[] = [];

beforeAll(async () => {
	const now = new Date();
	await db
		.insert(bauthUser)
		.values({
			id: TEST_USER_ID,
			email: TEST_EMAIL,
			emailVerified: false,
			name: 'Hangar jobs queries test',
			firstName: 'Hangar',
			lastName: 'JobsQ',
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
});

afterAll(async () => {
	if (jobIds.length > 0) {
		await db.delete(hangarJob).where(inArray(hangarJob.id, jobIds));
	}
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

interface InsertJobOpts {
	kind?: (typeof JOB_KINDS)[keyof typeof JOB_KINDS];
	status: (typeof JOB_STATUSES)[keyof typeof JOB_STATUSES];
	targetId: string;
	targetType?: string;
	createdAt?: Date;
	startedAt?: Date | null;
	finishedAt?: Date | null;
}

async function insertJob(opts: InsertJobOpts): Promise<string> {
	const id = generateHangarJobId();
	jobIds.push(id);
	await db.insert(hangarJob).values({
		id,
		kind: opts.kind ?? JOB_KINDS.SYNC_TO_DISK,
		targetType: opts.targetType ?? 'hangar.source',
		targetId: opts.targetId,
		status: opts.status,
		progress: {},
		payload: {},
		actorId: TEST_USER_ID,
		createdAt: opts.createdAt ?? new Date(),
		startedAt: opts.startedAt ?? null,
		finishedAt: opts.finishedAt ?? null,
	});
	return id;
}

describe('getActiveJobForTarget -- 409 gate on duplicate enqueue', () => {
	it('returns a QUEUED job for the target', async () => {
		const targetId = `target-active-queued-${TEST_USER_ID}`;
		const id = await insertJob({ status: JOB_STATUSES.QUEUED, targetId });
		const active = await getActiveJobForTarget(targetId);
		expect(active?.id).toBe(id);
	});

	it('returns a RUNNING job for the target', async () => {
		const targetId = `target-active-running-${TEST_USER_ID}`;
		const id = await insertJob({
			status: JOB_STATUSES.RUNNING,
			targetId,
			startedAt: new Date(),
		});
		const active = await getActiveJobForTarget(targetId);
		expect(active?.id).toBe(id);
	});

	it('returns undefined when only COMPLETE jobs exist', async () => {
		const targetId = `target-active-complete-${TEST_USER_ID}`;
		await insertJob({
			status: JOB_STATUSES.COMPLETE,
			targetId,
			finishedAt: new Date(),
		});
		const active = await getActiveJobForTarget(targetId);
		expect(active).toBeUndefined();
	});

	it('returns undefined when only FAILED jobs exist', async () => {
		const targetId = `target-active-failed-${TEST_USER_ID}`;
		await insertJob({
			status: JOB_STATUSES.FAILED,
			targetId,
			finishedAt: new Date(),
		});
		const active = await getActiveJobForTarget(targetId);
		expect(active).toBeUndefined();
	});

	it('returns undefined when only CANCELLED jobs exist', async () => {
		const targetId = `target-active-cancelled-${TEST_USER_ID}`;
		await insertJob({
			status: JOB_STATUSES.CANCELLED,
			targetId,
			finishedAt: new Date(),
		});
		const active = await getActiveJobForTarget(targetId);
		expect(active).toBeUndefined();
	});

	it('prefers the newest active row when there are multiple', async () => {
		const targetId = `target-active-multi-${TEST_USER_ID}`;
		const older = new Date(Date.now() - 60_000);
		const newer = new Date();
		await insertJob({ status: JOB_STATUSES.QUEUED, targetId, createdAt: older });
		const newId = await insertJob({ status: JOB_STATUSES.RUNNING, targetId, createdAt: newer });
		const active = await getActiveJobForTarget(targetId);
		expect(active?.id).toBe(newId);
	});
});

describe('getLatestCompleteJobByKind / getLatestCompleteJobForTarget', () => {
	it('returns the most-recently-finished COMPLETE job for the kind', async () => {
		const targetA = `target-latest-by-kind-a-${TEST_USER_ID}`;
		const targetB = `target-latest-by-kind-b-${TEST_USER_ID}`;
		const earlier = new Date(Date.now() - 60_000);
		const later = new Date();

		await insertJob({
			kind: JOB_KINDS.VALIDATE_REFERENCES,
			status: JOB_STATUSES.COMPLETE,
			targetId: targetA,
			finishedAt: earlier,
		});
		const newest = await insertJob({
			kind: JOB_KINDS.VALIDATE_REFERENCES,
			status: JOB_STATUSES.COMPLETE,
			targetId: targetB,
			finishedAt: later,
		});

		const latest = await getLatestCompleteJobByKind(JOB_KINDS.VALIDATE_REFERENCES);
		expect(latest?.id).toBe(newest);
	});

	it('skips non-COMPLETE jobs even when they are newer', async () => {
		const targetId = `target-latest-skip-noncomplete-${TEST_USER_ID}`;
		const earlier = new Date(Date.now() - 60_000);
		const later = new Date();

		const completeId = await insertJob({
			kind: JOB_KINDS.SIZE_REPORT,
			status: JOB_STATUSES.COMPLETE,
			targetId,
			finishedAt: earlier,
		});
		// Newer FAILED job should not displace the older COMPLETE one.
		await insertJob({
			kind: JOB_KINDS.SIZE_REPORT,
			status: JOB_STATUSES.FAILED,
			targetId,
			finishedAt: later,
		});

		const latest = await getLatestCompleteJobByKind(JOB_KINDS.SIZE_REPORT);
		expect(latest?.id).toBe(completeId);
	});

	it('scopes per-target via getLatestCompleteJobForTarget', async () => {
		const targetA = `target-per-target-a-${TEST_USER_ID}`;
		const targetB = `target-per-target-b-${TEST_USER_ID}`;
		const completeA = await insertJob({
			kind: JOB_KINDS.DIFF_SOURCE,
			status: JOB_STATUSES.COMPLETE,
			targetId: targetA,
			finishedAt: new Date(),
		});
		await insertJob({
			kind: JOB_KINDS.DIFF_SOURCE,
			status: JOB_STATUSES.COMPLETE,
			targetId: targetB,
			finishedAt: new Date(),
		});

		const latestForA = await getLatestCompleteJobForTarget(JOB_KINDS.DIFF_SOURCE, targetA);
		expect(latestForA?.id).toBe(completeA);
		expect(latestForA?.targetId).toBe(targetA);
	});
});

describe('listRunningJobs -- filters strictly by status=running', () => {
	it('returns only RUNNING rows', async () => {
		const baseTarget = `target-list-running-${TEST_USER_ID}`;
		const runningId = await insertJob({
			status: JOB_STATUSES.RUNNING,
			targetId: `${baseTarget}-r`,
			startedAt: new Date(),
		});
		const queuedId = await insertJob({
			status: JOB_STATUSES.QUEUED,
			targetId: `${baseTarget}-q`,
		});
		const completeId = await insertJob({
			status: JOB_STATUSES.COMPLETE,
			targetId: `${baseTarget}-c`,
			finishedAt: new Date(),
		});

		const running = await listRunningJobs();
		const ids = running.map((r) => r.id);
		expect(ids).toContain(runningId);
		expect(ids).not.toContain(queuedId);
		expect(ids).not.toContain(completeId);
	});
});

describe('listRecentJobsForTarget -- newest first, bounded by limit', () => {
	it('returns rows ordered by createdAt DESC and respects the limit', async () => {
		const targetId = `target-recent-${TEST_USER_ID}`;
		const t0 = new Date(Date.now() - 90_000);
		const t1 = new Date(Date.now() - 60_000);
		const t2 = new Date(Date.now() - 30_000);
		const t3 = new Date();
		await insertJob({ status: JOB_STATUSES.COMPLETE, targetId, createdAt: t0, finishedAt: t0 });
		const id1 = await insertJob({ status: JOB_STATUSES.COMPLETE, targetId, createdAt: t1, finishedAt: t1 });
		const id2 = await insertJob({ status: JOB_STATUSES.COMPLETE, targetId, createdAt: t2, finishedAt: t2 });
		const id3 = await insertJob({ status: JOB_STATUSES.RUNNING, targetId, createdAt: t3, startedAt: t3 });

		const recent = await listRecentJobsForTarget(targetId, 3);
		expect(recent).toHaveLength(3);
		expect(recent[0].id).toBe(id3);
		expect(recent[1].id).toBe(id2);
		expect(recent[2].id).toBe(id1);
	});
});
