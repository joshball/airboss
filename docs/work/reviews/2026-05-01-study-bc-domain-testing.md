---
feature: study-bc-domain
category: testing
date: 2026-05-01
branch: main
counts:
  critical: 0
  major: 5
  minor: 9
  nit: 4
status: unread
review_status: done
---

## Status as of 2026-05-04

| Severity | Count | Closed | Open |
| -------- | ----- | ------ | ---- |
| critical | 0     | 0      | 0    |
| major    | 5     | 5      | 0    |
| minor    | 9     | 2      | 7    |
| nit      | 4     | 2      | 2    |

### MAJOR: Mastery integration tests carry state across describe blocks -- CLOSED

PR #546 (`libs/bc/study/src/mastery.test.ts:339-475`). `withFixture` builds isolated syllabus/area/leaves/nodes per `it` block; `seedAttachedCards` is called inside each `withFixture` body. Closed.

### MAJOR: Knowledge progress tests on NODE_A run-order coupled -- CLOSED

PR #546 (`libs/bc/study/src/knowledge.progress.test.ts`). Each test uses a fresh node id within `withFixture` style. Closed.

### MAJOR: Credentials byEvidenceKind continues from prior seed -- CLOSED

PR #546. Per-test isolation via `withFixture`. Closed.

### MAJOR: Engine-targeting primary-goal swap mutates shared user -- CLOSED

PR #546 (commit `f2aae9ad`). Swap test mints `SWAP_USER_ID`. Closed.

### MAJOR: sessions.test.ts covers one of ~10 functions -- CLOSED

PR #547 (`libs/bc/study/src/sessions.test.ts`). Coverage now spans `previewSession`, `commitSession`, `startSession`, `getSession`, `getSessions`, `getResumableSession`, `recordItemResult`, plus error-path regressions. 56 `it` blocks total. Closed.

### MINOR: engine.test.ts seed-difference asserts only equal length -- STILL OPEN

`libs/bc/study/src/engine.test.ts:228-246` unchanged. Trigger: roll into next engine-test polish PR; either stage inputs that must reorder under different seeds and assert the difference, or delete (the deterministic test above already covers seed -> output mapping).

### MINOR: knowledge.cert "stretch priority is excluded" tests percent bounds -- STILL OPEN

`libs/bc/study/src/knowledge.cert.test.ts:275-289` unchanged. Trigger: when stretch-vs-critical accounting changes, replace the soft `[0,1]` bound with a delta comparison between two seeded users.

### MINOR: plans.test.ts NoActivePlanError import-only test -- CLOSED

This audit pass deleted the `error classes exist` describe block at `libs/bc/study/src/plans.test.ts:228-232` and dropped the unused `NoActivePlanError` import. A future rename trips the compiler at import time. Closed.

### MINOR: plans.test.ts `getActivePlan` returns-null suite-order coupled -- STILL OPEN

`libs/bc/study/src/plans.test.ts:119` still depends on prior tests archiving their plans. Trigger: roll into the next plans-test polish; mint a fresh user for the null-plan test.

### MINOR: review-sessions jumpToIndex literal `'testhash'` -- STILL OPEN

`libs/bc/study/src/review-sessions.test.ts:126,194,217,298` still uses the sentinel literal. The `withFreshUser` helper exists alongside it but hasn't been pushed across these tests. Trigger: parameterise `seedSession` with a per-test deck hash in next review-sessions polish.

### MINOR: scenarios.test.ts shares TEST_USER_ID -- STILL OPEN

`libs/bc/study/src/scenarios.test.ts:45` still has top-level shared user. The filter tests at line 198+ accumulate scenarios under it. Trigger: convert filter tests to per-test users alongside `getNextScenarios` / `getRepAccuracy` etc. that already do.

### MINOR: saved-decks.test.ts shares TEST_USER_ID -- STILL OPEN

`libs/bc/study/src/saved-decks.test.ts:17` shared user across deck-hash tests. Trigger: drop to per-test users via `withFreshUser` parity.

