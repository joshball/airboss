/**
 * Calibration BC tests.
 *
 * Runs against the local dev Postgres -- the BC under test reads aggregates
 * over review + session_item_result (rep slots), so testing it without a DB
 * would mean mocking both tables plus the confidence column semantics. We
 * insert the minimum amount of row-level data directly (bypassing submitReview
 * / recordItemResult) because the calibration math is the thing under test,
 * not the review submission pipeline.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	CALIBRATION_MIN_BUCKET_COUNT,
	CALIBRATION_TREND_WINDOW_DAYS,
	CARD_STATES,
	CARD_STATUSES,
	CONFIDENCE_LEVELS,
	CONTENT_SOURCES,
	type ConfidenceLevel,
	DOMAINS,
	REVIEW_RATINGS,
} from '@ab/constants';
import { db } from '@ab/db';
import { generateAuthId, generateCardId, generateReviewId, generateScenarioId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCalibration, getCalibrationPointCount, getCalibrationTrend } from './calibration';
import { card, cardState, review, scenario, session, sessionItemResult, studyPlan } from './schema';
import { seedRepAttempt } from './test-support';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `calibration-test-${TEST_USER_ID}@airboss.test`;

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Calibration Test',
		firstName: 'Calibration',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	// FK order: review references card (restrict), session_item_result references
	// scenario (set null), session references plan (restrict). Wipe the slot
	// log + sessions + plan first via the test-support helper so the scenario
	// delete doesn't trip the FK from session_item_result.
	await db.delete(review).where(eq(review.userId, TEST_USER_ID));
	await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, TEST_USER_ID));
	await db.delete(session).where(eq(session.userId, TEST_USER_ID));
	await db.delete(studyPlan).where(eq(studyPlan.userId, TEST_USER_ID));
	await db.delete(cardState).where(eq(cardState.userId, TEST_USER_ID));
	await db.delete(card).where(eq(card.userId, TEST_USER_ID));
	await db.delete(scenario).where(eq(scenario.userId, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

/**
 * Create a fresh user scoped to a single test case. Ensures data isolation
 * without the cross-test leak risk of sharing the top-level TEST_USER_ID.
 */
async function withFreshUser<T>(fn: (userId: string) => Promise<T>): Promise<T> {
	const userId = generateAuthId();
	const now = new Date();
	await db.insert(bauthUser).values({
		id: userId,
		email: `cal-fresh-${userId}@airboss.test`,
		name: 'Fresh',
		firstName: 'Fresh',
		lastName: 'User',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
	try {
		return await fn(userId);
	} finally {
		await db.delete(review).where(eq(review.userId, userId));
		await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, userId));
		await db.delete(session).where(eq(session.userId, userId));
		await db.delete(studyPlan).where(eq(studyPlan.userId, userId));
		await db.delete(cardState).where(eq(cardState.userId, userId));
		await db.delete(card).where(eq(card.userId, userId));
		await db.delete(scenario).where(eq(scenario.userId, userId));
		await db.delete(bauthUser).where(eq(bauthUser.id, userId));
	}
}

/**
 * Seed a card for the given user. Calibration reads join through the card
 * to grab the domain; stability/difficulty/state are arbitrary sentinel
 * values since the calibration BC never reads them.
 */
async function seedCard(userId: string, domain: string): Promise<string> {
	const id = generateCardId();
	const now = new Date();
	await db.insert(card).values({
		id,
		userId,
		front: `front ${id}`,
		back: `back ${id}`,
		domain,
		tags: [],
		cardType: 'basic',
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
		userId,
		stability: 1,
		difficulty: 5,
		state: CARD_STATES.NEW,
		dueAt: now,
		lastReviewId: null,
		lastReviewedAt: null,
		reviewCount: 0,
		lapseCount: 0,
	});
	return id;
}

/** Seed one review row with explicit confidence + rating. */
async function seedReview(
	userId: string,
	cardId: string,
	confidence: ConfidenceLevel,
	isCorrect: boolean,
	reviewedAt: Date = new Date(),
): Promise<void> {
	await db.insert(review).values({
		id: generateReviewId(),
		cardId,
		userId,
		rating: isCorrect ? REVIEW_RATINGS.GOOD : REVIEW_RATINGS.AGAIN,
		confidence,
		stability: 1,
		difficulty: 5,
		elapsedDays: 0,
		scheduledDays: 1,
		state: CARD_STATES.NEW,
		dueAt: reviewedAt,
		reviewedAt,
		answerMs: null,
	});
}

