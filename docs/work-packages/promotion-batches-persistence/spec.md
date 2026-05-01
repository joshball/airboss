---
title: Promotion batches & editions persistence
status: draft
created: 2026-05-01
authored-by: Joshua (with agent)
trigger: chunk-4 review (Cluster H) closure; review #393 line 115
related-adrs: [019]
related-wps: [chapter-source-ingestion, sources-content-pipeline-review-fixes]
---

## Why

`libs/sources/src/registry/lifecycle.ts:9` ships an in-memory `Map` for promotion batches and `libs/sources/src/registry/editions.ts:22` ships an in-memory `Map` for per-entry edition history. Both are explicitly Phase 2 placeholders. The audit-row contract (ADR 019 §2.4) is final but has no persistence layer; every restart wipes the audit trail. ADR 019 §2.1's "indexed tier" note already commits us to moving editions out of the in-memory tier.

Closing this gap closes Cluster H of the chunk-4 sources & content pipeline review (`docs/work/reviews/2026-05-01-sources-content-pipeline-INDEX.md`).

## Scope

In:

- New Drizzle schema namespace `sources_registry` with two tables:
  - `promotion_batches` -- the audit row defined in ADR 019 §2.4. One row per `recordPromotion` / `recordDePromotion` call.
  - `editions` -- per-entry edition history. ADR 019 §6.1 (`Edition` + `AliasEntry`).
- Postgres-backed reimplementation of `recordPromotion` / `recordDePromotion` with transactional all-or-nothing semantics.
- Postgres-backed reimplementation of `getEditionsMap` / `getCurrentEdition` reads, with an in-memory cache layer that respects W5's generation-counter invalidation contract.
- Drizzle migration script.
- Backfill: empty start (Phase 2 ships empty per `editions.ts:7`). No data migration.
- Test plan: see `test-plan.md`.

Out:

- Schema for `SOURCES` itself. That stays in code (`libs/sources/src/registry/sources.ts`) -- it's the static registry, not a mutable runtime store.
- ENUMERATED_CORPORA registration (W6 owns).
- Sectionals corpus (W9 may scaffold; this WP doesn't depend on it).
- UI for inspecting promotion history (separate WP if/when needed).

## Contracts

### `promotion_batches` table

ADR 019 §2.4 froze the audit row contract. The table mirrors `PromotionBatch` from `lifecycle.ts:23-34`:

```typescript
export const promotionBatches = pgTable('promotion_batches', {
  id: text('id').primaryKey(),                        // batch_ULID via createId('batch')
  corpus: text('corpus').notNull(),                   // CHAR varies; a corpus enum check constraint is OK
  reviewerId: text('reviewer_id').notNull(),
  promotionDate: timestamp('promotion_date', { withTimezone: true }).notNull(),
  scope: jsonb('scope').$type<readonly SourceId[]>().notNull(),
  inputSource: text('input_source').notNull(),
  state: text('state', { enum: ['promoted', 'de-promoted'] }).notNull(),
  fromLifecycle: text('from_lifecycle', { enum: SOURCE_LIFECYCLES }).notNull(),
  toLifecycle: text('to_lifecycle', { enum: SOURCE_LIFECYCLES }).notNull(),
  previousBatchId: text('previous_batch_id'),         // FK -> promotion_batches.id, nullable
});
```

Indexes:

- `(corpus, promotion_date desc)` -- list a corpus's history newest-first.
- `(previous_batch_id)` -- the de-promotion link traversal.
- `(reviewer_id, promotion_date desc)` -- per-reviewer audit.

### `editions` table

ADR 019 §6.1.

```typescript
export const editions = pgTable('editions', {
  id: text('id').primaryKey(),                          // edition_ULID via createId('edition')
  sourceId: text('source_id').notNull(),                // matches SOURCES key
  editionLabel: text('edition_label').notNull(),        // 'FAA-H-8083-25C', '2026-04', '141'
  publishedAt: timestamp('published_at', { withTimezone: true }),
  retiredAt: timestamp('retired_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<EditionMetadata>(), // shape from ADR 019 §6.1
});
```

Indexes:

- `(source_id, published_at)` -- chronological walk per entry.
- Partial index `WHERE retired_at IS NULL` -- "current" lookups.

### `recordPromotion` (transactional)

Public signature unchanged. Internals:

1. Open a Drizzle transaction.
2. Validate every `scope` entry's transition (current `for` loop in lifecycle.ts:117 stays).
3. Insert one row into `promotion_batches`.
4. Update each entry's effective lifecycle (this stays in-memory in `ENTRY_LIFECYCLES` for now -- it's a derived view rebuilt on demand from `promotion_batches`; see "rebuild on read" below). If the entry-lifecycle overlay is eventually persisted too, that's a follow-on.
5. Commit. On any error, the transaction rolls back; no partial audit row is left.

W6 is mid-flight on the in-memory atomicity fix for this same function. **Coordination contract: W6 lands the in-memory all-or-nothing semantics with the existing `Map`s; this WP swaps the writes to a Drizzle transaction in a follow-on PR.** W6's tests carry over; this WP adds transactional rollback tests (mid-insert failure, FK violation, etc.). W6 ships against the in-memory contract as currently scoped -- mid-flight redirect is not supported in the current agent environment.

### `getCurrentEdition` (cached)

Read path:

1. In-memory cache map keyed by `SourceId`. Generation counter from W5's index.
2. On cache miss or stale generation, query `editions` for the row(s) with the highest `published_at` and `retired_at IS NULL` for that `source_id`.
3. Cache the result. Bump generation when `editions` writes happen.

W5 designs the index against the in-memory `Map` today. **Coordination contract: W5's index treats the underlying store as opaque. The in-memory `Map` becomes a cache layer that the Postgres-backed `getEditionsMap` populates lazily. The generation-counter invalidation contract from W5 stays intact -- writes bump the counter; reads check before serving cached lookups.** W5's PR remains correct as-is; this WP changes the *source* of the cached values, not the cache contract. W5 ships against the in-memory contract as currently scoped -- mid-flight redirect is not supported in the current agent environment.

### Rebuild on read for `ENTRY_LIFECYCLES`

The current overlay map is a derived view. With persistent `promotion_batches`, the lifecycle of an entry is "the `toLifecycle` of the most recent promotion batch whose `scope` contains it, or `SOURCES[id].lifecycle` if no batch exists." On startup, the overlay rebuilds from `promotion_batches` ORDER BY `promotion_date`. This guarantees in-memory state matches Postgres.

Schema-level FK from `promotion_batches.previous_batch_id` -> `promotion_batches.id` is `ON DELETE RESTRICT`. The audit trail is append-only; we never delete batches.

## Open questions

None. The audit-row shape is final per ADR 019 §2.4; the table is a direct port.

## References

- `docs/decisions/019-reference-identifier-system/decision.md` §2.1, §2.4, §6.1
- `libs/sources/src/registry/lifecycle.ts:1-12` (Phase 2 placeholder rationale)
- `libs/sources/src/registry/editions.ts:1-12`
- `docs/work/reviews/2026-05-01-sources-content-pipeline-INDEX.md` Cluster H
- `docs/work/reviews/2026-05-01-sources-content-pipeline-schema.md` #3
