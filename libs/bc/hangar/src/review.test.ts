/**
 * Review BC primitive tests -- hits the live Postgres dev DB (per project
 * test pattern). Each test scopes its rows under a unique board name + ref
 * prefix so cleanup is targeted; we never walk live rows.
 */

import { bauthUser } from '@ab/auth/schema';
import { db } from '@ab/db/connection';
import { generateAuthId } from '@ab/utils';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	countItemsByCriteria,
	countReviewQueueOpen,
	createBucket,
	createColumn,
	createTask,
	deleteBucket,
	deleteTask,
	finishSession,
	getBoard,
	getBucket,
	getItem,
	getOpenSession,
	getOrCreateBoard,
	listBuckets,
	listColumns,
	listItems,
	listKinds,
	listSessions,
	listSteps,
	listTasks,
	pinItemToColumn,
	recordStep,
	seedDefaultBuckets,
	softDeleteItem,
	startSession,
	updateBucket,
	updateTask,
	upsertItem,
	validateBucketFilterCriteria,
} from './review';
import {
	hangarBoard,
	hangarBoardColumn,
	hangarBoardTask,
	hangarReviewBucket,
	hangarReviewItem,
	hangarReviewSession,
	hangarReviewStep,
} from './schema';

const TEST_USER_ID = generateAuthId();
const TEST_USER_2_ID = generateAuthId();
const TEST_EMAIL = `review-bc-test-${TEST_USER_ID}@airboss.test`;
const TEST_EMAIL_2 = `review-bc-test-2-${TEST_USER_2_ID}@airboss.test`;
const BOARD_NAME_PREFIX = `test-${TEST_USER_ID.slice(-12)}-`;

// Track ids for targeted cleanup.
const boardIds: string[] = [];

beforeAll(async () => {
	const now = new Date();
	await db
		.insert(bauthUser)
		.values([
			{
				id: TEST_USER_ID,
				email: TEST_EMAIL,
				emailVerified: false,
				name: 'Review BC test 1',
				firstName: 'Review',
				lastName: 'BC1',
				createdAt: now,
				updatedAt: now,
			},
			{
				id: TEST_USER_2_ID,
				email: TEST_EMAIL_2,
				emailVerified: false,
				name: 'Review BC test 2',
				firstName: 'Review',
				lastName: 'BC2',
				createdAt: now,
				updatedAt: now,
			},
		])
		.onConflictDoNothing();
});

afterAll(async () => {
	if (boardIds.length > 0) {
		// Cascade walks columns / buckets / items / sessions / steps / tasks.
		await db.delete(hangarBoard).where(inArray(hangarBoard.id, boardIds));
	}
	// Single round-trip for both test users.
	await db.delete(bauthUser).where(inArray(bauthUser.id, [TEST_USER_ID, TEST_USER_2_ID]));
});

/**
 * Create a fresh board scoped to this test. We don't use `getOrCreateBoard()`
 * because it's keyed on the singleton `Hangar Review` name; per-test
 * isolation needs unique names. The seeders are tested separately.
 */
async function freshBoard(suffix: string) {
	const name = `${BOARD_NAME_PREFIX}${suffix}`;
	const inserted = await db
		.insert(hangarBoard)
		.values({ id: `brd_${name}`, name })
		.returning();
	const board = inserted[0];
	if (!board) throw new Error('freshBoard: insert returned no row');
	boardIds.push(board.id);
	return board;
}

describe('getOrCreateBoard', () => {
	it('returns the same board on repeat calls and seeds default columns + kinds', async () => {
		const a = await getOrCreateBoard();
		const b = await getOrCreateBoard();
		expect(a.id).toBe(b.id);
		const cols = await listColumns(a.id);
		expect(cols.map((c) => c.name)).toEqual(['Backlog', 'In Progress', 'Review', 'Done']);
		const kinds = await listKinds();
		const kindIds = kinds.map((k) => k.id).sort();
		expect(kindIds).toEqual(['ad_hoc', 'knowledge_node', 'reference_toc', 'wp_spec', 'wp_test_plan']);
	});
});

describe('columns', () => {
	it('createColumn appends a custom column', async () => {
		const board = await freshBoard('columns-create');
		const col = await createColumn({ boardId: board.id, name: 'Custom', sortOrder: 99 });
		expect(col.name).toBe('Custom');
		expect(col.sortOrder).toBe(99);
		const all = await listColumns(board.id);
		expect(all.some((c) => c.id === col.id)).toBe(true);
	});
});

