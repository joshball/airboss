// Client-safe surface for `@ab/db`.
//
// The live `postgres` pool and Drizzle handle live in `./connection`,
// which has top-level side effects (opens the pool, registers SIGTERM
// handlers, calls `requireEnv('DATABASE_URL')`). Re-exporting them from
// the package index would drag the Node-only `postgres` driver into
// every module that touches a column helper -- including svelte
// components that only need `timestamps()` for their schema. That broke
// the sim app's client bundle (`Buffer is not defined`) and crashed
// SSR when DATABASE_URL was unset.
//
// Server callers that need the live handle import from `@ab/db/connection`
// directly (deep import; explicit opt-in to the side-effectful module).
// This index keeps only pure helpers that are safe to evaluate anywhere.

export { timestamps } from './columns';
export { escapeLikePattern } from './escape';
