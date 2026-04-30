/**
 * Pure suggestion-threshold logic for the section reader.
 *
 * The "Mark this section as read?" banner surfaces when ALL of the following
 * are true (per spec.md "Read-progress mechanics"):
 *
 *   1. The user has spent at least `HANDBOOK_SUGGEST_OPEN_SECONDS` of
 *      visible time on the page in the current session.
 *   2. Cumulative `total_seconds_visible` (across visits) is at least
 *      `HANDBOOK_SUGGEST_TOTAL_SECONDS`.
 *   3. (When `HANDBOOK_SUGGEST_REQUIRES_SCROLL_END` is true) the user has
 *      scrolled to the bottom of the section content at least once.
 *   4. The current read status is not already `read` -- the prompt asks the
 *      user to advance to that state, so it is moot if they are there.
 *
 * Locally dismissed prompts ("Not yet" click) suppress the banner for the
 * rest of the session via `dismissedThisSession`. That state is not
 * persisted; reloading the page re-evaluates the heuristic.
 *
 * Extracted from the page component so the threshold rule has a single
 * deterministic test seam without booting a DOM.
 */

import {
	HANDBOOK_READ_STATUSES,
	HANDBOOK_SUGGEST_OPEN_SECONDS,
	HANDBOOK_SUGGEST_REQUIRES_SCROLL_END,
	HANDBOOK_SUGGEST_TOTAL_SECONDS,
	type HandbookReadStatus,
} from '@ab/constants';

export interface ReadSuggestionInput {
	/** Visible time accumulated in the current page-load (resets on reload). */
	openedSecondsInSession: number;
	/** Cumulative `handbook_read_state.total_seconds_visible` (across visits). */
	totalSecondsVisible: number;
	/** Whether the user has scrolled to the bottom of the section body. */
	scrolledToBottom: boolean;
	/** Current read status from `handbook_read_state.status`. */
	status: HandbookReadStatus;
	/** True after the learner clicks "Not yet" in the current session. */
	dismissedThisSession: boolean;
}

/**
 * Returns true when the suggestion banner should render. Pure: same input,
 * same output. No DOM access, no I/O.
 */
export function shouldShowReadSuggestion(input: ReadSuggestionInput): boolean {
	if (input.dismissedThisSession) return false;
	if (input.status === HANDBOOK_READ_STATUSES.READ) return false;
	if (input.openedSecondsInSession < HANDBOOK_SUGGEST_OPEN_SECONDS) return false;
	if (input.totalSecondsVisible < HANDBOOK_SUGGEST_TOTAL_SECONDS) return false;
	if (HANDBOOK_SUGGEST_REQUIRES_SCROLL_END && !input.scrolledToBottom) return false;
	return true;
}