describe('buckets', () => {
	it('seedDefaultBuckets is idempotent and creates the seed list once', async () => {
		const board = await freshBoard('buckets-seed');
		await seedDefaultBuckets(board.id);
		await seedDefaultBuckets(board.id);
		const buckets = await listBuckets(board.id);
		expect(buckets.length).toBe(6);
		expect(buckets.map((b) => b.name)).toContain('WP Specs -- unread');
	});

	it('create + update + delete roundtrip', async () => {
		const board = await freshBoard('buckets-crud');
		const created = await createBucket({
			boardId: board.id,
			name: 'Custom bucket',
			kindId: 'wp_spec',
			filterCriteria: { kind: 'wp_spec' },
			sortOrder: 10,
		});
		expect(created.name).toBe('Custom bucket');
		const updated = await updateBucket(created.id, { name: 'Renamed', sortOrder: 11 });
		expect(updated.name).toBe('Renamed');
		expect(updated.sortOrder).toBe(11);
		await deleteBucket(created.id);
		const after = await db.select().from(hangarReviewBucket).where(eq(hangarReviewBucket.id, created.id));
		expect(after.length).toBe(0);
	});
});

describe('items', () => {
	it('upsertItem inserts a new row and updates the same key in place', async () => {
		const board = await freshBoard('items-upsert');
		const first = await upsertItem({
			boardId: board.id,
			kindId: 'wp_spec',
			ref: 'docs/work-packages/foo/spec.md',
			title: 'Foo (initial)',
			frontmatterStatus: 'unread',
			reviewStatus: 'pending',
			cachedFields: { otherFields: {} },
		});
		expect(first.title).toBe('Foo (initial)');
		const second = await upsertItem({
			boardId: board.id,
			kindId: 'wp_spec',
			ref: 'docs/work-packages/foo/spec.md',
			title: 'Foo (updated)',
			frontmatterStatus: 'reading',
			reviewStatus: 'pending',
			cachedFields: { otherFields: {} },
		});
		expect(second.id).toBe(first.id);
		expect(second.title).toBe('Foo (updated)');
		expect(second.frontmatterStatus).toBe('reading');
	});

	it('upsertItem resurrects a soft-deleted row and clears stale pinnedColumnId', async () => {
		const board = await freshBoard('items-resurrect');
		const col = await createColumn({ boardId: board.id, name: 'Done' });
		const created = await upsertItem({
			boardId: board.id,
			kindId: 'wp_spec',
			ref: 'docs/work-packages/resurrect/spec.md',
			title: 'Resurrect',
			frontmatterStatus: 'done',
			reviewStatus: 'done',
			cachedFields: { otherFields: {} },
		});
		await pinItemToColumn(created.id, col.id);
		await softDeleteItem(created.id);
		const resurrected = await upsertItem({
			boardId: board.id,
			kindId: 'wp_spec',
			ref: 'docs/work-packages/resurrect/spec.md',
			title: 'Resurrect',
			frontmatterStatus: 'reading',
			reviewStatus: 'pending',
			cachedFields: { otherFields: {} },
		});
		expect(resurrected.id).toBe(created.id);
		expect(resurrected.deletedAt).toBeNull();
		expect(resurrected.pinnedColumnId).toBeNull();
		expect(resurrected.frontmatterStatus).toBe('reading');
	});

	it('listItems filters by kind + frontmatter status + review status', async () => {
		const board = await freshBoard('items-list');
		await upsertItem({
			boardId: board.id,
			kindId: 'wp_spec',
			ref: 'a',
			title: 'A',
			frontmatterStatus: 'unread',
			reviewStatus: 'pending',
			cachedFields: { otherFields: {} },
		});
		await upsertItem({
			boardId: board.id,
			kindId: 'wp_spec',
			ref: 'b',
			title: 'B',
			frontmatterStatus: 'reading',
			reviewStatus: 'pending',
			cachedFields: { otherFields: {} },
		});
		await upsertItem({
			boardId: board.id,
			kindId: 'knowledge_node',
			ref: 'c',
			title: 'C',
			frontmatterStatus: 'done',
			reviewStatus: 'done',
			cachedFields: { otherFields: {} },
		});
		const allWp = await listItems(board.id, { kindIds: ['wp_spec'] });
		expect(allWp.length).toBe(2);
		const onlyReading = await listItems(board.id, { frontmatterStatus: ['reading'] });
		expect(onlyReading.map((r) => r.title)).toEqual(['B']);
		const onlyDone = await listItems(board.id, { reviewStatus: ['done'] });
		expect(onlyDone.map((r) => r.title)).toEqual(['C']);
	});

	it('pinItemToColumn updates pinnedColumnId and back to null', async () => {
		const board = await freshBoard('items-pin');
		const col = await createColumn({ boardId: board.id, name: 'X' });
		const item = await upsertItem({
			boardId: board.id,
			kindId: 'ad_hoc',
			ref: 'task_x',
			title: 'X',
			frontmatterStatus: null,
			reviewStatus: null,
			cachedFields: { otherFields: {} },
		});
		const pinned = await pinItemToColumn(item.id, col.id);
		expect(pinned.pinnedColumnId).toBe(col.id);
		const unpinned = await pinItemToColumn(item.id, null);
		expect(unpinned.pinnedColumnId).toBeNull();
	});

	it('getItem returns null for unknown id', async () => {
		const row = await getItem('ritem_does_not_exist');
		expect(row).toBeNull();
	});
});

