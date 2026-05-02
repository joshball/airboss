# 0007 -- promotion_batches + editions

Phase 1 of the work package
[`promotion-batches-persistence`](../docs/work-packages/promotion-batches-persistence/spec.md).
Authors the persistence layer for the `@ab/sources` registry's audit trail
and per-entry edition history. The read path (`getEditionsMap`) and write
path (`recordPromotion` / `recordDePromotion`) move to Postgres in Phase 2
and Phase 3 respectively (separate PRs); this migration only lands the
schema so the later phases drop in cleanly.

## What this migration does

Creates a new `sources_registry` Postgres schema with two tables:

- `promotion_batches` -- one append-only row per promotion or de-promotion
  event. Frozen audit row contract per
  [ADR 019 §2.4](../docs/decisions/019-reference-identifier-system/decision.md).
  Self-referential FK on `previous_batch_id` with `ON DELETE RESTRICT` so
  the de-promotion chain cannot be silently broken.
- `editions` -- per-`SOURCES`-entry edition history. Shape per ADR 019 §6.1.

### Indexes

| Table               | Index                                       | Notes                                                                |
| ------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| `promotion_batches` | `(corpus, promotion_date DESC NULLS LAST)`  | Newest-first list per corpus.                                        |
| `promotion_batches` | `(previous_batch_id)`                       | De-promotion link traversal.                                         |
| `promotion_batches` | `(reviewer_id, promotion_date DESC NULLS LAST)` | Per-reviewer audit query.                                        |
| `editions`          | `(source_id, published_at)`                 | Chronological walk per entry.                                        |
| `editions`          | `(source_id) WHERE retired_at IS NULL`      | Partial index for the hot "current edition" lookup the renderer uses. |

### CHECK constraints

- `promotion_batches.state IN ('promoted', 'de-promoted')`
- `promotion_batches.from_lifecycle IN ('draft', 'pending', 'accepted', 'retired', 'superseded')`
- `promotion_batches.to_lifecycle IN ('draft', 'pending', 'accepted', 'retired', 'superseded')`

The enum values come from `SOURCE_LIFECYCLE_VALUES` and
`PROMOTION_STATE_VALUES` in `libs/constants/src/sources.ts`. Adding a new
value requires a follow-on migration that rewrites the CHECK clause; the
TS schema's `inList()` helper keeps the SQL in lockstep with the constant.

## Rollback

Forward-only. Drizzle's migration table tracks application state;
re-running `bun run db:migrate` against a DB that already has this entry
applied is a no-op.

If you must reverse the migration manually:

```sql
DROP TABLE IF EXISTS "sources_registry"."editions";
DROP TABLE IF EXISTS "sources_registry"."promotion_batches";
DROP SCHEMA IF EXISTS "sources_registry";
```

The two `DROP TABLE` calls are order-sensitive only because of the
self-FK on `promotion_batches`; dropping `editions` first is for style.
The `DROP SCHEMA` is safe at the end because both tables are in that
schema and nothing else lives there yet.

After running the rollback SQL, also remove the corresponding journal
entry from `drizzle/meta/_journal.json` so a subsequent `bun run
db:migrate` can re-apply this migration cleanly.

## Verification

Manual test plan (from `docs/work-packages/promotion-batches-persistence/test-plan.md`):

1. `bun run db:reset` (drop + recreate the local DB).
2. `bun run db:migrate` (apply every migration through this one).
3. Verify the schema and tables exist:

   ```bash
   docker exec airboss-db psql -U airboss -d airboss -c '\dn sources_registry'
   docker exec airboss-db psql -U airboss -d airboss -c '\d+ sources_registry.promotion_batches'
   docker exec airboss-db psql -U airboss -d airboss -c '\d+ sources_registry.editions'
   ```

4. Confirm all 5 indexes are present in the `\d+` output (3 on
   `promotion_batches`, 2 on `editions`), including the partial index on
   `editions` qualified by `WHERE retired_at IS NULL`.
5. Confirm the FK on `promotion_batches.previous_batch_id` is RESTRICT.

The migration smoke test is intentionally a manual step: a fresh DB +
migrate run is the same gate the deploy pipeline uses, and the dev DB is
not provisioned for CI.
