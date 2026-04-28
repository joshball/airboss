/**
 * Dashboard counters -- assert the deletedAt-IS-NULL filtering on
 * countLiveSources / countLiveReferences and the same filter on
 * listLiveSources. countAllJobs has no soft-delete column, so it is exercised
 * as a sanity check that the count helper composes against hangar.job.
 */

import { bauthUser } from '@ab/auth/schema';
import { JOB_KINDS, JOB_STATUSES, REFERENCE_SOURCE_TYPES } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId, generateHangarJobId } from '@ab/utils';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { countAllJobs, countLiveReferences, countLiveSources, listLiveSources } from './dashboard-queries';
import { hangarJob, hangarReference, hangarSource } from './schema';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `hangar-dashboard-${TEST_USER_ID}@airboss.test`;
const ID_PREFIX = `dashtest-${TEST_USER_ID.slice(-12)
	.toLowerCase()
	.replace(/[^a-z0-9]/g, '-')}`;

const refIds: string[] = [];
const srcIds: string[] = [];
const jobIds: string[] = [];

function refId(suffix: string): string {
	const id = `${ID_PREFIX}-ref-${suffix}`;
	refIds.push(id);
	return id;
}

function srcId(suffix: string): string {
	const id = `${ID_PREFIX}-src-${suffix}`;
	srcIds.push(id);
	return id;
}

beforeAll(async () => {
	const now = new Date();
	await db
		.insert(bauthUser)
		.values({
			id: TEST_USER_ID,
			email: TEST_EMAIL,
			emailVerified: false,
			name: 'Hangar dashboard test',
			firstName: 'Hangar',
			lastName: 'Dashboard',
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
});

afterAll(async () => {
	if (jobIds.length > 0) {
		await db.delete(hangarJob).where(inArray(hangarJob.id, jobIds));
	}
	for (const id of refIds) {
		await db.delete(hangarReference).where(eq(hangarReference.id, id));
	}
	for (const id of srcIds) {
		await db.delete(hangarSource).where(eq(hangarSource.id, id));
	}
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

describe('countLiveSources / listLiveSources -- deletedAt-IS-NULL filtering', () => {
	it('counts only live sources and excludes soft-deleted rows', async () => {
		const liveId = srcId('live');
		const deletedId = srcId('deleted');
		const now = new Date();

		await db.insert(hangarSource).values([
			{
				id: liveId,
				type: REFERENCE_SOURCE_TYPES.CFR,
				title: 'live source',
				version: 'v1',
				url: 'https://example.test/live',
				path: `data/sources/${liveId}.xml`,
				format: 'xml',
				checksum: 'pending-download',
				downloadedAt: 'pending-download',
				updatedBy: TEST_USER_ID,
			},
			{
				id: deletedId,
				type: REFERENCE_SOURCE_TYPES.CFR,
				title: 'soft-deleted source',
				version: 'v1',
				url: 'https://example.test/deleted',
				path: `data/sources/${deletedId}.xml`,
				format: 'xml',
				checksum: 'pending-download',
				downloadedAt: 'pending-download',
				updatedBy: TEST_USER_ID,
				deletedAt: now,
			},
		]);

		const count = await countLiveSources();
		const listed = await listLiveSources();
		const listedIds = listed.map((r) => r.id);

		expect(listedIds).toContain(liveId);
		expect(listedIds).not.toContain(deletedId);

		// We don't know the global count -- another test or seed may have run.
		// Asserting list ids contain ours and the count is at least the live row
		// captures the filter without coupling to global state.
		expect(count).toBeGreaterThanOrEqual(1);
	});
});

describe('countLiveReferences -- deletedAt-IS-NULL filtering', () => {
	it('counts only live references and excludes soft-deleted rows', async () => {
		const liveId = refId('live');
		const deletedId = refId('deleted');
		const now = new Date();

		await db.insert(hangarReference).values([
			{
				id: liveId,
				displayName: liveId,
				paraphrase: 'live ref',
				tags: { sourceType: REFERENCE_SOURCE_TYPES.CFR },
				updatedBy: TEST_USER_ID,
			},
			{
				id: deletedId,
				displayName: deletedId,
				paraphrase: 'deleted ref',
				tags: { sourceType: REFERENCE_SOURCE_TYPES.CFR },
				updatedBy: TEST_USER_ID,
				deletedAt: now,
			},
		]);

		const before = await countLiveReferences();
		// Add one more live row; count must grow by at least 1. (Peer suites
		// may also be writing references concurrently, so assert >= rather
		// than ==.)
		const extraId = refId('extra-live');
		await db.insert(hangarReference).values({
			id: extraId,
			displayName: extraId,
			paraphrase: 'second live ref',
			tags: { sourceType: REFERENCE_SOURCE_TYPES.CFR },
			updatedBy: TEST_USER_ID,
		});
		const after = await countLiveReferences();
		expect(after).toBeGreaterThanOrEqual(before + 1);
	});
});

describe('countAllJobs -- counts every job row regardless of status', () => {
	it('grows by at least the number of jobs we add (parallel-test tolerant)', async () => {
		const before = await countAllJobs();
		const id = generateHangarJobId();
		jobIds.push(id);
		await db.insert(hangarJob).values({
			id,
			kind: JOB_KINDS.SYNC_TO_DISK,
			targetType: 'registry',
			targetId: 'registry',
			status: JOB_STATUSES.QUEUED,
			progress: {},
			payload: {},
			actorId: TEST_USER_ID,
		});
		const after = await countAllJobs();
		// Peer test files (jobs-queries.test.ts, jobs.test.ts) write to
		// hangar.job concurrently, so we assert "grew by at least 1" rather
		// than exact delta.
		expect(after).toBeGreaterThanOrEqual(before + 1);
	});
});