### MINOR: library-by-cert smoke test asserts only non-empty -- STILL OPEN

`libs/bc/study/src/library-by-cert.test.ts:241-250` still depends on dev-seed weather row. Trigger: pin to fixed dev-seed slug + edition or drop the smoke test (the neighbouring assertion already covers the BC).

### MINOR: scenarios.test.ts bare `.rejects.toThrow()` -- STILL OPEN

`libs/bc/study/src/scenarios.test.ts:106,117,176` bare `.rejects.toThrow()`; line 130/143/156/169 already use regex. Trigger: small test-tightening pass; pin every reject to a specific class or message regex.

### MINOR: composite-fks `expected promise to reject` -- STILL OPEN

`libs/bc/study/src/composite-fks.schema.test.ts:103-116` and `scenario-option.schema.test.ts:99` helper unchanged. Trigger: small schema-test polish pass.

### NIT: calibration.test.ts dead `TEST_USER_ID` -- CLOSED

`libs/bc/study/src/calibration.test.ts:33-40`. The unused fixtures were removed; comment confirms "the previous shared TEST_USER_ID + beforeAll/afterAll fixtures were unused -- removed so the file no longer leaves dead seed". Closed.

### NIT: dashboard.test.ts dead `BASE_USER` -- CLOSED

`libs/bc/study/src/dashboard.test.ts:42-47`. Same shape as calibration. Closed.

### NIT: scenario-option.schema.test.ts redundant `toBeDefined()` -- STILL OPEN

`libs/bc/study/src/scenario-option.schema.test.ts:424` unchanged. Trigger: small schema-test polish pass alongside `composite-fks` cleanup.

### NIT: engine.test.ts MODE_WEIGHTS test -- STILL OPEN

`libs/bc/study/src/engine.test.ts:92-100` still in BC test file. Trigger: when `libs/constants/` grows its own test surface (not yet present), move the invariant alongside the constant.

### Final verdict

