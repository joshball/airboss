# Tasks: extract `libs/bc/hangar/`

Status legend: `[x]` done, `[ ]` pending.

## Schema move

- [x] Create `libs/bc/hangar/` package (`package.json`, `src/`, exports).
- [x] Move `libs/db/src/hangar.ts` -> `libs/bc/hangar/src/schema.ts` (full schema with `bauthUser` FK references).
- [x] Move `libs/db/src/sim.ts` -> `libs/bc/sim/src/schema.ts`; wire `simAttempt` re-exports through `@ab/bc-sim`.
- [x] Drop hangar/sim re-exports from `libs/db/src/index.ts`.
- [x] Drop `@ab/auth` from `libs/db/package.json`; `@ab/db` is now infra-only.

## `auditColumns` decision

- [x] Move `auditColumns()` helper from `@ab/db` to `@ab/auth/columns` (next to `bauthUser`).
  - Rationale: `@ab/db` becomes pure (connection + escape + timestamps); `auditColumns` now lives where its `bauthUser` reference resolves. Same outcome (helper still exported, no callers existed) but cleaner dep graph.

## BC code move

- [x] Move 9 server files into `libs/bc/hangar/src/`:
  - `registry.ts`, `registry.test.ts`
  - `source-fetch.ts`, `source-fetch.test.ts`
  - `source-jobs.ts`, `source-jobs.test.ts`
  - `upload-handler.ts`, `upload-helpers.ts`, `upload-helpers.test.ts`
  - `users.ts`, `users.test.ts`
  - `jobs.ts`, `jobs.test.ts`
  - `edition-stub.ts`, `edition-stub.test.ts`
  - `source-form.ts`, `source-form.test.ts`, `source-form-types.ts`
  - `reference-form.ts`, `reference-form.test.ts`, `reference-form-types.ts`
  - dependency files: `form-helpers.ts`, `form-schemas.ts` (`schemas.ts` renamed to disambiguate from `schema.ts`).
- [x] Update `REPO_ROOT` calculation (4 ascents from `libs/bc/hangar/src/source-jobs.ts`).
- [x] Update `@ab/db` imports inside the moved files to use `./schema` for tables.

## New BC query helpers (promoting inline drizzle)

- [x] `dashboard-queries.ts` -- `countLiveSources`, `countLiveReferences`, `countAllJobs`, `listLiveSources`.
- [x] `jobs-queries.ts` -- `listRecentJobsForTarget`, `getActiveJobForTarget`, `getLatestCompleteJobByKind`, `getLatestCompleteJobForTarget`, `listRunningJobs`.
- [x] `registry.ts` -- `getReferenceSummary` (slim projection for `apps/study/references/[id]`).
- [x] `@ab/audit` -- `countAuditEntriesSince` (so home-page audit count stays out of routes).
- [x] `@ab/auth` -- `countAllUsers` (same reason for `bauthUser` count).

## Path aliases

- [x] Root `tsconfig.json`: add `@ab/bc-hangar` paths.
- [x] `apps/hangar/svelte.config.js`: add `@ab/bc-hangar` alias.
- [x] `apps/study/svelte.config.js`: add `@ab/bc-hangar` + transitive infra (`@ab/audit`, `@ab/hangar-jobs`, `@ab/hangar-sync`).
- [x] `drizzle.config.ts`: switch `./libs/db/src/{hangar,sim}.ts` -> `./libs/bc/{hangar,sim}/src/schema.ts`.

## Consumers updated

- [x] `apps/hangar/src/routes/**` -- 17 files routed through `@ab/bc-hangar`.
- [x] `apps/hangar/src/hooks.server.ts` -- `hangarJobHandlers` from `@ab/bc-hangar`.
- [x] `apps/hangar/src/lib/components/{ReferenceForm,SourceForm}.svelte` -- form types from `@ab/bc-hangar`.
- [x] `apps/study/src/routes/(app)/references/[id]/+page.server.ts` -- uses `getReferenceSummary`.
- [x] `libs/hangar-jobs/{enqueue,worker,types}.ts` -- schema imports via `@ab/bc-hangar/schema`.
- [x] `libs/hangar-sync/{run-sync-job,to-domain,detect-conflict,run-sync-job.test}.ts` -- same.
- [x] `libs/bc/citations/{citations,search}.ts` -- same.

## Acceptance verification

- [x] `bun run check` -- 205 errors total, all pre-existing on `main` (none introduced by this WP).
- [x] Zero `from 'drizzle-orm'` imports in `apps/hangar/src/routes/**`.
- [x] Zero `db.select().from(hangar*)` outside `libs/bc/hangar/` and the hangar infra libs (`hangar-jobs`, `hangar-sync`) that own the worker/sync engines and import schema via `@ab/bc-hangar/schema`.
- [x] BC tests: 354 passed (libs/bc/hangar + libs/bc/sim + libs/hangar-jobs + libs/hangar-sync + libs/bc/citations + libs/audit + libs/auth).
- [x] `bunx biome check` clean on touched files.
- [x] svelte-check: hangar 0 errors, sim 0 errors, study unchanged from main.