/**
 * Seed a rep-attempt. Needs a scenario row to join to for the domain lookup.
 * The scenario `options` blob has to satisfy the shape CHECK (2-5 options
 * with one correct), so we ship a minimal 2-option payload.
 */
async function seedScenario(userId: string, domain: string): Promise<string> {
	const id = generateScenarioId();
	await db.insert(scenario).values({
		id,
		userId,
		title: `scenario ${id}`,
		situation: 'situation',
		options: [
			{ id: 'a', text: 'a', isCorrect: true, outcome: 'o', whyNot: '' },
			{ id: 'b', text: 'b', isCorrect: false, outcome: 'o', whyNot: 'wn' },
		],
		teachingPoint: 'tp',
		domain,
		difficulty: 'beginner',
		phaseOfFlight: null,
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		isEditable: true,
		regReferences: [],
		status: 'active',
		createdAt: new Date(),
	});
	return id;
}

async function seedAttempt(
	userId: string,
	scenarioId: string,
	confidence: ConfidenceLevel,
	isCorrect: boolean,
	attemptedAt: Date = new Date(),
): Promise<void> {
	await seedRepAttempt({
		userId,
		scenarioId,
		isCorrect,
		confidence,
		completedAt: attemptedAt,
	});
}

describe('getCalibration -- empty data', () => {
	it('returns null score with no points', async () => {
		await withFreshUser(async (userId) => {
			const result = await getCalibration(userId);
			expect(result.totalCount).toBe(0);
			expect(result.score).toBeNull();
			// All five buckets present but flagged needsMoreData.
			expect(result.buckets).toHaveLength(5);
			for (const b of result.buckets) {
				expect(b.count).toBe(0);
				expect(b.needsMoreData).toBe(true);
			}
			expect(result.domains).toEqual([]);
		});
	});
});

describe('getCalibration -- perfect calibration', () => {
	it('returns score = 1.0 when every bucket hits its expected accuracy', async () => {
		await withFreshUser(async (userId) => {
			const cardId = await seedCard(userId, DOMAINS.WEATHER);
			// Seed each bucket with `count` points at exactly its expected accuracy.
			// WILD_GUESS (expected 0%): 0/count correct
			// UNCERTAIN (expected 25%): count/4 correct
			// MAYBE (expected 50%): count/2 correct
			// PROBABLY (expected 75%): 3*count/4 correct
			// CERTAIN (expected 100%): count/count correct
			// Pick count=20 so (0, 5, 10, 15, 20) hit the expected fractions exactly.
			const count = 20;
			const targets: Array<[ConfidenceLevel, number]> = [
				[CONFIDENCE_LEVELS.WILD_GUESS, 0],
				[CONFIDENCE_LEVELS.UNCERTAIN, 5],
				[CONFIDENCE_LEVELS.MAYBE, 10],
				[CONFIDENCE_LEVELS.PROBABLY, 15],
				[CONFIDENCE_LEVELS.CERTAIN, 20],
			];
			for (const [level, correct] of targets) {
				for (let i = 0; i < count; i++) {
					await seedReview(userId, cardId, level, i < correct);
				}
			}
			const result = await getCalibration(userId);
			expect(result.score).toBeCloseTo(1.0, 5);
			for (const b of result.buckets) {
				expect(b.needsMoreData).toBe(false);
				expect(b.gap).toBeCloseTo(0, 5);
			}
		});
	});
});

describe('getCalibration -- overconfident', () => {
	it('returns score < 1.0 with negative gaps at high confidence', async () => {
		await withFreshUser(async (userId) => {
			const cardId = await seedCard(userId, DOMAINS.WEATHER);
			// CERTAIN bucket: 20 points, 10 correct -> accuracy 50%, expected
			// 100%, gap -0.5 (overconfident). PROBABLY bucket: 20 points, 10
			// correct -> accuracy 50%, expected 75%, gap -0.25 (overconfident).
			for (let i = 0; i < 20; i++) {
				await seedReview(userId, cardId, CONFIDENCE_LEVELS.CERTAIN, i < 10);
			}
			for (let i = 0; i < 20; i++) {
				await seedReview(userId, cardId, CONFIDENCE_LEVELS.PROBABLY, i < 10);
			}
			const result = await getCalibration(userId);
			expect(result.score).not.toBeNull();
			if (result.score !== null) expect(result.score).toBeLessThan(1);
			const certain = result.buckets.find((b) => b.level === CONFIDENCE_LEVELS.CERTAIN);
			const probably = result.buckets.find((b) => b.level === CONFIDENCE_LEVELS.PROBABLY);
			expect(certain?.gap).toBeLessThan(0);
			expect(probably?.gap).toBeLessThan(0);
			// Mean absolute gap = (0.5 + 0.25) / 2 = 0.375 -> score = 0.625.
			expect(result.score).toBeCloseTo(0.625, 5);
		});
	});
});

