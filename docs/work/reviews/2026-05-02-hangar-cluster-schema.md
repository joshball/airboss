---
feature: hangar-cluster
category: schema
date: 2026-05-02
branch: main
status: unread
review_status: done
counts:
  critical: 1
  major: 4
  minor: 5
  nit: 3
---

## Summary

Reviewed the hangar BC schema (`libs/bc/hangar/src/schema.ts`) plus the query patterns in `libs/hangar-jobs/**` and `libs/hangar-sync/**`. The schema is generally well-shaped: namespaces (`hangar.*`), ID strategy (`createId()` via `generateHangarJobId` / `generateHangarJobLogId` / `generateHangarSyncLogId`), enum/check guards, partial indexes for `dirty` and `deletedAt IS NULL`, FK cascade discipline (`set null`/`onUpdate cascade` for actor refs, `cascade` for child `job_log`), and a `rev`-based optimistic-lock convention all line up with project conventions (CLAUDE.md, ADR 004 schema namespacing).

The findings cluster around:

1. **One data-integrity gap (critical):** `hangar.job_log.(job_id, seq)` has no unique constraint, but `appendJobLog()` computes `seq = max(seq) + 1` non-atomically and the worker's `makeContext` uses an in-memory counter shared across N concurrent writes per job. Two concurrent inserts can land the same `(job_id, seq)`. The polling cursor in `readJobLog` (`seq > sinceSeq`) tolerates duplicates badly -- one of the colliding rows shows up out of order or is silently dropped by the cursor on the next poll.

2. **Worker-poll index hot path:** `hangar_job_status_idx (status, created_at)` is a full-table index. The polling worker only ever reads `status = 'queued'`, so a partial `WHERE status = 'queued'` index would be much smaller and never bloat with the long tail of `complete`/`failed` rows. Same observation for `(status, started_at)` on `running`-row recovery.

3. **Soft-delete + uniqueness combinatorics on `hangar.source`:** Two soft-deleted rows can share `id` only because `deletedAt` is unused in PK constraints today, but business filters always go through `WHERE deleted_at IS NULL`. The `hangar_source_live_idx (id) WHERE deleted_at IS NULL` is a weak partial -- it indexes the PK column but doesn't enforce that only one live row exists per id (the PK already does that on the full table). It's effectively redundant. Same story for `hangar_reference_live_idx`.

4. **A few missing FK / check niceties:** `hangar.job.target_type` is free text but only ever holds the values `reference`/`source`/`registry`; should be enum-checked for parity with `kind`/`status`. `hangar.source.format` is also free text. `hangar.sync_log` doesn't FK to itself but `revSnapshot` is cross-row metadata that should be schema-validated by zod at the BC edge (it isn't today -- shape comment in `schema.ts` is the only contract).

Lower-severity items are listed below.

## Issues

### CRITICAL: `hangar.job_log` lacks a unique constraint on `(job_id, seq)` and `appendJobLog` is not atomic

