/**
 * Numeric-rating <-> tally-bucket mapping for the memory-review undo flow.
 *
 * Pre-2026-05-04 the surface threaded `ratingLabel: string` through the
 * `PendingUndo` snapshot and decremented the local `RatingTally` by
 * lowercasing that label and string-comparing it against
 * `REVIEW_RATING_LABELS[REVIEW_RATINGS.AGAIN].toLowerCase()` etc. The numeric
 * rating was already present (it was passed into `startUndoWindow`) but was
 * dropped on the way into the snapshot. A label rename, a future i18n pass,
 * or two ratings sharing a case-folded prefix would silently desync the
 * tally bucket from the rating that was actually submitted.
 *
 * This module pins the numeric `ReviewRating` as the single source of truth
 * for both the increment-on-submit and decrement-on-undo flows. Both paths
 * route through `ratingTallyKey`, so they cannot drift.
 */

import { REVIEW_RATING_VALUES, REVIEW_RATINGS, type ReviewRating } from '@ab/constants';

/**
 * Per-rating tally bucket. Mirrored on the memory-review surface state.
 *
 * Keys are intentionally typed as `keyof RatingTally` (not the numeric
 * rating) so the page-level Svelte `$state<RatingTally>(...)` can deep-track
 * each bucket independently without auto-tracking-via-runtime-key tricks.
 */
export interface RatingTally {
	again: number;
	hard: number;
	good: number;
	easy: number;
}

/**
 * Map a numeric `ReviewRating` to its tally bucket key.
 *
 * Switch is exhaustive over the four-member literal union; the type system
 * proves no rating can return `undefined` and TS will flag a missing case if
 * a fifth rating is ever added.
 */
export function ratingTallyKey(rating: ReviewRating): keyof RatingTally {
	switch (rating) {
		case REVIEW_RATINGS.AGAIN:
			return 'again';
		case REVIEW_RATINGS.HARD:
			return 'hard';
		case REVIEW_RATINGS.GOOD:
			return 'good';
		case REVIEW_RATINGS.EASY:
			return 'easy';
	}
}

/**
 * Type-narrow a raw form value to the `ReviewRating` literal union. The
 * memory-review submit form posts `value={r}` from `REVIEW_RATING_VALUES`,
 * so a non-matching value can only come from a tampered DOM. Surfaces
 * surface-level error rather than silently submitting a 0.
 */
export function isReviewRating(value: number): value is ReviewRating {
	return (REVIEW_RATING_VALUES as readonly number[]).includes(value);
}
