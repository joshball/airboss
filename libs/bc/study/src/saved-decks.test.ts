/**
 * Saved-deck overlay BC tests. Real Postgres, mirrors the seeding pattern in
 * `review-sessions.test.ts`: each spec uses a fresh user so parallel runs
 * don't collide on overlay rows.
 */

import { bauthUser } from '@ab/auth/schema';
import { SAVED_DECK_LABEL_MAX_LENGTH } from '@ab/constants';
import { db } from '@ab/db';
import { generateAuthId, generateReviewSessionId } from '@ab/utils';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listSavedDecks } from './review-sessions';
import { deleteSavedDeck, normalizeSavedDeckLabel, renameSavedDeck, SavedDeckLabelTooLongError } from './saved-decks';
import { memoryReviewSession, savedDeck } from './schema';

const TEST_USER_ID = generateAuthId();
const OTHER_USER_ID = generateAuthId();
const TEST_EMAIL = `saved-decks-test-${TEST_USER_ID}@airboss.test`;
const OTHER_EMAIL = `saved-decks-other-${OTHER_USER_ID}@airboss.test`;
const CREATED_SESSION_IDS: string[] = [];

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values([
		{
			id: TEST_USER_ID,
			email: TEST_EMAIL,
			name: 'Saved Decks Test',
			firstName: 'Saved',
			lastName: 'Decks',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
		{
			id: OTHER_USER_ID,
			email: OTHER_EMAIL,
			name: 'Saved Decks Other',
			firstName: 'Saved',
			lastName: 'Other',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
	]);
});

afterAll(async () => {
	if (CREATED_SESSION_IDS.length > 0) {
		await db.delete(memoryReviewSession).where(eq(memoryReviewSession.userId, TEST_USER_ID));
		await db.delete(memoryReviewSession).where(eq(memoryReviewSession.userId, OTHER_USER_ID));
	}
	await db.delete(savedDeck).where(eq(savedDeck.userId, TEST_USER_ID));
	await db.delete(savedDeck).where(eq(savedDeck.userId, OTHER_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, OTHER_USER_ID));
});

async function seedReviewSession(userId: string, deckHash: string): Promise<string> {
	const id = generateReviewSessionId();
	const now = new Date();
	await db.insert(memoryReviewSession).values({
		id,
		userId,
		deckHash,
		deckSpec: { domain: null },
		cardIdList: [],
		currentIndex: 0,
		status: 'completed',
		startedAt: now,
		lastActivityAt: now,
		completedAt: now,
	});
	CREATED_SESSION_IDS.push(id);
	return id;
}

describe('normalizeSavedDeckLabel', () => {
	it('returns null for null / empty / whitespace input', () => {
		expect(normalizeSavedDeckLabel(null)).toBeNull();
		expect(normalizeSavedDeckLabel(undefined)).toBeNull();
		expect(normalizeSavedDeckLabel('')).toBeNull();
		expect(normalizeSavedDeckLabel('   ')).toBeNull();
		expect(normalizeSavedDeckLabel('\t\n')).toBeNull();
	});

	it('trims surrounding whitespace', () => {
		expect(normalizeSavedDeckLabel('  Airspace daily  ')).toBe('Airspace daily');
	});

	it('rejects labels longer than the configured maximum', () => {
		const tooLong = 'x'.repeat(SAVED_DECK_LABEL_MAX_LENGTH + 1);
		expect(() => normalizeSavedDeckLabel(tooLong)).toThrow(SavedDeckLabelTooLongError);
	});

	it('accepts labels at exactly the maximum length', () => {
		const atMax = 'x'.repeat(SAVED_DECK_LABEL_MAX_LENGTH);
		expect(normalizeSavedDeckLabel(atMax)).toBe(atMax);
	});
});

describe('renameSavedDeck', () => {
	it('inserts a new overlay row when none exists yet', async () => {
		const hash = 'rn000001';
		const row = await renameSavedDeck(TEST_USER_ID, hash, 'Airspace daily');

		expect(row.userId).toBe(TEST_USER_ID);
		expect(row.deckHash).toBe(hash);
		expect(row.label).toBe('Airspace daily');
		expect(row.dismissedAt).toBeNull();
	});

	it('updates the existing row in place on subsequent calls', async () => {
		const hash = 'rn000002';
		const first = await renameSavedDeck(TEST_USER_ID, hash, 'First name');
		const second = await renameSavedDeck(TEST_USER_ID, hash, 'Second name');

		expect(second.id).toBe(first.id);
		expect(second.label).toBe('Second name');

		const allRows = await db
			.select()
			.from(savedDeck)
			.where(and(eq(savedDeck.userId, TEST_USER_ID), eq(savedDeck.deckHash, hash)));
		expect(allRows).toHaveLength(1);
	});

	it('clears the label when an empty string is supplied', async () => {
		const hash = 'rn000003';
		await renameSavedDeck(TEST_USER_ID, hash, 'Temporary');
		const cleared = await renameSavedDeck(TEST_USER_ID, hash, '');
		expect(cleared.label).toBeNull();
	});

	it('clears dismissedAt when renaming a previously-dismissed deck', async () => {
		const hash = 'rn000004';
		await deleteSavedDeck(TEST_USER_ID, hash);
		const renamed = await renameSavedDeck(TEST_USER_ID, hash, 'Brought back');
		expect(renamed.label).toBe('Brought back');
		expect(renamed.dismissedAt).toBeNull();
	});

	it('rejects labels longer than the maximum', async () => {
		const hash = 'rn000005';
		const tooLong = 'x'.repeat(SAVED_DECK_LABEL_MAX_LENGTH + 1);
		await expect(renameSavedDeck(TEST_USER_ID, hash, tooLong)).rejects.toBeInstanceOf(SavedDeckLabelTooLongError);

		const stored = await db
			.select()
			.from(savedDeck)
			.where(and(eq(savedDeck.userId, TEST_USER_ID), eq(savedDeck.deckHash, hash)));
		expect(stored).toHaveLength(0);
	});

	it('scopes by user (renaming as one user does not affect another user)', async () => {
		const hash = 'rn000006';
		await renameSavedDeck(TEST_USER_ID, hash, 'Mine');
		await renameSavedDeck(OTHER_USER_ID, hash, 'Theirs');

		const mine = await db
			.select()
			.from(savedDeck)
			.where(and(eq(savedDeck.userId, TEST_USER_ID), eq(savedDeck.deckHash, hash)));
		const theirs = await db
			.select()
			.from(savedDeck)
			.where(and(eq(savedDeck.userId, OTHER_USER_ID), eq(savedDeck.deckHash, hash)));

		expect(mine[0]?.label).toBe('Mine');
		expect(theirs[0]?.label).toBe('Theirs');
		expect(mine[0]?.id).not.toBe(theirs[0]?.id);
	});
});

