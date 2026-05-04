---
title: 'Phase 5 Correctness Review: Hangar Review Queue'
reviewer: correctness
date: 2026-05-04
diff: d975adb2...3b523eff
---

# Phase 5 Correctness Review: Hangar Review Queue

## Summary

- Files reviewed: 10
- Critical: 0
- Major: 4
- Minor: 7
- Nit: 2

The atomic frontmatter flip (temp + rename) and the BC's session-uniqueness primitives hold up. The walker action layer has no critical data-loss bug, but the `everyStepPassed` decision has a counting bug that produces false-negative refusals to flip when orphan rows exist with `pass` outcome, the `recordStep` BC has a TOCTOU between its SELECT-then-INSERT branches that surfaces raw PG `23505` to the user, and the `finishSession` action does not re-check `deletedAt`. Test coverage for action handlers is absent.

## Findings

### Critical

(none)

### Major

#### MAJOR: `everyStepPassed` counts orphan-pass rows against the plan total -- false negatives on flip

- **File**: `libs/bc/hangar/src/review.ts:843-851`
- **Problem**: The pass-count loop walks the entire `recorded` array without filtering to plan steps:

  ```ts
  let passCount = 0;
  for (const r of recorded) {
    if (r.outcome === 'pass') passCount += 1;
  }
  return passCount === steps.length;
  ```

  When `recorded` contains a row whose `stepRef` is not in the live plan (orphan -- e.g. test-plan.md was edited between recording and finishing, or a step was deleted from the plan since recording), and that orphan's outcome happens to be `pass`, `passCount > steps.length` and the function returns `false` even though every plan step is a `pass`.

- **Trigger**: User walks the test plan to a clean pass. Author then reorders/renumbers/removes a step in `test-plan.md` (changing `stepRef` hashes for one or more rows). User clicks Finish. Re-reading the plan emits the new step set; the prior recordings are now orphans. Any orphan with `outcome='pass'` blocks the flip. The accompanying test only exercises orphan-fail (`{stepRef: 'orphan', outcome: 'fail'}`); orphan-pass is not covered. Spec gap, not just a UX gap: `?/finishSession` reads the live plan exactly to handle concurrent edits, then the comparator throws away the work.
- **Fix**: Filter the pass-count to plan stepRefs:

  ```ts
  const planRefs = new Set(steps.map((s) => s.stepRef));
  let passCount = 0;
  for (const r of recorded) {
    if (planRefs.has(r.stepRef) && r.outcome === 'pass') passCount += 1;
  }
  return passCount === steps.length;
  ```

  Add a test case `{stepRef: 'orphan', outcome: 'pass'}` to `review-derive.test.ts` to lock the behaviour. The existing comment claiming "we only count the final outcome" is incorrect -- the loop counts all recorded `pass` rows including orphans.

#### MAJOR: `recordStep` BC has SELECT-then-INSERT TOCTOU that surfaces PG 23505 to the user

- **File**: `libs/bc/hangar/src/review.ts:782-811`
- **Problem**: `recordStep` does a SELECT for `(sessionId, stepRef)`, then either UPDATE-by-id or INSERT, with no retry around the INSERT. The unique index `hangar_review_step_ref_unique_idx` on `(sessionId, stepRef)` raises PG `23505` if two concurrent calls both miss the SELECT and both INSERT. The BC's sibling `startSession` and `upsertItem` follow the same pattern but BOTH catch `23505` and retry; `recordStep` does not. The class JSDoc on the file claims "Step writes are idempotent on `(sessionId, stepRef)`" -- the unique index keeps the DB consistent, but a concurrent racer surfaces a raw PG error to the action, which the action does not catch either.
- **Trigger**: Fast double-click on an outcome button, two browser tabs open on the same walker session, or any client retry on a slow request that didn't actually fail server-side. Severity is Major because the project explicitly designed the partial unique index for this case and named idempotency a hard guarantee in the BC docstring.
- **Fix**: Replace the SELECT-then-INSERT with `onConflictDoUpdate` keyed on `(sessionId, stepRef)`:

  ```ts
  const id = generateHangarReviewStepId();
  const inserted = await db
    .insert(hangarReviewStep)
    .values({ id, sessionId: input.sessionId, stepIndex: input.stepIndex, stepRef: input.stepRef, outcome: input.outcome, note: input.note })
    .onConflictDoUpdate({
      target: [hangarReviewStep.sessionId, hangarReviewStep.stepRef],
      set: { outcome: input.outcome, note: input.note, stepIndex: input.stepIndex },
    })
    .returning();
  ```

  This collapses the two-statement path into one upsert and eliminates the race window. Match the test expectation in `review-derive.test.ts` if a covering integration test is added.