All 5 majors closed (PRs #546 + #547 + the test-isolation PRs leading up to them). 2 of 9 minors closed (this pass dropped the no-op plans test; calibration + dashboard dead seed nits closed in #468/#546). 7 minors + 2 nits remain, all small polish items with concrete triggers. `review_status` stays `done`.

## Summary

Reviewed every `*.test.ts` in `libs/bc/study/src/`. Two files in the locked scope (`handbooks.test.ts`, `handbooks-errata.test.ts`) do not exist; the surviving counterparts are `references.test.ts` and `reference-errata.test.ts`, which were not read.

Overall the suite is in strong shape: real DB integration where the SQL is the system under test, pure-function suites for math, no `vi.mock` over-stubbing, no `it.skip` / `it.todo`, no commented-out tests, and assertions are mostly tight (`toBeCloseTo`, full-object `toEqual`, FK error code + constraint name). The dominant pattern - per-test isolated users via `withFreshUser` (calibration, dashboard, parts of review-sessions) - is the right shape and should propagate to the suites that still share state.

The bulk of the findings are test-independence problems: several files share a top-level `TEST_USER_ID` across tests, and the test bodies have grown to the point where a later test reads state seeded by an earlier test (calibration's `seedRepAttempt` write surface, mastery's `NODE_K`/`NODE_S` carried between describe blocks, knowledge.progress's NODE_A walk, credentials' "byEvidenceKind" continues from prior seed, engine-targeting's primary-goal switch mutates the user used by other tests). One coverage gap stands out: `sessions.ts` exports ~10 functions; `sessions.test.ts` exercises one (`recordItemResult`). A handful of soft assertions and unused fixtures round out the rest.

## Issues

### MAJOR: Mastery integration tests carry state across describe blocks

File: `libs/bc/study/src/mastery.test.ts`
Problem: `getNodeEvidenceState -- integration` seeds cards on `NODE_K` and reps on `NODE_S` (lines 388-405). The next describe block `isLeafMastered -- integration` (lines 417+) then asserts based on that seed, with comments openly admitting it: "seedAttachedCards has already run from the prior test", "the prior test has already added 4 correct reps on NODE_S, so the leaf IS already mastered via scenario evidence". If vitest runs the file with isolation, these tests fail; if the order is shuffled, they fail. The test is only green because of a specific run order.
Fix: Seed each `it` block independently (move seeding inside or use a fresh `nodeId` per test), or put the dependent assertions in the same `it` so the contract is documented. Either approach removes the implicit run-order requirement.

### MAJOR: Knowledge progress tests on NODE_A are run-order coupled

File: `libs/bc/study/src/knowledge.progress.test.ts`
Problem: `recordPhaseVisited` describe block uses `NODE_A` across three tests. Test 2 (line 88) expects `lastPhase=PROBLEM` and assumes CONTEXT was already visited; test 3 (line 97) asserts `visitedPhases` contains CONTEXT, PROBLEM, AND DISCOVER -- the sum of every prior test's writes. Reorder the file and tests fail. There is no per-test cleanup, so once you run the file twice you cannot reason about state.
Fix: Use a fresh node per `it` block, or wrap each `it` in a transaction-scoped helper. Reset `knowledgeNodeProgress` for the user between tests if you want to keep one node id.

### MAJOR: Credentials "byEvidenceKind" depends on previous test's seeded leaves

File: `libs/bc/study/src/credentials.test.ts`
Problem: The "rolls up mastery when leaves + links exist" test (line 440) seeds `K1_ID` + `R1_ID` leaves and `kn_node_1` + `kn_node_2` knowledge nodes. The next test (line 615) "byEvidenceKind aggregate counts required + passing leaves per kind" begins with the comment "Continues from the previous test's seed". If the suite is re-ordered or the prior test fails, the second test asserts against a syllabus tree that has not been populated.
Fix: Move the seeded subtree into a shared `beforeAll` hook (or factor the seeding into a helper called from both tests) so each test stands on its own.

### MAJOR: Engine-targeting "primary goal switch" mutates a user shared by other tests

File: `libs/bc/study/src/engine-targeting.test.ts`
Problem: `getEngineTargeting -- primary goal switch` (line 388) calls `setPrimaryGoal(irGoal.id, GOAL_USER_ID)` against `GOAL_USER_ID`, which is also used by `source=goal when the user has a primary goal`, `depthPreference + sessionLength always come from the plan when present`, and `does not flag disagreement when goal and plan agree`. Vitest does not guarantee describe-block order; if the swap test happens to run first, the earlier tests see `focusDomains=[WEATHER]` rather than `[AIRSPACE]` and fail. The current pass is order-dependent.
Fix: Mint a separate user for the swap test (the per-suite `beforeAll` already builds users; add a `SWAP_USER_ID` and seed its goals locally) so the swap is self-contained and `GOAL_USER_ID` keeps its `[AIRSPACE]` invariant.

### MAJOR: sessions.test.ts exercises one function out of ten

File: `libs/bc/study/src/sessions.test.ts`
Problem: `sessions.ts` exports `previewSession`, `commitSession`, `startSession`, `getSession`, `getSessionItemResults`, `getSessionItemResult`, `getSessions`, `getResumableSession`, `recordItemResult`, plus `buildEnginePools`. The 217-line test file covers exactly one (the regression test for ticket B4 against `recordItemResult`). The rest of the BC has no unit-level coverage in this layer; a future change to `commitSession`'s slot pre-insert logic, `getResumableSession`'s status filter, or `previewSession`'s plan resolution will pass `bun run check` cleanly.
Fix: Author tests for at least the `commitSession` -> `recordItemResult` round trip, the `previewSession` plan/empty-pool path, and `getResumableSession`'s status + recency rules. The fixture builders in this file already do most of the work; the gap is just `it` blocks.

### MINOR: engine.test.ts seed-difference test asserts only equal length

File: `libs/bc/study/src/engine.test.ts`
Problem: `same pool + different seed can reorder (not identical)` (line 228) does not assert that the order actually differs. The comment notes "Not asserting inequality -- pool size could collapse to identical picks", and the assertions that remain (`aIds.length === bIds.length`, `length > 0`) are satisfied by the *same* output. The test cannot fail if the engine ignores the seed entirely.
Fix: Either remove the test (it's covered by the determinism test above) or stage the inputs so different seeds *must* reorder, then assert `aIds`/`bIds` differ at some index.

### MINOR: knowledge.cert "stretch priority is excluded" tests percent bounds, not exclusion

File: `libs/bc/study/src/knowledge.cert.test.ts`
Problem: The test at line 275 is named "stretch priority is excluded from progress" but asserts only that `row.percent` is finite and in `[0, 1]`. The comment admits this: "We can't easily isolate 'this specific node is excluded' without more scaffolding". The exclusion is the load-bearing claim and it is not actually tested here.
Fix: Compare totals between two seeded users (one with stretch nodes, one without), or compute the expected total without the stretch nodes and assert equality, so a regression that includes stretch in `getCertProgress` actually fails.

### MINOR: plans.test.ts NoActivePlanError test is import-only

File: `libs/bc/study/src/plans.test.ts`
Problem: Line 229 -- `expect(NoActivePlanError).toBeDefined()`. The class is imported and asserted to exist; the test never throws or catches it. The file comment even says "kept here as a sanity import so a future rename doesn't silently drop it" -- but a rename would break the import statement at compile time, not run time. The test does nothing.
Fix: Drop the test, or stage a real call path that throws `NoActivePlanError` and assert against the thrown instance.

### MINOR: plans.test.ts `getActivePlan` returns-null test depends on suite order

File: `libs/bc/study/src/plans.test.ts`
Problem: `getActivePlan` describe block test "returns null when the user has no active plan" (line 119) only passes if every prior `createPlan` test in the file already archived its plan. If a future `createPlan` test forgets the trailing `archivePlan(p.id, ...)` call, this test silently fails as a side effect, masking the bug.
Fix: Use a fresh user for this test (`generateAuthId()` + insert + cleanup) so it asserts the null-plan path directly.

### MINOR: review-sessions jumpToIndex tests share state via 'testhash'

File: `libs/bc/study/src/review-sessions.test.ts`
Problem: Tests 140-232 all create sessions with literal `deckHash: 'testhash'` against the shared `TEST_USER_ID`. The `findResumableSessionByDeckHash` describe block uses `computeDeckHash(...)` so it does not collide, but anyone refactoring the literal hash to a computed one would unknowingly share state across tests.
Fix: Either parameterise `seedSession` with a per-test deck hash, or document that `'testhash'` is a sentinel and forbid it from leaking into the resumable-session block.

### MINOR: scenarios.test.ts filter tests share TEST_USER_ID across describe blocks

File: `libs/bc/study/src/scenarios.test.ts`
Problem: The filter tests at line 198+ accumulate scenarios under the shared `TEST_USER_ID`, then assert via `.some(s => s.id === sc.id)`. The pattern works because each test only checks for its own id, but the user grows unbounded across the file. A future test that asserts `getScenarios(...).length === N` will collide.
Fix: Move the filter tests onto fresh users (the file already does this for `getNextScenarios`, `getRepAccuracy`, etc.). Mixed conventions in the same file invite drift.

### MINOR: saved-decks.test.ts shares TEST_USER_ID across deck-hash tests

File: `libs/bc/study/src/saved-decks.test.ts`
Problem: Every test uses `TEST_USER_ID` and unique deck hashes. Works today (assertions are scoped to specific hashes), but the user accumulates `savedDeck` rows across tests. `listSavedDecks` returns them all; the `find(s => s.deckHash === hash)` filter is the only thing keeping the assertions clean.
Fix: Either drop to per-test users (as `review-sessions.test.ts -> listSavedDecks` already does via `withFreshUser`) or assert the deck count as a delta to make the leak surface.

### MINOR: library-by-cert.test.ts smoke test asserts only non-empty

File: `libs/bc/study/src/library-by-cert.test.ts`
Problem: Line 241 -- `weather topic surfaces seeded weather references when present (smoke)` asserts `slugs.length > 0`. It depends on the dev seed having at least one weather reference. If the dev DB is rebuilt without the weather seed, the test fails for an environmental reason, not a code reason. The neighbouring test (line 226) already proves the BC works on the suite's own seeded weather row, so the smoke test adds little signal.
Fix: Drop the smoke test, or pin the assertion to a fixed dev-seed slug + edition (and document it as a dev-seed dependency).

### MINOR: scenarios.test.ts uses `.rejects.toThrow()` without a message regex

File: `libs/bc/study/src/scenarios.test.ts`
Problem: Several validation tests use bare `.rejects.toThrow()` (lines 99-118). Any rejection passes -- a different error class, a typo in the BC, an internal panic. The tests that *do* match a message regex (line 130 `/exactly one option must be marked correct/`, line 156 `/why not/i`) are stronger.
Fix: Apply the regex pattern uniformly. For each `.rejects.toThrow()`, pin to the specific error class (e.g. `ZodError`, the named BC error) or to a stable substring of the message.

### MINOR: composite-fks.schema "no expected promise" path is unreachable

File: `libs/bc/study/src/composite-fks.schema.test.ts`, also `scenario-option.schema.test.ts`
Problem: `captureError` (line 97) ends with `throw new Error('expected promise to reject, but it resolved');`. If the assertion never trips, the test fails downstream on `expect(err.code).toBe(...)` because `err` is empty -- but the failure message is "expected '23503' to be undefined", not the helpful "expected promise to reject". Today's failures are still caught, but the diagnostic is worse than a direct `await expect(...).rejects.toThrow()` plus a follow-up FK-name check.
Fix: Make the helper return `{ code, constraint }` and let the test re-shape the assertion to `expect(...).rejects.toThrowError(/sqlstate-23503|...constraint-name.../)`. Optional - the tests pass; the readability is the only loss.

### NIT: calibration.test.ts seeds a TEST_USER_ID that no test reads

File: `libs/bc/study/src/calibration.test.ts`
Problem: Lines 33-49 create `TEST_USER_ID` in `beforeAll`; lines 56-63 clean it up in `afterAll`. Every test uses `withFreshUser` instead. The user is dead seed.
Fix: Drop the `TEST_USER_ID` declaration + the `beforeAll`/`afterAll` rows. The `withFreshUser` helper is the load-bearing fixture.

### NIT: dashboard.test.ts BASE_USER is unused

File: `libs/bc/study/src/dashboard.test.ts`
Problem: Same shape as calibration -- `BASE_USER` is created in `beforeAll` (line 43) and torn down in `afterAll` (lines 66-73), but every test calls `isolatedUser(...)` and never reads it.
Fix: Remove `BASE_USER` and the corresponding hooks.

### NIT: scenario-option.schema.test.ts uses bare `expect.toBeDefined()` for FK-set-null assertions

File: `libs/bc/study/src/scenario-option.schema.test.ts`
Problem: `expect(survivingSir).toBeDefined()` (line 424) is followed by `expect(survivingSir?.scenarioId).toBeNull()`. The `toBeDefined` is redundant -- the `?.` dereference would be `undefined?.scenarioId === undefined`, which is not `null`, so the next line covers the existence check.
Fix: Drop `toBeDefined()`; rely on the property assertions.

### NIT: engine.test.ts MODE_WEIGHTS test is a constants invariant, not a BC test

File: `libs/bc/study/src/engine.test.ts`
Problem: Lines 92-100 assert `MODE_WEIGHTS[m]` rows sum to 1.0. The constants live in `libs/constants` and are never mutated by the engine; the invariant belongs alongside `MODE_WEIGHTS` itself or in `libs/constants` tests.
Fix: Move to a constants-level test (or leave it -- the cost is one cheap iteration, but the boundary is wrong).
