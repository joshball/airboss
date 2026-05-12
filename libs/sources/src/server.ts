// @browser-globals: server-only -- never imported by client .svelte
//
// Server-only barrel for `@ab/sources`. Every value re-exported here touches
// `@ab/db/connection` (the postgres driver) and cannot be evaluated in a
// browser bundle. Client surfaces import from `@ab/sources` (the root barrel)
// for browser-safe helpers; server surfaces -- `+page.server.ts`,
// `+server.ts`, `apps/*/src/lib/server/**`, scripts -- import from here.
//
// Pattern mirrors `@ab/bc-study/server`. Adding a value re-export here ALSO
// requires `scripts/check-browser-globals.ts` to list `@ab/sources/server` in
// `SERVER_ONLY_PACKAGE_PATTERNS` so a `.svelte` file that tries to import
// from it fails the check.

// Phase 9 runtime registry hydration. `bootstrap.ts` statically imports
// `node:fs` and synthesizes `SourceEntry` + `Edition` rows from on-disk
// derivative manifests, so it cannot evaluate in a browser bundle. Callers
// (`bun run airboss-ref`, `+page.server.ts`, ingest scripts) import these
// from the server barrel; the runtime barrel re-exports only the types.
export { hydrateRegsFromDerivatives, PHASE_9_BOOTSTRAP_REVIEWER_ID } from './bootstrap.ts';
// Drizzle table handles for callers that need to author their own subqueries
// (e.g. ADR 026 BC-consumers building a `notSupersededInRegistry` predicate
// against `study.reference`). Surfaced from the server barrel because their
// only legitimate consumers are query authors -- not types.
export { type EditionRow, editions, type NewEditionRow } from './db/schema.ts';
// ADR 026 §6 resolver API.
export {
	getCurrentEdition,
	getEditionByLabel,
	isEditionSuperseded,
	listEditionsForSource,
} from './registry/edition-resolver.ts';
// ADR 026 §3 seed-time writer (the seed is the only caller; the
// `edition-cache-write-guard` lint blocks non-seed call sites).
export { markPriorEditionsRetired, type UpsertEditionInput, upsertEdition } from './registry/edition-writer.ts';
// Existing server-only helpers callers reach via deep file import today.
// Surface them here so future callers don't reach into `registry/editions.ts`
// directly. `getEditionsMap` (the sync, in-memory variant called from
// per-corpus resolvers that ship in the browser barrel) is intentionally
// omitted -- it's pure-read and stays callable from the runtime barrel.
export {
	getCurrentEditionForSource,
	getEditionsMapAsync,
	loadEditionsFromDb,
	warmEditionsCache,
} from './registry/editions.ts';