#### MAJOR: `?/finishSession` does not check `item.deletedAt` before flipping frontmatter

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.server.ts:219-220`
- **Problem**: The action fetches the item and only rejects on `null`:

  ```ts
  const item = await getItem(itemId);
  if (!item) return fail(404, { finishSession: 'Item not found.' as const });
  ```

  The sibling `?/markSpecRead` and `?/flipReviewStatus` actions (in the parent `+page.server.ts`) AND the load functions in both files all gate on `!item || item.deletedAt !== null`. The walker action and finish path are inconsistent: a soft-deleted item still allows `finishSession` to close the session AND write `review_status: done` to the on-disk spec.md (which may still exist or be dangling). The next loader pass may resurrect the item with `review_status: done`, masking the soft-delete.
- **Trigger**: Loader soft-deletes the item between session start and finish (e.g. file moved/renamed and not yet re-discovered). User clicks Finish with `outcome=pass`. Action proceeds, writes review_status to whatever path the stale `item.ref` points at.
- **Fix**: Match the rest of the file:

  ```ts
  if (!item || item.deletedAt !== null) return fail(404, { finishSession: 'Item not found.' as const });
  ```

  Same pattern in the in-page actions.

#### MAJOR: No action-layer test coverage for the walker's three writes

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.server.ts` (none)
- **Problem**: `?/recordStep`, `?/finishSession`, and `?/flipReviewStatus` all touch the database AND (for finish/flip) the filesystem. The only Phase 5 test coverage is six `everyStepPassed` cases in `review-derive.test.ts` -- a pure decision helper. The action handlers carry the load-bearing invariants in this phase: tamper guard on session ownership, atomic frontmatter flip on 100% pass, idempotency under retry, and refusal to flip on partial pass. None are tested. The work-package manual test plan is the only safety net, and the spec calls out this is the highest-stakes phase.
- **Trigger**: A future regression in any of the action paths above ships unnoticed. Examples: loosening the tamper guard, dropping the `outcomeRaw === 'pass' && cleanPass` condition, breaking `safeReadFile` to throw instead of returning null.
- **Fix**: Add an integration test (Vitest with the test DB harness already used by other BC tests) that covers:
  - `?/recordStep` rejects a session id that does not match `getOpenSession(itemId, userId)`.
  - `?/recordStep` upserts when called twice with the same `(sessionId, stepRef)`.
  - `?/finishSession` flips `review_status: done` when steps are 100% pass AND `outcome=pass`.
  - `?/finishSession` does NOT flip when any step is fail/blocked.
  - `?/finishSession` does NOT flip when `outcome` is sent as `pass` but the live plan has un-recorded steps.
  - `?/finishSession` returns `frontmatterError` (not throw) when the on-disk file is missing.

  These are the bugs the load-bearing path can ship.

### Minor

