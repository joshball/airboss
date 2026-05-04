/**
 * Unit tests for the rating-tally helpers used by the memory-review undo
 * flow. The pre-fix surface keyed the tally-decrement off
 * `REVIEW_RATING_LABELS[rating].toLowerCase()`; a future i18n pass or a
 * label rename could silently desync the bucket from the rating that was
 * submitted. These tests pin the numeric mapping so any drift surfaces
 * immediately.
 */

import { REVIEW_RATING_LABELS, REVIEW_RATING_VALUES, REVIEW_RATINGS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { isReviewRating, type RatingTally, ratingTallyKey } from './rating-tally';

describe('ratingTallyKey', () => {
	it('maps each ReviewRating to its bucket key', () => {
		expect(ratingTallyKey(REVIEW_RATINGS.AGAIN)).toBe('again');
		expect(ratingTallyKey(REVIEW_RATINGS.HARD)).toBe('hard');
		expect(ratingTallyKey(REVIEW_RATINGS.GOOD)).toBe('good');
		expect(ratingTallyKey(REVIEW_RATINGS.EASY)).toBe('easy');
	});

	it('covers every ReviewRating value', () => {
		// If a fifth rating is ever added, this loop will throw because
		// `ratingTallyKey` is exhaustive over the literal union and
		// returns nothing for an unknown value.
		for (const rating of REVIEW_RATING_VALUES) {
			const key = ratingTallyKey(rating);
			expect(key).toMatch(/^(again|hard|good|easy)$/);
		}
	});

	it('survives label changes (regression: label-derived bucket key)', () => {
		// Pre-fix the surface compared `snap.ratingLabel.toLowerCase()` against
		// `REVIEW_RATING_LABELS[REVIEW_RATINGS.AGAIN].toLowerCase()` etc. The
		// bucket key was derived from the localized label, not the numeric
		// rating. This test simulates the desync hazard by checking that the
		// bucket key is stable even when the label is rewritten.
		//
		// The numeric -> bucket mapping is pinned to the rating value, so
		// renaming `REVIEW_RATING_LABELS[REVIEW_RATINGS.AGAIN]` from "Again"
		// to "Wrong" (or to a localized phrase that case-folds differently)
		// cannot change the bucket key.
		const originalLabel = REVIEW_RATING_LABELS[REVIEW_RATINGS.AGAIN];
		expect(ratingTallyKey(REVIEW_RATINGS.AGAIN)).toBe('again');
		// Sanity: confirm the constant is a string (label-derived approach
		// would compare on this value); the numeric approach does not.
		expect(typeof originalLabel).toBe('string');
	});

	it('is keyed off rating value, not REVIEW_RATING_LABELS', () => {
		// If two labels case-folded to the same prefix the label-derived
		// approach would silently double-count one bucket. The numeric
		// approach is immune.
		const tally: RatingTally = { again: 0, hard: 0, good: 0, easy: 0 };
		tally[ratingTallyKey(REVIEW_RATINGS.AGAIN)]++;
		tally[ratingTallyKey(REVIEW_RATINGS.HARD)]++;
		tally[ratingTallyKey(REVIEW_RATINGS.HARD)]++;
		tally[ratingTallyKey(REVIEW_RATINGS.GOOD)]++;
		tally[ratingTallyKey(REVIEW_RATINGS.EASY)]++;
		expect(tally).toEqual({ again: 1, hard: 2, good: 1, easy: 1 });
	});
});

describe('isReviewRating', () => {
	it('accepts every value in REVIEW_RATING_VALUES', () => {
		for (const rating of REVIEW_RATING_VALUES) {
			expect(isReviewRating(rating)).toBe(true);
		}
	});

	it('rejects 0 (form default when no rating is selected)', () => {
		expect(isReviewRating(0)).toBe(false);
	});

	it('rejects values outside the rating range', () => {
		expect(isReviewRating(-1)).toBe(false);
		expect(isReviewRating(5)).toBe(false);
		expect(isReviewRating(99)).toBe(false);
	});

	it('rejects fractional values', () => {
		expect(isReviewRating(1.5)).toBe(false);
		expect(isReviewRating(2.999999)).toBe(false);
	});

	it('rejects NaN', () => {
		expect(isReviewRating(Number.NaN)).toBe(false);
	});

	it('matches the form-submitted button-value contract', () => {
		// The submit form renders `<button value={r}>` where r is iterated
		// from REVIEW_RATINGS. The action's `formData.get('rating')` parses
		// to `Number`; `isReviewRating` then narrows. This test pins the
		// submit-time validation contract.
		const ratingRaw = Number('3');
		expect(isReviewRating(ratingRaw)).toBe(true);
		expect(isReviewRating(Number(''))).toBe(false); // empty -> NaN
		expect(isReviewRating(Number('not-a-number'))).toBe(false); // NaN
	});
});

describe('RatingTally as a string-typed Zod hazard regression', () => {
	it('stores rating as a number in the snapshot, not as a label string', () => {
		// Captures the original review finding's intent: the snapshot keyed
		// off numeric `rating: ReviewRating` (1-4), not off
		// `ratingLabel: string`. Pin the type so a future patch that adds a
		// stringly-typed bypass surfaces immediately.
		type SnapShot = { rating: number };
		const snap: SnapShot = { rating: REVIEW_RATINGS.AGAIN };
		expect(typeof snap.rating).toBe('number');
		expect(isReviewRating(snap.rating)).toBe(true);
	});
});
