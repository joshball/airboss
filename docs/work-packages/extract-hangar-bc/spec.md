---
status: done
shipped: PR #284 (2026-04-28)
trigger: after the 2026-04-27 fix PR merges; tracked as the next architecture cleanup before any net-new hangar feature
source: 2026-04-27 architecture + backend reviews
---

# Extract `libs/bc/hangar/`

## Problem

~2,400 lines of BC-shaped logic live under `apps/hangar/src/lib/server/`:

- `registry.ts` -- reference + source CRUD, optimistic locking, RevConflictError, audit writes
- `source-fetch.ts`, `source-jobs.ts` -- ingest orchestration
- `upload-handler.ts` -- staged upload pipeline
- `users.ts` -- read-only directory
- `jobs.ts`, `edition-stub.ts`, `source-form.ts`, `reference-form.ts`

Plus 9+ route files importing `db, hangarSource, hangarReference` from `@ab/db` and running Drizzle queries directly. The architecture rule is "apps are thin SvelteKit shells; data access lives in BCs." Hangar violates this systemically.

The hangar Drizzle schemas (`libs/db/src/hangar.ts`) also live in `@ab/db` instead of their owning BC, the same anti-pattern.

## Why this isn't fixed in PR-2026-04-27

Moving 2,400 lines + 5 schema tables + 10 route files in a review-fix PR would dwarf every other fix. The same review surfaced 60+ point fixes that need attention; ship those, then tackle this with a dedicated work package.

## Scope

1. Create `libs/bc/hangar/` with `package.json`, `tsconfig.json`, `src/index.ts`.
2. Move `libs/db/src/hangar.ts` -> `libs/bc/hangar/src/schema.ts`.
3. Move `apps/hangar/src/lib/server/{registry,source-fetch,source-jobs,upload-handler,users,jobs,edition-stub,source-form,reference-form}.ts` -> `libs/bc/hangar/src/`.
4. Promote inline Drizzle queries from route files (`+page.server.ts`, `+server.ts`) into BC functions: `getSourceById`, `getActiveJobForSource`, `listRecentJobsForSource`, `safeCount`, `getLatestCompleteJob(kind)`, etc.
5. Update `@ab/db` to drop the hangar re-exports.
6. Update `apps/hangar/` imports from `@ab/db` to `@ab/bc-hangar`.
7. Update `apps/study/src/routes/(app)/references/[id]/+page.server.ts` to call `@ab/bc-hangar.getReferenceById` instead of importing the table directly.
8. Same treatment for `libs/db/src/sim.ts` -> `libs/bc/sim/src/schema.ts` (sim BC already exists).
9. After: `libs/db/package.json` can drop `@ab/auth` dependency once `auditColumns` (the only `bauthUser` consumer left) is moved.

## Trigger

After this PR merges. Block any net-new hangar feature on this WP landing.

## Acceptance

- `bun run check` clean.
- Zero `from 'drizzle-orm'` imports in any route file.
- Zero `db.select().from(hangar*)` outside `libs/bc/hangar/`.
- All hangar tests pass; no regressions in e2e suite.
