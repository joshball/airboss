---
title: 'Retro Schema Review: Hangar Review Queue (Phases 1-2)'
reviewer: schema
date: 2026-05-04
diff: main...worktree-agent-ae8eb8cb532bdfcc4
---

# Retro Schema Review: Hangar Review Queue (Phases 1-2)

## Summary

Phases 1-2 land 9 new tables in `hangar.*` plus a docs FTS index. The schema is well-organised: namespace-correct, consistent prefixed-ULID IDs, CHECK constraints sourced from `@ab/constants`, partial indexes for soft-delete + open-session uniqueness, status fields lifted to first-class columns with their own CHECKs (correctly resolved in the Phase 1 prior review). The biggest concern is data-loss-on-user-delete in `review_session` (cascade vs set-null mismatch with project audit-trail conventions) and a small cluster of FK columns missing indexes that will pay back as soon as the loader scales past dev volumes.

- Files reviewed: 5 (`schema.ts`, `review.ts`, `review.test.ts`, `constants/review.ts`, `review-discovery.ts`)
- Critical: 1
- Major: 4
- Minor: 6
- Nit: 4

## Findings

### Critical

#### C1. `review_session.userId` cascade-deletes a user's entire review history

- **Location**: `libs/bc/hangar/src/schema.ts:590-592`
- **Problem**: `userId: text('user_id').notNull().references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' })`. Deleting (or even soft-deactivating + GDPR-purging) a `bauth_user` row also deletes every `review_session` row they ever opened, which then cascades to `review_step`. Every other user-FK in this BC (`hangarReference.updatedBy`, `hangarSource.updatedBy`, `hangarSyncLog.actorId`, `hangarBoardTask.assigneeId`, `hangarBoardTask.createdBy`, all four invitation FKs) uses `onDelete: 'set null'` precisely to preserve the audit trail.
- **Why it matters**: Project rule (CLAUDE.md): "Never lose information." A reviewer's session + step outcomes are the only durable record of which test plans were walked, what failed, and what was blocked. A user delete should not vaporize that history. This is a single-user app today, but the spec calls out multi-user as a v1 deferral, not a permanent shape; getting this right now is much cheaper than trying to recover deleted sessions later.
- **Fix**: Change to `onDelete: 'set null'` (and make `userId` nullable):
  ```ts
  userId: text('user_id').references(() => bauthUser.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  ```
  Adjust `getOpenSession` / `startSession` callers to handle a nullable `userId` (an orphaned session is read-only). Alternatively, keep NOT NULL + use `onDelete: 'restrict'` and require admin tooling to reassign or hard-delete sessions before purging the user; either resolution is fine, but the current cascade is wrong.

### Major

#### M1. `review_session.outcome` is uncovered by the partial-finished-at index used to filter the only "list closed sessions" path

- **Location**: `libs/bc/hangar/src/schema.ts:600-606`
- **Problem**: The two indexes on `review_session` are `(itemId, userId, startedAt)` and the unique partial `(itemId, userId) WHERE finishedAt IS NULL`. `listSessions(itemId)` (review.ts:526-534) does `WHERE itemId = ? ORDER BY startedAt DESC LIMIT 20` -- the planner can use `sessionItemUserIdx`'s leading column on a small board, but the index leads with `(itemId, userId)` together; for a board where the `itemId`-only `ORDER BY startedAt DESC` is the hot path (the WP-spec right-rail history), the planner ends up scanning + sorting rather than walking an ordered index.
- **Why it matters**: The right-rail "Sessions: 1 open / 2 done" panel hits this on every WP-spec page render. Today's data is small; a year of reviewing 89 WPs at ~3 sessions per WP turns into a measurable jump. The hard cap of 20 doesn't help index selection -- it bounds output, not scan.
- **Fix**: Add a per-item index on `(itemId, startedAt desc)`:
  ```ts
  sessionItemStartedIdx: index('hangar_review_session_item_started_idx').on(t.itemId, desc(t.startedAt)),
  ```
  Or restructure `sessionItemUserIdx` to lead with `itemId` alone and add a second composite for the `(itemId, userId)` walker lookup. The fact that `getOpenSession` (item + user) is also a hot path means both shapes are wanted; declare both.

#### M2. `review_bucket.kindId` FK has no supporting index

- **Location**: `libs/bc/hangar/src/schema.ts:482-484`
- **Problem**: `kindId text NOT NULL REFERENCES review_kind(id) ON DELETE RESTRICT` -- no index. Postgres FK enforcement on a `RESTRICT` parent delete must scan child rows for a match; with only 5 kinds + ~10 buckets the cost is invisible, but adding a kind via `seedReviewKinds` issues an FK-check on every insert.
- **Why it matters**: More relevantly: the bucket-admin "buckets for kind X" query (Phase 7) and the loader's "all buckets pointing at this kind" walk both need this index. Postgres docs also note that FK columns generally want indexes to support cascading updates / deletes efficiently.
- **Fix**:
  ```ts
  bucketKindIdx: index('hangar_review_bucket_kind_idx').on(t.kindId),
  ```

