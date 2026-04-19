import { CARD_STATES, REVIEW_RATINGS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { fsrsDefaultParams, fsrsInitialState, fsrsSchedule } from './srs';

const NOW = new Date('2026-04-19T12:00:00Z');

describe('fsrsInitialState', () => {
	it('returns the new-card defaults', () => {
		const s = fsrsInitialState(NOW);
		expect(s.state).toBe(CARD_STATES.NEW);
		expect(s.stability).toBe(0);
		expect(s.difficulty).toBe(0);
		expect(s.reviewCount).toBe(0);
		expect(s.lapseCount).toBe(0);
		expect(s.lastReview).toBeNull();
	});
});

describe('fsrsDefaultParams', () => {
	it('exposes a finite default weight vector of at least 19 entries', () => {
		// FSRS-5 uses 19 weights; newer ts-fsrs releases extend to 21 for FSRS-6
		// compatibility. Assert the invariant that matters: all entries finite,
		// length at least the FSRS-5 count.
		const w = fsrsDefaultParams();
		expect(w.length).toBeGreaterThanOrEqual(19);
		expect(w.every((x) => Number.isFinite(x))).toBe(true);
	});
});

describe('fsrsSchedule -- new card', () => {
	it('Good on a new card promotes past state New with stability > 0', () => {
		const start = fsrsInitialState(NOW);
		const result = fsrsSchedule(start, REVIEW_RATINGS.GOOD, NOW);
		expect(result.state).not.toBe(CARD_STATES.NEW);
		expect(result.stability).toBeGreaterThan(0);
		expect(result.difficulty).toBeGreaterThanOrEqual(1);
		expect(result.difficulty).toBeLessThanOrEqual(10);
	});

	it('Again on a new card lands in learning with short due interval', () => {
		const start = fsrsInitialState(NOW);
		const result = fsrsSchedule(start, REVIEW_RATINGS.AGAIN, NOW);
		expect(result.state).toBe(CARD_STATES.LEARNING);
		// Due should be soon: within a day of now.
		const msToDue = result.dueAt.getTime() - NOW.getTime();
		expect(msToDue).toBeGreaterThan(0);
		expect(msToDue).toBeLessThan(24 * 60 * 60 * 1000);
	});

	it('Easy on a new card schedules a longer interval than Good', () => {
		const easy = fsrsSchedule(fsrsInitialState(NOW), REVIEW_RATINGS.EASY, NOW);
		const good = fsrsSchedule(fsrsInitialState(NOW), REVIEW_RATINGS.GOOD, NOW);
		expect(easy.dueAt.getTime()).toBeGreaterThan(good.dueAt.getTime());
	});

	it('Rating ordering: Again <= Hard <= Good <= Easy by scheduled interval', () => {
		// Pin-down test: guards against Hard/Good being swapped in RATING_TO_TS.
		// Compare against a card already in Review state so all four ratings
		// schedule real intervals (Again on a new card goes to Learning with a
		// sub-day interval that reorders the comparison).
		const dueIn5 = new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000);
		const state: Parameters<typeof fsrsSchedule>[0] = {
			stability: 5,
			difficulty: 5,
			state: CARD_STATES.REVIEW,
			dueAt: dueIn5,
			lastReview: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000),
			reviewCount: 2,
			lapseCount: 0,
		};
		const at = dueIn5;

		const again = fsrsSchedule(state, REVIEW_RATINGS.AGAIN, at).dueAt.getTime();
		const hard = fsrsSchedule(state, REVIEW_RATINGS.HARD, at).dueAt.getTime();
		const good = fsrsSchedule(state, REVIEW_RATINGS.GOOD, at).dueAt.getTime();
		const easy = fsrsSchedule(state, REVIEW_RATINGS.EASY, at).dueAt.getTime();

		expect(again).toBeLessThanOrEqual(hard);
		expect(hard).toBeLessThan(good);
		expect(good).toBeLessThan(easy);
	});
});

describe('fsrsSchedule -- review cards', () => {
	// Construct a card that is already in the Review state: last reviewed 10
	// days before NOW, next due 10 days after NOW, and we re-rate at the due
	// time. We build the state directly so the test is isolated from FSRS's
	// graduation heuristics.
	function makeMatureCard() {
		const dueInTenDays = new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000);
		const lastReview = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000);
		const state: Parameters<typeof fsrsSchedule>[0] = {
			stability: 10,
			difficulty: 5,
			state: CARD_STATES.REVIEW,
			dueAt: dueInTenDays,
			lastReview,
			reviewCount: 3,
			lapseCount: 0,
		};
		return { state, at: dueInTenDays };
	}

	it('Again on a Review-state card transitions to Relearning and shortens the interval', () => {
		const { state, at } = makeMatureCard();
		const before = state.stability;

		const result = fsrsSchedule(state, REVIEW_RATINGS.AGAIN, at);
		expect(result.state).toBe(CARD_STATES.RELEARNING);
		// Due should be much sooner than the prior 10-day interval.
		const newIntervalMs = result.dueAt.getTime() - at.getTime();
		expect(newIntervalMs).toBeLessThan(24 * 60 * 60 * 1000);
		// Stability collapses after a lapse.
		expect(result.stability).toBeLessThan(before);
	});

	it('Easy on a Review-state card increases stability', () => {
		const { state, at } = makeMatureCard();
		const before = state.stability;

		const result = fsrsSchedule(state, REVIEW_RATINGS.EASY, at);
		expect(result.stability).toBeGreaterThan(before);
		expect(result.state).toBe(CARD_STATES.REVIEW);
	});
});

describe('fsrsSchedule -- bounds', () => {
	it('difficulty stays within [1, 10] across many review cycles', () => {
		let s = fsrsInitialState(NOW);
		let t = NOW;
		// 20 rounds of varied ratings -- difficulty must stay bounded.
		const ratings = [
			REVIEW_RATINGS.GOOD,
			REVIEW_RATINGS.HARD,
			REVIEW_RATINGS.GOOD,
			REVIEW_RATINGS.EASY,
			REVIEW_RATINGS.AGAIN,
		];
		for (let i = 0; i < 20; i++) {
			const r = fsrsSchedule(s, ratings[i % ratings.length], t);
			expect(r.difficulty).toBeGreaterThanOrEqual(1);
			expect(r.difficulty).toBeLessThanOrEqual(10);
			expect(r.stability).toBeGreaterThan(0);
			s = {
				stability: r.stability,
				difficulty: r.difficulty,
				state: r.state,
				dueAt: r.dueAt,
				lastReview: t,
				reviewCount: s.reviewCount + 1,
				lapseCount: r.state === CARD_STATES.RELEARNING ? s.lapseCount + 1 : s.lapseCount,
			};
			t = r.dueAt;
		}
	});

	it('elapsedDays and scheduledDays are finite non-negative numbers', () => {
		const result = fsrsSchedule(fsrsInitialState(NOW), REVIEW_RATINGS.GOOD, NOW);
		expect(Number.isFinite(result.elapsedDays)).toBe(true);
		expect(Number.isFinite(result.scheduledDays)).toBe(true);
		expect(result.elapsedDays).toBeGreaterThanOrEqual(0);
		expect(result.scheduledDays).toBeGreaterThanOrEqual(0);
	});
});
