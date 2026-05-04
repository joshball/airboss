---
title: 'Retro Phase 6 Backend Review: Hangar Review Queue'
reviewer: backend
date: 2026-05-05
scope: phase 6 (TOC + knowledge node + ad-hoc tasks) -- merged in PR #611 squash 1310d0ec
---

# Retro Phase 6 Backend Review: Hangar Review Queue

## Summary

- Files reviewed: 6 (3 route servers, 2 BC files, 1 test file)
- Critical: 2
- Major: 4
- Minor: 6
- Nit: 3

The Phase 6 backend extends the existing review-queue substrate cleanly: per-kind loaders dispatch off `kindId`, action handlers follow the same `requireRole / getItem / kind-check / fail|ok` shape established in Phase 5, and `parseToc` is pure with strong test coverage. The frontmatter writer is genuinely atomic (temp + rename), and the path-traversal defense (`assertWithinRepoRoot`) is wired on every filesystem write site. The two real correctness gaps are (1) the ad-hoc task create / update / delete trio is not transactional across `board_task` and the mirror `review_item`, so a partial-write window leaves the board in an inconsistent state; and (2) `loadKnowledgeNode` reads from `resolve(REPO_ROOT, item.ref)` without `assertWithinRepoRoot`, so a corrupted DB row with `..` segments could leak file contents from outside the repo into the loader return value. Magic strings (`'ad_hoc'`, `'pass' | 'fail' | 'abandoned'`), missing entryRef validation in `?/recordTocStep`, and missing action-layer tests for the four new actions round out the punch list.

## Findings

### Critical

#### CRITICAL: ad-hoc task create / update / delete is not atomic across `board_task` + mirror `review_item`