#### M3. `review_item.pinnedColumnId` FK has no supporting index, and the cleanup path on column delete will table-scan

- **Location**: `libs/bc/hangar/src/schema.ts:521-524`
- **Problem**: `pinnedColumnId` references `board_column.id` with `onDelete: 'set null'`. There is no index on this column. When a column is deleted, Postgres has to scan the entire `review_item` table to find rows to NULL.
- **Why it matters**: Column delete is rare today (default 4 columns are seeded), but Phase 7's bucket / column admin will introduce reorders and renames; cascade-on-update is `cascade` so even renames take the lock. With ~190 items today and growth aimed at 1000+ (`REVIEW_LIST_HARD_CAP`), a sequential scan during an admin operation is observable. The board's "items pinned to column X" query (a natural drag-drop refresh after column rename) also needs this index.
- **Fix**:
  ```ts
  itemPinnedColumnIdx: index('hangar_review_item_pinned_column_idx').on(t.pinnedColumnId).where(sql`${t.pinnedColumnId} IS NOT NULL`),
  ```

#### M4. `board_task` FK columns (`columnId`, `assigneeId`, `createdBy`) have no supporting indexes

- **Location**: `libs/bc/hangar/src/schema.ts:665-682`
- **Problem**: Three nullable FKs to `board_column` / `bauthUser` with no indexes. The board's "tasks in column X" filter, the per-user "my tasks" filter, and the admin "tasks created by me" view all become sequential scans. `onDelete: 'set null'` on all three forces a full-table scan when any referenced parent row is deleted.
- **Why it matters**: Same shape as M3 -- works fine at dev volumes, painful as soon as multi-user lands. Default sort `(boardId, sortOrder)` is indexed via `taskBoardIdx`, but column / assignee / creator filters fall through to a scan.
- **Fix**:
  ```ts
  taskColumnIdx: index('hangar_board_task_column_idx').on(t.columnId).where(sql`${t.columnId} IS NOT NULL`),
  taskAssigneeIdx: index('hangar_board_task_assignee_idx').on(t.assigneeId).where(sql`${t.assigneeId} IS NOT NULL`),
  ```
  Skip the `createdBy` index unless an admin "tasks I created" view actually ships; partial-on-not-null keeps the indexes small.

### Minor

#### m1. Spec says `task`, schema names it `board_task`

- **Location**: `libs/bc/hangar/src/schema.ts:657-694` vs `docs/work-packages/hangar-review-queue/spec.md:172`
- **Problem**: The spec's data-model table lists the table as `task`. Implementation lands as `hangar.board_task`. The renaming is sensible (the row is a board-attached task, distinct from any other "task" concept), but the spec was not updated to match.
- **Why it matters**: Drift between spec and code violates the "Update docs with the work" rule (CLAUDE.md). A future reviewer searching for `task` won't find it; bucket admin specs that reference `task` rows are now stale.
- **Fix**: Either rename to `task` to match spec (not recommended -- `board_task` is more specific and avoids future name collision) OR update `spec.md:172` data-model row to `board_task`. Prefer the latter.

#### m2. `review_kind.discoveryRule` jsonb is dead weight

- **Location**: `libs/bc/hangar/src/schema.ts:459` and `libs/bc/hangar/src/review.ts:172`
- **Problem**: Column declared with intent to drive per-kind loader behavior from data; the seeder writes `null`, and `review-discovery.ts` hardcodes the rules in TypeScript (the discovery functions ignore the column). Not a bug, but a "shipped column with no consumer" smell -- per CLAUDE.md "Zero tolerance for known issues. A stub is a known issue."
- **Why it matters**: Either the column is reserved for a Phase 7 admin UI (in which case it needs a tracked next-step and a CHECK / shape validator) or it's speculative and should be dropped. Leaving it un-typed (`Record<string, unknown> | null`) and unwritten is the worst combination -- it advertises a contract the BC doesn't honor.
- **Fix**: Either:
  - Drop the column from Phase 1-2 and add it back when the data-driven loader lands; OR
  - Define a typed shape (e.g. `{ glob: string; titleField?: string } | { source: 'db'; query: string }` discriminated union), validate on insert, and have `review-discovery.ts` consult the column when present (falling back to the hardcoded default). My recommendation: drop it for now -- it can be added later with a clear shape.

#### m3. `review_kind.defaultColumnMapping` is similarly unused