#### MINOR: Walker `load` creates an open session before the test-plan presence check

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.server.ts:78-83`
- **Problem**: `startSession(item.id, user.id)` runs before the function has decided whether the test plan even exists. When `test-plan.md` is missing (the page's `missing` state), an empty open session is left in the database forever (until the next `abandoned` sweep, which Phase 5 does not implement). `startSession` is idempotent for the same `(item, user)`, so this is not unbounded growth, but it produces a rendered `Open` session badge in the right rail of the spec view for an item the user only glanced at.
- **Trigger**: Author adds a `wp_spec` item before authoring `test-plan.md`. Reviewer clicks "Open test-plan walker" to see if there's anything to review. An open session row appears in the session-history rail.
- **Fix**: Move the `startSession` call after the `md === null ? [] : parseTestPlan(...)` block, and only create the session when `steps.length > 0`. When there is no plan, render the missing state without a session row.

#### MINOR: `WalkerStepRow.svelte` `$effect` clobbers in-flight typing on every server refresh

- **File**: `libs/ui/src/components/WalkerStepRow.svelte:56-58`
- **Problem**:

  ```ts
  let noteDraft = $state('');
  $effect(() => {
    noteDraft = recordedNote;
  });
  ```

  The block comment claims a `$derived` would clobber the user's typing "which is why we mirror with `$effect` instead." `$effect` re-runs whenever its tracked dependency (`recordedNote`, a prop) changes, and it unconditionally writes back to `noteDraft`, so it has the same clobber behaviour as `$derived`. After every successful `?/recordStep` round-trip, `invalidateAll()` refreshes server data, the new `recordedNote` lands as a prop, the effect runs, and any text the user typed since the last save is overwritten with the persisted value.
- **Trigger**: User types "hello" in the note for step A, blurs (saves "hello"), then keeps typing " world" while `invalidateAll` is in flight. When the server data resolves and the prop updates, `noteDraft` is set back to "hello".
- **Fix**: Either guard the effect on a "user is editing" flag (set by `oninput`, cleared on save) so prop updates only sync when the textarea isn't focused, or drop the textarea-state mirror entirely and bind to a derived note (with a save-on-blur committing through). The simpler fix: only mirror when `noteDraft === ''` (initial mount) or when the upstream value changes after a save the user initiated. The current claim in the comment is incorrect.

#### MINOR: `everyStepPassed` test docstring (line 168-180) misrepresents actual behaviour

- **File**: `libs/bc/hangar/src/review-derive.test.ts:168-181`
- **Problem**: The test name says "extra recorded steps that do not exist in the plan do not invalidate the pass" and the comment expands "the plan's steps are the authoritative universe (every step in the plan has a pass)." Both readings are only correct for orphan-`fail` and orphan-`blocked`. The test only exercises orphan-`fail`, masking the bug above. The comment is false in the orphan-`pass` case.
- **Trigger**: Future maintainer reads the test, believes orphans are universally ignored, and writes downstream code that depends on this invariant.
- **Fix**: Tied to the Major above. Adding the `planRefs` filter in `everyStepPassed` makes the documented behaviour true. Add an explicit `{stepRef: 'orphan', outcome: 'pass'}` test that asserts `true` post-fix.

#### MINOR: `?/recordStep` has TOCTOU between session-ownership check and step write

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.server.ts:168-172`
- **Problem**:

  ```ts
  const open = await getOpenSession(itemId, user.id);
  if (!open || open.id !== sessionId) return fail(403, ...);
  await recordStep({ sessionId, stepIndex, stepRef, outcome: outcomeRaw, note });
  ```

  Between the `open` SELECT and the `recordStep` write, a concurrent `?/finishSession` from another tab can close the session. The step write then targets a now-closed session. The DB FK still resolves (no error), so the write succeeds but lands in a session that has `finishedAt` set. The recorded step is invisible to the next walker session (which will be a new row) and shows up only in `listSessions` history.
- **Trigger**: Two browser tabs on the same walker; user finishes in tab A while clicking an outcome in tab B.
- **Fix**: Either include `finishedAt IS NULL` in the recordStep write predicate (e.g. WHERE EXISTS subquery on `hangarReviewSession` with `finishedAt IS NULL`, or move both the check and the write into a single transaction with `SELECT ... FOR UPDATE`), or detect the closed-session case and surface a `409 Conflict` to the caller so the UI re-loads.

#### MINOR: Walker action accepts `outcome=abandoned` from the client

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.server.ts:206-207`
- **Problem**: `isSessionOutcome` accepts the full `SESSION_OUTCOME_VALUES` set including `abandoned`. The constants file documents `abandoned` as "reserved for sessions left open longer than the resume window (loader bookkeeping; not surfaced as a button)." A malicious or curious form post can close their own session as `abandoned` directly; this contaminates loader bookkeeping (a session marked `abandoned` should mean the loader's resume-window sweep, not the user-driven finish path).
- **Trigger**: Tampering form post, or future UI bug that includes `abandoned` in the dropdown.
- **Fix**: Whitelist user-finishable outcomes explicitly in the action: `if (outcomeRaw !== 'pass' && outcomeRaw !== 'fail') return fail(400, ...)`. Reserve `abandoned` for the loader's bookkeeping path.

#### MINOR: `loadWpSpec` reads `test-plan.md` twice on every page load

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:115, 130`
- **Problem**: `buildTabPayload` reads test-plan.md to render the tab body, then the walker-summary block at line 130 reads the SAME file again to parse step counts. Two `readFile` syscalls per render against the same path. Correctness-adjacent: a non-atomic concurrent edit between the two reads can produce a tab body that doesn't match the parsed step count. Path mostly benign (test-plan edits are human-driven and rare).
- **Trigger**: Reviewer is on the spec view while the WP author saves test-plan.md.
- **Fix**: Read the file once in `loadWpSpec`, pass the buffer into both the tab payload and the parser. Cache the parsed steps + bodyHtml so the tab payload uses the same input.

