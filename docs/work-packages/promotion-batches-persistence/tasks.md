---
title: Promotion batches & editions persistence -- tasks
status: draft
created: 2026-05-01
sequencing: blocked-on-W5-W6-merge
---

Build order. Each task is a single PR unless noted.

## Prereq

- [ ] W5 (`perf/sources-registry-index`) merged to main.
- [ ] W6 (`fix/sources-backend-criticals`) merged to main.

Once both prereq PRs land, the in-memory atomicity + index contracts are stable and this WP rebases against them cleanly.

## Phase 1 -- schema + migration

- [ ] Author `libs/sources/src/db/schema.ts` with `promotion_batches` + `editions` per `spec.md`.
- [ ] Wire into `drizzle.config.ts` schema array.
- [ ] Generate migration: `bun run db:generate`.
- [ ] Hand-review the generated SQL: confirm indexes, FK, enum check constraints look right.
- [ ] Add migration README documenting rollback SQL.
- [ ] Test: `bun run db:migrate` against a fresh DB succeeds; rerun is no-op.

## Phase 2 -- read path

- [ ] Refactor `getEditionsMap` to query Postgres with a generation-counter cache.
- [ ] Add `getCurrentEdition(id)` (single-row read) for hot paths.
- [ ] Add bootstrap-time `rebuildLifecycleOverlay()` and call from the app bootstrap.
- [ ] Tests per `test-plan.md` `editions.test.ts` and `lifecycle-overlay-rebuild.test.ts`.

## Phase 3 -- write path

- [ ] Convert `recordPromotion` / `recordDePromotion` to use a Drizzle transaction. If the public signature changes to async, batch the caller updates.
- [ ] Bump generation counter on every committed transaction.
- [ ] Tests per `test-plan.md` `lifecycle.test.ts` extensions.
- [ ] Integration test: write -> restart -> overlay rebuilt -> read returns post-write state.

## Phase 4 -- cleanup

- [ ] Remove the `let _activeEditions` mutable-module-level binding from `editions.ts`. The DB is the source of truth; the cache is a read-through layer with no test mutation surface beyond `__editions_internal__` (which becomes a no-op or is deleted entirely if no test still depends on it).
- [ ] Update `lifecycle.ts:9` and `editions.ts:7` doc comments: remove "Phase 2 ships X; persistence is a future WP" language. Replace with "Persisted via the `sources_registry.promotion_batches` and `sources_registry.editions` tables; see WP `promotion-batches-persistence`."
- [ ] Update ADR 019 §2.1 to reflect the indexed tier is now active.
- [ ] Manual test plan run; sign-off.

## Verification gates per phase

- `bun run check` clean (0/0).
- All existing sources tests pass.
- New tests pass.
- Manual restart-survives-promotion test passes.

## Estimated PR count

3 PRs:

1. Phase 1 (schema + migration).
2. Phase 2 + 3 (read + write paths together; they share the cache contract).
3. Phase 4 (cleanup + ADR update).
