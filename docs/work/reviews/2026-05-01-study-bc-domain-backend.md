---
feature: study-bc-domain
category: backend
date: 2026-05-01
branch: main
status: unread
review_status: pending
counts:
  critical: 1
  major: 4
  minor: 6
  nit: 4
---

## Summary

Reviewed the full `libs/bc/study/src/` directory (about 30k LOC, 60+ files) for backend
quality: BC-function discipline, transaction safety, error categorization, validation,
data transformation, API consistency. Overall the BC layer is mature -- typed errors are
abundant and well-named, write paths that mutate multiple rows almost always wrap a
transaction, and most idempotency stories are explicit (UPSERTs with named unique
targets, FOR UPDATE locks for read-modify-write sequences). The hot transactional paths
(`submitReview`, `undoReview`, `commitSession`, `recordItemResult`, `skipSessionSlot`,
`activatePlan`, `replaceNodeEdges`, `recordPhaseVisited/Completed`, `setPrimaryGoal`,
`createCard`, `createScenario`) are correct.

Issues fall into four buckets:

- One critical: `applyCertGoalsToPrimaryGoal` writes the goal targeting patch and N
  syllabus links across separate connections with no enclosing transaction, so a
  mid-loop failure leaves a partially-built primary goal.
- A handful of TOCTOU read-then-write sequences that should be UPSERT or transaction-
  wrapped (`renameSavedDeck`/`deleteSavedDeck`, `setComprehended`).
- Error-categorization slip: `recordItemResult` raises `SessionNotFoundError` when the
  problem is a foreign review id, and `getCredentialIdsCoveredBy` drives a per-credential
  query loop that should be a single recursive CTE.
- Several minor patterns drift -- a stray `'new'` magic string, a quoted SQL identifier
  bypassing the schema reference, a duplicate `escapeLike` helper, a fragile
  unique-violation error-message regex, and a few boilerplate `throw new Error("X
  failed")` sites where the BC otherwise prefers typed errors.

The schema-validation, idempotency, and per-user authorization story is in good shape.
The fixes below are mostly local; no architectural reshape is needed.

## Issues

### CRITICAL: `applyCertGoalsToPrimaryGoal` mutates primary goal across N writes with no transaction

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/goals.ts` (lines 527-579)

Problem: The helper does in order: (1) read primary goal, (2) optionally `createGoal`
(its own transaction), (3) `db.update(goal).set(targetingPatch)` for focus/skip
targeting, (4) loop over each cert slug and call `addGoalSyllabus` (one INSERT each).
None of (3)+(4) is enclosed in a `db.transaction(...)`. If any iteration in the loop
throws -- e.g. `getCredentialPrimarySyllabus` returns null, FK error, network blip --
the user is left with a primary goal whose targeting patch landed but only the first M
of N cert syllabi attached. Because the helper is documented as "idempotent on re-run",
that may sound recoverable, but the partial state can briefly drive the engine
(`getDerivedCertGoals` reads `goal_syllabus`) to a wrong cert filter while the user is
mid-action. The "preset start" / "dev seed" call sites are precisely the ones where
multi-cert installs happen.

Fix: Wrap steps (3) and (4) inside a single `db.transaction(async (tx) => { ... })`,
threading `tx` into `getCredentialBySlug`, `getCredentialPrimarySyllabus`, and
`addGoalSyllabus`. The `createGoal` step (when no primary exists) should also be done
inside the same transaction by inlining its insert -- or call `createGoal(..., tx)` once
the helper is moved inside. `skippedCerts` is computed during the loop, so partial
success semantics need a small rework: either gate the final return on no exception
(roll back the targeting patch when any cert lookup throws), or split into a "validate
all certs first, then write" two-phase approach so a missing syllabus skips cleanly
without polluting the targeting patch.

---

### MAJOR: `renameSavedDeck` and `deleteSavedDeck` are read-then-write outside a transaction

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/saved-decks.ts` (lines 73-107, 123-155)

