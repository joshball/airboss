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
import {
	CARD_STATES,
	CARD_STATUSES,
	CARD_TYPES,
	CONTENT_SOURCES,
	DOMAINS,
	REVIEW_RATINGS,
	REVIEW_SESSION_STATUSES,
} from '@ab/constants';
import { db } from '@ab/db';
import { generateAuthId, generateCardId, generateReviewId, generateReviewSessionId } from '@ab/utils';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	computeDeckHash,
	findResumableSessionByDeckHash,
	getReviewedCardIdsInSession,
	jumpToIndex,
	listSavedDecks,
	ReviewSessionJumpOutOfRangeError,
	ReviewSessionNotActiveError,
	ReviewSessionNotFoundError,
	resumeReviewSession,
} from './review-sessions';
import { card, cardState, memoryReviewSession, type ReviewSessionDeckSpec, review } from './schema';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `review-sessions-test-${TEST_USER_ID}@airboss.test`;
const OTHER_USER_ID = generateAuthId();
const OTHER_EMAIL = `review-sessions-other-${OTHER_USER_ID}@airboss.test`;
const CREATED_CARD_IDS: string[] = [];
const CREATED_SESSION_IDS: string[] = [];

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values([
		{
			id: TEST_USER_ID,
			email: TEST_EMAIL,
			name: 'Review Sessions Test',
			firstName: 'Review',
			lastName: 'Sessions',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
		{
			id: OTHER_USER_ID,
			email: OTHER_EMAIL,
			name: 'Review Sessions Other',
			firstName: 'Review',
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
		await db.delete(review).where(inArray(review.userId, [TEST_USER_ID, OTHER_USER_ID]));
		await db.delete(memoryReviewSession).where(inArray(memoryReviewSession.userId, [TEST_USER_ID, OTHER_USER_ID]));
	}
	if (CREATED_CARD_IDS.length > 0) {
		await db.delete(cardState).where(inArray(cardState.userId, [TEST_USER_ID, OTHER_USER_ID]));
		await db.delete(card).where(inArray(card.userId, [TEST_USER_ID, OTHER_USER_ID]));
	}
	await db.delete(bauthUser).where(inArray(bauthUser.id, [TEST_USER_ID, OTHER_USER_ID]));
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

interface SeedSessionRowOptions {
	userId?: string;
	cardIds?: readonly string[];
	deckHash?: string;
	deckSpec?: ReviewSessionDeckSpec;
	status?: 'active' | 'completed' | 'abandoned';
	currentIndex?: number;
	startedAt?: Date;
	lastActivityAt?: Date;
	completedAt?: Date | null;
}

/**
 * Insert a `memory_review_session` row with arbitrary fields. Defaults to an
 * ACTIVE row owned by `TEST_USER_ID` so the resolver tests can override only
 * the dimensions they care about (status, deckHash, lastActivityAt).
 */
async function seedSessionRow(opts: SeedSessionRowOptions = {}): Promise<string> {
	const id = generateReviewSessionId();
	const now = new Date();
	const startedAt = opts.startedAt ?? now;
	const lastActivityAt = opts.lastActivityAt ?? startedAt;
	const status = opts.status ?? REVIEW_SESSION_STATUSES.ACTIVE;
	await db.insert(memoryReviewSession).values({
		id,
		userId: opts.userId ?? TEST_USER_ID,
		deckHash: opts.deckHash ?? 'testhash',
		deckSpec: opts.deckSpec ?? { domain: null },
		cardIdList: opts.cardIds ? [...opts.cardIds] : [],
		currentIndex: opts.currentIndex ?? 0,
		status,
		startedAt,
		lastActivityAt,
		completedAt: opts.completedAt ?? (status === REVIEW_SESSION_STATUSES.COMPLETED ? lastActivityAt : null),
	});
	CREATED_SESSION_IDS.push(id);
	return id;
}

describe('findResumableSessionByDeckHash', () => {
	it('returns the most-recent ACTIVE session for the user+hash', async () => {
		const hash = computeDeckHash({ domain: DOMAINS.REGULATIONS });
		const older = await seedSessionRow({
			deckHash: hash,
			lastActivityAt: new Date('2026-04-20T12:00:00Z'),
		});
		const newer = await seedSessionRow({
			deckHash: hash,
			lastActivityAt: new Date('2026-04-22T12:00:00Z'),
		});

		const found = await findResumableSessionByDeckHash(TEST_USER_ID, hash);
		expect(found?.id).toBe(newer);
		expect(found?.id).not.toBe(older);
	});

	it('returns ABANDONED sessions (resumable) but never COMPLETED', async () => {
		// Use a unique hash so neighbouring tests don't pollute the result.
		const hash = computeDeckHash({ domain: DOMAINS.AERODYNAMICS });
		const completed = await seedSessionRow({
			deckHash: hash,
			status: REVIEW_SESSION_STATUSES.COMPLETED,
			lastActivityAt: new Date('2026-04-25T12:00:00Z'),
		});
		const abandoned = await seedSessionRow({
			deckHash: hash,
			status: REVIEW_SESSION_STATUSES.ABANDONED,
			lastActivityAt: new Date('2026-04-23T12:00:00Z'),
		});

		const found = await findResumableSessionByDeckHash(TEST_USER_ID, hash);
		// COMPLETED is never resumable even when it is the most recent row.
		expect(found?.id).toBe(abandoned);
		expect(found?.id).not.toBe(completed);
	});

	it('returns null when only completed sessions exist for the hash', async () => {
		const hash = computeDeckHash({ domain: DOMAINS.WEATHER });
		await seedSessionRow({ deckHash: hash, status: REVIEW_SESSION_STATUSES.COMPLETED });
		await seedSessionRow({ deckHash: hash, status: REVIEW_SESSION_STATUSES.COMPLETED });

		const found = await findResumableSessionByDeckHash(TEST_USER_ID, hash);
		expect(found).toBeNull();
	});

	it('returns null for a hash the user has never run', async () => {
		const found = await findResumableSessionByDeckHash(TEST_USER_ID, 'noexist0');
		expect(found).toBeNull();
	});

	it('does not leak sessions from another user', async () => {
		const hash = computeDeckHash({ domain: DOMAINS.FLIGHT_PLANNING });
		await seedSessionRow({
			userId: OTHER_USER_ID,
			deckHash: hash,
			lastActivityAt: new Date('2026-04-22T12:00:00Z'),
		});

		const found = await findResumableSessionByDeckHash(TEST_USER_ID, hash);
		expect(found).toBeNull();
	});
});

describe('listSavedDecks', () => {
	// Each test uses a fresh user so per-hash aggregates are isolated. The
	// helper rebuilds users + cleans up after to keep the suite self-contained.
	async function withFreshUser<T>(label: string, fn: (userId: string) => Promise<T>): Promise<T> {
		const userId = generateAuthId();
		const email = `saved-decks-${label}-${userId}@airboss.test`;
		const now = new Date();
		await db.insert(bauthUser).values({
			id: userId,
			email,
			name: 'Saved Decks Test',
			firstName: 'Saved',
			lastName: 'Decks',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		});
		try {
			return await fn(userId);
		} finally {
			await db.delete(memoryReviewSession).where(eq(memoryReviewSession.userId, userId));
			await db.delete(bauthUser).where(eq(bauthUser.id, userId));
		}
	}

	it('returns an empty list when the user has never run a session', async () => {
		await withFreshUser('empty', async (userId) => {
			const decks = await listSavedDecks(userId);
			expect(decks).toEqual([]);
		});
	});

	it('dedupes by deckHash and aggregates the session count', async () => {
		await withFreshUser('dedupe', async (userId) => {
			const hashA = computeDeckHash({ domain: DOMAINS.REGULATIONS });
			const hashB = computeDeckHash({ domain: DOMAINS.WEATHER });
			// Three runs of deck A (mix of statuses), one of deck B.
			await seedSessionRow({
				userId,
				deckHash: hashA,
				deckSpec: { domain: DOMAINS.REGULATIONS },
				lastActivityAt: new Date('2026-04-20T10:00:00Z'),
				status: REVIEW_SESSION_STATUSES.COMPLETED,
			});
			await seedSessionRow({
				userId,
				deckHash: hashA,
				deckSpec: { domain: DOMAINS.REGULATIONS },
				lastActivityAt: new Date('2026-04-22T10:00:00Z'),
				status: REVIEW_SESSION_STATUSES.ABANDONED,
			});
			await seedSessionRow({
				userId,
				deckHash: hashA,
				deckSpec: { domain: DOMAINS.REGULATIONS },
				lastActivityAt: new Date('2026-04-23T10:00:00Z'),
				status: REVIEW_SESSION_STATUSES.ACTIVE,
			});
			await seedSessionRow({
				userId,
				deckHash: hashB,
				deckSpec: { domain: DOMAINS.WEATHER },
				lastActivityAt: new Date('2026-04-21T10:00:00Z'),
				status: REVIEW_SESSION_STATUSES.COMPLETED,
			});

			const decks = await listSavedDecks(userId);
			expect(decks).toHaveLength(2);
			const a = decks.find((d) => d.deckHash === hashA);
			const b = decks.find((d) => d.deckHash === hashB);
			expect(a?.sessionCount).toBe(3);
			expect(b?.sessionCount).toBe(1);
			expect(a?.deckSpec).toEqual({ domain: DOMAINS.REGULATIONS });
			expect(b?.deckSpec).toEqual({ domain: DOMAINS.WEATHER });
		});
	});

	it('orders by most recent lastActivityAt across distinct hashes', async () => {
		await withFreshUser('order', async (userId) => {
			const hashOld = computeDeckHash({ domain: DOMAINS.REGULATIONS });
			const hashMid = computeDeckHash({ domain: DOMAINS.WEATHER });
			const hashNew = computeDeckHash({ domain: DOMAINS.AERODYNAMICS });
			await seedSessionRow({
				userId,
				deckHash: hashOld,
				deckSpec: { domain: DOMAINS.REGULATIONS },
				lastActivityAt: new Date('2026-04-10T00:00:00Z'),
			});
			await seedSessionRow({
				userId,
				deckHash: hashMid,
				deckSpec: { domain: DOMAINS.WEATHER },
				lastActivityAt: new Date('2026-04-15T00:00:00Z'),
			});
			await seedSessionRow({
				userId,
				deckHash: hashNew,
				deckSpec: { domain: DOMAINS.AERODYNAMICS },
				lastActivityAt: new Date('2026-04-20T00:00:00Z'),
			});

			const decks = await listSavedDecks(userId);
			expect(decks.map((d) => d.deckHash)).toEqual([hashNew, hashMid, hashOld]);
		});
	});

	it('reports the most-recent resumable run when one exists, null otherwise', async () => {
		await withFreshUser('resumable', async (userId) => {
			const cardIds = ['c1', 'c2', 'c3'];
			const hashWithResumable = computeDeckHash({ domain: DOMAINS.REGULATIONS });
			const hashWithoutResumable = computeDeckHash({ domain: DOMAINS.WEATHER });

			// Deck with both a completed run (older) and an active run (newer):
			// resumable should pick the active one.
			await seedSessionRow({
				userId,
				deckHash: hashWithResumable,
				deckSpec: { domain: DOMAINS.REGULATIONS },
				lastActivityAt: new Date('2026-04-18T00:00:00Z'),
				status: REVIEW_SESSION_STATUSES.COMPLETED,
			});
			const activeId = await seedSessionRow({
				userId,
				deckHash: hashWithResumable,
				deckSpec: { domain: DOMAINS.REGULATIONS },
				cardIds,
				currentIndex: 1,
				lastActivityAt: new Date('2026-04-22T00:00:00Z'),
				status: REVIEW_SESSION_STATUSES.ACTIVE,
			});

			// Deck with only completed runs: resumable should be null.
			await seedSessionRow({
				userId,
				deckHash: hashWithoutResumable,
				deckSpec: { domain: DOMAINS.WEATHER },
				lastActivityAt: new Date('2026-04-19T00:00:00Z'),
				status: REVIEW_SESSION_STATUSES.COMPLETED,
			});

			const decks = await listSavedDecks(userId);
			const withResumable = decks.find((d) => d.deckHash === hashWithResumable);
			const withoutResumable = decks.find((d) => d.deckHash === hashWithoutResumable);
			expect(withResumable?.resumable).not.toBeNull();
			expect(withResumable?.resumable?.sessionId).toBe(activeId);
			expect(withResumable?.resumable?.currentIndex).toBe(1);
			expect(withResumable?.resumable?.totalCards).toBe(cardIds.length);
			expect(withResumable?.resumable?.status).toBe(REVIEW_SESSION_STATUSES.ACTIVE);
			expect(withoutResumable?.resumable).toBeNull();
		});
	});

	it('does not include sessions from other users', async () => {
		await withFreshUser('isolation', async (userId) => {
			const hash = computeDeckHash({ domain: DOMAINS.FLIGHT_PLANNING });
			// Seed a row for the cross-test OTHER_USER_ID; userId should not see it.
			await seedSessionRow({
				userId: OTHER_USER_ID,
				deckHash: hash,
				deckSpec: { domain: DOMAINS.FLIGHT_PLANNING },
				lastActivityAt: new Date('2026-04-22T00:00:00Z'),
			});
			const decks = await listSavedDecks(userId);
			expect(decks).toEqual([]);
		});
	});
});
