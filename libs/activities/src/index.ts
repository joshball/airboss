/**
 * `@ab/activities` -- interactive learning activities attached to
 * knowledge nodes. Components live under `src/<activity>/` and are
 * imported by the knowledge-learn surface via
 * `@ab/activities/<activity>/Component.svelte`.
 *
 * There is no runtime barrel export: activities are heavyweight
 * `.svelte` components loaded on demand, so consumers import them by
 * path instead of through this file.
 */

export {};
