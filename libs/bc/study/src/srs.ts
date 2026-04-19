/**
 * FSRS-5 scheduling wrapper.
 *
 * Delegates the math to `ts-fsrs` (MIT, widely deployed in Anki-compatible
 * apps) and exposes a narrow airboss-flavored API with our own CardState
 * strings and Date-based returns. No runtime logic lives here -- this module
 * only translates between our types and ts-fsrs types.
 */

import { CARD_STATES, type CardState, REVIEW_RATINGS, type ReviewRating } from '@ab/constants';
import {
	type Card,
	type CardInput,
	createEmptyCard,
	default_w,
	type FSRS,
	type FSRSParameters,
	fsrs,
	Rating,
	State,
} from 'ts-fsrs';

/** Scheduler inputs needed to schedule the next review. */
export interface CardSchedulerState {
	stability: number;
	difficulty: number;
	state: CardState;
	dueAt: Date;
	lastReview: Date | null;
	reviewCount: number;
	lapseCount: number;
}

/** Scheduler output: new scheduling values for a card after a rating. */
export interface ScheduleResult {
	stability: number;
	difficulty: number;
	state: CardState;
	dueAt: Date;
	elapsedDays: number;
	scheduledDays: number;
}

const RATING_TO_TS: Record<ReviewRating, Rating> = {
	[REVIEW_RATINGS.AGAIN]: Rating.Again,
	[REVIEW_RATINGS.HARD]: Rating.Hard,
	[REVIEW_RATINGS.GOOD]: Rating.Good,
	[REVIEW_RATINGS.EASY]: Rating.Easy,
};

const STATE_TO_TS: Record<CardState, State> = {
	[CARD_STATES.NEW]: State.New,
	[CARD_STATES.LEARNING]: State.Learning,
	[CARD_STATES.REVIEW]: State.Review,
	[CARD_STATES.RELEARNING]: State.Relearning,
};

const STATE_FROM_TS: Record<State, CardState> = {
	[State.New]: CARD_STATES.NEW,
	[State.Learning]: CARD_STATES.LEARNING,
	[State.Review]: CARD_STATES.REVIEW,
	[State.Relearning]: CARD_STATES.RELEARNING,
};

/**
 * Shared default FSRS instance. Stateless; safe for concurrent use.
 * Pass custom params to fsrsSchedule / fsrsInitialState to override (e.g.
 * per-user optimized weights).
 */
const defaultScheduler = fsrs();

function getScheduler(params?: Partial<FSRSParameters>): FSRS {
	return params ? fsrs(params) : defaultScheduler;
}

/** Initial scheduler state for a brand-new card (no prior reviews). */
export function fsrsInitialState(now: Date = new Date()): CardSchedulerState {
	const empty = createEmptyCard(now);
	return {
		stability: empty.stability,
		difficulty: empty.difficulty,
		state: STATE_FROM_TS[empty.state],
		dueAt: empty.due,
		lastReview: empty.last_review ?? null,
		reviewCount: empty.reps,
		lapseCount: empty.lapses,
	};
}

/**
 * FSRS default weight parameters. Length is 19 under FSRS-5; ts-fsrs 5.x
 * extends to 21 for FSRS-6 compatibility. Returned array is frozen by ts-fsrs
 * and should not be mutated -- copy before tuning.
 */
export function fsrsDefaultParams(): readonly number[] {
	return default_w;
}

/**
 * Schedule the next review for a card after the learner rates it.
 *
 * Pure function: does not read/write the DB. The caller is responsible for
 * persisting the resulting stability/difficulty/state/dueAt onto card_state
 * and inserting a review row.
 */
export function fsrsSchedule(
	state: CardSchedulerState,
	rating: ReviewRating,
	now: Date = new Date(),
	params?: Partial<FSRSParameters>,
): ScheduleResult {
	const cardInput: CardInput = {
		due: state.dueAt,
		stability: state.stability,
		difficulty: state.difficulty,
		elapsed_days: 0,
		scheduled_days: 0,
		learning_steps: 0,
		reps: state.reviewCount,
		lapses: state.lapseCount,
		state: STATE_TO_TS[state.state],
		last_review: state.lastReview ?? null,
	};

	const grade = RATING_TO_TS[rating];
	const result = getScheduler(params).next(cardInput, now, grade);
	const nextCard: Card = result.card;

	return {
		stability: nextCard.stability,
		difficulty: nextCard.difficulty,
		state: STATE_FROM_TS[nextCard.state],
		dueAt: nextCard.due,
		elapsedDays: result.log.elapsed_days,
		scheduledDays: result.log.scheduled_days,
	};
}
