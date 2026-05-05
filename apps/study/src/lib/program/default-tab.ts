/**
 * Helpers for `/program` sub-tab resolution.
 *
 * Two pure functions that a server load and any unit tests can call without
 * touching the DB:
 *
 * - `resolveDefaultProgramTab` -- "Goal when one exists, else Quals" per
 *   design.md Phase 2 default.
 * - `parseProgramTab` -- safe parse of the `?tab=` query param against the
 *   closed `PROGRAM_TAB_VALUES` allowlist, returning `null` for missing or
 *   invalid input.
 */

import {
	isProgramTab,
	PROGRAM_TAB_DEFAULT_NO_GOAL,
	PROGRAM_TAB_DEFAULT_WITH_GOAL,
	type ProgramTab,
} from '@ab/constants';

export function resolveDefaultProgramTab(input: { hasGoal: boolean }): ProgramTab {
	return input.hasGoal ? PROGRAM_TAB_DEFAULT_WITH_GOAL : PROGRAM_TAB_DEFAULT_NO_GOAL;
}

/**
 * Parse a raw `?tab=` value. Returns the canonical tab when valid, otherwise
 * `null` -- the caller decides whether to redirect, fall back to the
 * default, or show an error.
 *
 * `null` / `undefined` (param absent) -> `null`.
 * String value not in `PROGRAM_TAB_VALUES` -> `null`.
 */
export function parseProgramTab(value: string | null | undefined): ProgramTab | null {
	if (value === null || value === undefined) return null;
	return isProgramTab(value) ? value : null;
}
