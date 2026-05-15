/**
 * Per-(user, product, family, sub-family) state machine. Pure function:
 * takes the prior mastery row plus a new attempt outcome, returns the new
 * mastery row + a transition descriptor that the route can surface to the
 * student ("altimeter promoted to passive").
 *
 * Transitions (per the drill plan):
 *
 * - `active -> passive` when `streakAcrossSessions >= WX_PRACTICE_PROMOTION_STREAK`
 *   AND `recentRing` is full of correct answers AND the family is NOT in
 *   `WX_PRACTICE_NEVER_PROMOTE_FAMILIES`.
 * - `passive -> demoted` immediately on any wrong answer.
 * - `demoted -> active` after `WX_PRACTICE_RECOVERY_STREAK` correct attempts in a row.
 *
 * The "across sessions" semantic for `streakAcrossSessions` is enforced
 * here: when the caller passes `acrossSession = true` (first attempt for
 * the family in a new session), `streakAcrossSessions` increments by one
 * on correct; otherwise it stays put. The route layer is responsible for
 * setting `acrossSession` correctly (true on the first attempt of the
 * family in the session).
 *
 * Pure -- no DB. Browser-safe.
 */

import {
	WX_PRACTICE_MASTERY_STATES,
	WX_PRACTICE_NEVER_PROMOTE_FAMILIES,
	WX_PRACTICE_PROMOTION_STREAK,
	WX_PRACTICE_RECENT_RING_LENGTH,
	WX_PRACTICE_RECOVERY_STREAK,
	type WxPracticeMasteryState,
	type WxProduct,
} from '@ab/constants';

export interface MasterySnapshot {
	userId: string;
	product: WxProduct;
	family: string;
	subFamily: string;
	attempts: number;
	correct: number;
	recentRing: boolean[];
	streakAcrossSessions: number;
	state: WxPracticeMasteryState;
	lastSeenAt: Date | null;
	lastUpdatedAt: Date;
}

export type MasteryTransition =
	| { kind: 'none' }
	| { kind: 'promoted'; from: 'active'; to: 'passive' }
	| { kind: 'demoted'; from: 'passive'; to: 'demoted' }
	| { kind: 'recovered'; from: 'demoted'; to: 'active' };

export interface ApplyAttemptInput {
	prior: MasterySnapshot | null;
	userId: string;
	product: WxProduct;
	family: string;
	subFamily: string;
	correct: boolean;
	/** True if this is the first attempt for this (product, family, subFamily) in the current session. */
	acrossSession: boolean;
	now?: Date;
}

export interface ApplyAttemptResult {
	mastery: MasterySnapshot;
	transition: MasteryTransition;
}

const ACTIVE = WX_PRACTICE_MASTERY_STATES.ACTIVE;
const PASSIVE = WX_PRACTICE_MASTERY_STATES.PASSIVE;
const DEMOTED = WX_PRACTICE_MASTERY_STATES.DEMOTED;

function emptyMastery(input: ApplyAttemptInput, now: Date): MasterySnapshot {
	return {
		userId: input.userId,
		product: input.product,
		family: input.family,
		subFamily: input.subFamily,
		attempts: 0,
		correct: 0,
		recentRing: [],
		streakAcrossSessions: 0,
		state: ACTIVE,
		lastSeenAt: null,
		lastUpdatedAt: now,
	};
}

function pushRing(ring: readonly boolean[], next: boolean): boolean[] {
	const out = [...ring, next];
	while (out.length > WX_PRACTICE_RECENT_RING_LENGTH) out.shift();
	return out;
}

function ringFullCorrect(ring: readonly boolean[]): boolean {
	if (ring.length < WX_PRACTICE_RECENT_RING_LENGTH) return false;
	return ring.every((b) => b === true);
}

function isPromotable(family: string): boolean {
	return !WX_PRACTICE_NEVER_PROMOTE_FAMILIES.includes(family);
}

/**
 * Count the number of trailing `true` values in the ring (consecutive
 * correct from the most recent attempt backward). Used for `demoted ->
 * active` recovery.
 */
function trailingCorrectStreak(ring: readonly boolean[]): number {
	let n = 0;
	for (let i = ring.length - 1; i >= 0; i -= 1) {
		if (ring[i] === true) n += 1;
		else break;
	}
	return n;
}

export function applyAttempt(input: ApplyAttemptInput): ApplyAttemptResult {
	const now = input.now ?? new Date();
	const prior = input.prior ?? emptyMastery(input, now);

	const attempts = prior.attempts + 1;
	const correct = prior.correct + (input.correct ? 1 : 0);
	const recentRing = pushRing(prior.recentRing, input.correct);

	// streakAcrossSessions advances by one when this is the first attempt of
	// the family this session AND the answer is correct; resets to zero on a
	// wrong answer; otherwise unchanged.
	let streakAcrossSessions = prior.streakAcrossSessions;
	if (!input.correct) {
		streakAcrossSessions = 0;
	} else if (input.acrossSession) {
		streakAcrossSessions = prior.streakAcrossSessions + 1;
	}

	let state = prior.state;
	let transition: MasteryTransition = { kind: 'none' };

	if (state === ACTIVE && input.correct) {
		// Check for active -> passive promotion.
		if (
			isPromotable(input.family) &&
			streakAcrossSessions >= WX_PRACTICE_PROMOTION_STREAK &&
			ringFullCorrect(recentRing)
		) {
			state = PASSIVE;
			transition = { kind: 'promoted', from: 'active', to: 'passive' };
		}
	} else if (state === PASSIVE && !input.correct) {
		// Any miss while passive -> demoted.
		state = DEMOTED;
		transition = { kind: 'demoted', from: 'passive', to: 'demoted' };
	} else if (state === DEMOTED && input.correct) {
		// Recovery requires N correct in a row.
		if (trailingCorrectStreak(recentRing) >= WX_PRACTICE_RECOVERY_STREAK) {
			state = ACTIVE;
			transition = { kind: 'recovered', from: 'demoted', to: 'active' };
		}
	}

	const mastery: MasterySnapshot = {
		userId: input.userId,
		product: input.product,
		family: input.family,
		subFamily: input.subFamily,
		attempts,
		correct,
		recentRing,
		streakAcrossSessions,
		state,
		lastSeenAt: now,
		lastUpdatedAt: now,
	};

	return { mastery, transition };
}