- **Location**: `libs/bc/hangar/src/schema.ts:457` and `libs/bc/hangar/src/review.ts:171`
- **Problem**: Column reserved for "derived column when an item is unpinned" lookup. Seeder writes `null`. There is no consumer in the BC and no fallback path verified; the comment at line 510 says "NULL means derive from `frontmatterStatus` via `review_kind.defaultColumnMapping`" but the reading-side function that does this derivation does not yet exist on this branch.
- **Why it matters**: Same as m2 -- a column with no reader is a contract gap. Phase 4 (board UI) will have to either add a consumer or land it without one and live with stale schema.
- **Fix**: Either land the consumer (`getDerivedColumnId(item)` helper) in this phase even if no UI reads it yet (so the BC contract is closed), or drop the column and reintroduce when the board renderer needs it. Choose one; don't ship the column un-consumed.

#### m4. `cachedFields` jsonb default `{ otherFields: {} }` is duplicated between schema and BC writers

- **Location**: `libs/bc/hangar/src/schema.ts:541` and `libs/bc/hangar/src/review.test.ts:175,184,...`
- **Problem**: The schema declares `.default({ otherFields: {} })`, but every `upsertItem` test passes `cachedFields: { otherFields: {} }` explicitly. The BC `UpsertItemInput` requires the field (not optional) at the type level. So the schema default is unreachable.
- **Why it matters**: Two sources of truth for the empty value. If the shape evolves (e.g. add `title` cache field), the schema default and the BC writer drift silently.
- **Fix**: Make `UpsertItemInput.cachedFields` optional (`?: CachedFrontmatterFields`) and let the schema default win on insert; only set in the update branch when the caller actually supplies it. Or drop the schema default and require the field everywhere. Either way, one source of truth.

#### m5. `review_bucket.filterCriteria` jsonb has no shape validator at the DB layer

- **Location**: `libs/bc/hangar/src/schema.ts:486`
- **Problem**: `filterCriteria` is typed as `BucketFilterCriteria` in TS but stored as `jsonb` with no CHECK on the keys / value types. A bad bucket-admin form submission can write `{ kind: 42 }` and the DB will accept it; the bucket query at runtime then misbehaves silently.
- **Why it matters**: Spec calls out the bucket-admin form (Phase 7) explicitly accepts an "Advanced jsonb predicate" textarea. Without a server-side validator + ideally a CHECK, garbage flows from the form straight into bucket queries. Today's seed data is hand-authored TS so the risk is muted; the moment the admin UI lands it becomes real.
- **Fix**: Add a Zod schema for `BucketFilterCriteria` in `@ab/types` (or co-located in `review.ts`), parse + validate inside `createBucket` / `updateBucket` before insert, and reject malformed input with a useful error. A jsonb-path CHECK is overkill in Postgres; the BC validator is enough as long as it's the only write path.

#### m6. `review_item.boardId` has no standalone index; coverage relies on the unique partial

- **Location**: `libs/bc/hangar/src/schema.ts:553-557`
- **Problem**: The comment at line 550-552 claims the `(boardId, kindId, ref) WHERE deletedAt IS NULL` partial unique index covers `WHERE boardId = ?` queries via leading column. That works for `boardId =` lookups when the planner picks it, but the partial-on-deletedAt restricts visibility to live rows -- which is normally what we want, but `softDeleteItem` -> later `pinItemToColumn(itemId, ...)` flows touch deleted rows, and the loader's "all rows for board including deleted, to compute the prune set" path scans without index help.
- **Why it matters**: The loader's diff-vs-live walk runs on every refresh. Without a non-partial `boardId` index, that walk is a sequential scan once item count climbs.
- **Fix**: Add a non-partial index, or accept the scan + document why. Recommended:
  ```ts
  itemBoardIdx: index('hangar_review_item_board_idx').on(t.boardId, t.deletedAt),
  ```
  The `(boardId, deletedAt)` shape lets both "live items for board" and "all items for board including deleted" plans land on the same index.

### Nit

#### n1. `inList` SQL helper is unsafe-shaped even though the inputs are constants

- **Location**: `libs/bc/hangar/src/schema.ts:55-56`
- **Problem**: `inList` does its own single-quote escape (`v.replace(/'/g, "''")`). The inputs are all `*_VALUES` arrays from `@ab/constants` so the risk today is zero, but the helper is tucked into a schema file where a future contributor might pass a runtime value. CHECK constraints don't take parameters, so the raw SQL is required, but the helper invites misuse.
- **Why it matters**: Defense in depth on a low-likelihood vector. Cheap to harden.
- **Fix**: Add a TS-level guard that asserts `values` is `as const`-typed (e.g. constrain the input to `readonly [string, ...string[]]` and reject runtime strings via a comment or a type-only assertion). Or rename to `inListConst` to make the contract obvious.

