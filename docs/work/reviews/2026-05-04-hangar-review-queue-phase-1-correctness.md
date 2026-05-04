---
feature: hangar-review-queue
category: correctness
date: 2026-05-04
branch: worktree-agent-ae8eb8cb532bdfcc4
phase: 1
issues_found: 5
critical: 0
major: 2
minor: 2
nit: 1
---

# Phase 1 correctness review -- hangar-review-queue

## Summary

Logic is mostly sound; tests cover the happy path for every BC primitive, idempotency on the seeders, soft-delete resurrection on `upsertItem`, and concurrent-session uniqueness. The two real bugs: `seedDefaultColumns`'s sortOrder fallback is dead code (always reachable but never used because the filter eliminates the case), and `softDeleteItem` doesn't update the soft-delete partial-unique index correctly because the resurrection path in `upsertItem` looks up by `(boardId, kindId, ref)` without the soft-deleted filter -- which is the right behavior for resurrection but means a resurrected row's `updatedAt` regression matters for cache invalidation. Plus a couple of minor edge-case gaps.

## Issues

### MAJOR: `upsertItem` resurrection silently restores cachedStatus from the new input, dropping the prior cachedStatus

- **File**: `libs/bc/hangar/src/review.ts:351-395`
- **Problem**: When a soft-deleted row exists for `(boardId, kindId, ref)`, `upsertItem` clears `deletedAt` and overwrites `cachedStatus` with `input.cachedStatus`. That's the intended behavior. BUT: the new `cachedStatus` comes from a fresh frontmatter parse, so if the frontmatter changed while the file was "missing" (e.g. agent edited it via git), the resurrected row uses the new state. That's correct. The bug: `cachedAt` is stamped to the resurrection time, but `updatedAt` (from `timestamps()`) is set to the same `now`, which is fine. However the `pinnedColumnId` is **not** cleared. If a user pinned the row to "Done" before deletion, then the file resurrected with `frontmatterStatus: 'reading'`, the row stays pinned to Done -- silently masking a status downgrade.
- **Trigger**: User pins WP card to Done -> file goes missing (loader prunes -> `softDeleteItem` -> `deletedAt` set, `pinnedColumnId` retained) -> file restored with `status: reading` -> `upsertItem` resurrects -> board still shows pinned to Done despite frontmatter saying reading.
- **Fix**: On resurrection (existing row with `deletedAt IS NOT NULL`), clear `pinnedColumnId` to NULL. The user can re-pin if they want; better than a stale pin masking new state. Refactor:
  ```ts
  if (existing[0]) {
    const row = existing[0];
    const wasDeleted = row.deletedAt !== null;
    const updated = await db.update(hangarReviewItem).set({
      title: input.title,
      cachedStatus: input.cachedStatus,
      cachedAt: now,
      deletedAt: null,
      ...(wasDeleted ? { pinnedColumnId: null } : {}),
    })...
  }
  ```

### MAJOR: `seedDefaultColumns` sortOrder fallback is unreachable for filtered rows

- **File**: `libs/bc/hangar/src/review.ts:99-116`
- **Problem**: The `.filter(...).map((name, idx) => ({ ..., sortOrder: REVIEW_BOARD_DEFAULT_COLUMNS.indexOf(name as ReviewBoardDefaultColumn) === -1 ? idx : REVIEW_BOARD_DEFAULT_COLUMNS.indexOf(...) }))` block: every `name` reaching the `.map()` is a member of `REVIEW_BOARD_DEFAULT_COLUMNS` (it came from filtering that exact array), so `.indexOf()` is always `>= 0` and the `=== -1 ? idx :` branch is dead code. Not a bug, just confusing -- the type `ReviewBoardDefaultColumn` already enforces the invariant. Worse: if Phase 4 adds a custom column to `REVIEW_BOARD_DEFAULT_COLUMNS` later and a downstream caller expands the list at runtime, the dead branch would misorder columns by inserting them at filter-loop index instead of intended position.
- **Trigger**: Today: never fires. Future: brittleness if seeders ever take a runtime list.
- **Fix**: Simplify to:
  ```ts
  const toInsert = REVIEW_BOARD_DEFAULT_COLUMNS
    .filter((name) => !have.has(name))
    .map((name) => ({
      id: generateHangarBoardColumnId(),
      boardId,
      name,
      sortOrder: REVIEW_BOARD_DEFAULT_COLUMNS.indexOf(name),
    }));
  ```
  The `name` is typed `ReviewBoardDefaultColumn` already; no cast needed.

### MINOR: `startSession`'s race recovery silently loses the original error context

- **File**: `libs/bc/hangar/src/review.ts:457-468`
- **Problem**: The catch block re-selects on unique-constraint loser, but if the insert failed for any *other* reason (e.g. FK violation because `itemId` doesn't exist, or DB connection drop), the error is swallowed and `getOpenSession` is called again. If the second `getOpenSession` returns null, the original error is re-thrown -- but the user-facing error is now indistinguishable between "race lost" and "FK violation". Also: if `getOpenSession` itself throws on the retry, that error masks the original.
- **Trigger**: User passes a stale `itemId`; `startSession` throws a generic FK error; the `catch` block calls `getOpenSession`, which returns `null` because no session exists; the original FK error is rethrown -- correct behavior, but only after a redundant DB round-trip.
- **Fix**: Inspect the error. Drizzle/postgres unique violations have code `23505`; only retry on that code. Pseudocode:
  ```ts
  } catch (err) {
    const isPgUnique = (err instanceof Error && 'code' in err && err.code === '23505');
    if (!isPgUnique) throw err;
    const retry = await getOpenSession(itemId, userId, db);
    if (retry) return retry;
    throw err;
  }
  ```

### MINOR: `listItems` ORDER BY uses `sortOrder ASC` then `title ASC`, but no tie-breaker on equal title

- **File**: `libs/bc/hangar/src/review.ts:298-330`
- **Problem**: Two items with the same `(sortOrder, title)` (e.g. two WP specs both titled "Hangar Review Queue" but at different paths because of a rename collision) sort non-deterministically. The board re-renders could shuffle them between requests, which the user perceives as bugs.
- **Trigger**: A future kind that doesn't have unique titles within a board (or any duplicate after a typo).
- **Fix**: Add `id` as final tie-breaker: `.orderBy(asc(hangarReviewItem.sortOrder), asc(hangarReviewItem.title), asc(hangarReviewItem.id))`. ULIDs sort time-ascending, so this also gives "older items first" as the natural fallback.

### NIT: `recordStep` test asserts overwrite by `outcome === 'fail'` after `'pass'`, but doesn't assert `updatedAt` advanced

- **File**: `libs/bc/hangar/src/review.test.ts:292-321`
- **Problem**: The idempotency test confirms the row id stays the same and the outcome flips, but doesn't assert that `updatedAt` actually moved forward. If a future schema change drops the `updatedAt` trigger, this test would still pass while UI state-by-mtime breaks.
- **Trigger**: regression on `timestamps()` trigger semantics.
- **Fix**: Capture `first.updatedAt` before overwrite; assert `overwrite.updatedAt > first.updatedAt`. Two-line addition.
