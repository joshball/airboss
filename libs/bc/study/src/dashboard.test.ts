/**
 * Dashboard BC tests.
 *
 * Seeds a fresh user with known cards, reviews, and scenarios, then verifies
 * the panel aggregates compute correctly. Runs against the local dev Postgres
 * -- same convention as scenarios.test.ts -- because the BC is the real thing
 * under test.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	ACTIVITY_WINDOW_DAYS,
	CARD_STATES,
	CARD_STATUSES,
	CARD_TYPES,
	CONTENT_SOURCES,
	DIFFICULTIES,
	DOMAINS,
	REVIEW_RATINGS,
	SCENARIO_STATUSES,
	WEAK_AREA_MIN_DATA_POINTS,
} from '@ab/constants';
import { db } from '@ab/db';
import { generateAuthId, generateCardId, generateRepAttemptId, generateReviewId, generateScenarioId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	type DashboardFetchers,
	getDashboardPayload,
	getRecentActivity,
	getRepBacklog,
	getWeakAreas,
	type PanelResult,
	type RecentActivity,
} from './dashboard';
import { card, cardState, repAttempt, review, scenario } from './schema';

/** Shared user for tests that don't mutate shared state destructively. */
const BASE_USER = generateAuthId();

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: BASE_USER,
		email: `dashboard-test-${BASE_USER}@airboss.test`,
		name: 'Dashboard Test',
		firstName: 'Dashboard',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	// rep_attempt -> scenario is RESTRICT; review -> card is RESTRICT. Delete
	// child rows first in both chains before the user cascade fires.
	await db.delete(repAttempt).where(eq(repAttempt.userId, BASE_USER));
	await db.delete(scenario).where(eq(scenario.userId, BASE_USER));
	await db.delete(review).where(eq(review.userId, BASE_USER));
	await db.delete(cardState).where(eq(cardState.userId, BASE_USER));
	await db.delete(card).where(eq(card.userId, BASE_USER));
	await db.delete(bauthUser).where(eq(bauthUser.id, BASE_USER));
});

