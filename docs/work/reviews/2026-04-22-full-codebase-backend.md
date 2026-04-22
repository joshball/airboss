---
feature: full-codebase
category: backend
date: 2026-04-22
branch: main
issues_found: 14
critical: 1
major: 5
minor: 6
nit: 2
---

## Summary

Backend is well-structured overall: form actions are thin wrappers that delegate
to the BC layer, Zod validates at the action boundary, typed errors from the BC
map cleanly to user-facing failures, and `requireAuth` is uniformly applied at
both the (app) layout and every load/action. Key gaps are around concurrency
(no DB-level uniqueness on `session_item_result` (session_id, slot_index),
race windows in `startFromPreset`, and reusable read-modify-write patterns
without row locks), a few inconsistencies in how errors are surfaced back to
forms (plan actions return raw `error.message` strings; `memory/review` escalates
500s to `error()` while the peer `session/[id]` uses `fail(500)`), and the
session runner accepting writes against already-completed sessions. Nothing
leaks DB text or secrets to the client.

## Issues

### CRITICAL: `recordItemResult` has no atomic read-or-create; (session_id, slot_index) lacks a UNIQUE constraint

- **File**: `libs/bc/study/src/sessions.ts:756-827`, schema `libs/bc/study/src/schema.ts:462-522`
- **Problem**: `recordItemResult` does a SELECT existing, then either UPDATE or INSERT without a transaction, row lock, or UPSERT. The table has `sir_session_slot_idx` (a non-unique index) on `(sessionId, slotIndex)` but no UNIQUE constraint. Two parallel POSTs to `submitReview`/`submitRep`/`skip` for the same slot (double-submit from a finicky tap, a Svelte enhance retry on transient 5xx, or the tab left open in two browsers) can both see "no existing row" and both INSERT -- producing two rows for one slot. Summary aggregation (`getSessionSummary`) then double-counts attempts, correctness, and confidence averages. The commit path at `commitSession` (lines 663-685) is also vulnerable: two overlapping `startSession` calls for the same user could theoretically race, but `generateSessionId()` in commitSession makes that harmless; the real exposure is post-commit upsert.
- **Fix**: Add UNIQUE `(session_id, slot_index)` to `session_item_result` (matches the intent of `sirSessionSlotIdx`). Rewrite `recordItemResult` as an atomic UPSERT using Drizzle's `.onConflictDoUpdate({ target: [sessionId, slotIndex], set: { ... } })`. Alternatively wrap the SELECT/INSERT in a serializable transaction with `FOR UPDATE` on the parent `session` row. Prefer the first: simpler, fewer round-trips, and the DB guarantees single-row-per-slot.

### MAJOR: Session runner actions accept writes against already-completed sessions

- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:159-340` (every action)
- **Problem**: The load function redirects completed sessions to the summary (line 44), but every action (`submitReview`, `submitRep`, `completeNode`, `skip`) skips that check. `loadSlot` fetches results by slotIndex but never asks whether the parent session is still open. A stale form on a completed session (back button after finishing, duplicate tab) can still POST, and `recordItemResult` happily updates a slot's `completedAt` -- invalidating the summary that was just computed. `finish` is also re-callable, and `completeSession` is idempotent on its return, but by then you've potentially mutated slot rows behind a summary the user already sees.
- **Fix**: At the top of every action, call `getSession(event.params.id, user.id)` and `fail(409, { error: 'Session already ended.' })` (or redirect to the summary) when `completedAt !== null`. Ideal: a single `requireOpenSession` helper reused by all five actions.

### MAJOR: `startFromPreset` does not handle `DuplicateActivePlanError`

- **File**: `apps/study/src/routes/(app)/session/start/+page.server.ts:103-152`
- **Problem**: The action archives any existing active plan, then calls `createPlan`, which also archives inside its own transaction. If the user double-submits (two preset picks concurrently, or preset + a manual plan create in another tab), the partial UNIQUE index fires and `createPlan` throws `DuplicateActivePlanError`. The catch block treats that as a generic 500 ("Could not start the session from that preset. Try again."), which is both wrong (nothing is broken; the user already has a plan) and produces a worse UX than the BC is capable of. The pre-emptive `archivePlan` on line 124 is itself redundant -- `createPlan` already archives in a transaction -- and it widens the race window for no win.
- **Fix**: Drop the pre-emptive `archivePlan` call; rely on `createPlan`'s transactional archive. Catch `DuplicateActivePlanError` explicitly and either retry once (the losing side can run `startSession` against the now-existing active plan) or surface "Another plan was just set up elsewhere -- refresh to continue." Also catch `NoActivePlanError` from the subsequent `startSession` for the same symmetry the sibling `start` action enforces.

### MAJOR: `updatePlan` action leaks raw `Error.message` to the client

- **File**: `apps/study/src/routes/(app)/plans/[id]/+page.server.ts:85`
- **Problem**: `fail(400, { error: err instanceof Error ? err.message : 'Could not save plan.' })`. The BC's `updatePlan` throws `new Error(...)` on the focus-vs-skip disjointness check (`plans.ts:183`) with a message that happens to be readable, but any other thrown `Error` (a DB-level CHECK violation, a JSON serialization issue, etc.) pipes its raw message straight into the form. That's the "don't leak DB errors" rule violated by construction. The peer `plans/new/+page.server.ts` (lines 88-98) handles the same failure class correctly with a fixed user-facing message.
- **Fix**: Define a typed error in `plans.ts` for the disjointness check (`DomainOverlapError` or similar), catch it explicitly in the action with a user-facing message, and fall through to a generic "Could not save plan." for the 500 case. Keep the exception message in the server log via `createLogger` like the other actions do.

### MAJOR: `memory/review` action surfaces 500 via `error()` while peer actions use `fail(500)`

- **File**: `apps/study/src/routes/(app)/memory/review/+page.server.ts:128`
- **Problem**: On unexpected DB failure the review submit throws `error(500, ...)`, which produces a full-page error response. Every other form action in the codebase (`memory/new`, `memory/[id]`, `plans/new`, `plans/[id]`, `reps/new`, `session/[id]`, `session/start`) returns `fail(500, { error: ... })` so the form can recover inline. A learner mid-review would lose their place entirely because of an inconsistent convention.
- **Fix**: Change to `return fail(500, { success: false as const, error: 'Could not save review', cardId });` and widen the action return type so the template can handle the error branch. Match the shape the `session/[id]` runner uses for `submitReview` (line 219).

### MAJOR: `completeSession` side-effect fires on a GET load

- **File**: `apps/study/src/routes/(app)/sessions/[id]/summary/+page.server.ts:13-15`
- **Problem**: The summary page's load function writes to the DB (`completeSession`) on GET. While the operation is idempotent, it breaks the "load = read" contract, means prefetching/link previews can silently complete sessions, and duplicates logic that the `finish` action in the runner already performs. It also bypasses CSRF (GETs aren't CSRF-checked) so any page that embeds the summary URL can end someone's session.
- **Fix**: Remove the load-side `completeSession`. Have the runner's `finish` action be the only path that ends a session, and let the summary load just render the state it finds. If a learner lands on the summary for an open session via a deep link, redirect them to the runner and let them `finish` explicitly, or show a "Finish this session first" banner.

### MINOR: `recordItemResult` spreads non-null guards that silently fall back to previous values

- **File**: `libs/bc/study/src/sessions.ts:778-800`
- **Problem**: The UPDATE branch does `cardId: result.cardId ?? existing.cardId` (same pattern for `scenarioId`, `nodeId`, `reviewId`, `skipKind`, `chosenOption`, `isCorrect`, `confidence`, `answerMs`). This conflates "the caller did not provide this field" with "the caller explicitly cleared this field to null." Today no caller wants to clear a field on re-record, so this is benign, but the pattern ships a trap for the next caller. It also means a retry with a subset of fields will retain stale values, potentially mixing a rep's is_correct=true from attempt 1 with chosenOption from attempt 2.
- **Fix**: Take `undefined` to mean "don't touch" and `null` to mean "clear" (standard Drizzle upsert semantics). Build the SET object by only including keys whose input is !== undefined. Or: reject re-records of completed slots entirely by checking `existing.completedAt !== null` and throwing a typed error.

### MINOR: Redirect guard relies on structural shape rather than `isRedirect`

- **File**: `apps/study/src/routes/(app)/session/start/+page.server.ts:78, 142`
- **Problem**: Both actions use `err instanceof Response || (err && typeof err === 'object' && 'status' in err && 'location' in err)` to identify a SvelteKit redirect inside a catch. SvelteKit exports `isRedirect` and `isHttpError` for exactly this, which is both more readable and robust to internal shape changes.
- **Fix**: `import { isRedirect } from '@sveltejs/kit'` and use `if (isRedirect(err)) throw err;`.

### MINOR: `addSkipDomain` runs two non-atomic UPDATE statements

- **File**: `libs/bc/study/src/plans.ts:263-276`
- **Problem**: When the caller adds a domain that was previously in focus, the BC first computes the new `focusDomains` filter and then calls `updatePlan` to set both `skipDomains` and `focusDomains`. Fine. But the preceding `getPlan` read and the final update aren't in a transaction, so a concurrent `updatePlan` could clobber the focus change. The window is tiny and the worst outcome is the invariant briefly violated until the next write. Still, `addSkipNode`, `removeSkipNode`, and `removeSkipDomain` share the same pattern.
- **Fix**: Wrap the read-modify-write in `db.transaction(...)` or move the mutation to a SET that computes inside SQL (array_append / array_remove filtered by id). For v1 size this is defense in depth, not a user-visible bug.

### MINOR: `previewSession` and `startSession` don't share the same `now`

- **File**: `libs/bc/study/src/sessions.ts:692-701`
- **Problem**: `startSession` calls `previewSession(... now)` and then `commitSession(... now)` -- same `now`, good -- but the pool callbacks built inside `previewSession` capture a freshly-computed `new Date()` via `buildEnginePools(userId, now, db)` (line 607). On a slow preview, the engine scores use the original `now` but any downstream code (e.g. `overdueRatio` in `fetchCardCandidates`) can drift by seconds. Here everything threads through the same `now` argument, so the drift is zero -- but the signature allows callers to pass different `now` values between preview and commit, which would produce slot rows whose `presentedAt` predates the engine's view of `dueAt`. Low-severity because the only caller is `startSession` itself.
- **Fix**: Either make the `now` parameter of `previewSession` mandatory (so the compiler forces the caller to pick one and share it) or stop exposing it at all and compute `now` once internally.

### MINOR: `getSessionSummary` runs fresh `count` queries inside a read path

- **File**: `libs/bc/study/src/sessions.ts:1013-1073`
- **Problem**: The summary load runs two `count(*)` queries (`dueTomorrow`, `relearning`), a `selectDistinct` join, AND a `knowledgeNode` title lookup, all inside the summary fetch, each on every summary page load. For v1 scale it's fine; for a learner hitting summary repeatedly, each hit issues 4 extra round-trips that don't change between sessions (due-tomorrow maybe; relearning changes only on review; node title never). Cache these in the BC or at least parallelize with `Promise.all` since they're independent.
- **Fix**: Wrap the three reads in `Promise.all([...])` and let the title resolve in parallel too. Better: compute "suggestedNext" via a dedicated BC function that the load can call alongside the summary read.

### MINOR: `logout` action swallows `auth.handler` errors silently

- **File**: `apps/study/src/routes/(app)/logout/+page.server.ts:15-37`
- **Problem**: The try/finally logs the handler failure but otherwise hides it -- the user sees a clean redirect to /login even when the server failed to invalidate the session on better-auth's side. The local cookie clear saves the UX, but the backing session row may still be valid for a stolen-cookie attacker. No surface for the user to retry.
- **Fix**: Acceptable for v1 (local clear is defence in depth), but worth raising as a telemetry/alerting concern: treat a non-2xx from `auth.handler` during sign-out as an incident signal, not just a log line. If the session is banned/expired, the response will 4xx, which is fine; anything 5xx should page.

### NIT: `memory/new` uses raw string `'cardType'` and `'tags'` keys in the "save and add" carry-over URL

- **File**: `apps/study/src/routes/(app)/memory/new/+page.server.ts:84-95`
- **Problem**: `QUERY_PARAMS.DOMAIN` is used for `domain` but `cardType` and `tags` are raw strings (and `tags` is not in the `QUERY_PARAMS` constant at all). Inconsistent with the "no magic strings" rule and means a rename of those params misses these two sites.
- **Fix**: Add `CARD_TYPE` (actually already present, line 47 of `routes.ts`) and a `TAGS` entry to `QUERY_PARAMS`, and use them here. On the read side (line 19-27) the same string literals are used; update both.

### NIT: `reps/browse` silently accepts the legacy `phase` query param

- **File**: `apps/study/src/routes/(app)/reps/browse/+page.server.ts:33-35`
- **Problem**: Backwards-compat for old bookmarks is fine, but there's no log or deprecation surface, so nobody will notice when it's safe to drop. Also, the fallback precedence is `FLIGHT_PHASE` first, then `phase`, but if both are present and differ, the silent mismatch is a debugging landmine.
- **Fix**: Add a `log.info` with `requestId` when only the legacy param is set, and a TODO with a retirement target. If both are set and differ, `log.warn` and pick `FLIGHT_PHASE`.