describe('deleteSavedDeck', () => {
	it('stamps dismissedAt on a previously-renamed row', async () => {
		const hash = 'dl000001';
		await renameSavedDeck(TEST_USER_ID, hash, 'About to go');
		const dismissed = await deleteSavedDeck(TEST_USER_ID, hash);
		expect(dismissed.dismissedAt).toBeInstanceOf(Date);
		expect(dismissed.label).toBe('About to go');
	});

	it('creates a new dismissed row when none existed before', async () => {
		const hash = 'dl000002';
		const dismissed = await deleteSavedDeck(TEST_USER_ID, hash);
		expect(dismissed.dismissedAt).toBeInstanceOf(Date);
		expect(dismissed.label).toBeNull();
	});

	it('does not delete underlying memory_review_session rows', async () => {
		const hash = 'dl000003';
		const sessionId = await seedReviewSession(TEST_USER_ID, hash);
		await deleteSavedDeck(TEST_USER_ID, hash);

		const stillThere = await db
			.select()
			.from(memoryReviewSession)
			.where(eq(memoryReviewSession.id, sessionId))
			.limit(1);
		expect(stillThere).toHaveLength(1);
	});

	it('is idempotent across repeated dismisses', async () => {
		const hash = 'dl000004';
		const first = await deleteSavedDeck(TEST_USER_ID, hash);
		const second = await deleteSavedDeck(TEST_USER_ID, hash);
		expect(second.id).toBe(first.id);
		expect(second.dismissedAt).toBeInstanceOf(Date);

		const allRows = await db
			.select()
			.from(savedDeck)
			.where(and(eq(savedDeck.userId, TEST_USER_ID), eq(savedDeck.deckHash, hash)));
		expect(allRows).toHaveLength(1);
	});

	it("scopes by user (one user cannot dismiss another user's deck)", async () => {
		const hash = 'dl000005';
		await renameSavedDeck(OTHER_USER_ID, hash, 'Theirs');
		await deleteSavedDeck(TEST_USER_ID, hash);

		const otherRow = await db
			.select()
			.from(savedDeck)
			.where(and(eq(savedDeck.userId, OTHER_USER_ID), eq(savedDeck.deckHash, hash)))
			.limit(1);
		expect(otherRow[0]?.dismissedAt).toBeNull();
		expect(otherRow[0]?.label).toBe('Theirs');
	});
});

describe('listSavedDecks integration with overlay', () => {
	it('hides decks that have been dismissed', async () => {
		const visible = 'lv000001';
		const dismissed = 'lv000002';
		await seedReviewSession(TEST_USER_ID, visible);
		await seedReviewSession(TEST_USER_ID, dismissed);
		await deleteSavedDeck(TEST_USER_ID, dismissed);

		const summaries = await listSavedDecks(TEST_USER_ID);
		const hashes = summaries.map((s) => s.deckHash);
		expect(hashes).toContain(visible);
		expect(hashes).not.toContain(dismissed);
	});

	it('surfaces the custom label when one is set', async () => {
		const hash = 'lv000003';
		await seedReviewSession(TEST_USER_ID, hash);
		await renameSavedDeck(TEST_USER_ID, hash, 'My favorite deck');

		const summaries = await listSavedDecks(TEST_USER_ID);
		const found = summaries.find((s) => s.deckHash === hash);
		expect(found?.label).toBe('My favorite deck');
	});

	it('reports a null label when the overlay has no label set', async () => {
		const hash = 'lv000004';
		await seedReviewSession(TEST_USER_ID, hash);

		const summaries = await listSavedDecks(TEST_USER_ID);
		const found = summaries.find((s) => s.deckHash === hash);
		expect(found?.label).toBeNull();
	});

	it('brings a dismissed deck back into the list when renamed', async () => {
		const hash = 'lv000005';
		await seedReviewSession(TEST_USER_ID, hash);
		await deleteSavedDeck(TEST_USER_ID, hash);

		const beforeRename = await listSavedDecks(TEST_USER_ID);
		expect(beforeRename.find((s) => s.deckHash === hash)).toBeUndefined();

		await renameSavedDeck(TEST_USER_ID, hash, 'Resurrected');
		const afterRename = await listSavedDecks(TEST_USER_ID);
		const resurrected = afterRename.find((s) => s.deckHash === hash);
		expect(resurrected?.label).toBe('Resurrected');
	});
});