/** Create an isolated user + return a cleanup closure. */
async function isolatedUser(label: string): Promise<{ userId: string; cleanup: () => Promise<void> }> {
	const userId = generateAuthId();
	const now = new Date();
	await db.insert(bauthUser).values({
		id: userId,
		email: `dashboard-${label}-${userId}@airboss.test`,
		name: `${label} Test`,
		firstName: label,
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
	return {
		userId,
		cleanup: async () => {
			await db.delete(repAttempt).where(eq(repAttempt.userId, userId));
			await db.delete(scenario).where(eq(scenario.userId, userId));
			await db.delete(review).where(eq(review.userId, userId));
			await db.delete(cardState).where(eq(cardState.userId, userId));
			await db.delete(card).where(eq(card.userId, userId));
			await db.delete(bauthUser).where(eq(bauthUser.id, userId));
		},
	};
}

interface SeedCardOptions {
	domain: string;
	dueAt?: Date;
	stability?: number;
	state?: string;
}

/** Insert a card + its initial card_state directly (no FSRS side effects). */
async function seedCard(userId: string, opts: SeedCardOptions): Promise<string> {
	const id = generateCardId();
	const now = new Date();
	await db.insert(card).values({
		id,
		userId,
		front: `front ${id}`,
		back: `back ${id}`,
		domain: opts.domain,
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
		userId,
		stability: opts.stability ?? 0,
		difficulty: 5,
		state: opts.state ?? CARD_STATES.NEW,
		dueAt: opts.dueAt ?? now,
		lastReviewId: null,
		lastReviewedAt: null,
		reviewCount: 0,
		lapseCount: 0,
	});
	return id;
}

interface SeedReviewOptions {
	rating: number;
	reviewedAt: Date;
}

async function seedReview(userId: string, cardId: string, opts: SeedReviewOptions): Promise<void> {
	await db.insert(review).values({
		id: generateReviewId(),
		cardId,
		userId,
		rating: opts.rating,
		confidence: null,
		stability: 1,
		difficulty: 5,
		elapsedDays: 0,
		scheduledDays: 1,
		state: CARD_STATES.LEARNING,
		dueAt: new Date(opts.reviewedAt.getTime() + 24 * 60 * 60 * 1000),
		reviewedAt: opts.reviewedAt,
		answerMs: null,
	});
}

async function seedScenario(userId: string, domain: string): Promise<string> {
	const id = generateScenarioId();
	await db.insert(scenario).values({
		id,
		userId,
		title: `sc ${id}`,
		situation: 'Flying along, something happens.',
		options: [
			{ id: 'a', text: 'Do thing A', isCorrect: true, outcome: 'Good', whyNot: '' },
			{ id: 'b', text: 'Do thing B', isCorrect: false, outcome: 'Bad', whyNot: 'Bad because' },
		],
		teachingPoint: 'Teaching point goes here',
		domain,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		phaseOfFlight: null,
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		isEditable: true,
		regReferences: [],
		status: SCENARIO_STATUSES.ACTIVE,
		createdAt: new Date(),
	});
	return id;
}

async function seedAttempt(
	userId: string,
	scenarioId: string,
	isCorrect: boolean,
	attemptedAt: Date = new Date(),
): Promise<void> {
	await db.insert(repAttempt).values({
		id: generateRepAttemptId(),
		scenarioId,
		userId,
		chosenOption: isCorrect ? 'a' : 'b',
		isCorrect,
		confidence: null,
		answerMs: null,
		attemptedAt,
	});
}

/** Convenience: unwrap PanelResult for happy-path test reads. */
function val<T>(r: PanelResult<T>): T {
	if ('value' in r) return r.value;
	throw new Error(`Expected value, got error: ${r.error}`);
}

// ---------------------------------------------------------------------------
// getRepBacklog
// ---------------------------------------------------------------------------

describe('getRepBacklog', () => {
	it('returns zeros for a fresh user', async () => {
		const { userId, cleanup } = await isolatedUser('backlog-fresh');
		try {
			const b = await getRepBacklog(userId);
			expect(b).toEqual({ unattempted: 0, totalActive: 0, byDomain: [] });
		} finally {
			await cleanup();
		}
	});

	it('splits attempted vs. unattempted scenarios by domain', async () => {
		const { userId, cleanup } = await isolatedUser('backlog-split');
		try {
			const s1 = await seedScenario(userId, DOMAINS.WEATHER);
			// s2 stays unattempted so the byDomain counts split across attempt state.
			await seedScenario(userId, DOMAINS.WEATHER);
			const s3 = await seedScenario(userId, DOMAINS.REGULATIONS);
			await seedAttempt(userId, s1, true);
			await seedAttempt(userId, s3, false);

			const b = await getRepBacklog(userId);
			expect(b.totalActive).toBe(3);
			expect(b.unattempted).toBe(1);

			const wx = b.byDomain.find((d) => d.domain === DOMAINS.WEATHER);
			const regs = b.byDomain.find((d) => d.domain === DOMAINS.REGULATIONS);
			expect(wx?.unattempted).toBe(1);
			expect(wx?.totalAttempts).toBe(1);
			expect(regs?.unattempted).toBe(0);
			expect(regs?.totalAttempts).toBe(1);
		} finally {
			await cleanup();
		}
	});

	it('ignores archived scenarios', async () => {
		const { userId, cleanup } = await isolatedUser('backlog-archived');
		try {
			const s1 = await seedScenario(userId, DOMAINS.WEATHER);
			// Archive this scenario; it should not count.
			await db.update(scenario).set({ status: SCENARIO_STATUSES.ARCHIVED }).where(eq(scenario.id, s1));
			const b = await getRepBacklog(userId);
			expect(b.totalActive).toBe(0);
			expect(b.byDomain).toEqual([]);
		} finally {
			await cleanup();
		}
	});
});

// ---------------------------------------------------------------------------
// getRecentActivity
// ---------------------------------------------------------------------------

describe('getRecentActivity', () => {
	it(`returns ${ACTIVITY_WINDOW_DAYS} zero-filled days for a fresh user`, async () => {
		const { userId, cleanup } = await isolatedUser('activity-fresh');
		try {
			const a = await getRecentActivity(userId);
			expect(a.days).toHaveLength(ACTIVITY_WINDOW_DAYS);
			expect(a.days.every((d) => d.reviews === 0 && d.attempts === 0)).toBe(true);
			expect(a.total).toBe(0);
			expect(a.averagePerDay).toBe(0);
			expect(a.streakDays).toBe(0);
		} finally {
			await cleanup();
		}
	});

	it('aggregates reviews and attempts into UTC day buckets', async () => {
		const { userId, cleanup } = await isolatedUser('activity-agg');
		try {
			const now = new Date('2026-04-19T12:00:00Z');
			const yesterday = new Date('2026-04-18T12:00:00Z');
			const twoDaysAgo = new Date('2026-04-17T06:00:00Z');

			// Seed a card so reviews FK can point at it.
			const cardId = await seedCard(userId, { domain: DOMAINS.WEATHER });
			await seedReview(userId, cardId, { rating: REVIEW_RATINGS.GOOD, reviewedAt: now });
			await seedReview(userId, cardId, { rating: REVIEW_RATINGS.GOOD, reviewedAt: yesterday });
			await seedReview(userId, cardId, { rating: REVIEW_RATINGS.AGAIN, reviewedAt: twoDaysAgo });

			const scId = await seedScenario(userId, DOMAINS.WEATHER);
			await seedAttempt(userId, scId, true, now);
			await seedAttempt(userId, scId, false, yesterday);

			const a: RecentActivity = await getRecentActivity(userId, 7, db, now);
			expect(a.days).toHaveLength(7);

			// Days are ordered oldest -> newest; today is the last element.
			const today = a.days[a.days.length - 1];
			const yesterdayRow = a.days[a.days.length - 2];
			const twoDaysAgoRow = a.days[a.days.length - 3];

			expect(today.day).toBe('2026-04-19');
			expect(today.reviews).toBe(1);
			expect(today.attempts).toBe(1);

			expect(yesterdayRow.day).toBe('2026-04-18');
			expect(yesterdayRow.reviews).toBe(1);
			expect(yesterdayRow.attempts).toBe(1);

			expect(twoDaysAgoRow.day).toBe('2026-04-17');
			expect(twoDaysAgoRow.reviews).toBe(1);
			expect(twoDaysAgoRow.attempts).toBe(0);

			expect(a.total).toBe(5);
			expect(a.streakDays).toBe(3);
		} finally {
			await cleanup();
		}
	});

	it('breaks the streak on a day with neither reviews nor attempts', async () => {
		const { userId, cleanup } = await isolatedUser('activity-streak-gap');
		try {
			const now = new Date('2026-04-19T12:00:00Z');
			const threeDaysAgo = new Date('2026-04-16T12:00:00Z');

			const cardId = await seedCard(userId, { domain: DOMAINS.WEATHER });
			await seedReview(userId, cardId, { rating: REVIEW_RATINGS.GOOD, reviewedAt: now });
			// Gap on 2026-04-17 and 2026-04-18.
			await seedReview(userId, cardId, { rating: REVIEW_RATINGS.GOOD, reviewedAt: threeDaysAgo });

			const a = await getRecentActivity(userId, 7, db, now);
			expect(a.streakDays).toBe(1);
		} finally {
			await cleanup();
		}
	});
});

// ---------------------------------------------------------------------------
// getWeakAreas
// ---------------------------------------------------------------------------

describe('getWeakAreas', () => {
	it('returns empty array for a fresh user', async () => {
		const { userId, cleanup } = await isolatedUser('weak-fresh');
		try {
			const w = await getWeakAreas(userId);
			expect(w).toEqual([]);
		} finally {
			await cleanup();
		}
	});

	it(`skips domains below WEAK_AREA_MIN_DATA_POINTS=${WEAK_AREA_MIN_DATA_POINTS}`, async () => {
		const { userId, cleanup } = await isolatedUser('weak-min-data');
		try {
			const now = new Date('2026-04-19T12:00:00Z');
			const cardId = await seedCard(userId, { domain: DOMAINS.WEATHER });
			// 3 reviews only -- well below the 10 minimum. Must not rank.
			for (let i = 0; i < 3; i++) {
				await seedReview(userId, cardId, {
					rating: REVIEW_RATINGS.AGAIN,
					reviewedAt: new Date(now.getTime() - i * 60_000),
				});
			}
			const w = await getWeakAreas(userId, 5, db, now);
			expect(w).toEqual([]);
		} finally {
			await cleanup();
		}
	});

	it('ranks a low-accuracy domain higher than a passing one', async () => {
		const { userId, cleanup } = await isolatedUser('weak-rank');
		try {
			const now = new Date('2026-04-19T12:00:00Z');
			const wxCard = await seedCard(userId, { domain: DOMAINS.WEATHER });
			const regsCard = await seedCard(userId, { domain: DOMAINS.REGULATIONS });

			// Weather: 10 reviews, all AGAIN -> 0% accuracy.
			for (let i = 0; i < 10; i++) {
				await seedReview(userId, wxCard, {
					rating: REVIEW_RATINGS.AGAIN,
					reviewedAt: new Date(now.getTime() - (i + 1) * 60_000),
				});
			}
			// Regulations: 10 reviews, all GOOD -> 100% accuracy.
			for (let i = 0; i < 10; i++) {
				await seedReview(userId, regsCard, {
					rating: REVIEW_RATINGS.GOOD,
					reviewedAt: new Date(now.getTime() - (i + 1) * 60_000),
				});
			}

			const w = await getWeakAreas(userId, 5, db, now);
			// Regulations is above threshold so it's excluded entirely;
			// weather dominates.
			expect(w.length).toBeGreaterThanOrEqual(1);
			expect(w[0].domain).toBe(DOMAINS.WEATHER);
			expect(w.some((r) => r.domain === DOMAINS.REGULATIONS)).toBe(false);

			// Reason list for weather should include the card-accuracy signal.
			const cardReason = w[0].reasons.find((r) => r.kind === 'card-accuracy');
			expect(cardReason).toBeDefined();
			if (cardReason?.kind === 'card-accuracy') {
				expect(cardReason.accuracy).toBe(0);
				expect(cardReason.dataPoints).toBe(10);
			}
		} finally {
			await cleanup();
		}
	});

	it('surfaces overdue cards even when they are the only signal past threshold', async () => {
		const { userId, cleanup } = await isolatedUser('weak-overdue');
		try {
			const now = new Date('2026-04-19T12:00:00Z');
			const threeDaysAgo = new Date('2026-04-16T12:00:00Z');

			// Mixed: 10 GOOD reviews gives good accuracy, but the card itself
			// is well overdue so the domain still shows in weak areas.
			const wxCard = await seedCard(userId, {
				domain: DOMAINS.WEATHER,
				dueAt: threeDaysAgo,
			});
			for (let i = 0; i < 10; i++) {
				await seedReview(userId, wxCard, {
					rating: REVIEW_RATINGS.GOOD,
					reviewedAt: new Date(now.getTime() - (i + 1) * 60_000),
				});
			}

			const w = await getWeakAreas(userId, 5, db, now);
			// The accuracy signal is fine; overdue is the only reason to flag.
			const wx = w.find((a) => a.domain === DOMAINS.WEATHER);
			expect(wx).toBeDefined();
			const overdue = wx?.reasons.find((r) => r.kind === 'overdue');
			expect(overdue).toBeDefined();
			if (overdue?.kind === 'overdue') {
				expect(overdue.overdueCount).toBeGreaterThan(0);
			}
		} finally {
			await cleanup();
		}
	});
});

// ---------------------------------------------------------------------------
// getDashboardPayload
// ---------------------------------------------------------------------------

describe('getDashboardPayload', () => {
	it('returns panel-level value tuples on success', async () => {
		const { userId, cleanup } = await isolatedUser('payload-success');
		try {
			const payload = await getDashboardPayload(userId);
			// All four panels populated with a `value` tuple (no error) for a
			// zero-state user. Shapes asserted rather than specific counts.
			expect('value' in payload.stats).toBe(true);
			expect('value' in payload.repBacklog).toBe(true);
			expect('value' in payload.weakAreas).toBe(true);
			expect('value' in payload.activity).toBe(true);
			expect(val(payload.repBacklog).totalActive).toBe(0);
			expect(val(payload.activity).days).toHaveLength(ACTIVITY_WINDOW_DAYS);
			expect(val(payload.weakAreas)).toEqual([]);
		} finally {
			await cleanup();
		}
	});

	it('isolates a failing panel into an `error` tuple without breaking the rest', async () => {
		const { userId, cleanup } = await isolatedUser('payload-isolation');
		try {
			// Inject a fetcher record where `weakAreas` throws; the other three
			// succeed. Panels must end up independent: three values, one error.
			const sabotaged: DashboardFetchers = {
				stats: () =>
					Promise.resolve({
						dueNow: 0,
						reviewedToday: 0,
						streakDays: 0,
						stateCounts: {
							[CARD_STATES.NEW]: 0,
							[CARD_STATES.LEARNING]: 0,
							[CARD_STATES.REVIEW]: 0,
							[CARD_STATES.RELEARNING]: 0,
						},
						domains: [],
					}),
				repBacklog: (uid, database) => getRepBacklog(uid, database),
				weakAreas: () => Promise.reject(new Error('boom from weak areas')),
				activity: (uid, database, now) => getRecentActivity(uid, ACTIVITY_WINDOW_DAYS, database, now),
			};
			const payload = await getDashboardPayload(userId, db, new Date(), sabotaged);
			expect('value' in payload.stats).toBe(true);
			expect('value' in payload.repBacklog).toBe(true);
			expect('value' in payload.activity).toBe(true);
			expect('error' in payload.weakAreas).toBe(true);
			if ('error' in payload.weakAreas) {
				expect(payload.weakAreas.error).toContain('boom from weak areas');
			}
		} finally {
			await cleanup();
		}
	});
});