describe('getCalibration -- data completeness threshold', () => {
	it('excludes buckets with < CALIBRATION_MIN_BUCKET_COUNT from the score', async () => {
		await withFreshUser(async (userId) => {
			const cardId = await seedCard(userId, DOMAINS.REGULATIONS);
			// PROBABLY: 20 points, 15 correct -> perfectly calibrated (gap 0).
			for (let i = 0; i < 20; i++) {
				await seedReview(userId, cardId, CONFIDENCE_LEVELS.PROBABLY, i < 15);
			}
			// CERTAIN: 3 points, 0 correct -> gap -1.0 but below threshold so
			// it must not enter the score.
			for (let i = 0; i < CALIBRATION_MIN_BUCKET_COUNT - 2; i++) {
				await seedReview(userId, cardId, CONFIDENCE_LEVELS.CERTAIN, false);
			}
			const result = await getCalibration(userId);
			const probably = result.buckets.find((b) => b.level === CONFIDENCE_LEVELS.PROBABLY);
			const certain = result.buckets.find((b) => b.level === CONFIDENCE_LEVELS.CERTAIN);
			expect(probably?.needsMoreData).toBe(false);
			expect(certain?.needsMoreData).toBe(true);
			// Only the PROBABLY bucket clears the threshold and its gap is 0,
			// so the score is 1.0. If CERTAIN were counted the score would
			// drop to 0.5 ((0 + 1) / 2 -> 1 - 0.5).
			expect(result.score).toBeCloseTo(1.0, 5);
		});
	});
});

describe('getCalibration -- combined reviews + rep attempts', () => {
	it('aggregates card reviews and rep attempts into the same bucket', async () => {
		await withFreshUser(async (userId) => {
			const cardId = await seedCard(userId, DOMAINS.WEATHER);
			const scenarioId = await seedScenario(userId, DOMAINS.WEATHER);
			// Split the PROBABLY bucket across both sources:
			// - 10 reviews: 8 correct (rating Good)
			// - 10 rep attempts: 7 correct (is_correct true)
			// Combined: 20 points, 15 correct -> accuracy 0.75, expected 0.75,
			// gap 0. Perfect at this bucket.
			for (let i = 0; i < 10; i++) {
				await seedReview(userId, cardId, CONFIDENCE_LEVELS.PROBABLY, i < 8);
			}
			for (let i = 0; i < 10; i++) {
				await seedAttempt(userId, scenarioId, CONFIDENCE_LEVELS.PROBABLY, i < 7);
			}
			const result = await getCalibration(userId);
			const probably = result.buckets.find((b) => b.level === CONFIDENCE_LEVELS.PROBABLY);
			expect(probably?.count).toBe(20);
			expect(probably?.correct).toBe(15);
			expect(probably?.accuracy).toBeCloseTo(0.75, 5);
			expect(probably?.gap).toBeCloseTo(0, 5);
		});
	});
});

describe('getCalibration -- per-domain breakdown', () => {
	it('computes an independent score per domain', async () => {
		await withFreshUser(async (userId) => {
			const weatherCard = await seedCard(userId, DOMAINS.WEATHER);
			const regsCard = await seedCard(userId, DOMAINS.REGULATIONS);
			// Weather: PROBABLY bucket, 10 correct of 20 -> overconfident.
			for (let i = 0; i < 20; i++) {
				await seedReview(userId, weatherCard, CONFIDENCE_LEVELS.PROBABLY, i < 10);
			}
			// Regulations: PROBABLY bucket, 15 correct of 20 -> perfect.
			for (let i = 0; i < 20; i++) {
				await seedReview(userId, regsCard, CONFIDENCE_LEVELS.PROBABLY, i < 15);
			}
			const result = await getCalibration(userId);
			expect(result.domains.map((d) => d.domain).sort()).toEqual([DOMAINS.REGULATIONS, DOMAINS.WEATHER].sort());
			const weather = result.domains.find((d) => d.domain === DOMAINS.WEATHER);
			const regs = result.domains.find((d) => d.domain === DOMAINS.REGULATIONS);
			// Weather: gap -0.25 -> score 0.75.
			expect(weather?.score).toBeCloseTo(0.75, 5);
			// Regulations: gap 0 -> score 1.0.
			expect(regs?.score).toBeCloseTo(1.0, 5);
			// Weather's largest gap is the PROBABLY bucket at -0.25.
			expect(weather?.largestGap?.level).toBe(CONFIDENCE_LEVELS.PROBABLY);
			expect(weather?.largestGap?.gap).toBeCloseTo(-0.25, 5);
		});
	});
});