#### MINOR: `commitNote` silently drops the user's typing when the textarea has no outcome and the user navigates away

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:143-157`
- **Problem**: The "save a local-only optimistic note" branch stores the note in `optimistic` but never persists. The next page reload (or any `invalidateAll`) sources the textarea from `recordedNote = ''` and the typing is gone.
- **Trigger**: User reads step 1, writes a note explaining what they're going to test, then closes the tab to grab a coffee. On return: note is gone.
- **Fix**: Either persist the note even without an outcome (introduce a sentinel "no-outcome" row, or relax the `recordStep` BC to allow null-outcome notes), or surface a "your note is unsaved -- pick an outcome" banner. The current "drops silently" UX is worse than either.

### Nit

#### NIT: `markSpecRead` and `flipReviewStatus` actions don't validate path traversal in `item.ref`

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:220, 245`; `walker/+page.server.ts:234`
- **Problem**: `resolve(REPO_ROOT, item.ref)` will happily resolve `..` segments outside REPO_ROOT. `item.ref` is loader-controlled, not user-controlled, so the practical exploit surface is small (an attacker would need to corrupt `hangarReviewItem.ref` directly in the DB). Defense-in-depth gap.
- **Fix**: After resolving, assert `absPath.startsWith(REPO_ROOT + sep)` (with a trailing-separator check to avoid `${REPO_ROOT}-evil/` matches).

#### NIT: Walker UI suggests `outcome=pass` when the user has 0 fails but unrecorded steps

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:293`
- **Problem**: `confirmFinish = everyStepPassed ? 'pass' : totals.fail > 0 ? 'fail' : 'pass'`. With `recorded = 5, total = 10, fail = 0, blocked = 0`, this picks `'pass'`. The action's tamper guard accepts it; `cleanPass` is false (incomplete plan), so no flip happens, and the session closes as `pass`. The reviewer's intent was probably "I'm partway through" -- the right suggestion is `pause`, not `finish as pass`.
- **Fix**: Suggest `pass` only when `everyStepPassed`. Otherwise: if any fail, suggest `fail`; if any blocked-with-no-fail, suggest `fail`; if simply incomplete, hide the Finish button entirely or open the dialog without a default selection so the user types intent.

## Areas verified clean

- The atomic frontmatter writer (`writeFrontmatterField` -> `atomicWriteFile`) is sibling-temp + rename, dedupes its own no-op writes via `if (after === before) return`, and cleans up the temp file on rename failure. The CRLF preservation from the Phase 4 retro fix is honoured by `setFrontmatterField` in `@ab/utils/markdown.ts`.
- `startSession` and `upsertItem` correctly catch and retry only on PG `23505`; the partial unique index on `(itemId, userId, finishedAt IS NULL)` keeps the open-session invariant under race.
- The walker's `?/finishSession` re-reads test-plan.md and step rows at finish time (not load time), so a concurrent edit can't trick the flip into firing on a stale snapshot.
- The order of operations in `?/finishSession` -- close the session, THEN write frontmatter -- is documented and consistent with the comment ("session is already finished even if the frontmatter write fails"). The post-write degraded state is recoverable via `?/flipReviewStatus`.
- The walker action layer correctly enforces the (item, user, sessionId) tamper guard via `getOpenSession` for `?/recordStep` and `?/finishSession`.
- The `getDerivedColumnName` and `resolveItemColumnId` helpers are pure, exhaustive across `(frontmatterStatus, reviewStatus)`, and tested with explicit cases for null/null, unread/*, reading/*, done/pending, done/done, plus pinned-column override and missing-column fallback.
- The `WP_SPEC_TABS` constant is exported through `@ab/constants` and consumed via the typed `WpSpecTabId` -- no magic strings on the routing surface.
- Tabs whose underlying file is missing render a "not present" placeholder rather than 404-ing the whole page; this matches the spec ("a WP that hasn't authored a `user-stories.md` yet is a normal state, not an error").
- The walker's `parseTestPlan` is invoked at finish time to compute `steps.length` against live disk content, so a step removed from the plan is not silently treated as still-present.
- The `setFrontmatterField` round-trip preserves CRLF when the input was authored CRLF (see EOL detection at line 320 of `libs/utils/src/markdown.ts`); the no-op early return prevents redundant writes when the field is already set.