#### n2. `hangarReviewItem.cachedAt` is redundant with `updatedAt`

- **Location**: `libs/bc/hangar/src/schema.ts:542`
- **Problem**: Every `upsertItem` write sets `cachedAt: now` (review.ts:381,409). The `...timestamps()` already sets `updatedAt` to `now()` on every write via `$onUpdate`. Both columns track "when the loader last touched the row." Two timestamps for the same event.
- **Why it matters**: Documentation drift trap: a reader has to check both to figure out which is "real." Schema bytes per row.
- **Fix**: Drop `cachedAt`, rely on `updatedAt`. If the design wanted a "last frontmatter scan" timestamp distinct from "last write" (e.g. an admin force-update doesn't bump `cachedAt`), document that intent and only write `cachedAt` from the loader. Today they move in lockstep.

#### n3. `review_step.note` and `review_session.note` use `.notNull().default('')` instead of nullable

- **Location**: `libs/bc/hangar/src/schema.ts:597,638`
- **Problem**: Convention nit -- "an empty note" and "no note" are different states being collapsed. Other text fields in the same BC use nullable (`hangarReference.author`, `hangarSource.locatorShape`).
- **Why it matters**: Tiny: the BC writer always sets a string, so the DB never sees NULL anyway. But "no note recorded" vs "note recorded as empty string" is a semantic distinction the schema currently can't represent.
- **Fix**: Drop the default + notNull, allow null. Update BC types to `string | null`. Or leave it -- this is purely a style call, low impact either way.

#### n4. Foreign-key `onDelete` cascade chain is deep and not summarized in code

- **Location**: `libs/bc/hangar/src/schema.ts:476-694` (multiple)
- **Problem**: Deleting a `hangarBoard` cascades through `board_column` -> `review_item` (cascade) + `review_session` (cascade via item) + `review_step` (cascade via session) + `review_bucket` (cascade) + `board_task` (cascade). Five tables hit on one delete. The chain is correct but undocumented in the schema header; a maintainer has to walk every FK to figure out the blast radius.
- **Why it matters**: Boards are rarely deleted today, but per-board cascade-delete is the natural way to clean up multi-board state in a future world. A cascade chain this deep deserves a one-paragraph comment so the next reader doesn't accidentally turn one of the cascades to `restrict` and find out at runtime.
- **Fix**: Add a `// Cascade map:` comment block in the `// -------- review queue` header (around line 357) that lists the chain in plain English.

## Areas verified clean

- **Schema namespace** -- All 9 new tables sit in `hangar` per `SCHEMAS.HANGAR`; no rogue tables in `public` or `study`.
- **ID strategy** -- All PKs are prefixed-ULID via dedicated `generateHangar*Id()` helpers in `@ab/utils`; no `nanoid()` / `ulid()` direct calls.
- **CHECK constraints sourced from constants** -- `frontmatterStatus`, `reviewStatus`, `kind`, `outcome` (session + step), `task.type`, `task.productArea` all have CHECKs whose value lists are interpolated from the `@ab/constants` `*_VALUES` arrays. The lift-from-jsonb migration (per Phase 1 prior schema review) is correctly executed: status is now a top-level column with its own CHECK rather than a deeply-nested jsonb field.
- **Soft-delete partials** -- `review_item` has the right pattern: `(boardId, kindId, ref) WHERE deletedAt IS NULL` unique partial allows resurrection without conflicting against deleted history.
- **Open-session uniqueness** -- `(itemId, userId) WHERE finishedAt IS NULL` unique partial correctly enforces "one open session per (item, user)" without bounding finished sessions; PG-23505-only retry in `startSession` is appropriately narrow.
- **Step idempotency** -- `(sessionId, stepRef)` unique index pairs with `recordStep`'s read-then-update logic so re-saving the same step is idempotent.
- **`getOrCreateBoard` transactionality** -- The fresh-board branch wraps insert + `seedDefaultColumns` + `seedReviewKinds` in a single `db.transaction`; a process kill mid-seed cannot leave a half-board.
- **Generated tsvector column** -- `docs_search_index.tsv` uses the correct `setweight(to_tsvector(...), 'A') || setweight(to_tsvector(...), 'B')` shape with a GIN index; matches the design.md SQL exactly.
- **Test coverage of constraints** -- `review.test.ts` exercises upsert, soft-delete + resurrection, multi-user open sessions, finish-then-restart, step overwrite. Tests hit the live dev DB (per project convention, not mocked).
- **Constants-only literal values** -- All CHECK arrays, default column names, board name, kind labels live in `libs/constants/src/review.ts`. No magic strings in the schema or BC.
- **Drizzle helper usage** -- `timestamps()` from `@ab/db` spread across all mutable tables; consistent with existing hangar tables (`reference`, `source`, `sync_log`, `invitation`).
