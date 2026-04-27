/**
 * Unit tests for the section-reader suggestion-threshold helper.
 *
 * The thresholds (`HANDBOOK_SUGGEST_OPEN_SECONDS`,
 * `HANDBOOK_SUGGEST_TOTAL_SECONDS`, `HANDBOOK_SUGGEST_REQUIRES_SCROLL_END`)
 * live in `libs/constants/src/study.ts`; these tests reference the constants
 * by name rather than by value so a future tuning pass doesn't drift the
 * test suite from the production thresholds.
 */

import { HANDBOOK_READ_STATUSES, HANDBOOK_SUGGEST_OPEN_SECONDS, HANDBOOK_SUGGEST_TOTAL_SECONDS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type ReadSuggestionInput, shouldShowReadSuggestion } from './read-suggestion';

const baseline: ReadSuggestionInput = {
	openedSecondsInSession: HANDBOOK_SUGGEST_OPEN_SECONDS,
	totalSecondsVisible: HANDBOOK_SUGGEST_TOTAL_SECONDS,
	scrolledToBottom: true,
	status: HANDBOOK_READ_STATUSES.READING,
	dismissedThisSession: false,
};

describe('shouldShowReadSuggestion', () => {
	it('shows when every threshold is met', () => {
		expect(shouldShowReadSuggestion(baseline)).toBe(true);
	});

	it('hides when session-open seconds is below the threshold', () => {
		expect(shouldShowReadSuggestion({ ...baseline, openedSecondsInSession: HANDBOOK_SUGGEST_OPEN_SECONDS - 1 })).toBe(
			false,
		);
	});

	it('hides when total visible seconds is below the threshold', () => {
		expect(shouldShowReadSuggestion({ ...baseline, totalSecondsVisible: HANDBOOK_SUGGEST_TOTAL_SECONDS - 1 })).toBe(
			false,
		);
	});

	it('hides when the user has not scrolled to the bottom', () => {
		expect(shouldShowReadSuggestion({ ...baseline, scrolledToBottom: false })).toBe(false);
	});

	it('hides once the section is already marked read', () => {
		expect(shouldShowReadSuggestion({ ...baseline, status: HANDBOOK_READ_STATUSES.READ })).toBe(false);
	});

	it('still shows when the section is unread and other thresholds pass', () => {
		// First-visit users with prior heartbeats from a previous session can hit
		// the prompt without the explicit `reading` status if a tab crashed mid-read.
		expect(shouldShowReadSuggestion({ ...baseline, status: HANDBOOK_READ_STATUSES.UNREAD })).toBe(true);
	});

	it('hides for the rest of the session once dismissed', () => {
		expect(shouldShowReadSuggestion({ ...baseline, dismissedThisSession: true })).toBe(false);
	});
});