describe('getCalibration -- domain filter', () => {
	it('filters buckets to a single domain when domain option is set', async () => {
		await withFreshUser(async (userId) => {
			const weatherCard = await seedCard(userId, DOMAINS.WEATHER);
			const regsCard = await seedCard(userId, DOMAINS.REGULATIONS);
			// Weather gets overconfident data, regulations gets perfect data.
			for (let i = 0; i < 20; i++) {
				await seedReview(userId, weatherCard, CONFIDENCE_LEVELS.PROBABLY, i < 10);
			}
			for (let i = 0; i < 20; i++) {
				await seedReview(userId, regsCard, CONFIDENCE_LEVELS.PROBABLY, i < 15);
			}
			const regs = await getCalibration(userId, { domain: DOMAINS.REGULATIONS });
			const probably = regs.buckets.find((b) => b.level === CONFIDENCE_LEVELS.PROBABLY);
			expect(probably?.count).toBe(20);
			expect(probably?.accuracy).toBeCloseTo(0.75, 5);
			// Filter still reports domain rollup, but only for the filtered slice.
			expect(regs.domains.map((d) => d.domain)).toEqual([DOMAINS.REGULATIONS]);
		});
	});
});

describe('getCalibrationTrend', () => {
	it('returns CALIBRATION_TREND_WINDOW_DAYS points in chronological order', async () => {
		await withFreshUser(async (userId) => {
			const cardId = await seedCard(userId, DOMAINS.WEATHER);
			// Plant 20 PROBABLY reviews distributed across the last 2 days so
			// the cumulative calc has something to compute.
			const now = new Date();
			const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
			for (let i = 0; i < 20; i++) {
				await seedReview(userId, cardId, CONFIDENCE_LEVELS.PROBABLY, i < 15, i < 10 ? twoDaysAgo : now);
			}
			const trend = await getCalibrationTrend(userId);
			expect(trend).toHaveLength(CALIBRATION_TREND_WINDOW_DAYS);
			// Chronological: first date is earlier than last.
			expect(trend[0].date < trend[trend.length - 1].date).toBe(true);
			// Last point sees every seeded row -> 20 points total, score defined.
			const last = trend[trend.length - 1];
			expect(last.count).toBe(20);
			expect(last.score).toBeCloseTo(1.0, 5);
		});
	});

	it('reports null score on days where no bucket clears the threshold', async () => {
		await withFreshUser(async (userId) => {
			const cardId = await seedCard(userId, DOMAINS.WEATHER);
			// Only 4 points -- below the threshold, so score stays null for
			// every trend point.
			const now = new Date();
			for (let i = 0; i < CALIBRATION_MIN_BUCKET_COUNT - 1; i++) {
				await seedReview(userId, cardId, CONFIDENCE_LEVELS.MAYBE, true, now);
			}
			const trend = await getCalibrationTrend(userId);
			for (const p of trend) {
				expect(p.score).toBeNull();
			}
		});
	});
});

describe('getCalibrationPointCount', () => {
	it('counts both review and rep_attempt confidence-rated rows', async () => {
		await withFreshUser(async (userId) => {
			const cardId = await seedCard(userId, DOMAINS.WEATHER);
			const scenarioId = await seedScenario(userId, DOMAINS.WEATHER);
			await seedReview(userId, cardId, CONFIDENCE_LEVELS.MAYBE, true);
			await seedReview(userId, cardId, CONFIDENCE_LEVELS.MAYBE, false);
			await seedAttempt(userId, scenarioId, CONFIDENCE_LEVELS.PROBABLY, true);
			const n = await getCalibrationPointCount(userId);
			expect(n).toBe(3);
		});
	});

	it('ignores rows with null confidence', async () => {
		await withFreshUser(async (userId) => {
			const cardId = await seedCard(userId, DOMAINS.WEATHER);
			await db.insert(review).values({
				id: generateReviewId(),
				cardId,
				userId,
				rating: REVIEW_RATINGS.GOOD,
				confidence: null,
				stability: 1,
				difficulty: 5,
				elapsedDays: 0,
				scheduledDays: 1,
				state: CARD_STATES.NEW,
				dueAt: new Date(),
				reviewedAt: new Date(),
				answerMs: null,
			});
			const n = await getCalibrationPointCount(userId);
			expect(n).toBe(0);
		});
	});
});
