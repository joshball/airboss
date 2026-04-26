/**
 * Group-by enum for the /reps/browse page. Subset of the shared
 * `BROWSE_GROUP_BY_VALUES` -- scenarios don't have an FSRS `state`, so we
 * drop that bucket.
 *
 * Lives in a sibling module instead of `+page.server.ts` because both the
 * server load and the client component need it -- SvelteKit forbids
 * non-`load`/`actions`/`config` exports from `+page.server.ts` modules.
 */
export const REPS_GROUP_BY_VALUES = ['none', 'domain', 'difficulty', 'phaseOfFlight', 'source', 'status'] as const;
export type RepsGroupByValue = (typeof REPS_GROUP_BY_VALUES)[number];
