---
feature: hangar-cluster
category: testing
date: 2026-05-02
branch: main
status: unread
review_status: done
counts:
  critical: 1
  major: 9
  minor: 9
  nit: 4
  total: 23
---

## Summary

Hangar cluster test coverage is uneven. Pure-helper modules (schemas, form
validators, drift / conflict detection, sync codec, audit cursor, upload
helpers, edition stub) are well-covered with strong assertions. The
admin-write surface (`user-writes.test.ts`) covers happy paths and guards but
under-tests the "better-auth API throws" path for ban / unban / revoke and
never exercises the audit-on-success ordering when the better-auth call
mutates the DB but our snapshot read fails. The largest gaps are
infrastructural: `libs/hangar-jobs/` ships zero unit tests for the worker
loop (claim race, concurrency cap, target-id mutex, no-handler path,
cancellation, orphan recovery). The `/sources/[id]/upload` form action has
no direct test - the path-traversal guard, 413 limit, the active-job 409
gate, and the "enqueue throws -> tmpdir cleaned up" finally block are all
unproven. There is no Playwright e2e for any hangar route. Several preview
component tests read source as text and grep for substrings, which is a
no-op as soon as the prod code is refactored to extract a helper. The
audit-queries DB suite over-relies on `.filter(insertedAuditIds.includes)`
to isolate from concurrent writers, which means the suite still passes if
the WHERE clause is broken (because everything is filtered down to the
seeded ids client-side after the query).

## Issues

### CRITICAL: audit-queries integration tests pass even if the WHERE clause is broken

**File:** `libs/bc/hangar/src/audit-queries.test.ts:243-349`

**Problem:** Every assertion in the live-DB block uses
`page.rows.filter((r) => insertedAuditIds.includes(r.id))` and then asserts
length / shape on that filtered subset. If `buildAuditWhere` regressed and
returned every row in the table, the suite would still pass for any
fixture-id assertion, because the test post-filters client-side to only the
fixture rows. Concretely: the "filters by exact actor id" test asserts
`ours.every((r) => r.actorId === ACTOR_A_ID)` after slicing to ours, but a
broken filter that returns rows for both actors would still pass that
assertion (the slice is by id, not by actor). Same for op-filter,
target-filter, time-window. The test name promises filter coverage, the
test mechanics don't deliver it.

**Fix:** For each filter test, also assert `page.rows.length === ours.length`
(or similar) so a regression that lets non-fixture rows through fails. Or
seed enough non-matching fixture rows under the same `targetType` /
`targetId` (different actor / op) and assert those are excluded by id from
the result, not from the post-filter.

### MAJOR: libs/hangar-jobs has zero test coverage

**File:** `libs/hangar-jobs/src/worker.ts`, `libs/hangar-jobs/src/enqueue.ts`

**Problem:** `libs/hangar-jobs/` ships `worker.ts` (claim race, concurrency
cap, target-id mutex, no-handler failure, cancellation poll, orphan
recovery, finally-block running-set cleanup) and `enqueue.ts`
(`recoverOrphanedRunning`, `appendJobLog` with server-side
`MAX(seq)+1`, `listJobs` filter composition, `writeJobLogRow`) - and
none of it has a unit or integration test. The only tests anywhere
exercise `enqueueJob` + `appendJobLog` + `readJobLog` indirectly via
`libs/bc/hangar/src/jobs.test.ts`. The worker's load-bearing
behaviors (no double-claim under concurrency, no two same-target jobs
running, no-handler -> FAILED + audit, orphan recovery emits
"recovered from worker restart" log) are unverified.

**Fix:** Add `libs/hangar-jobs/src/worker.test.ts` with seeded
fixtures + an in-memory handler map covering: (a) two jobs with the
same `targetId` are serialised, (b) jobs with different `targetId`
run in parallel up to `concurrency`, (c) unknown `kind` -> FAILED
status + audit row, (d) cancellation via `isCancelled()` is observed
by the handler, (e) `recoverOrphanedRunning` flips RUNNING -> QUEUED
and writes an event log per orphan, (f) the claim race - two
concurrent `claimNext` calls only succeed once.

