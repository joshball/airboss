/**
 * Constants for the `/program` surface (study-app-ia-cleanup Phase 2).
 *
 * Quals + Goal + Plan + Coverage roll onto a single Program page with
 * sub-tabs. The `?tab=` query param drives sub-tab selection; bogus values
 * fall back to the default tab. Per design.md: "Default tab = Goal when one
 * exists, else Quals."
 *
 * Tabs map 1:1 to child route segments under `apps/study/src/routes/(app)/program/`:
 *
 * | Tab        | Slug      | Child route        |
 * | ---------- | --------- | ------------------ |
 * | quals      | quals     | /program/quals     |
 * | goal       | goal      | /program/goals     |
 * | plan       | plan      | /program/plans     |
 * | coverage   | coverage  | /program/coverage  |
 *
 * Singular slug (`goal`, `plan`) is intentional -- the tab name reflects
 * the user's intent (singular: "my Goal", "my Plan"); the route segment
 * stays plural to match the resource list (`/program/goals/[id]`,
 * `/program/plans/[id]`).
 */

export const PROGRAM_TABS = {
	QUALS: 'quals',
	GOAL: 'goal',
	PLAN: 'plan',
	COVERAGE: 'coverage',
} as const;

export type ProgramTab = (typeof PROGRAM_TABS)[keyof typeof PROGRAM_TABS];

export const PROGRAM_TAB_VALUES: readonly ProgramTab[] = Object.values(PROGRAM_TABS);

/** Type-guard for sanitising untrusted `?tab=` input. */
export function isProgramTab(value: string): value is ProgramTab {
	return (PROGRAM_TAB_VALUES as readonly string[]).includes(value);
}

/**
 * Default tab when no goal exists. Per design.md Q1 -- the user's first
 * action on `/program` (when fresh) is picking a Qual to set a Goal
 * against. When a goal exists, the loader overrides this with `GOAL`.
 */
export const PROGRAM_TAB_DEFAULT_NO_GOAL: ProgramTab = PROGRAM_TABS.QUALS;
export const PROGRAM_TAB_DEFAULT_WITH_GOAL: ProgramTab = PROGRAM_TABS.GOAL;
