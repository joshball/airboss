---
title: Promotion batches & editions persistence -- tasks
status: shipped
created: 2026-05-01
shipped: 2026-05-02
---

Build order. Each task is a single PR unless noted.

## Prereq

- [x] W5 (`perf/sources-registry-index`) merged to main (#409).
- [x] W6 (`fix/sources-backend-criticals`) merged to main (#408).

## Phase 1 -- schema + migration -- PR #434

- [x] Author `libs/sources/src/db/schema.ts` with `promotion_batches` + `editions` per `spec.md`.
- [x] Wire into `drizzle.config.ts` schema array.
- [x] Generate migration: hand-written `drizzle/0007_promotion_batches_and_editions.sql`.
- [x] Hand-review the SQL: indexes, FK, CHECK constraints all present.
- [x] Migration README documenting rollback SQL.
- [x] Schema-shape unit tests in `libs/sources/src/db/schema.test.ts` (18 tests).

## Phase 2 -- read path -- PR #454 (combined with phase 3)

- [x] `getEditionsMap` reads through the Postgres-backed cache with `_loaded` flag + generation counter.
- [x] `getCurrentEdition(id)` single-row read.
- [x] `rebuildLifecycleOverlay()` in `init.ts`; `initRegistry()` called from `apps/{study,hangar}/src/hooks.server.ts`.
- [x] Tests in `editions.test.ts` and `lifecycle-overlay-rebuild.test.ts`.

## Phase 3 -- write path -- PR #454

- [x] `recordPromotion` / `recordDePromotion` are async + Drizzle-transactional. Public signature changed sync -> async; 14 corpus seed/ingest callers updated.
- [x] Generation counter bumped on every committed transaction.
- [x] Tests extending `lifecycle.test.ts`; integration test write -> restart -> overlay rebuild.

## Phase 4 -- cleanup

- [x] Update `lifecycle.ts:9` and `editions.ts:7` doc comments to drop the "Phase 2 / future WP" language. Replaced with "Persisted via `sources_registry.promotion_batches` / `editions`; see WP `promotion-batches-persistence`."
- [x] Update ADR 019 §2.1 to note `editions` is in the indexed tier (persisted).
- [ ] **Dropped:** "Remove `let _activeEditions` mutable-module-level binding." After Phase 2+3 shipped, this binding is the runtime cache the design.md describes (sync-caller compatibility, Postgres read-through). It is not stale Phase-2 scaffolding; removing it would break sync callers and the `__editions_internal__` test surface that test helpers still depend on. Decision recorded; no follow-on WP.
- [ ] Manual test plan run; user sign-off.

## Verification gates per phase

- [x] `bun run check` clean (0/0) per phase.
- [x] All existing sources tests pass.
- [x] New tests pass.
- [ ] Manual restart-survives-promotion test (deferred to user).

## Outcome

3 PRs shipped: #434 (schema), #454 (phases 2+3), this PR (Phase 4 cleanup).

Cluster H of the chunk-4 sources & content pipeline review (`docs/work/reviews/2026-05-01-sources-content-pipeline-INDEX.md`) is now closed by code, not by spec.