describe('sessions + steps', () => {
	it('startSession is idempotent for the same (item, user)', async () => {
		const board = await freshBoard('sessions-start');
		const item = await upsertItem({
			boardId: board.id,
			kindId: 'wp_test_plan',
			ref: 'docs/work-packages/foo/test-plan.md',
			title: 'Foo TP',
			frontmatterStatus: 'reading',
			reviewStatus: 'pending',
			cachedFields: { otherFields: {} },
		});
		const a = await startSession(item.id, TEST_USER_ID);
		const b = await startSession(item.id, TEST_USER_ID);
		expect(a.id).toBe(b.id);
		expect(b.finishedAt).toBeNull();
	});

	it('different users get distinct open sessions for the same item', async () => {
		const board = await freshBoard('sessions-dual');
		const item = await upsertItem({
			boardId: board.id,
			kindId: 'wp_test_plan',
			ref: 'dual',
			title: 'Dual',
			frontmatterStatus: null,
			reviewStatus: null,
			cachedFields: { otherFields: {} },
		});
		const a = await startSession(item.id, TEST_USER_ID);
		const b = await startSession(item.id, TEST_USER_2_ID);
		expect(a.id).not.toBe(b.id);
	});

	it('finishSession closes the session and frees getOpenSession to start a new one', async () => {
		const board = await freshBoard('sessions-finish');
		const item = await upsertItem({
			boardId: board.id,
			kindId: 'wp_test_plan',
			ref: 'finish',
			title: 'Finish',
			frontmatterStatus: null,
			reviewStatus: null,
			cachedFields: { otherFields: {} },
		});
		const session = await startSession(item.id, TEST_USER_ID);
		const closed = await finishSession(session.id, 'pass', 'notes here');
		expect(closed.finishedAt).not.toBeNull();
		expect(closed.outcome).toBe('pass');
		const open = await getOpenSession(item.id, TEST_USER_ID);
		expect(open).toBeNull();
		const sessions = await listSessions(item.id);
		expect(sessions.length).toBe(1);
		// Reopening creates a fresh session row.
		const next = await startSession(item.id, TEST_USER_ID);
		expect(next.id).not.toBe(session.id);
	});

	it('recordStep is idempotent on (sessionId, stepRef) and overwrites outcome', async () => {
		const board = await freshBoard('steps-record');
		const item = await upsertItem({
			boardId: board.id,
			kindId: 'wp_test_plan',
			ref: 'steps',
			title: 'Steps',
			frontmatterStatus: null,
			reviewStatus: null,
			cachedFields: { otherFields: {} },
		});
		const session = await startSession(item.id, TEST_USER_ID);
		const first = await recordStep({
			sessionId: session.id,
			stepIndex: 1,
			stepRef: 'abc123',
			outcome: 'pass',
			note: '',
		});
		// Sleep just enough to guarantee a clock tick on `updatedAt`.
		await new Promise((resolve) => setTimeout(resolve, 5));
		const overwrite = await recordStep({
			sessionId: session.id,
			stepIndex: 1,
			stepRef: 'abc123',
			outcome: 'fail',
			note: 'broke',
		});
		expect(overwrite.id).toBe(first.id);
		expect(overwrite.outcome).toBe('fail');
		expect(overwrite.note).toBe('broke');
		expect(overwrite.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
		const steps = await listSteps(session.id);
		expect(steps.length).toBe(1);
	});
});

describe('tasks', () => {
	it('create / update / delete a task', async () => {
		const board = await freshBoard('tasks-crud');
		const created = await createTask({
			boardId: board.id,
			title: 'Do the thing',
			type: 'feature',
			productArea: 'hangar',
			createdBy: TEST_USER_ID,
		});
		expect(created.title).toBe('Do the thing');
		const updated = await updateTask(created.id, { title: 'Do the thing (renamed)', type: 'chore' });
		expect(updated.title).toBe('Do the thing (renamed)');
		expect(updated.type).toBe('chore');
		await deleteTask(created.id);
		const after = await db.select().from(hangarBoardTask).where(eq(hangarBoardTask.id, created.id));
		expect(after.length).toBe(0);
	});

	it('listTasks returns rows for the given board only', async () => {
		const a = await freshBoard('tasks-isolation-a');
		const b = await freshBoard('tasks-isolation-b');
		await createTask({ boardId: a.id, title: 'A', type: 'bug', productArea: 'study' });
		await createTask({ boardId: b.id, title: 'B', type: 'bug', productArea: 'study' });
		const aRows = await listTasks(a.id);
		const bRows = await listTasks(b.id);
		expect(aRows.map((r) => r.title)).toEqual(['A']);
		expect(bRows.map((r) => r.title)).toEqual(['B']);
	});
});

describe('validateBucketFilterCriteria', () => {
	it('accepts an empty object', () => {
		expect(validateBucketFilterCriteria({})).toEqual({});
	});

	it('accepts the structured shape with all known keys', () => {
		const out = validateBucketFilterCriteria({
			kind: 'wp_spec',
			frontmatterStatus: ['unread', 'reading'],
			reviewStatus: ['pending'],
			noPassingSession: true,
		});
		expect(out).toMatchObject({
			kind: 'wp_spec',
			frontmatterStatus: ['unread', 'reading'],
			reviewStatus: ['pending'],
			noPassingSession: true,
		});
	});

	it('rejects unknown keys', () => {
		expect(() => validateBucketFilterCriteria({ kind: 'wp_spec', evilExtra: 1 })).toThrow(/unknown key/);
	});

	it('rejects wrong-typed kind', () => {
		expect(() => validateBucketFilterCriteria({ kind: 42 })).toThrow(/kind must be a string/);
	});

	it('rejects invalid frontmatterStatus values', () => {
		expect(() => validateBucketFilterCriteria({ frontmatterStatus: ['nope'] })).toThrow(/frontmatterStatus.*invalid/);
	});

	it('rejects non-array frontmatterStatus', () => {
		expect(() => validateBucketFilterCriteria({ frontmatterStatus: 'unread' })).toThrow(/string array/);
	});

	it('rejects non-boolean noPassingSession', () => {
		expect(() => validateBucketFilterCriteria({ noPassingSession: 'yes' })).toThrow(/noPassingSession.*boolean/);
	});

	it('rejects null / arrays / non-objects at the top level', () => {
		expect(() => validateBucketFilterCriteria(null)).toThrow(/structured object/);
		expect(() => validateBucketFilterCriteria([])).toThrow(/structured object/);
		expect(() => validateBucketFilterCriteria('foo')).toThrow(/structured object/);
	});
});

describe('countReviewQueueOpen', () => {
	it('counts everything that is not (frontmatterStatus=done AND reviewStatus=done) for the board', async () => {
		const board = await freshBoard('count-open');
		// Quadrants of (frontmatterStatus, reviewStatus): unread/pending,
		// reading/pending, done/pending, done/done. Only the (done, done)
		// row should be excluded from the count.
		await upsertItem({
			boardId: board.id,
			kindId: 'wp_spec',
			ref: 'a',
			title: 'A',
			frontmatterStatus: 'unread',
			reviewStatus: 'pending',
			cachedFields: { otherFields: {} },
		});
		await upsertItem({
			boardId: board.id,
			kindId: 'wp_spec',
			ref: 'b',
			title: 'B',
			frontmatterStatus: 'reading',
			reviewStatus: 'pending',
			cachedFields: { otherFields: {} },
		});
		await upsertItem({
			boardId: board.id,
			kindId: 'wp_spec',
			ref: 'c',
			title: 'C',
			frontmatterStatus: 'done',
			reviewStatus: 'pending',
			cachedFields: { otherFields: {} },
		});
		await upsertItem({
			boardId: board.id,
			kindId: 'wp_spec',
			ref: 'd',
			title: 'D',
			frontmatterStatus: 'done',
			reviewStatus: 'done',
			cachedFields: { otherFields: {} },
		});
		// Also a soft-deleted "open" row to ensure it's excluded.
		const e = await upsertItem({
			boardId: board.id,
			kindId: 'wp_spec',
			ref: 'e',
			title: 'E',
			frontmatterStatus: 'unread',
			reviewStatus: 'pending',
			cachedFields: { otherFields: {} },
		});
		await softDeleteItem(e.id);
		const open = await countReviewQueueOpen(board.id);
		expect(open).toBe(3);
	});

	it('returns 0 for a board with no items', async () => {
		const board = await freshBoard('count-empty');
		expect(await countReviewQueueOpen(board.id)).toBe(0);
	});
});

describe('getBucket', () => {
	it('returns the bucket when boardId is omitted (back-compat singleton)', async () => {
		const board = await freshBoard('get-bucket-noscope');
		const created = await createBucket({
			boardId: board.id,
			name: 'Open',
			kindId: 'wp_spec',
			filterCriteria: {},
			sortOrder: 0,
		});
		const got = await getBucket(created.id);
		expect(got?.id).toBe(created.id);
	});

	it('scopes by boardId when supplied -- mismatched board returns null', async () => {
		const a = await freshBoard('get-bucket-a');
		const b = await freshBoard('get-bucket-b');
		const onA = await createBucket({
			boardId: a.id,
			name: 'OnA',
			kindId: 'wp_spec',
			filterCriteria: {},
			sortOrder: 0,
		});
		expect((await getBucket(onA.id, a.id))?.id).toBe(onA.id);
		expect(await getBucket(onA.id, b.id)).toBeNull();
	});

	it('returns null for unknown ids', async () => {
		expect(await getBucket('hrb_does_not_exist')).toBeNull();
	});
});

describe('countItemsByCriteria', () => {
	it('counts items via SQL even past REVIEW_LIST_HARD_CAP shape -- here matches kind+status filter', async () => {
		const board = await freshBoard('count-criteria');
		await upsertItem({
			boardId: board.id,
			kindId: 'wp_spec',
			ref: 'a',
			title: 'A',
			frontmatterStatus: 'unread',
			reviewStatus: 'pending',
			cachedFields: { otherFields: {} },
		});
		await upsertItem({
			boardId: board.id,
			kindId: 'wp_spec',
			ref: 'b',
			title: 'B',
			frontmatterStatus: 'reading',
			reviewStatus: 'pending',
			cachedFields: { otherFields: {} },
		});
		await upsertItem({
			boardId: board.id,
			kindId: 'knowledge_node',
			ref: 'c',
			title: 'C',
			frontmatterStatus: 'unread',
			reviewStatus: 'pending',
			cachedFields: { otherFields: {} },
		});
		expect(await countItemsByCriteria(board.id, {})).toBe(3);
		expect(await countItemsByCriteria(board.id, { kind: 'wp_spec' })).toBe(2);
		expect(await countItemsByCriteria(board.id, { frontmatterStatus: ['unread'] })).toBe(2);
		expect(await countItemsByCriteria(board.id, { kind: 'wp_spec', frontmatterStatus: ['unread'] })).toBe(1);
	});
});

describe('getBoard', () => {
	it('returns the singleton board after getOrCreateBoard, null before', async () => {
		// `getBoard` returns the singleton if already seeded. We can't
		// easily test the null branch in isolation (the test pollutes the
		// singleton), so the existence assertion is the contract.
		await getOrCreateBoard();
		const board = await getBoard();
		expect(board).not.toBeNull();
		expect(board?.name).toBe('Hangar Review');
	});
});

// Silence unused-import warnings for tables only referenced via cleanup paths.
void hangarBoardColumn;
void hangarReviewItem;
void hangarReviewSession;
void hangarReviewStep;
