/**
 * Memory-review session BC tests -- covers the jump-to-card BC (`jumpToIndex`)
 * and the per-session reviewed-card lookup (`getReviewedCardIdsInSession`)
 * added for SMI walkthrough item 15.
 *
 * Runs against the local dev Postgres (the same connection drizzle-kit push
 * targets), matching the pattern of `scenarios.test.ts`. Each spec uses a
 * fresh user so parallel runs don't collide on session ids.
 */

import { bauthUser } from '@ab/auth/schema';
import { CARD_STATES, CARD_STATUSES, CARD_TYPES, CONTENT_SOURCES, DOMAINS, REVIEW_RATINGS } from '@ab/constants';
import { db } from '@ab/db';
import { generateAuthId, generateCardId, generateReviewId, generateReviewSessionId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	getReviewedCardIdsInSession,
	jumpToIndex,
	ReviewSessionJumpOutOfRangeError,
	ReviewSessionNotActiveError,
	ReviewSessionNotFoundError,
	resumeReviewSession,
} from './review-sessions';
import { card, cardState, memoryReviewSession, review } from './schema';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `review-sessions-test-${TEST_USER_ID}@airboss.test`;
const CREATED_CARD_IDS: string[] = [];
const CREATED_SESSION_IDS: string[] = [];

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Review Sessions Test',
		firstName: 'Review',
		lastName: 'Sessions',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	if (CREATED_SESSION_IDS.length > 0) {
		await db.delete(review).where(eq(review.userId, TEST_USER_ID));
		await db.delete(memoryReviewSession).where(eq(memoryReviewSession.userId, TEST_USER_ID));
	}
	if (CREATED_CARD_IDS.length > 0) {
		await db.delete(cardState).where(eq(cardState.userId, TEST_USER_ID));
		await db.delete(card).where(eq(card.userId, TEST_USER_ID));
	}
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

async function seedCard(): Promise<string> {
	const id = generateCardId();
	const now = new Date();
	await db.insert(card).values({
		id,
		userId: TEST_USER_ID,
		front: `front ${id}`,
		back: `back ${id}`,
		domain: DOMAINS.REGULATIONS,
		tags: [],
		cardType: CARD_TYPES.BASIC,
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: null,
		isEditable: true,
		status: CARD_STATUSES.ACTIVE,
		createdAt: now,
		updatedAt: now,
	});
	await db.insert(cardState).values({
		cardId: id,
		userId: TEST_USER_ID,
		stability: 0,
		difficulty: 5,
		state: CARD_STATES.NEW,
		dueAt: now,
		lastReviewId: null,
		lastReviewedAt: null,
		reviewCount: 0,
		lapseCount: 0,
	});
	CREATED_CARD_IDS.push(id);
	return id;
}

async function seedSession(cardIds: readonly string[], currentIndex = 0): Promise<string> {
	const id = generateReviewSessionId();
	const now = new Date();
	await db.insert(memoryReviewSession).values({
		id,
		userId: TEST_USER_ID,
		deckHash: 'testhash',
		deckSpec: { domain: null },
		cardIdList: [...cardIds],
		currentIndex,
		status: 'active',
		startedAt: now,
		lastActivityAt: now,
		completedAt: null,
	});
	CREATED_SESSION_IDS.push(id);
	return id;
}

