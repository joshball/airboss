---
title: Promotion batches & editions persistence -- design
status: draft
created: 2026-05-01
---

## Schema namespace

New file `libs/sources/src/db/schema.ts` exports the two tables, registered under namespace `sources_registry` (parallels `identity`, `audit`, `study`). Drizzle config picks it up from `drizzle.config.ts`'s schema array.

Naming follows existing convention: namespace prefix is implicit via the schema directory; table names stay short (`promotion_batches`, `editions`).

## File layout

```text
libs/sources/src/db/
  schema.ts                       new -- pgTable definitions + Zod inserts
  client.ts                       new -- drizzle() instance bound to the sources_registry namespace, re-exporting from @ab/db
libs/sources/src/registry/
  lifecycle.ts                    edited -- recordPromotion / recordDePromotion now wrap a Drizzle tx
  editions.ts                     edited -- getEditionsMap reads via Postgres + cache
  __testing__/                    new dir -- in-memory test doubles for tests that don't need the DB
```

The `db/` subdirectory mirrors the pattern in `libs/auth/src/db/` and `libs/bc/study/src/db/`.

## Transaction wrapper

```typescript
import { db } from '@ab/db';

export async function recordPromotion(input: PromotionInput): Promise<PromotionResult> {
  const validation = validatePromotion(input);
  if (!validation.ok) return validation;

  return await db.transaction(async (tx) => {
    const batch = buildBatch(input, validation.fromLifecycle);
    await tx.insert(promotionBatches).values(toPromotionBatchRow(batch));
    applyOverlayMutation(input.scope, input.targetLifecycle);
    return { ok: true, batch };
  }).catch((error) => ({ ok: false, error: String(error) }));
}
```

The signature stays sync-compatible at the public level by wrapping callers; or we change the public signature to async. Recommend async -- the registry is already async-capable (most callers are server-side handlers).

If the public signature changes from sync to async: callers in `apps/study/src/`, `libs/sources/src/registry/`, and any test files need updates. Grep `recordPromotion(` to enumerate.

## Cache layer for editions

`getEditionsMap()` returns a `ReadonlyMap` today. The cached version returns the same shape but populates lazily. Generation counter borrowed from W5:

```typescript
let cachedGeneration = -1;
let cachedMap: Map<SourceId, readonly Edition[]> = new Map();

export async function getEditionsMap(): Promise<Map<SourceId, readonly Edition[]>> {
  const currentGen = registryGeneration();
  if (currentGen === cachedGeneration) return cachedMap;
  cachedMap = await loadEditionsFromDb();
  cachedGeneration = currentGen;
  return cachedMap;
}
```

Writes to `editions` (any insert / update / delete) call `bumpRegistryGeneration()`. W5's index ties into the same counter so its invalidation already works.

If `getCurrentEdition` is hot enough to merit a per-id read instead of full-map load, add `getCurrentEdition(id)` that issues a single-row query and short-caches it for the request. Defer until measured.

## Rebuild ENTRY_LIFECYCLES on startup

```typescript
async function rebuildLifecycleOverlay(): Promise<void> {
  const batches = await db
    .select()
    .from(promotionBatches)
    .orderBy(promotionBatches.promotionDate);
  ENTRY_LIFECYCLES.clear();
  for (const batch of batches) {
    for (const id of batch.scope) {
      ENTRY_LIFECYCLES.set(id, batch.toLifecycle);
    }
  }
}
```

Called once at module load via top-level `await`, or via an explicit init function called from app bootstrap. Prefer the explicit init; top-level await complicates module ordering in Bun + Vitest.

## Migration

`drizzle-kit generate:pg` produces `drizzle/<timestamp>-promotion-batches-and-editions/migration.sql`. No data migration. The empty initial state matches `editions.ts:5` (Phase 2 ships empty) and `lifecycle.ts:84` (empty BATCHES Map).

Migration is forward-only. Rollback is `DROP TABLE editions; DROP TABLE promotion_batches;` -- documented in the migration's accompanying README, not auto-generated.

## W5 / W6 reconciliation notes

- **W5** ships the registry index against the in-memory `Map`s. After this WP lands, W5's index becomes a cache against the Postgres-backed reads. The `bumpRegistryGeneration()` call moves from "on Map mutation" to "on transaction commit." W5's tests stay correct -- they test cache invalidation, not the underlying store.
- **W6** ships the in-memory atomicity fix for `recordPromotion`. After this WP lands, W6's atomic-Map writes become atomic-transactional writes. W6's mid-batch-failure test transposes from "Map left half-mutated" to "transaction rolls back." Both tests assert the same observable property: post-failure state equals pre-failure state.
- This WP's PR rebases on top of W5 + W6 once they merge.

## Risks

1. **Async signature change ripple.** If `recordPromotion` becomes async, every caller updates. Mitigation: search callers first, batch the change.
2. **Bootstrap ordering.** `rebuildLifecycleOverlay` must run before any `getEntryLifecycle` call. If it doesn't, callers see static `SOURCES[id].lifecycle` and miss promotions. Mitigation: explicit `initRegistry()` from app bootstrap; integration test asserts overlay is hot before first request.
3. **Editions empty during transition.** Phase 2 ships empty; Phase 3+ ingestion populates. The cache layer must distinguish "no edition for this id" from "edition cache not warmed." Mitigation: cache holds `Map<SourceId, readonly Edition[]>`; absence-of-key means "not in DB," not "not loaded." A separate boolean tracks "loaded yet."
