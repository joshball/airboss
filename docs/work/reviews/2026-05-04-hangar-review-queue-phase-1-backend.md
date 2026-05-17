---
feature: hangar-review-queue
category: backend
date: 2026-05-04
branch: worktree-agent-ae8eb8cb532bdfcc4
phase: 1
issues_found: 5
critical: 0
major: 1
minor: 3
nit: 1
---

# Phase 1 backend review -- hangar-review-queue

## Summary

BC primitives are well-shaped: every helper takes an explicit Db argument with a default of the connection singleton, so tests can pass per-test transactions cleanly. Errors throw with file/identifier context. Idempotent helpers (`getOrCreateBoard`, `seedDefaultColumns`, `seedDefaultBuckets`, `seedReviewKinds`, `startSession`) follow the same shape. The biggest gap is that `seedDefaultColumns` and `seedDefaultBuckets` aren't transactional, which can leave partial seed state on a process kill mid-seed. A handful of minor consistency issues with input shapes + a missing `assigneeId` pass-through on `updateTask`.

## Issues

### MAJOR: Seeders are not transactional

- **File**: `libs/bc/hangar/src/review.ts:99` (seedDefaultColumns), `:226` (seedDefaultBuckets), `:151` (seedReviewKinds), `:80` (getOrCreateBoard composite)
- **Problem**: `getOrCreateBoard` runs three writes sequentially: insert the board, seed columns, seed kinds. If the process is killed between the board insert and the seed call, the next caller sees a board with zero columns and the test "returns the same board on repeat calls and seeds default columns + kinds" passes (because `seedDefaultColumns` is idempotent) but a real route's `listColumns()` between the two writes returns `[]`. Same risk for `seedDefaultBuckets` if Phase 4's auto-setup calls it inside the same load function.
- **Fix**: Wrap each composite write in `db.transaction(async (tx) => { ... })`. The Drizzle pattern is already used elsewhere in the BC (e.g. `registry.ts` `createReference`). Specifically:
  - `getOrCreateBoard` -> wrap insert + seedDefaultColumns + seedReviewKinds in one tx; the existing-row branch can stay outside the tx (already idempotent).
  - `seedDefaultColumns` -> single multi-row insert is already atomic; no change needed.
  - `seedDefaultBuckets` -> ditto, single insert is atomic.

The risk is small for `seedDefault*` standalone (one statement) but real for the composite `getOrCreateBoard`.

### MINOR: `updateTask` silently drops `assigneeId: null`

- **File**: `libs/bc/hangar/src/review.ts:594-609`
- **Problem**: `UpdateTaskInput` declares `assigneeId?: string | null` -- omit means "don't touch", `null` means "clear". The current `db.update(...).set(patch)` passes the patch through directly. Drizzle's behavior here: `set({ assigneeId: null })` writes NULL (good); `set({ assigneeId: undefined })` skips the column (good); `set({})` skips everything (good). So this actually works correctly. **Withdrawn finding.**

(Leaving the entry to document the audit -- the behavior is correct because `patch` is `Partial<>` and Drizzle's `set` honors absent keys. No action.)

### MINOR: `createTask` mixes string defaults with optional fields

- **File**: `libs/bc/hangar/src/review.ts:572-592`
- **Problem**: `description: input.description ?? ''` creates a non-distinguishable empty-string vs explicit-null state. The schema column is `text('description').notNull().default('')`, so the DB will accept the empty default. But the BC could just omit the field and let the DB default fire, keeping the BC and DB in lockstep without the BC repeating the default value.
- **Fix**: Pass only fields that are present. Either drop the `?? ''` or refactor the values block into:

  ```ts
  const values: NewHangarBoardTaskRow = {
    id, boardId: input.boardId, title: input.title, type: input.type, productArea: input.productArea,
  };
  if (input.columnId !== undefined) values.columnId = input.columnId;
  if (input.description !== undefined) values.description = input.description;
  // ...
  ```

  Slightly verbose but no double-source-of-truth on defaults.

### MINOR: `listSessions` does not paginate

- **File**: `libs/bc/hangar/src/review.ts:487-493`
- **Problem**: A heavy reviewer could accumulate hundreds of sessions per item over a year. `listSessions` returns all of them with no limit. The caller (Phase 5 right-rail session history) probably wants the top N.
- **Fix**: Add `limit?: number` parameter, default to a constant in `libs/constants/src/review.ts` (call it `REVIEW_SESSION_HISTORY_LIMIT`, suggest 20). Apply `.limit(limit)`.

### MINOR: `listSessions` raw `sql` for ORDER BY when `desc()` would do

- **File**: `libs/bc/hangar/src/review.ts:492`
- **Problem**: The order clause is `sql\`${hangarReviewSession.startedAt} DESC\`` -- a raw SQL fragment when Drizzle's typed `desc()` does the same job: `desc(hangarReviewSession.startedAt)`. Existing code in this file already imports `asc` from `drizzle-orm`; the matching `desc` helper is a one-line addition.
- **Fix**: Add `desc` to the import + use `.orderBy(desc(hangarReviewSession.startedAt))`.

### NIT: BC export barrel ordering ignores alphabetic convention near the new block

- **File**: `libs/bc/hangar/src/index.ts:151-184`
- **Problem**: The `from './review'` block lists exports alphabetically (good) but the BC index's existing convention sorts type aliases adjacent to the value of the same name. E.g., `type CreateBucketInput` then `createBucket`, `type CreateTaskInput` then `createTask`. The block currently lists all `type` aliases first as a chunk, then values. Mostly cosmetic; existing barrels in this file (e.g. the `./registry` block) interleave types and values.
- **Fix**: Reorder so each type sits next to its value. Or skip -- biome doesn't enforce it and it's a one-off churn risk.