### MAJOR: upload form action has no direct test coverage

**File:** `apps/hangar/src/routes/(app)/sources/[id]/upload/+page.server.ts`

**Problem:** This is the admin-facing upload surface for source bytes.
The action enforces (a) presence + non-empty file, (b)
`MAX_UPLOAD_BYTES` cap with a 413 response, (c) source exists +
not soft-deleted, (d) no active job for this target (409),
(e) path-traversal defense by writing to a fixed `upload.bin`
filename, (f) tmpdir cleanup in `finally` when `enqueueJob`
throws and no redirect was issued. None of these branches has
a test. Per the project rules ("upload-handler edge cases" called
out in the rubric), this is the most important untested surface
in the cluster.

**Fix:** Add a unit test for the action handler (extract pure
logic if needed) covering: empty file -> 400, oversize -> 413,
missing source -> 404, deleted source -> 404, active job -> 409,
enqueue throws -> 500 + tmpdir removed, happy path -> redirect to
job-detail with the right id and tempPath. The
path-traversal-fixed-filename behavior should be asserted via the
shape of the payload passed to `enqueueJob`.

### MAJOR: BetterAuthApiError wrap path only tested for setUserRole

**File:** `libs/bc/hangar/src/user-writes.test.ts:206-229`

**Problem:** `setUserRole` has a "wraps better-auth thrown error
as `BetterAuthApiError`" test, but `banUserAction`,
`unbanUserAction`, `revokeUserSession`, and
`revokeAllUserSessions` all do the same try/catch + wrap and
none of them have a test for the API-throws path. If a future
edit removes the `withWrappedAdminError` wrapper from one of
those four call sites, the suite stays green. This is the
admin write surface the project specifically called out as
needing close attention.

**Fix:** Add four "wraps better-auth thrown error" tests
mirroring the `setUserRole` shape, asserting (a) the rejection
is `instanceof BetterAuthApiError`, (b) `auditWriteMock` was
NOT called (so we don't audit a write that didn't happen).

### MAJOR: ban / unban tests don't assert audit ordering on api-throws-after-write

**File:** `libs/bc/hangar/src/user-writes.test.ts:232-339`

**Problem:** `readBanSnapshot` is called twice (before + after).
If the better-auth call succeeds but the snapshot read after
throws (DB blip, FK race), the audit row should not be written
or should be written with a clear failure marker. None of
the tests cover that interleaving. Same for `unbanUserAction`
and the post-snapshot in role assignment. Since
`readBanSnapshot` throws `BetterAuthApiError` on missing rows
(line 252 of prod), this is a real path.

**Fix:** Add tests where `drizzleResults` for the after-snapshot
returns `[]` (user disappeared mid-flight) and assert: (a)
rejection is `BetterAuthApiError`, (b) `auditWriteMock` was
not called (current behavior). If the spec wants a failure
audit, change behavior + add the test.

### MAJOR: cancellation handoff in source-jobs is plumbed but never exercised

**File:** `libs/bc/hangar/src/source-jobs.test.ts`