- **Location**: `apps/hangar/src/routes/(app)/review/tasks/new/+page.server.ts:91-115`, `apps/hangar/src/routes/(app)/review/tasks/[taskId]/edit/+page.server.ts:93-113` and `:131-134`
- **Problem**: All three task actions (`default`, `update`, `delete`) issue two separate awaits against the DB without wrapping them in `db.transaction`:
  - **create**: `createTask(...)` then `upsertItem(...)` then `redirect(303)`. If `upsertItem` fails, the underlying `board_task` row already exists but no mirror is written, so the task is invisible on the board (the loader skips `ad_hoc` per `review-loader.ts:117`, so it's never resurrected). The user sees a 500 toast and assumes the task wasn't created, then re-submits and gets a duplicate `board_task` row with a fresh ULID.
  - **update**: `updateTask(taskId, ...)` then `upsertItem(...)`. If the mirror upsert fails after `updateTask` succeeded, the canonical row has the new title/type/area but the kanban card still shows the old denormalized fields until the next loader pass touches the row -- and the loader doesn't touch `ad_hoc` rows.
  - **delete**: `softDeleteItem(mirror.id)` then `deleteTask(taskId)`. If `deleteTask` fails (e.g. FK from a future child table), the mirror is soft-deleted (item gone from the board) but `board_task` survives, so `/review/tasks/<id>/edit` still loads it. The user can re-submit the form and silently resurrect a "deleted" task.
- **Why it matters**: Spec invariant: "Ad-hoc task create: insert `board_task` row + insert mirror `review_item` row in the same transaction." This is also the prime-directive rule -- every multi-step mutation in the spec.md data model is named as transactional. The current code is the "as a stub / for now" shape. Postgres deadlocks, network blips, and FK violations on future kinds will surface as half-applied state with no rollback.
- **Fix**: Wrap each of the three actions in `db.transaction`, threading the transaction handle into both BC calls. Existing pattern: `getOrCreateBoard` already does this in `libs/bc/hangar/src/review.ts:103-114`. For create, also move `getOrCreateBoard()` and `listTasks(board.id)` (the sortOrder peek) inside the transaction so two concurrent creators don't race the sortOrder computation. Example:

```typescript
await db.transaction(async (tx) => {
  const board = await getOrCreateBoard(tx);
  const existing = await listTasks(board.id, tx);
  const nextSortOrder = existing.length === 0 ? 0 : Math.max(...existing.map((t) => t.sortOrder)) + 1;
  const task = await createTask({ ..., sortOrder: nextSortOrder }, tx);
  await upsertItem({ ..., kindId: REVIEW_KINDS.AD_HOC, ref: task.id, ... }, tx);
  return task;
});
throw redirect(303, ROUTES.HANGAR_REVIEW_TASK_EDIT(task.id));
```

`createTask` / `updateTask` / `deleteTask` / `upsertItem` / `softDeleteItem` / `findItemByRef` all already accept an optional `Db` parameter, so this is a one-line change per action plus a transaction wrapper.

#### CRITICAL: `loadKnowledgeNode` reads files without `assertWithinRepoRoot`

- **Location**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:192-193`
- **Problem**: The loader resolves `absPath = resolve(REPO_ROOT, item.ref)` then calls `safeReadFile(absPath)` -- the path-traversal guard `assertWithinRepoRoot` (defined later in the same file at `:388`) is only invoked from the three frontmatter-write actions, not from any of the per-kind load helpers. `item.ref` is loader-controlled, but the file's own JSDoc on `assertWithinRepoRoot` names this exact threat model: "a corrupted DB row could resolve outside REPO_ROOT via `..` segments". A row with `ref = '../../../etc/passwd'` would be read and (silently, on parse failure) returned to the page -- or, more realistically, a row with `ref = '../../../home/joshua/.ssh/id_rsa'` would render as "frontmatter parse failed; here is the body" in the knowledge-node view if the loader was ever pointed at a corrupted manifest.
- **Why it matters**: Defense-in-depth was the entire point of the helper. Wiring it on the write path but not the read path means a corrupted-row attacker reads anything the hangar process can read; the write check only stops them from corrupting it back. The spec calls out path validation as an invariant for the filesystem-touching actions; the load helpers touch the filesystem with the same `item.ref` so they have the same threat surface.
- **Fix**: Call `assertWithinRepoRoot(absPath)` immediately after `resolve(REPO_ROOT, item.ref)` in `loadKnowledgeNode`. Also do it in `loadWpSpec`'s `buildTabPayload` (which resolves `${wpDir}/${file}` against `REPO_ROOT` at line 351-352) and in the `testPlanAbs = resolve(REPO_ROOT, testPlanRel)` at `:284`. The cleanest fix is to push the check inside `safeReadFile`: have `safeReadFile(absPath)` call `assertWithinRepoRoot(absPath)` before `readFile`, and let the caller treat a thrown traversal as a 500. That way every read path inherits the guard for free.

### Major

#### MAJOR: `?/recordTocStep` does not verify `entryRef` belongs to the parsed TOC

- **Location**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:465-497`
- **Problem**: The action validates `entryIndex` is a non-negative integer and `outcome` is in `REVIEW_OUTCOME_VALUES`, but takes `entryRef` straight from form data and writes it to `review_step.stepRef` without checking it against the parsed TOC. `parseToc` produces deterministic SHA-1 hashes; a malicious or buggy client can submit any string and it lands in the steps table. The pass/fail computation later in `?/finishTocSession` (which doesn't yet exist as code that actually consults the parsed TOC -- see next finding) and the `noPassingSession` bucket filter both reason about "have all TOC entries been recorded?" -- if the recorded refs don't match the parsed refs, the bucket logic skews.
- **Why it matters**: Spec invariant: "TOC sessions are idempotent on `(item, user, !finishedAt)`... the entryRef pattern mirrors `parseTestPlan`'s stepRef pattern." The walker enforces this for test plans (`walker-actions.test.ts` covers the round-trip); the TOC variant skipped the validation. A 5-line change closes it.
- **Fix**: Re-parse the TOC inside `?/recordTocStep` before the `recordStep` call and reject `entryRef` values that aren't in `parsed.entries.map((e) => e.entryRef)`. Pattern:

```typescript
const reference = await getReference(item.ref);
const parsed = parseToc(item.ref, reference?.verbatim ?? null);
const validRefs = new Set(parsed.entries.map((e) => e.entryRef));
if (!validRefs.has(entryRef)) {
  return fail(400, { recordTocStep: 'entryRef is not in the parsed TOC' as const });
}
```

The reparse is cheap (string + sha1 over a few hundred entries max); cache it on the loader response only if profiling shows it's hot.

#### MAJOR: `?/finishTocSession` does not compute pass/fail from recorded steps

- **Location**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:506-530`
- **Problem**: The action accepts `outcome` from form data and writes it directly to `review_session.outcome` via `finishSession(sessionId, outcomeRaw, note)`. The spec contract for the TOC walker says the bucket filter `noPassingSession: true` "does the rest" -- but only if the session's outcome actually reflects "every parsed entry has a `pass` step." Today the client decides: a user can submit `outcome=pass` with zero recorded steps and the bucket filter will hide the item. Compare to the wp_test_plan walker, where `everyStepPassed(steps, recorded)` is the gate (`libs/bc/hangar/src/review.ts:865-888`); the TOC variant has no equivalent server-side check.
- **Why it matters**: Spec design.md explicitly says the walker pattern is shared substrate, and the TOC view "Each entry is a step in the active session." The loose contract here means "I clicked Finish -> Pass" hides the item even if I marked everything Fail. The whole point of the walker substrate is that the server, not the client, decides whether the work passes.
- **Fix**: Mirror the walker's finish path: after the session-ownership check, re-parse the TOC, fetch `listSteps(sessionId)`, and reject `outcome === 'pass'` unless `everyStepPassed(parsed.entries.map((e) => ({ stepRef: e.entryRef })), recorded)` is true. `outcome === 'fail'` and `outcome === 'abandoned'` can still be user-driven. Either reuse `everyStepPassed` directly (it operates on `{ stepRef }` shape so the entry mapping is trivial) or mint a TOC-specific helper alongside it in `review.ts`.

#### MAJOR: magic-string `'ad_hoc'` in two task action files

- **Location**: `apps/hangar/src/routes/(app)/review/tasks/new/+page.server.ts:108`, `apps/hangar/src/routes/(app)/review/tasks/[taskId]/edit/+page.server.ts:107` and `:132`
- **Problem**: Three sites pass the literal string `'ad_hoc'` as the `kindId`. Constant `REVIEW_KINDS.AD_HOC` exists and is imported elsewhere in the same feature (e.g. `+page.server.ts:104, :234`). CLAUDE.md "All literal values in `libs/constants/`" is a hard rule.
- **Why it matters**: A future rename of the kind id (e.g. `ad_hoc` -> `task`) will leave these three call sites pointing at a non-existent kind, breaking the mirror upsert silently. The constant exists; not using it is the kind of "stub a string today, fix later" the prime directive flags.
- **Fix**: Import `REVIEW_KINDS` and replace `'ad_hoc'` with `REVIEW_KINDS.AD_HOC` in all three sites.

#### MAJOR: `?/finishTocSession` uses literal session-outcome values instead of `SESSION_OUTCOME_VALUES`

- **Location**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:516`
- **Problem**: `if (outcomeRaw !== 'pass' && outcomeRaw !== 'fail' && outcomeRaw !== 'abandoned')` hardcodes the three session outcomes. `SESSION_OUTCOME_VALUES = ['pass', 'fail', 'abandoned'] as const` lives in `libs/constants/src/review.ts:60` and is exported through `@ab/constants`. The walker's `?/finishSession` already follows the constant pattern.
- **Why it matters**: Same reason as the magic-string finding above -- adding a fourth session outcome (e.g. `void` for "session was started by mistake") would have to find this string-comparison chain manually. The action also conflates session outcomes with step outcomes by accepting bare strings; a value `'blocked'` (a step outcome, not a session outcome) would currently 400 the right way, but only by accident of the chain.
- **Fix**: `if (!(SESSION_OUTCOME_VALUES as readonly string[]).includes(outcomeRaw)) return fail(400, ...)`. Mirror the existing `isReviewOutcome` helper at `:259` -- add a sibling `isSessionOutcome` and use it in both the validation and the type narrowing for the `finishSession` call.

### Minor

#### MINOR: `loadReferenceToc`, `loadKnowledgeNode`, `loadWpSpec` do not parallelize independent reads

- **Location**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:131-153, :192-219, :276-335`
- **Problem**: Each loader awaits its DB and FS reads sequentially even when they don't depend on each other. Examples:
  - `loadReferenceToc`: `getReference(item.ref)` and `listSessions(item.id)` are independent (one needs `item.ref`, the other `item.id`).
  - `loadKnowledgeNode`: `safeReadFile(absPath)` and `listSessions(item.id)` are independent.
  - `loadWpSpec`: the per-tab `Promise.all` is good, but the trailing `await listSessions(item.id)` could overlap with the tabs/walker work.
- **Why it matters**: Each round-trip on the page load is ~1-5ms locally but 10-20ms over the wire to the OrbStack PG socket; the knowledge-node view runs at ~3 sequential awaits when it could run at ~1-2.
- **Fix**: Wrap independent calls in `Promise.all`. Example for `loadKnowledgeNode`:

```typescript
const [raw, sessionRows] = await Promise.all([safeReadFile(absPath), listSessions(item.id)]);
```

#### MINOR: `?/recordTocStep` and `?/finishTocSession` lack action-layer tests

- **Location**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/spec-actions.test.ts` (existing, but doesn't cover the new actions)
- **Problem**: The Phase 5 spec actions (`?/markSpecRead`, `?/flipReviewStatus`) have a 246-line vitest file that covers soft-deleted-item rejection, kind mismatch, idempotency, and write-failure paths. The four Phase 6 actions (`?/recordTocStep`, `?/finishTocSession`, `?/markKnowledgeNodeReviewed`, plus the three task CRUD actions in two separate files) have zero direct action-layer tests. Walker tests exist but they're for the wp_test_plan kind, not the TOC variant.
- **Why it matters**: Spec invariants like "tamper guard via re-fetch open session", "session-ownership check before finish", "writeFrontmatterField failure surfaces as 409" are demonstrably tested for `?/markSpecRead` / `?/flipReviewStatus` and they should be tested for the new actions too. A regression would slip through `bun run test` silently. Project rule: "Automated tests alongside implementation."
- **Fix**: Add a `toc-actions.test.ts` and a `tasks-actions.test.ts` next to the existing `spec-actions.test.ts`, following the same `vi.doMock('@ab/auth' / '@ab/bc-hangar')` pattern. Cover at minimum: `entryRef` validation rejection (after the major fix lands), session-ownership tamper-guard, kind-mismatch rejection, and `writeFrontmatterField` failure for `?/markKnowledgeNodeReviewed`. For tasks: validation errors for missing title/type/productArea, the transactional rollback story (after the critical fix lands), and the soft-delete-mirror-before-hard-delete-task ordering.

#### MINOR: task create's sortOrder computation races concurrent creators

- **Location**: `apps/hangar/src/routes/(app)/review/tasks/new/+page.server.ts:88-89`
- **Problem**: `const existing = await listTasks(board.id); const nextSortOrder = existing.length === 0 ? 0 : Math.max(...existing.map((t) => t.sortOrder)) + 1;` Two concurrent creators both read the same `existing` and both insert with the same `nextSortOrder`. There's no unique constraint on `(boardId, sortOrder)` so both succeed -- which is the right call -- but they collapse onto the same position, defeating "the task lands at the end of the column."
- **Why it matters**: Cosmetic at the user-visible level (ties are tie-broken on `id`), but the comment says "existing rows don't get reshuffled" and the implication is that each new task lands strictly last. With concurrent creators the second-finished task lands at the same position as the first.
- **Fix**: After moving sortOrder computation inside the transaction (per the critical-finding fix), either (a) use `SELECT MAX(sort_order) FOR UPDATE` against the board to serialize creators, or (b) use a Postgres `GENERATED ALWAYS AS IDENTITY` sequence per board. (a) is fine for the volume here. Even simpler: drop the `+1` semantics entirely and use `Date.now()` or the ULID's time component (`board_task` IDs are ULIDs already); the board orders by `(sortOrder, id)` and ULIDs sort time-ascending so the new row naturally lands last without a SELECT.

#### MINOR: task create's redirect-detection in catch is loose

- **Location**: `apps/hangar/src/routes/(app)/review/tasks/new/+page.server.ts:119-122`
- **Problem**: `if (err instanceof Response || (typeof err === 'object' && err !== null && 'status' in err && 'location' in err))`. `err instanceof Response` will never match a SvelteKit redirect (the framework throws a plain object with `{ status, location }`, not a `Response`). The duck-type check on the second branch is correct but loose: a custom application error that happens to carry both fields would also flow through as a redirect.
- **Why it matters**: Subtle. If a future BC primitive throws something with a `status` and `location` property as part of its error shape (e.g. an HTTP-fetch wrapper), the catch will rethrow it and the user sees a "redirect" to a garbage URL.
- **Fix**: Import `isRedirect` from `@sveltejs/kit` (it's the framework's official narrow). `if (isRedirect(err)) throw err;` is precise. Drop the `instanceof Response` branch entirely; it's dead.

#### MINOR: `?/markKnowledgeNodeReviewed` is not idempotent

- **Location**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:542-562`
- **Problem**: The action writes `discovery_review: done` unconditionally. Compare to `?/markSpecRead` (`:416-418`), which checks `if (item.frontmatterStatus === 'done') return { markSpecRead: 'already-done' as const }` and skips the write.
- **Why it matters**: The double-click / fast-refetch case re-touches the file's mtime and produces a one-byte git diff (no real change in content because `setFrontmatterField` short-circuits when the value is unchanged -- see `review-frontmatter.ts:52`). So the disk is safe; what's missing is the "already-done" toast wording. A user who clicks twice gets the success toast twice instead of "already marked reviewed" the second time.
- **Fix**: Read `discovery_review` from the cached frontmatter (the loader already caches `cachedFields.otherFields`) or from the DB row's denormalized field, and short-circuit with an `already-done` sentinel when it's already `done`. Or, since `cachedFields.otherFields` may not include `discovery_review`, parse the file's frontmatter once and gate. The wp_spec path's pattern transfers directly.

#### MINOR: PG FK-violation errors surface to the user as raw messages

- **Location**: `apps/hangar/src/routes/(app)/review/tasks/new/+page.server.ts:125-126`, `tasks/[taskId]/edit/+page.server.ts:116-118`
- **Problem**: A bad `assigneeId` or `columnId` (a string that isn't a valid `bauth.user.id` or `hangar.board_column.id`) hits the FK and throws a Postgres error with code `23503`. The catch passes `err.message` straight through to the user. They see `insert or update on table "board_task" violates foreign key constraint "..."`, not a friendly "That assignee doesn't exist."
- **Why it matters**: Project standard ("Are error messages user-facing (not raw DB errors)?"). The form lets the user type any string into `assigneeId`, so invalid values are realistic.
- **Fix**: Either validate `assigneeId` exists in `bauth.user` before the insert (extra round-trip, but explicit), or narrow PG `23503` in the catch and emit `errors.assigneeId = 'Assignee not found.'` / `errors.columnId = 'Column not found.'` based on the constraint name. Mirroring `isPgUniqueViolation` from `review.ts:755`, add an `isPgFkViolation` and switch on `err.constraint`.

### Nit

#### NIT: `assertWithinRepoRoot` uses `startsWith(root)` plus a separate-branch fallback

- **Location**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:388-393`
- **Problem**: The implementation tolerates the case `absPath === REPO_ROOT` via `|| absPath !== REPO_ROOT`. There's no callsite that would ever resolve to exactly `REPO_ROOT` -- every callsite passes `resolve(REPO_ROOT, item.ref)` where `item.ref` is a non-empty file path. The fallback is dead.
- **Fix**: Drop the `|| absPath !== REPO_ROOT` clause. The trailing-separator pattern alone is correct.

#### NIT: `safeReadFile` swallows every error including EACCES / EMFILE

- **Location**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:373-379`
- **Problem**: `try { return await readFile(absPath, 'utf8'); } catch { return null; }` collapses all read errors into "missing." A permissions error or out-of-FDs error then renders the page as "knowledge node missing" rather than surfacing a real issue. Compare to `review-frontmatter.ts:28-30` which preserves the error.
- **Fix**: Distinguish ENOENT from other failures. `if (err.code === 'ENOENT') return null; throw err;`. The `loadKnowledgeNode` caller already has a `missing: true` branch keyed off `null`; everything else should bubble.

#### NIT: `WalkerSummary` and `SessionSummary` are local interfaces re-declared per file

- **Location**: `+page.server.ts:61-77`
- **Problem**: These shapes are also implicit in `walker/+page.server.ts` and the bucket / item loaders. Centralizing them in `libs/types` (or co-locating with the BC) would let the views import the shape rather than re-derive it from the loader return.
- **Fix**: Move `WalkerSummary` / `SessionSummary` to `libs/bc/hangar/src/review.ts` (or `libs/types/src/review.ts`) and import from both load files. Cross-page consistency on shape is the goal.

## Areas verified clean

- Auth: `requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN)` is consistent across the per-kind load and every action handler.
- Path traversal on the write path: `assertWithinRepoRoot` is called from all three frontmatter-write action sites (`?/markSpecRead`, `?/flipReviewStatus`, `?/markKnowledgeNodeReviewed`).
- Session ownership: `?/recordTocStep` and `?/finishTocSession` both re-fetch `getOpenSession(itemId, user.id)` and reject when `open.id !== sessionId` -- the tamper-guard is right.
- Idempotency: `recordStep` uses `onConflictDoUpdate` on `(sessionId, stepRef)`, so the action layer doesn't need a 23505 retry. `startSession` is `(item, user, !finishedAt)` idempotent and retries on 23505 in the BC.
- Atomic frontmatter writes: `writeFrontmatterField` writes to a sibling `.tmp` file and renames into place; `setFrontmatterField` no-ops when the value is already current; rename is one POSIX syscall.
- Soft-delete ordering on task delete: mirror is soft-deleted before `board_task` is hard-deleted, so the loader's prune skip for `ad_hoc` rows can't race the deletion (and ad_hoc rows are excluded from prune anyway in `review-loader.ts:117`).
- Type safety: no `any`, no non-null assertions in the reviewed files. `isReviewOutcome` and `isProductArea` / `isTaskType` are proper user-type guards over the constant arrays.
- TOC parser: `parseToc` is pure, deterministic, hash-stable, and handles all three accepted verbatim shapes plus malformed inputs without throwing. Test coverage covers 13 cases (the WP cited 12; the actual count is 13 -- the kind=toc-with-non-array-items case is the extra).
- `findItemByRef` and `getTask` are read-only, indexed (the unique partial on `(boardId, kindId, ref) WHERE deleted_at IS NULL` carries the `findItemByRef` lookup; `board_task.id` is the PK for `getTask`), and free of side effects.
- Drizzle ORM only -- no raw SQL except the well-guarded `listItemsWithPassingSession` window-function query in `review.ts:657`, which is out of Phase 6 scope but worth flagging as the only `db.execute(sql\`...\`)` site in the BC.
- `@ab/*` cross-lib imports throughout; no relative-path leaks across lib boundaries.
- Tests use `.toMatchObject`, `.toMatch`, `.toEqual`, `.toBe(true)` -- no `.toBeTruthy()` anywhere in the new test file or the spec-actions test.