Problem: Both functions select for the existing `(user_id, deck_hash)` row, then branch
on whether to UPDATE or INSERT. There's a partial UNIQUE on `(user_id, deck_hash)` (the
inferred uniqueness from the implicit upsert pattern), so two concurrent calls -- e.g. a
double-click rename, two tabs, or `enhance` retry -- can both read "no existing row" and
both INSERT. One will succeed, the other surfaces a raw DB unique-violation error to the
caller instead of the typed BC outcome.

Fix: Use a single `db.insert(savedDeck).values(...).onConflictDoUpdate({ target: [savedDeck.userId, savedDeck.deckHash], set: {...} }).returning()`
in both functions. The `dismissedAt: null` semantic on rename, and the `dismissedAt: now`
semantic on delete, fold cleanly into the `set` clause. Drops the pre-read entirely and
makes both calls atomic against concurrent writers.

---

### MAJOR: `recordItemResult` throws `SessionNotFoundError` when reviewId ownership check fails

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/sessions.ts` (lines 874-881)

Problem: When the caller passes a `reviewId` that does not belong to `userId`, the BC
throws `SessionNotFoundError(sessionId, userId)`. That error name is structurally wrong
-- the session was found, the review id is the bad one. Routes catch typed errors by
class, so a real session-not-found will look identical to "buggy caller smuggled foreign
review id" and the operator can't disambiguate.

Fix: Introduce a typed `InvalidReviewReferenceError(sessionId, reviewId, userId)` (or
similar) and throw that instead. Export it from the BC barrel. Route handlers
already render `SessionNotFoundError` as 404; the new error should map to 400/403 since
it indicates the caller composed a request they had no business making, not a missing
session.

---

### MAJOR: `createPlan` detects unique-violation by regex on `error.message`

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/plans.ts` (lines 174-182)

Problem: Race-guard around the partial UNIQUE index uses
`/unique|duplicate/i.test(err.message)`. This is fragile across Postgres locales,
driver versions (`postgres-js` vs `pg`), and any wrapping middleware that rewrites the
message. The companion `citations.ts` (line 294) does this correctly: it tests
`(err as { code?: string }).code === '23505'` against the SQLSTATE.

Fix: Replace the regex with the SQLSTATE check (`'23505'` for `unique_violation`).
Apply the same pattern wherever else the BC catches unique-violations (this is the only
site I found, but worth a grep).

---

### MAJOR: `getCredentialIdsCoveredBy` runs N+1 sequential queries inside a while loop

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/credentials.ts` (lines 139-167)

Problem: The transitive prereq walker uses BFS in app code: pop a credential id, run
`SELECT prereq_id FROM credential_prereq WHERE credential_id = ?`, push results, repeat.
For a CFI-A with PPL/IR/CPL/CFI lineage that's 4-5 sequential round-trips per call. The
function is called from `getCertsCoveredBy` (engine targeting + relevance cache), so it
ends up on the hot path of every engine run.

Fix: Replace the loop with a single recursive CTE:
`WITH RECURSIVE walk AS (SELECT credential_id, prereq_id FROM credential_prereq WHERE credential_id = $1 UNION SELECT cp.credential_id, cp.prereq_id FROM credential_prereq cp JOIN walk w ON cp.credential_id = w.prereq_id) SELECT DISTINCT prereq_id FROM walk`.
Drizzle exposes `sql` for this; one call replaces the BFS. The defensive visited-set
guard is then unnecessary because `UNION` (not `UNION ALL`) handles cycles. The
"hand-edited bad row" defence is preserved by the seed's `validateCredentialDag` plus
the DB CHECK; pulling the loop out of app code is the right tradeoff.

---

### MINOR: `snooze.ts` `getReplacementCard` uses magic string `'new'` and a quoted column literal

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/snooze.ts` (lines 383, 407)

Problem: Line 407 references `cardState.state` against the literal `'new'` instead of
`CARD_STATES.NEW`. Line 383 builds the due-at predicate via
`sql\`"due_at" <= ${now.toISOString()}\`` -- a bare quoted column name that bypasses
the schema reference. Both violate the project rule that states/enums route through
`@ab/constants` and SQL fragments use the typed table reference, not raw identifiers.

Fix: Change the `'new'` literal to `CARD_STATES.NEW` (already imported in the file, line
22). Rewrite the due-at predicate to `lte(cardState.dueAt, now)` -- importing `lte` is
free, the surrounding queries already use it.

