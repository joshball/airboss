---
title: Promotion batches & editions persistence -- test plan
status: draft
created: 2026-05-01
---

## Unit (Vitest, `*.test.ts`)

### `lifecycle.test.ts` (extends existing)

- Existing in-memory tests stay (W6 lands them). Add:
  - `recordPromotion` writes one row to `promotion_batches` with all 10 fields populated.
  - `recordPromotion` rolls back the row when the transaction throws after the insert (e.g., simulated FK violation downstream).
  - `recordPromotion` rolls back the row when the entry-lifecycle overlay update throws.
  - `recordDePromotion` requires `previous_batch_id` to exist; FK violation surfaces as `PromotionResult.ok: false`.
  - Audit chain: a sequence of `recordPromotion` -> `recordDePromotion` produces two rows where the second's `previous_batch_id` matches the first's `id`.
  - Concurrent `recordPromotion` against overlapping scope on different reviewer ids: both succeed and both rows persist (no implicit serialization expected; promotion is idempotent at the row level).

### `editions.test.ts` (new)

- `getEditionsMap` returns empty when no rows exist.
- After insert, `getEditionsMap` returns the new edition; cache-hit on the second call (assert via the generation counter).
- After a `bumpRegistryGeneration()` from elsewhere, the next `getEditionsMap` re-queries.
- `getCurrentEdition(id)` returns the row with the highest `published_at` and `retired_at IS NULL`.
- Edge: two editions with the same `published_at` -- tiebreak deterministic (recommend ULID id sort, document choice).

### `lifecycle-overlay-rebuild.test.ts` (new)

- After inserting 3 promotion rows for entry `X` (draft -> pending -> accepted), `rebuildLifecycleOverlay` produces `ENTRY_LIFECYCLES.get(X) === 'accepted'`.
- After a `recordDePromotion` (accepted -> pending), the rebuild produces `pending`.
- Empty table -> empty overlay.

## Integration (Playwright + DB, `*.integration.test.ts`)

- `recordPromotion` from the BC layer writes a real row to a real Postgres instance (the existing test DB harness in `tests/`).
- `getCurrentEdition` from the BC layer reads back the latest edition.
- App restart simulation: write batch -> close DB connection -> reopen -> rebuild overlay -> `getEntryLifecycle(id)` returns the post-batch state. This is the audit-trail-survives-restart property the WP exists to provide.

## Migration

- `bun run db:migrate` against an empty DB creates both tables with all indexes.
- Rerun is idempotent (Drizzle's migration table tracks state).
- Rollback SQL (`DROP TABLE editions; DROP TABLE promotion_batches;`) cleanly restores empty schema.

## Manual test plan

Per CLAUDE.md "Nothing merges without a manual test plan."

1. `bun run db:reset` (drop + recreate local DB).
2. `bun run db:migrate` (apply migration).
3. Verify tables exist: `psql ... -c '\d promotion_batches' -c '\d editions'`.
4. From a Node REPL or test fixture: call `recordPromotion({ scope: ['ac:ac-61-65'], targetLifecycle: 'pending', ... })`. Verify row in `promotion_batches`.
5. Restart the dev server. Verify `getEntryLifecycle('ac:ac-61-65')` returns `'pending'` (overlay rebuilt from DB).
6. Call `recordDePromotion` against the previous batch. Verify the new row references the previous via `previous_batch_id`.
7. `bun run db:rollback promotion-batches-and-editions` (or manual `DROP TABLE`s). Verify migration table still tracks correctly for re-application.

## Performance

Not a concern at Phase 2 scale (registry is small; promotions are operator-driven). Add benchmarks only if `getCurrentEdition` becomes a per-render N+1 (the W5 cache should prevent that; if a future profile shows it, add a per-id read path).