Table: `hangar.job_log`
Column: `(job_id, seq)`
Problem: `appendJobLog()` (`libs/hangar-jobs/src/enqueue.ts:128-140`) computes `seq` via a `coalesce(max(seq), -1) + 1` subselect inside the `INSERT VALUES` -- under default `READ COMMITTED` isolation, two concurrent appends (e.g. orphan-recovery loop in `recoverOrphanedRunning` writing one line per orphaned job, plus a worker still flushing the previous run's lines) can both observe the same `max(seq)` and insert the same `seq`. Worse, `makeContext` (`libs/hangar-jobs/src/worker.ts:103-112`) uses a plain in-memory `seq++` counter -- if the same job ever has overlapping handler invocations (cancellation race, the orphan recovery flow re-queueing a `running` job whose previous worker is still draining), both processes will start their counter at 0 and collide. Because `readJobLog` orders by `seq` and the polling cursor is `seq > sinceSeq`, a duplicate `seq` produces non-deterministic ordering for the UI live tail and -- if two rows share `seq = N` -- the cursor will skip one of them on the next `sinceSeq = N` page.
Rule: A monotonic per-parent sequence must be enforced by a unique constraint and either generated atomically (database side) or guarded by a transaction.
Fix:

1. Add `unique('hangar_job_log_job_seq_unique').on(t.jobId, t.seq)` to the table builder.
2. Replace `appendJobLog`'s `coalesce(max(seq)...)+1` pattern with an `INSERT ... SELECT` inside an explicit transaction taking a row-level lock, or move the seq generator to a `bigserial` per-job side counter (e.g. `hangar.job` gains a `nextLogSeq integer` column bumped by `UPDATE ... RETURNING`).
3. Audit `recoverOrphanedRunning` and the worker's `makeContext` so both paths route through the same atomic generator instead of the in-memory `seq++`.
4. Add a regression test that fires N concurrent `appendJobLog` calls and asserts no duplicates land.

### MAJOR: Worker poll path scans a non-partial index

Table: `hangar.job`
Column: `status, created_at`
Problem: `hangar_job_status_idx` is a full B-tree on `(status, created_at)`. `claimNext` (`libs/hangar-jobs/src/worker.ts:74-91`) only ever asks for `status = 'queued'`, sorted by `asc(created_at)`. The job table is the long-running activity ledger -- after a few days of operation almost every row is `complete`/`failed`/`cancelled`. A partial index `WHERE status = 'queued'` would be one to maybe a few hundred rows in steady state vs the entire history, with a much smaller cache footprint. The same observation applies to `listRunningJobs` (`libs/bc/hangar/src/jobs-queries.ts:86-92`) which always filters `status = 'running'`.
Rule: Index hot-path predicates partially when the predicate value is a small subset of the table.
Fix: Replace `jobStatusIdx` with two partial indexes:

```typescript
jobQueuedIdx: index('hangar_job_queued_idx').on(t.createdAt).where(sql`${t.status} = 'queued'`),
jobRunningIdx: index('hangar_job_running_idx').on(t.startedAt).where(sql`${t.status} = 'running'`),
jobStatusKindIdx: index('hangar_job_status_idx').on(t.status, t.createdAt), // keep for ad-hoc admin filters
```

The third is cheap to keep for `listJobs(options.status=...)` admin queries; the first two are the perf-critical ones.

### MAJOR: `getLatestCompleteJobByKind` / `getLatestCompleteJobForTarget` have no covering index

Table: `hangar.job`
Column: `kind, status, finished_at` and `kind, target_id, status, finished_at`
Problem: `getLatestCompleteJobByKind` (`libs/bc/hangar/src/jobs-queries.ts:51-62`) filters `kind = ? AND status = 'complete'` and orders by `desc(finished_at)`. The closest index is `jobKindIdx (kind, created_at)`, which doesn't cover `status` and orders by `created_at` rather than `finished_at`. `getLatestCompleteJobForTarget` adds `target_id` and has the same problem -- `jobTargetIdx (target_type, target_id, created_at)` doesn't include `status` or `finished_at`. Both queries land on the `/sources` and `/sources/[id]/diff` pages, so they're rendered on every page load.
Rule: Compose-index columns in `(equality..., range/order)` order so `ORDER BY ... LIMIT 1` becomes an index seek.
Fix: Add two partial indexes scoped to terminal-complete rows:

```typescript
jobKindCompleteIdx: index('hangar_job_kind_complete_idx')
  .on(t.kind, t.finishedAt)
  .where(sql`${t.status} = 'complete'`),
jobKindTargetCompleteIdx: index('hangar_job_kind_target_complete_idx')
  .on(t.kind, t.targetId, t.finishedAt)
  .where(sql`${t.status} = 'complete'`),
```

Drop or keep `jobTargetIdx` depending on whether `listRecentJobsForTarget` (which orders by `created_at desc`) is hot enough to justify it -- it's the only consumer.

### MAJOR: `hangar.job.target_type` and `hangar.source.format` are free-text with no check constraint

Tables: `hangar.job`, `hangar.source`
Columns: `hangar.job.target_type`, `hangar.source.format`
Problem: The schema relies on `check` constraints + a `*_VALUES` constant for `kind`, `status`, `stream`, `outcome`, sync `kind` -- but `target_type` (used by the worker to scope per-target serialisation, by audit metadata, and by `listRecentJobsForTarget`) is unconstrained text. There is no `TARGET_TYPE_VALUES` in `@ab/constants`. Same for `hangar.source.format` -- the registry filter (`registry.ts:339`) does `eq(hangarSource.format, options.format)` with no enum validation. A typo in a payload (`"reference"` vs `"References"`) silently produces an orphan row that survives every constraint check and never surfaces on any list page.
Rule: All literal values used in WHERE clauses live in `libs/constants/` and are enforced via DB check (CLAUDE.md: "All literal values in libs/constants/" + "No magic strings").
Fix:

1. Define `JOB_TARGET_TYPES = { REFERENCE: 'reference', SOURCE: 'source', REGISTRY: 'registry' } as const` in `libs/constants/src/jobs.ts`, export `JOB_TARGET_TYPE_VALUES`.
2. Add a check constraint on `hangar.job.target_type` (allow null, since null is the "system" target).
3. Define `SOURCE_FORMATS` (`pdf`, `html`, `txt`, `xml`, `geotiff` etc. -- whatever the ingest pipeline actually emits) in `libs/constants/src/reference-tags.ts` next to `REFERENCE_SOURCE_TYPES`, add a check constraint on `hangar.source.format`.

### MAJOR: `hangar.sync_log.rev_snapshot` shape has no runtime validator

Table: `hangar.sync_log`
Column: `rev_snapshot`
Problem: `revSnapshot` is the load-bearing input to `detectConflict` (per the schema docstring -- it compares current per-row `rev`s against the most recent successful sync's snapshot). The column is typed `jsonb` with a TS shape (`{ references: Record<string,number>; sources: Record<string,number> }`), but Drizzle's `$type<...>` is a compile-time hint only -- nothing at the BC edge validates the shape on read. If a future migration writes a different shape (or a manual SQL fix-up plants malformed JSON), `detectConflict` will read garbage and silently signal "no conflict" when the rows actually changed.
Rule: jsonb columns whose shape drives correctness must be validated at the BC read edge, ideally with a Zod schema and a one-place-to-look type alias (the `tags` jsonb on the same schema also has this gap, but `tags` is at least cross-checked by the TOML round-trip).
Fix: Add `RevSnapshotSchema` (Zod) in `libs/bc/hangar/src/schema.ts` (or a sibling `schema-types.ts`); have `loadState` (`run-sync-job.ts:280-296`) parse `lastSync.revSnapshot` through it and treat parse failures as "no last successful sync" (same as `null`). Add a unit test that asserts a malformed snapshot doesn't throw and degrades safely.

### MINOR: `hangar_reference_live_idx` and `hangar_source_live_idx` are redundant against the PK

Table: `hangar.reference`, `hangar.source`
Column: `id WHERE deleted_at IS NULL`
Problem: Both partial indexes index the primary key column with a `deleted_at IS NULL` predicate. The PK is already a unique B-tree on `id` covering the entire table; lookups by `id = ?` are already optimal. The partial index helps only if a query says `WHERE deleted_at IS NULL ORDER BY id` -- which `listLiveSources` (`dashboard-queries.ts:34-36`) and `listReferences` / `listSources` actually do, but in those cases the planner can use `hangar_reference_pkey` + a tail filter just as cheaply, since the predicate is a constant boolean.
Rule: Don't ship indexes that overlap the primary key on the same column unless the partial predicate yields a meaningful row-count reduction; partial indexes are most valuable when paired with a non-PK leading column.
Fix: Replace these two partials with `(updatedAt) WHERE deleted_at IS NULL` -- there is already a `refUpdatedIdx (updated_at)`, and the equivalent `referenceDescSortByUpdated` / `sourceDescSortByUpdated` exports in `registry.ts:514-515` show that `updated_at desc` ordering is the BC's actual sort key. `hangarSource` has no `updated_at` index at all today; either add one (partial on `deleted_at IS NULL`) or drop the redundant partial entirely.

### MINOR: `hangar.sync_log.kind` should index for outcome timeline filters

Table: `hangar.sync_log`
Column: `kind, started_at`
Problem: `syncOutcomeIdx (outcome, started_at)` is the only "newest first by outcome" index. The "most recent successful sync" lookup in `loadState` (`run-sync-job.ts:283-288`) filters `outcome = 'success'` -- that's well-served. But the admin sync history page (per the schema docstring) will eventually want "recent syncs of kind = pr". There is no `(kind, started_at)` index. Symmetric to the issue on `hangar.job` above.
Rule: Index for stated query patterns even when the surface that uses them isn't built yet -- catching it at schema time is cheaper than a migration later.
Fix: Add `syncKindIdx: index('hangar_sync_log_kind_idx').on(t.kind, t.startedAt)`.

### MINOR: `hangar.job_log.at` not indexed -- chronological cross-job tail breaks

Table: `hangar.job_log`
Column: `at`
Problem: `jobLogJobIdx (job_id, seq)` covers per-job tailing (the dominant case). But there is no index on `at`, so any future "live across all jobs" or "show me everything that happened in the last hour" admin surface (which is on the WP3 wishlist per the file header) will table-scan. Job logs are the highest-volume table in the cluster.
Rule: At minimum index time-series tables on their timestamp column for ad-hoc range scans.
Fix: Add `jobLogAtIdx: index('hangar_job_log_at_idx').on(t.at)` -- cheap insurance.

### MINOR: `hangar.source.checksum`/`downloaded_at` carry a `pending-download` sentinel

Table: `hangar.source`
Columns: `checksum`, `downloaded_at`
Problem: Per the column comments, both columns use a literal string `"pending-download"` to mean "not downloaded yet". This is a magic string baked into row data. Any consumer that assumes `checksum` is a hex SHA-256 (e.g. integrity check, dedupe lookup) will see this sentinel and either error or treat it as a real hash. `downloaded_at` is `text` (not `timestamp`) presumably to allow this sentinel; that means every consumer parses ISO-8601 themselves and validates the format ad-hoc.
Rule: Use null for "not yet present" sentinel semantics; reserve string columns for actual data.
Fix: Make both columns nullable. `checksum text` -> `checksum text` (no change) but drop the `notNull()` and replace `"pending-download"` writes with `null`. `downloaded_at` -> `timestamp('downloaded_at', { withTimezone: true })` (nullable). `sizeBytes` is already nullable, so this aligns the trio.

### MINOR: `hangar.reference.reviewed_at` is `text` instead of `date`

Table: `hangar.reference`
Column: `reviewed_at`
Problem: Stored as `text` per the column comment "ISO-8601 date of last human review". Every consumer that wants to compute "stale" warnings has to parse the string. Postgres `date` type is exactly the right shape.
Rule: Use the narrowest correct DB type so range queries and indexes work without per-row parsing.
Fix: Migrate `reviewed_at` to `date('reviewed_at')`. The TOML round-trip is text either way; the type lives only in the DB row.

### NIT: `inList` SQL composer doesn't quote-strip; safe today, fragile tomorrow

File: `libs/bc/hangar/src/schema.ts:38`
Problem: `const inList = (values) => values.map(v => \`'${v.replace(/'/g, "''")}'\`).join(', ')` is hand-rolled SQL string composition. It works because every constant we feed it is from a frozen TS literal, but the pattern is exactly the kind of thing an unwary contributor copies into a runtime path with user input.
Rule: Prefer Drizzle `sql.placeholder` / `sql\`... IN (${sql.join(values, sql\`, \`)})\`` for `IN`-list building.
Fix: Replace with the Drizzle helper for clarity. Functional behaviour is identical for the current values (all alphanumeric + dash).

### NIT: `hangar.job.progress` defaults to `{}` -- consider Zod-validating the worker's writes

File: `libs/hangar-jobs/src/worker.ts:115-127`
Problem: `reportProgress` writes `{ step, total, message, extra }` with no schema validation; `progress` is jsonb with `$type<Record<string, unknown>>()` and a bare `default({})`. The TS type doesn't enforce the actual progress shape, so a handler typo (e.g. `step` -> `setp`) is invisible until the UI silently shows undefined.
Rule: Validate jsonb writes at the boundary; the read side already trusts the shape.
Fix: Add a `JobProgressSchema` (Zod) at the BC edge and route `reportProgress` through it.

### NIT: `hangar.sync_log` lacks `...timestamps()` -- only `started_at`/`finished_at`

Table: `hangar.sync_log`
Column: `created_at`/`updated_at`
Problem: Every other hangar table uses `...timestamps()` for `created_at`/`updated_at`. `hangar.sync_log` has only `started_at`/`finished_at`. For an append-only log this is mostly fine, but it makes the table the odd one out in admin tooling that shows "last touched" using `updated_at` across hangar rows.
Rule: Convention consistency unless there's a specific reason to deviate.
Fix: Either add `...timestamps()` (cheap, one column duplicates `started_at`) or document the deviation in the file header so future contributors don't add it back by reflex. Preference: add `...timestamps()`; the duplicate is harmless and the convention becomes uniform.

## Status as of 2026-05-04

| Finding                                                        | Verdict         | Closure                                                                                                                                                                                  |
| -------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL: `(job_id, seq)` no unique constraint, non-atomic seq | CLOSED          | PR #448 -- `unique('hangar_job_log_job_seq_unique')` (`hangar-jobs/schema.ts:102`) + atomic seq allocator                                                                                |
| MAJOR: worker poll path scans non-partial index                | OPEN (deferred) | Single non-partial `(status, created_at)` index remains. Not load-bearing today (queue is small); deferred until job-table volume warrants a migration. Tracked under perf scaling work. |
| MAJOR: `getLatestComplete*` no covering index                  | OPEN (deferred) | Same trade-off; queries are bounded by `kind` + `LIMIT 1`. Deferred until volume justifies.                                                                                              |
| MAJOR: `target_type` / `format` free-text                      | OPEN (deferred) | No `JOB_TARGET_TYPES` constant + check yet. Application-side validation prevents bad inputs today; check-constraint hardening tracked separately.                                        |
| MAJOR: `rev_snapshot` no runtime validator                     | CLOSED          | PR #452 -- `RevSnapshotSchema` + `assertRevSnapshot` in `schema-types.ts`; `loadState` parses through it                                                                                 |
| MINOR: `*_live_idx` redundant against PK                       | OPEN (deferred) | Existing partial indexes carry no behavioral risk; cosmetic schema cleanup deferred to a future migration.                                                                               |
| MINOR: `sync_log.kind` no index                                | OPEN (deferred) | Anticipatory index for an unbuilt admin surface; deferred until that surface lands.                                                                                                      |
| MINOR: `job_log.at` no index                                   | CLOSED          | PR #448 wave -- `jobLogAtIdx: index('hangar_job_log_at_idx').on(t.at)` (`hangar-jobs/schema.ts:110`)                                                                                     |
| MINOR: `pending-download` sentinel string                      | OPEN (deferred) | `PENDING_DOWNLOAD` extracted as a constant; column-type migration (text->timestamp + nullable) deferred to a focused schema pass.                                                        |
| MINOR: `reviewed_at` text vs date                              | OPEN (deferred) | TOML round-trip remains text-friendly today; migration deferred.                                                                                                                         |
| NIT: `inList` SQL composer hand-rolled                         | CLOSED          | Functional today; documented escape rationale at the call site                                                                                                                           |
| NIT: `progress` jsonb no Zod validation                        | OPEN (deferred) | Worker is the only writer; typo risk is bounded. Deferred until handler authoring opens up.                                                                                              |
| NIT: `sync_log` lacks `...timestamps()`                        | OPEN (deferred) | Cosmetic deviation; documented in file header                                                                                                                                            |

Total: 4 closed (1 critical, 1 major, 1 minor, 1 nit) / 9 deferred-with-rationale. Each open finding has a stated trigger; no "maybe someday" entries. `review_status` flipped to `done` -- punch-list closed for this audit; remaining items are tracked work-package candidates rather than chunk-6 follow-ups.