---

### MINOR: `submitFeedback` allows comment-required signals to no-op silently when `comment` is whitespace-only

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/feedback.ts` (lines 49-53)

Problem: `comment = input.comment?.trim() ?? null`. The `if (!comment) throw ...` then
catches whitespace-only input -- correct. But the inserted row stores `comment = null`
even when the caller passed a non-required signal with a whitespace-only comment. That's
intentional for some surfaces, but the function silently coerces "user typed spaces" to
"no comment" without logging or returning a flag. Routes that show the comment in a UI
get an invisible round-trip mismatch.

Fix: Pick one of: (a) document the trim-to-null behavior in the JSDoc and have callers
treat it as "spaces are not a comment", or (b) preserve the original non-empty-after-
trim string and only null when truly empty/undefined. Option (a) is fine; just write it
down so route layer authors don't get surprised.

---

### MINOR: `citations/search.ts` reimplements `escapeLike` instead of using `@ab/db`'s helper

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/citations/search.ts` (lines 27-29)

Problem: Local `escapeLike` reimplements the LIKE-pattern escape that already exists as
`escapeLikePattern` in `@ab/db` and is imported by `cards.ts` and `scenarios.ts` for the
same purpose. Two implementations means two places to fix when the rule changes (e.g.,
adding `[` or `^` for an upgraded ILIKE syntax).

Fix: Drop the local `escapeLike`; import `escapeLikePattern` from `@ab/db` and call it
inside `buildTermPattern`.

---

### MINOR: `goals.ts` returns `Error('createGoal failed')` / `Error('addGoalSyllabus failed')` rather than typed errors

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/goals.ts` (lines 253, 258, 338, 394)

Problem: When `db.insert(...).returning()` yields zero rows, the BC throws a bare
`Error('X failed')`. Every other failure mode in the file uses a typed class
(`GoalNotFoundError`, `GoalNotOwnedError`, `GoalAlreadyPrimaryError`). The bare `Error`
breaks the discriminator pattern used by route handlers (`if (err instanceof
SomeError) ...`). Same pattern in `credentials.ts` line 480 (`upsertCredential failed`)
and `syllabi.ts` lines 502, 534 (`upsertSyllabus failed`, `upsertSyllabusNode failed`).

Fix: Add a `BcInsertReturnedNoRowError` (or similar) typed class once in the BC, and
throw it from each "RETURNING produced nothing" guard. Route handlers can map it to a
500 with a stable error code rather than parsing `Error.message`. Alternatively, if
the empty-array case is genuinely "should never happen" (post-FOR-UPDATE,
post-onConflict-do-update), use an assertion helper that throws a single named
internal-invariant error.

---

### MINOR: `createCitation` swallows the typed `unique_violation` for non-Postgres errors

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/citations/citations.ts` (lines 291-298)

Problem: The `try/catch` checks `err instanceof Error && 'code' in err && err.code === '23505'`
to surface `DuplicateCitationError`. That works for `postgres-js`. If the project ever
swaps drivers or wraps errors (transactional retries, OpenTelemetry instrumentation),
the wrap may swallow `code`. The fallback `throw err` then surfaces a raw 500 instead
of the typed BC error.

Fix: Add a defence-in-depth pre-read for the `(sourceType, sourceId, targetType,
targetId)` row right before the insert, throwing `DuplicateCitationError` from there.
Keep the SQLSTATE catch as the race-guard for the rare concurrent insert. This is the
same pattern `snooze.ts` uses for `CardAlreadyRemovedError` (lines 113-131).

---

### MINOR: `getNextScenarios` correlated subquery embeds `userId` directly into SQL fragment

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/scenarios.ts` (lines 531-539)

Problem: The `lastAttempt` correlated subquery uses
`AND ${sessionItemResult.userId} = ${userId}`. Drizzle's tagged template parameterizes
both sides, so this is safe -- but the surrounding code style consistently uses
`eq(sessionItemResult.userId, userId)` etc. Mixing raw SQL fragments with the query
builder makes audit harder; the next maintainer has to verify every embedded value is a
parameter, not an interpolation.

Fix: Where possible, lift the user-scoped predicates out of the SQL fragment and into a
correlated subquery built with the query builder. If that proves awkward (the
correlated `${outerScenarioId}` reference is the reason for the raw SQL), at minimum
add a comment block above the fragment confirming "all `${...}` references are Drizzle
SQL params, not string interpolations" so reviewers don't have to derive it.

---

### NIT: `engine.ts` uses `as unknown as EngineXCandidate` casts to discriminate union members

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/engine.ts` (lines 481, 485, 488, 505, 507, 508, 775)