**Problem:** `fakeContext` accepts an `isCancelled` override and
the prod `nodeSpawnRunner` polls it on a 500 ms interval to
SIGTERM the child, but no test passes `isCancelled: async () =>
true` and asserts the runner / handler bails or that SIGTERM
would be issued. Cancellation is one of the three documented
scenarios in the file header ("Exercises the payload plumbing,
exit-code-error path, output streaming, and cancellation handoff
to the runner") but the cancellation case is missing.

**Fix:** Add a test that wires a runner which calls
`isCancelled` once per polled iteration, set the fake context
to return `true` after the first poll, and assert the runner's
returned exit code / outcome reflects cancellation.

### MAJOR: dashboard countLiveSources test does not actually verify the soft-delete filter

**File:** `libs/bc/hangar/src/dashboard-queries.test.ts:103-114`

**Problem:** The test inserts 1 live + 1 soft-deleted source and
asserts `count >= 1`. That's true even if the SQL counts both rows
(because >=1 is always satisfied). The test relies on `listed.map`
to assert the deleted id is absent from the list, which proves
`listLiveSources` filters - but the `count` check does not prove
`countLiveSources` filters. The test's stated goal ("counts only
live sources and excludes soft-deleted rows") is not verified for
the count.

**Fix:** Capture `before = await countLiveSources()`; then insert
1 live + 1 deleted; then assert `after - before === 1` (or under
parallel-test conditions, `after - before >= 1` AND
`afterIncludingDeleted - before === 2`). Or insert only the
deleted row first and assert count didn't change.

### MAJOR: searchActorIds cap test is non-discriminating

**File:** `libs/bc/hangar/src/audit-queries.test.ts:412-416`

**Problem:** `expect(hits.length).toBeLessThanOrEqual(1)` is true
for 0 hits, 1 hit, and is the only assertion. If the cap argument
was wired to a no-op and the function returned 0 results, the
test would pass. If the cap was wired to 1 but matched the wrong
fixtures, it would also pass.

**Fix:** Seed >=2 actors that match the search term, assert
`hits.length === 1` exactly when cap is 1, and additionally assert
that the returned hit is one of the seeded ids (so a return of
zero rows fails). Also assert that calling with cap 5 returns
both fixture actors.

### MAJOR: preview component tests assert source-string presence, not behavior

**File:** `apps/hangar/src/lib/components/preview/preview-components.test.ts`

**Problem:** Six describe blocks all read the `.svelte` file as
text and `expect(source).toContain('sourceId')` -- treating the
component source string as the test surface. This passes any
time the literal string appears anywhere in the file (script
imports, comments, type names). It will silently pass when:
(a) a prop is renamed and a comment retains the old name, (b)
the prop is declared but the template never reads it, (c) the
template uses `<img>` but the `src=` is wrong, (d) the
`ROUTES.HANGAR_SOURCE_THUMBNAIL` import is removed but a
JSDoc `@example` line still references it. The test header
acknowledges this ("the contract above is what keeps these
components honest"), but the contract is too loose to keep
them honest.

**Fix:** Either (a) wire the Svelte vitest plugin and write
real render tests (the file header notes this is "separate
infra work"; the work-package tests/test-plan should escalate
this), or (b) tighten the assertions to look for prop
declarations (`$props<{ sourceId:`) and template structures
(grep within `extractTemplate(source)` only, not the full
file) so script comments don't satisfy them.

### MAJOR: theme-token test walks `process.cwd()` and silently no-ops if dir is wrong

**File:** `apps/hangar/src/lib/server/theme-tokens.test.ts:12,40-55`

**Problem:** `const HANGAR_SRC = resolve(process.cwd(), 'apps/hangar/src')`
- if vitest is invoked from inside the hangar app (cwd =
`apps/hangar`), the path resolves to `apps/hangar/apps/hangar/src`
which doesn't exist; `walk` will throw `ENOENT` (good) - but if
someone changes the cwd guard to a `try` that swallows, the test
silently passes with zero `.svelte` files inspected. There's no
sanity assertion that any `.svelte` files were actually visited.

**Fix:** Track a `filesScanned` counter inside the `walk` loop and
assert `expect(filesScanned).toBeGreaterThan(0)`. Same fix for the
sibling `lib/components/theme-tokens.test.ts` (which iterates a
fixed FILE list - assert each path exists / each file has a non-
empty extracted `<style>` block, otherwise a relocated file
silently makes the test trivially pass).

### MINOR: jobs-queries listRunningJobs leaks rows from peer fixtures

**File:** `libs/bc/hangar/src/jobs-queries.test.ts:215-237`

**Problem:** `listRunningJobs()` returns every running row in the
DB. The test asserts our running id is included and the queued /
complete ids are excluded - good - but does not bound the return
size or assert `running.every((r) => r.actorId === TEST_USER_ID
|| ...)`. If the worker writes an unrelated RUNNING row during
the test, the test still passes. That's fine for green builds,
but conversely the test would not catch a regression where
`listRunningJobs` returned, say, every QUEUED row instead -
because the test only asserts contains-running-id /
not-contains-queued-id, not the count.

**Fix:** Filter the result to `r.actorId === TEST_USER_ID` and
assert `length === 1` on the filtered set, plus the contains /
not-contains checks.

### MINOR: time-window filter test on audit-queries asserts ">=2" not exact count

**File:** `libs/bc/hangar/src/audit-queries.test.ts:294-314`

**Problem:** `expect(ours.length).toBeGreaterThanOrEqual(2)` -
the spec says rows 5 + 6 fall inside the window. If a regression
let in row 4 too, the test passes. Fixture timestamps are
deterministic; the assertion should be an exact match.

**Fix:** `expect(ours.length).toBe(2)` and assert the two ids
are `insertedAuditIds[4]` and `insertedAuditIds[5]`.

### MINOR: detect-conflict test missing source-revs-current-AND-references-current

**File:** `libs/hangar-sync/src/detect-conflict.test.ts`

**Problem:** Tests cover ref-only conflict, src-only conflict,
no-baseline, equal-revs, new-rows. There is no test for the
mixed case: refs equal + sources advanced (one entry, kind=
source) AND refs advanced + sources equal (one entry, kind=
reference). The asymmetric "src-only" test is close, but it
seeds zero refs in `referenceRevs` - it doesn't prove the
function correctly skips a current ref while flagging a
current source. A small ordering / accumulator bug would
slip past.

**Fix:** Add a test with both `referenceRevs` and `sourceRevs`
populated, baseline only advances on one side, assert
`entries.length === 1` and the kind matches.

### MINOR: emit-aviation-ts round-trip drops to length-equality on full set

**File:** `libs/hangar-sync/src/emit-aviation-ts.test.ts:77-99`

**Problem:** The full-fixture round-trip uses
`AVIATION_REFERENCES.slice(0, 10)` for the dynamic-import test
but the byte-identity test uses the full set. A semantic round-
trip on the full set isn't proven. If the emitter regresses on
a particular tag shape (e.g. `verbatim` blocks beyond the first
10 references), byte-identity catches the *output* drift but
not whether the *consumed* TypeScript actually parses to the
right `Reference[]`.

**Fix:** Either (a) round-trip the full set (the test header
admits this is a speed concern; a 10-second test on full
fixtures is fine for CI), or (b) curate the slice to include
each tag-shape variant rather than the first 10.

### MINOR: source-fetch happy-path missing assertion that DB patch was applied to row.id

**File:** `libs/bc/hangar/src/source-fetch.test.ts:115-185`

**Problem:** `expect(dbPatches[0]?.patch.checksum).toBe(...)` and
`expect(dbPatches[0]?.patch.version).toBe(...)` - the test never
asserts `dbPatches[0]?.id === row.id`. If the producer accidentally
called `dbUpdate('wrong-id', patch)`, the test still passes.

**Fix:** Add `expect(dbPatches[0]?.id).toBe('sectional-denver')`.

### MINOR: registry test seeds bauthUser then never asserts updatedBy on rows

**File:** `libs/bc/hangar/src/registry.test.ts:111-137`

**Problem:** The "creates" test asserts `row.updatedBy === TEST_USER_ID`
but the "updates" test does not - so a regression where update silently
nulls or hardcodes updatedBy slips through.

**Fix:** Add `expect(updated.updatedBy).toBe(TEST_USER_ID)` in the
update + soft-delete tests.

### MINOR: revokeAllUserSessions test doesn't verify the order of "list sessions" vs "api.revokeUserSessions"

**File:** `libs/bc/hangar/src/user-writes.test.ts:394-465`

**Problem:** `listRecentUserSessions` is called *before*
`api.revokeUserSessions` so the count reflects pre-revoke state.
If a regression flipped the order (list after revoke -> count
always 0), `revokedCount=0` would silently be the new norm. The
"reports 0" branch test (line 447) asserts 0 and would still pass.
The "reports 2" branch (line 395) catches it but only because
the mock returns 2; a spy that asserts call ordering would catch
it more sharply.

**Fix:** Use `mockOrder` / track call order and assert
`listRecentUserSessions` was called before `api.revokeUserSessions`.

### MINOR: source-jobs makeBuildHandler / makeValidateHandler tests have one assertion only

**File:** `libs/bc/hangar/src/source-jobs.test.ts:149-187`

**Problem:** Build / validate happy-path tests assert a result
shape match but do not assert (a) progress reporting, (b) event
log emission ("started" / "done"), (c) audit finalization. The
fetch / extract / diff handlers exercise these via the success
runner; build / validate skip them.

**Fix:** Add the same progress + event assertions to keep the
five handlers symmetric, especially since `finalizeAudit` is
called by all of them and a regression in one is invisible.

### MINOR: parse-csv test missing pathological inputs

**File:** `apps/hangar/src/lib/components/preview/parse-csv.test.ts`

**Problem:** Coverage is solid for the happy paths. Missing: (a)
single-column rows ("a\n1\n2\n"), (b) only header no rows,
(c) row with fewer cells than header, (d) row with more cells
than header (does it truncate, pad, or error?), (e) lone CR,
(f) BOM (﻿) at start of header. Production data from
FAA exports tends to ship with BOMs.

**Fix:** Add cases for jagged rows + BOM. Document the chosen
behavior (truncate vs pad) in the test name.

### MINOR: jobs.test.ts duplicate-poll test asserts via Set comparison, not seq monotonicity

**File:** `libs/bc/hangar/src/jobs.test.ts:101-120`

**Problem:** `expect(new Set(firstLines).size === firstLines.length)`
proves no two lines are identical (a, b vs a, a). It does not
prove `seq` is monotonic across the returned rows. A regression
where seq is constant or decreasing would still pass this test
because the lines themselves are unique.

**Fix:** Assert `first[0].seq < first[1].seq` (sorted by seq is
the contract).

### NIT: drizzleResults shim global mutation across tests is implicit-coupling-prone

**File:** `libs/bc/hangar/src/user-writes.test.ts:24-39,82-83`

**Problem:** The `drizzleResults` array is module-scoped. The
`afterEach` asserts it's empty (good), but a test that forgets
to seed enough rows (e.g. ban paths need 2 push calls) will
hand the second call an empty array, hide an unintended
default, and only fail at the `afterEach` length assertion -
which can mask the actual broken expectation. A queue with
identifying labels would be clearer.

**Fix:** Replace the array with a per-test object map keyed
by call-purpose name (e.g. `{ banSnapshotBefore, banSnapshotAfter }`)
or wrap chain creation in a factory that requires a label.

### NIT: source-form binary-visual tests omit cadence-too-large boundary

**File:** `libs/bc/hangar/src/source-form.test.ts:125-131`

**Problem:** Cadence-zero is rejected, blank is allowed, but no
upper bound is asserted. If the schema accepts cadence_days =
1_000_000 silently, a typo could schedule a fetcher to never
run.

**Fix:** Either confirm there's no upper bound (drop this nit) or
add a boundary test for the documented cap.

### NIT: window.test.ts treats unknown / unparseable inputs identically without distinguishing

**File:** `apps/hangar/src/routes/(app)/admin/audit/window.test.ts:73-87`

**Problem:** Both "unknown window" and "unparseable from/to" tests
fall back to default. The function's spec is silent on whether the
URL params should be sanitised back into the redirect (so a user
with `?window=fortnight` doesn't keep that bad value forever).
If product expects a redirect-to-canonical-URL behavior, the
test doesn't catch its absence.

**Fix:** Confirm spec - if redirect-on-bad-input is in scope, add
the assertion; if not, drop this nit.

### NIT: audit cursor decode tests skip a future-edge case

**File:** `libs/bc/hangar/src/audit-queries.test.ts:60-81`

**Problem:** No test for a cursor with multiple `::` separators
(`'2026::aud_x::extra'`) or for an id with leading/trailing
whitespace. The decoder uses `indexOf('::')` semantics that
should be tested at boundaries.

**Fix:** Add tests for `'a::b::c'` (does it use first or last
delimiter?) and for `'  2026-04-30T00:00:00Z  ::aud_x'` (whitespace
tolerance).

## Status as of 2026-05-04

| Finding | Verdict | Closure |
| ------- | ------- | ------- |
| CRITICAL: audit-queries WHERE-clause filter coverage | CLOSED | PR #463 -- per-filter `expect(ours).toHaveLength(N)` (`audit-queries.test.ts:301-389`) |
| MAJOR: hangar-jobs zero test coverage | CLOSED | PR #463 -- `worker.test.ts` + `enqueue.test.ts` (claim race, concurrency cap, target-id mutex, no-handler, cancellation, orphan recovery) |
| MAJOR: upload form action no direct test | CLOSED | PR #463 -- `upload-action.test.ts` covers empty/oversize/missing/deleted/active-job/enqueue-throws/happy paths |
| MAJOR: BetterAuthApiError wrap only on setUserRole | CLOSED | PR #463 -- describe block at `user-writes.test.ts:236-330` covers ban/unban/setRole/revoke/revokeAll |
| MAJOR: ban/unban audit ordering on api-throws-after-write | CLOSED | PR #463 -- after-snapshot-fail tests added (`user-writes.test.ts:329-394`) |
| MAJOR: cancellation handoff in source-jobs not exercised | CLOSED | PR #463 -- cancellation test added in source-jobs.test.ts |
| MAJOR: countLiveSources doesn't verify soft-delete filter | CLOSED | This audit -- now asserts `after - before === 1` not `>= 1` |
| MAJOR: searchActorIds cap test non-discriminating | CLOSED | This audit -- exact length + fixture-id pin + cap-5 widen check |
| MAJOR: preview component tests grep source string | CLOSED | PR #463 -- replaced with prop-shape + template-extract checks |
| MAJOR: theme-token test silent no-op risk | CLOSED | PR #463 -- `filesScanned > 0` guard |
| MINOR: jobs-queries listRunningJobs leaks peer-fixture rows | CLOSED | This audit -- pinned per-fixture count |
| MINOR: time-window filter `>=2` lax assertion | CLOSED | This audit -- exact length + id pinning |
| MINOR: detect-conflict mixed-case test | CLOSED | PR #452 -- mixed refs+sources advanced cases |
| MINOR: emit-aviation-ts full-set round-trip | CLOSED | PR #463 -- full-set semantic round-trip |
| MINOR: source-fetch missing dbPatches[0].id | CLOSED | This audit -- pin id assertion |
| MINOR: registry update test missing updatedBy | CLOSED | This audit -- assertions added on update + softDelete |
| MINOR: revokeAllUserSessions order assertion | CLOSED | PR #463 -- explicit call-order assertion |
| MINOR: source-jobs build/validate single-assertion | CLOSED | PR #463 -- progress + event log assertions added |
| MINOR: parse-csv pathological inputs | CLOSED | PR #463 -- BOM + jagged-row tests |
| MINOR: jobs.test.ts seq monotonicity | CLOSED | This audit -- `seqA < seqB` assertion added |
| NIT: drizzleResults shim coupling | CLOSED | PR #463 -- factory-with-label pattern |
| NIT: source-form cadence upper bound | CLOSED | PR #463 -- documented as no-cap-by-design |
| NIT: window.test.ts unknown-vs-unparseable | CLOSED | PR #463 -- spec confirmed; no redirect-to-canonical, behavior documented |
| NIT: audit cursor decode boundary cases | CLOSED | PR #463 -- multi-`::` and whitespace tolerance tests |

Total: 23 closed / 0 open. `review_status` flipped to `done`.
