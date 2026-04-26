/**
 * Engine scoring coefficients. See ADR 014 and `libs/bc/study/src/engine.ts`.
 *
 * Three categories:
 * - WEIGHTS: relative dial values for additive scoring inside a slice.
 * - THRESHOLDS: product cut-offs that gate behaviour (overdue, low-accuracy).
 * - WINDOWS: duration constants used as denominators for urgency math.
 *
 * Every value here used to be a bare numeric literal. The names map to the
 * product narrative each weight encodes (last-session domain, relearning
 * rescue, expand by priority, etc.). Tuning changes route through this
 * module so engine changes are reviewable.
 */

import { MS_PER_WEEK } from './time';

export const ENGINE_SCORING = {
	CONTINUE: {
		/** Domain match on the most recent session's domain. */
		LAST_SESSION_DOMAIN: 1.0,
		/** Domain match on an earlier recent-domain entry. */
		EARLIER_RECENT_DOMAIN: 0.5,
		/** Share of the continue-slice score driven by domain recency. */
		DOMAIN_RECENCY_SHARE: 0.6,
		/** Share of the continue-slice score driven by due-date urgency. */
		DUE_URGENCY_SHARE: 0.4,
		/** Bonus on a rep candidate when the most recent attempt was wrong. */
		RECENT_MISS_BONUS: 0.2,
	},
	STRENGTHEN: {
		/** Card is in the relearning state -- highest strengthen priority. */
		RELEARNING: 0.9,
		/** Card was rated Again on the last review. */
		RATED_AGAIN: 0.6,
		/** Card was rated Hard on the last review. */
		RATED_HARD: 0.3,
		/** Card is heavily overdue (above the THRESHOLDS.HEAVILY_OVERDUE_RATIO). */
		HEAVILY_OVERDUE: 0.4,
		/** Rep accuracy is below THRESHOLDS.REP_LOW_ACCURACY. */
		REP_LOW_ACCURACY: 0.6,
		/** Rep had a recent miss. */
		REP_RECENT_MISS: 0.4,
		/** Multiplier on the calibration overconfidence signal (cards + reps). */
		OVERCONFIDENCE_FACTOR: 0.3,
	},
	EXPAND: {
		/** Knowledge-node priority weight: critical / standard / stretch. */
		PRIORITY_CRITICAL: 1.0,
		PRIORITY_STANDARD: 0.6,
		PRIORITY_STRETCH: 0.2,
		/** Bonus when the node's domain is in the user's focus filter. */
		FOCUS_DOMAIN_MATCH: 0.4,
		/** Bonus when the node's bloom depth matches the user's depth preference. */
		BLOOM_DEPTH_MATCH: 0.2,
	},
	DIVERSIFY: {
		/** Bonus when the user prefers deep-coverage sessions. */
		DEEP_DEPTH_PREFERENCE_BONUS: 0.1,
	},
	FOCUS: {
		/**
		 * Score promotion applied to any candidate whose domain matches the
		 * session's focus filter. Spec treats focus as a *preference*, not a
		 * hard gate, so we add a flat bonus across continue/strengthen/diversify
		 * pools instead of filtering. EXPAND has its own larger
		 * `FOCUS_DOMAIN_MATCH` because the spec gives focus higher weight on
		 * the unstarted-node selection.
		 */
		DOMAIN_PROMOTION_BONUS: 0.25,
	},
	THRESHOLDS: {
		/** Overdue ratio at or above which a card counts as "heavily overdue". */
		HEAVILY_OVERDUE_RATIO: 2,
		/** Rep accuracy below this is treated as "low" by strengthen. */
		REP_LOW_ACCURACY: 0.6,
		/** Card is "due" (eligible for continue) at or above this overdue ratio. */
		CONTINUE_DUE_RATIO: 1,
	},
	WINDOWS: {
		/** Due-urgency saturates after this many ms past dueAt. */
		DUE_URGENCY_SATURATION_MS: MS_PER_WEEK,
	},
} as const;