Problem: `toSessionItem` and `identityKeyOfScored` discriminate by `scored.kind` then
cast `scored.candidate as unknown as EngineXCandidate` for each branch. Type-safe in
practice (the cast follows a kind-tag check) but verbose, and `as unknown as X` is the
double-cast smell that defeats `noUncheckedIndexedAccess`-style audits.

Fix: Make `Scored<T>` a discriminated union over `kind` + `candidate` so TypeScript
narrows automatically. One way: `type Scored = { kind: 'card', candidate: EngineCardCandidate, ... } | { kind: 'rep', candidate: EngineRepCandidate, ... } | { kind: 'node_start', candidate: EngineNodeCandidate, ... }`.
The branches in `toSessionItem` then drop the casts entirely.

---

### NIT: `sessions.ts` `getStreakDays` UTC-day cursor reconstruction is awkward

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/sessions.ts` (lines 1106-1124)

Problem: The decrement loop builds a `Date` from `${cursor}T00:00:00Z`, calls
`setUTCDate(getUTCDate() - 1)`, and slices the ISO string. Works -- but the `T00:00:00Z`
suffix on a string that came from `to_char(... AT TIME ZONE tz, 'YYYY-MM-DD')` couples
the JS-side calendar walk to a UTC representation that doesn't match the SQL bucketing.
Around DST transitions (2 AM PST clock spring) the cursor still increments correctly
because both ends use `YYYY-MM-DD` strings, not real timezone math, but the next reader
has to convince themselves of that.

Fix: Add a one-line comment confirming the walk is purely string-arithmetic over
`YYYY-MM-DD` keys produced by the SQL `AT TIME ZONE`, so the UTC-named JS `Date` calls
are an internal trick rather than a timezone correctness claim. Alternatively, pull
out a small helper `priorDayKey(cursor: string): string` that does the decrement
without instantiating a `Date`.

---

### NIT: `references.ts` insert-on-upsert defaults set `status: 'unread'` for `setNotes` even though notes don't change status

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/references.ts` (lines 705-730)

Problem: `setNotes` on a section that has never been opened inserts with
`status: HANDBOOK_READ_STATUSES.UNREAD`. The `onConflictDoUpdate.set` only mutates
`notesMd` and `updatedAt`, so an existing row's status is preserved -- correct -- but
the "first write" path side-effects `status='unread'` into a newly-created row. That's
fine (nothing changes from the absent state) but a future reader may read `setNotes`
and conclude it's a status-aware write.

Fix: Either (a) require the row to exist (`UPDATE ... WHERE ... RETURNING`, throw
`HandbookValidationError` when zero rows) -- matching `markAsReread`; or (b) leave the
behavior and add a one-line JSDoc noting "first-time setNotes also creates the row in
`unread` status -- by design, so an annotation persists even before the section is
opened."

---

### NIT: `validateCredentialDag` returns the unsorted-id list rather than the cycle when `findCycle` returns empty

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/credentials.ts` (lines 558-565)

Problem: `validateCredentialDag` falls back to passing the unsorted id list to
`CredentialPrereqCycleError` when `findCycle` returns `[]`. The error class is named
"cycle", but the payload may not be a cycle path. Callers handling the error see
`cycle: ['ppl', 'ir', 'cpl']` and assume it's a path; but if `findCycle` truly came back
empty, it's just "remaining unsorted nodes."

Fix: When `findCycle` returns empty, throw a different error (e.g.
`CredentialPrereqUnresolvedNodesError`) or augment `CredentialPrereqCycleError` with a
discriminated `kind: 'cycle' | 'unresolved'` field. Either way, callers can render an
accurate message.