describe('jumpToIndex', () => {
	it('moves currentIndex to the requested position when the session is active', async () => {
		const ids = [await seedCard(), await seedCard(), await seedCard(), await seedCard()];
		const sessionId = await seedSession(ids, 0);

		const updated = await jumpToIndex({ sessionId, userId: TEST_USER_ID, index: 2 });

		expect(updated.currentIndex).toBe(2);

		const state = await resumeReviewSession(sessionId, TEST_USER_ID);
		expect(state.position).toBe(3);
		expect(state.currentCard?.id).toBe(ids[2]);
	});

	it('is a no-op when jumping to the existing index', async () => {
		const ids = [await seedCard(), await seedCard()];
		const sessionId = await seedSession(ids, 1);

		const before = await db.select().from(memoryReviewSession).where(eq(memoryReviewSession.id, sessionId)).limit(1);
		const lastActivityBefore = before[0]?.lastActivityAt;

		const updated = await jumpToIndex({ sessionId, userId: TEST_USER_ID, index: 1 });

		expect(updated.currentIndex).toBe(1);
		expect(updated.lastActivityAt.getTime()).toBe(lastActivityBefore?.getTime());
	});

	it('rejects an out-of-range index', async () => {
		const ids = [await seedCard(), await seedCard()];
		const sessionId = await seedSession(ids, 0);

		await expect(jumpToIndex({ sessionId, userId: TEST_USER_ID, index: 5 })).rejects.toBeInstanceOf(
			ReviewSessionJumpOutOfRangeError,
		);
		await expect(jumpToIndex({ sessionId, userId: TEST_USER_ID, index: -1 })).rejects.toBeInstanceOf(
			ReviewSessionJumpOutOfRangeError,
		);
		await expect(jumpToIndex({ sessionId, userId: TEST_USER_ID, index: 1.5 })).rejects.toBeInstanceOf(
			ReviewSessionJumpOutOfRangeError,
		);
	});

	it('rejects a missing session id', async () => {
		await expect(
			jumpToIndex({ sessionId: generateReviewSessionId(), userId: TEST_USER_ID, index: 0 }),
		).rejects.toBeInstanceOf(ReviewSessionNotFoundError);
	});

	it('refuses to jump in a completed session', async () => {
		const ids = [await seedCard()];
		const sessionId = generateReviewSessionId();
		const now = new Date();
		await db.insert(memoryReviewSession).values({
			id: sessionId,
			userId: TEST_USER_ID,
			deckHash: 'testhash',
			deckSpec: { domain: null },
			cardIdList: [...ids],
			currentIndex: ids.length,
			status: 'completed',
			startedAt: now,
			lastActivityAt: now,
			completedAt: now,
		});
		CREATED_SESSION_IDS.push(sessionId);

		await expect(jumpToIndex({ sessionId, userId: TEST_USER_ID, index: 0 })).rejects.toBeInstanceOf(
			ReviewSessionNotActiveError,
		);
	});

	it('refuses to jump in an abandoned session', async () => {
		const ids = [await seedCard(), await seedCard()];
		const sessionId = generateReviewSessionId();
		const now = new Date();
		await db.insert(memoryReviewSession).values({
			id: sessionId,
			userId: TEST_USER_ID,
			deckHash: 'testhash',
			deckSpec: { domain: null },
			cardIdList: [...ids],
			currentIndex: 0,
			status: 'abandoned',
			startedAt: now,
			lastActivityAt: now,
			completedAt: null,
		});
		CREATED_SESSION_IDS.push(sessionId);

		await expect(jumpToIndex({ sessionId, userId: TEST_USER_ID, index: 1 })).rejects.toBeInstanceOf(
			ReviewSessionNotActiveError,
		);
	});
});

describe('getReviewedCardIdsInSession', () => {
	it('returns only cards that already received a review row in the session', async () => {
		const ids = [await seedCard(), await seedCard(), await seedCard()];
		const sessionId = await seedSession(ids, 1);

		// Stamp two reviews on the first two cards.
		const now = new Date();
		for (const cardId of [ids[0], ids[1]] as string[]) {
			await db.insert(review).values({
				id: generateReviewId(),
				userId: TEST_USER_ID,
				cardId,
				reviewSessionId: sessionId,
				rating: REVIEW_RATINGS.GOOD,
				confidence: null,
				stability: 1,
				difficulty: 5,
				elapsedDays: 0,
				scheduledDays: 1,
				state: CARD_STATES.LEARNING,
				dueAt: now,
				reviewedAt: now,
				answerMs: null,
			});
		}

		const rated = await getReviewedCardIdsInSession(sessionId, TEST_USER_ID);
		expect(new Set(rated)).toEqual(new Set([ids[0], ids[1]]));
	});

	it('returns an empty list before any reviews', async () => {
		const ids = [await seedCard()];
		const sessionId = await seedSession(ids, 0);
		const rated = await getReviewedCardIdsInSession(sessionId, TEST_USER_ID);
		expect(rated).toEqual([]);
	});
});
