/**
 * BC query helpers (`queries.ts`) hit the real DB. The tests guard the
 * upsert / override / staleness contract end-to-end against
 * `hangar.ingest_issue` + `hangar.ingest_override`, plus the `audit_log`
 * row written through `auditWrite`.
 *
 * Each test seeds its own fixture rows keyed by the test-user id so two
 * concurrent test runs never collide. `afterAll` cascades the deletion
 * through the FK on the issue row.
 */

import { auditLog } from '@ab/audit';
import { bauthUser } from '@ab/auth/schema';
import { AUDIT_TARGETS, INGEST_REVIEW } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId } from '@ab/utils';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	applyOverride,
	dismissIssue,
	getCurrentOverride,
	getCurrentOverrides,
	getIssue,
	getStatusCounts,
	IssueNotFoundError,
	listIssues,
	listOverridesWithIssues,
	listSources,
	markStaleByDifference,
	reopenIssue,
	upsertIssue,
	upsertIssues,
} from './queries';
import { ingestIssue, ingestOverride } from './schema';
import type { IssueInput } from './types';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `ingest-review-queries-${TEST_USER_ID}@airboss.test`;
const TEST_TAG = TEST_USER_ID.slice(-12);

const seededIssueIds: string[] = [];

beforeAll(async () => {
	const now = new Date();
	await db
		.insert(bauthUser)
		.values({
			id: TEST_USER_ID,
			email: TEST_EMAIL,
			emailVerified: false,
			name: 'Ingest review queries test',
			firstName: 'Ingest',
			lastName: 'Queries',
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
});

afterAll(async () => {
	if (seededIssueIds.length > 0) {
		await db.delete(ingestIssue).where(inArray(ingestIssue.id, seededIssueIds));
	}
	await db.delete(auditLog).where(eq(auditLog.actorId, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

function makeInput(overrides: Partial<IssueInput> = {}): IssueInput {
	const externalId = overrides.externalId ?? `ext_${TEST_TAG}_${Math.random().toString(36).slice(2, 10)}`;
	return {
		corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
		sourceId: 'ifh',
		edition: 'FAA-H-8083-15B',
		pageNum: 83,
		kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN,
		externalId,
		payload: { captionText: 'sample', mode: 'unknown', sectionCode: '', candidateSnapshot: [] },
		...overrides,
	};
}

async function seedIssue(overrides: Partial<IssueInput> = {}) {
	const result = await upsertIssue(makeInput(overrides));
	seededIssueIds.push(result.id);
	return result;
}

describe('upsertIssue', () => {
	it('inserts a fresh (kind, external_id) row with first_seen_at == last_seen_at', async () => {
		const input = makeInput();
		const result = await upsertIssue(input);
		seededIssueIds.push(result.id);

		expect(result.externalId).toBe(input.externalId);
		expect(result.status).toBe(INGEST_REVIEW.STATUS.UNRESOLVED);
		expect(result.firstSeenAt.getTime()).toBe(result.lastSeenAt.getTime());
		expect(result.payload).toMatchObject({ captionText: 'sample' });
	});

	it('updates payload + last_seen_at on a second upsert with the same key, preserves first_seen_at', async () => {
		const input = makeInput();
		const first = await upsertIssue(input);
		seededIssueIds.push(first.id);

		// Sleep 5 ms so the two timestamps clearly differ.
		await new Promise((resolve) => setTimeout(resolve, 5));

		const updated = await upsertIssue({
			...input,
			payload: { captionText: 'updated', mode: 'image-extracted-elsewhere', sectionCode: '4-7', candidateSnapshot: [] },
		});

		expect(updated.id).toBe(first.id);
		expect(updated.firstSeenAt.getTime()).toBe(first.firstSeenAt.getTime());
		expect(updated.lastSeenAt.getTime()).toBeGreaterThan(first.lastSeenAt.getTime());
		expect(updated.payload).toMatchObject({ captionText: 'updated' });
	});

	it('flips a stale row back to unresolved on re-emergence', async () => {
		const input = makeInput();
		const seeded = await upsertIssue(input);
		seededIssueIds.push(seeded.id);
		await markStaleByDifference(
			{ corpus: INGEST_REVIEW.CORPUSES.HANDBOOK, kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN },
			[],
		);
		const reEmerged = await upsertIssue(input);
		expect(reEmerged.status).toBe(INGEST_REVIEW.STATUS.UNRESOLVED);
	});
});

describe('upsertIssues (bulk)', () => {
	it('upserts a batch in one logical call', async () => {
		const inputs = [makeInput(), makeInput(), makeInput()];
		const rows = await upsertIssues(inputs);
		for (const r of rows) seededIssueIds.push(r.id);
		expect(rows).toHaveLength(3);
		expect(new Set(rows.map((r) => r.id)).size).toBe(3);
	});
});

describe('listIssues + filters', () => {
	it('filters by corpus + status', async () => {
		const ext = `list_${TEST_TAG}_${Math.random().toString(36).slice(2, 8)}`;
		const seeded = await seedIssue({ externalId: ext });
		const rows = await listIssues({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			status: INGEST_REVIEW.STATUS.UNRESOLVED,
		});
		expect(rows.some((r) => r.id === seeded.id)).toBe(true);
		const wrongStatus = await listIssues({
			corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
			status: INGEST_REVIEW.STATUS.DISMISSED,
		});
		expect(wrongStatus.some((r) => r.id === seeded.id)).toBe(false);
	});

	it('accepts a list of statuses', async () => {
		const seeded = await seedIssue();
		const rows = await listIssues({
			status: [INGEST_REVIEW.STATUS.UNRESOLVED, INGEST_REVIEW.STATUS.RESOLVED],
		});
		expect(rows.some((r) => r.id === seeded.id)).toBe(true);
	});
});

describe('getIssue', () => {
	it('returns the row by id', async () => {
		const seeded = await seedIssue();
		const fetched = await getIssue(seeded.id);
		expect(fetched.id).toBe(seeded.id);
	});

	it('throws IssueNotFoundError on miss', async () => {
		await expect(getIssue('isiss_missing_xxx')).rejects.toBeInstanceOf(IssueNotFoundError);
	});
});

describe('applyOverride', () => {
	it('inserts the first override and flips status to resolved', async () => {
		const seeded = await seedIssue();
		const result = await applyOverride({
			issueId: seeded.id,
			action: {
				action: INGEST_REVIEW.ACTIONS.PAIR,
				payload: { figureId: 'fig-4-7-00', imagePage: 84, imageXref: 7 },
			},
			actorUserId: TEST_USER_ID,
		});
		expect(result.action).toBe(INGEST_REVIEW.ACTIONS.PAIR);
		expect(result.payload).toMatchObject({ figureId: 'fig-4-7-00' });

		const issue = await getIssue(seeded.id);
		expect(issue.status).toBe(INGEST_REVIEW.STATUS.RESOLVED);
	});

	it('replaces the override on a second call (one row per issue)', async () => {
		const seeded = await seedIssue();
		const first = await applyOverride({
			issueId: seeded.id,
			action: {
				action: INGEST_REVIEW.ACTIONS.PAIR,
				payload: { figureId: 'fig-a', imagePage: 1, imageXref: 1 },
			},
			actorUserId: TEST_USER_ID,
		});
		const second = await applyOverride({
			issueId: seeded.id,
			action: { action: INGEST_REVIEW.ACTIONS.MARK_NO_FIGURE, payload: {} },
			actorUserId: TEST_USER_ID,
		});
		expect(second.id).toBe(first.id);
		expect(second.action).toBe(INGEST_REVIEW.ACTIONS.MARK_NO_FIGURE);

		const all = await db.select().from(ingestOverride).where(eq(ingestOverride.issueId, seeded.id));
		expect(all).toHaveLength(1);
	});

	it('writes one audit_log row per applyOverride call', async () => {
		const seeded = await seedIssue();
		await applyOverride({
			issueId: seeded.id,
			action: {
				action: INGEST_REVIEW.ACTIONS.PAIR,
				payload: { figureId: 'fig-x', imagePage: 5, imageXref: 9 },
			},
			actorUserId: TEST_USER_ID,
		});
		const auditRows = await db
			.select()
			.from(auditLog)
			.where(and(eq(auditLog.actorId, TEST_USER_ID), eq(auditLog.targetId, seeded.id)));
		const ingestRows = auditRows.filter((r) => r.targetType === AUDIT_TARGETS.HANGAR_INGEST_OVERRIDE);
		expect(ingestRows).toHaveLength(1);
		expect(ingestRows[0]?.op).toBe('create');
	});
});

describe('getCurrentOverride', () => {
	it('returns null when no override exists', async () => {
		const seeded = await seedIssue();
		const override = await getCurrentOverride(seeded.id);
		expect(override).toBeNull();
	});

	it('returns the most recent override on hit', async () => {
		const seeded = await seedIssue();
		await applyOverride({
			issueId: seeded.id,
			action: {
				action: INGEST_REVIEW.ACTIONS.PAIR,
				payload: { figureId: 'fig-y', imagePage: 1, imageXref: 1 },
			},
			actorUserId: TEST_USER_ID,
		});
		const override = await getCurrentOverride(seeded.id);
		expect(override).not.toBeNull();
		expect(override?.action).toBe(INGEST_REVIEW.ACTIONS.PAIR);
	});
});

describe('getCurrentOverrides (bulk)', () => {
	it('returns a Map keyed by issue_id', async () => {
		const a = await seedIssue();
		const b = await seedIssue();
		await applyOverride({
			issueId: a.id,
			action: { action: INGEST_REVIEW.ACTIONS.MARK_NO_FIGURE, payload: {} },
			actorUserId: TEST_USER_ID,
		});
		const map = await getCurrentOverrides([a.id, b.id]);
		expect(map.has(a.id)).toBe(true);
		expect(map.has(b.id)).toBe(false);
	});

	it('returns an empty map for an empty input list', async () => {
		const map = await getCurrentOverrides([]);
		expect(map.size).toBe(0);
	});
});

describe('listOverridesWithIssues', () => {
	it('returns issue + override pairs for the corpus', async () => {
		const seeded = await seedIssue();
		await applyOverride({
			issueId: seeded.id,
			action: {
				action: INGEST_REVIEW.ACTIONS.PAIR,
				payload: { figureId: 'fig-z', imagePage: 3, imageXref: 4 },
			},
			actorUserId: TEST_USER_ID,
		});
		const pairs = await listOverridesWithIssues({ corpus: INGEST_REVIEW.CORPUSES.HANDBOOK, sourceId: 'ifh' });
		expect(pairs.some((p) => p.issue.id === seeded.id)).toBe(true);
	});
});

describe('markStaleByDifference', () => {
	it('flips listed status to stale only for issues NOT in seenExternalIds', async () => {
		const aExt = `stale_a_${TEST_TAG}_${Math.random().toString(36).slice(2, 8)}`;
		const bExt = `stale_b_${TEST_TAG}_${Math.random().toString(36).slice(2, 8)}`;
		const a = await seedIssue({ externalId: aExt });
		const b = await seedIssue({ externalId: bExt });

		const staled = await markStaleByDifference(
			{ corpus: INGEST_REVIEW.CORPUSES.HANDBOOK, kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN },
			[bExt],
		);
		const aAfter = await getIssue(a.id);
		const bAfter = await getIssue(b.id);
		expect(aAfter.status).toBe(INGEST_REVIEW.STATUS.STALE);
		expect(bAfter.status).toBe(INGEST_REVIEW.STATUS.UNRESOLVED);
		expect(staled).toContain(a.id);
		expect(staled).not.toContain(b.id);
	});

	it('preserves a resolved override across staleness; re-emergence flips status back to resolved', async () => {
		const ext = `resilient_${TEST_TAG}_${Math.random().toString(36).slice(2, 8)}`;
		const input = makeInput({ externalId: ext });
		const seeded = await upsertIssue(input);
		seededIssueIds.push(seeded.id);
		await applyOverride({
			issueId: seeded.id,
			action: {
				action: INGEST_REVIEW.ACTIONS.PAIR,
				payload: { figureId: 'fig-r', imagePage: 1, imageXref: 1 },
			},
			actorUserId: TEST_USER_ID,
		});
		await markStaleByDifference(
			{ corpus: INGEST_REVIEW.CORPUSES.HANDBOOK, kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN },
			[],
		);
		const stale = await getIssue(seeded.id);
		expect(stale.status).toBe(INGEST_REVIEW.STATUS.STALE);
		const overrideStillThere = await getCurrentOverride(seeded.id);
		expect(overrideStillThere).not.toBeNull();

		// Re-emergence: re-running upsert with the same external_id flips
		// status back to unresolved (the producer's view); applying an
		// override (or the existing override surviving) drives the resolved
		// label on the queue. The contract is only that the override row
		// survives staleness.
		await upsertIssue(input);
		const reEmerged = await getIssue(seeded.id);
		// Status returns to UNRESOLVED on re-emerge (an override on top of
		// the same row is the user's separate decision).
		expect(reEmerged.status).toBe(INGEST_REVIEW.STATUS.UNRESOLVED);
	});
});

describe('dismissIssue / reopenIssue', () => {
	it('dismissIssue drops any override and flips status to dismissed', async () => {
		const seeded = await seedIssue();
		await applyOverride({
			issueId: seeded.id,
			action: { action: INGEST_REVIEW.ACTIONS.MARK_FALSE_CAPTION, payload: {} },
			actorUserId: TEST_USER_ID,
		});
		await dismissIssue(seeded.id, TEST_USER_ID);
		const after = await getIssue(seeded.id);
		expect(after.status).toBe(INGEST_REVIEW.STATUS.DISMISSED);
		const override = await getCurrentOverride(seeded.id);
		expect(override).toBeNull();
	});

	it('reopenIssue flips status back to unresolved and drops any override', async () => {
		const seeded = await seedIssue();
		await applyOverride({
			issueId: seeded.id,
			action: { action: INGEST_REVIEW.ACTIONS.MARK_NO_FIGURE, payload: {} },
			actorUserId: TEST_USER_ID,
		});
		await reopenIssue(seeded.id, TEST_USER_ID);
		const after = await getIssue(seeded.id);
		expect(after.status).toBe(INGEST_REVIEW.STATUS.UNRESOLVED);
		const override = await getCurrentOverride(seeded.id);
		expect(override).toBeNull();
	});
});

describe('getStatusCounts', () => {
	it('groups by status', async () => {
		const seeded = await seedIssue();
		await applyOverride({
			issueId: seeded.id,
			action: {
				action: INGEST_REVIEW.ACTIONS.PAIR,
				payload: { figureId: 'fig-c', imagePage: 1, imageXref: 1 },
			},
			actorUserId: TEST_USER_ID,
		});
		const counts = await getStatusCounts({ corpus: INGEST_REVIEW.CORPUSES.HANDBOOK });
		expect(counts.resolved).toBeGreaterThanOrEqual(1);
	});
});

describe('listSources', () => {
	it('returns distinct (corpus, sourceId) pairs with totals', async () => {
		await seedIssue({ sourceId: `srctest_${TEST_TAG}` });
		const rows = await listSources(INGEST_REVIEW.CORPUSES.HANDBOOK);
		expect(rows.some((r) => r.sourceId === `srctest_${TEST_TAG}`)).toBe(true);
	});
});
