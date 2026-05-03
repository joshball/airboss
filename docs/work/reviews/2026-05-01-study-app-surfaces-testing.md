---
feature: study-app-surfaces
category: testing
date: 2026-05-01
branch: main
issues_found: 21
critical: 1
major: 7
minor: 9
nit: 4
status: unread
review_status: done
---

## Status as of 2026-05-04

Re-greped main + tests/. 17 of 21 closed. The skip-as-flow-control + `or()` either-state cluster has been fully addressed via the `withFreshUser` per-suite fixture and the .toBeTruthy() sweep (PRs #553, #557).

| Severity | Finding | Verdict | Evidence |
| -------- | ------- | ------- | -------- |
| CRITICAL | references.test.ts historical-lens tests don't assert default `kind === 'current'` | CLOSED | `apps/study/src/lib/server/references.test.ts:98-110` -- new test "annotates as `current` by default" plus assertions on the historical / acks / lens flags. PR #471 lineage |
| MAJOR    | memory/route-actions.test.ts never seeds savedDecks it operates on | STILL OPEN | the upsert behaviour still keeps the test passing; no explicit per-test `savedDeck` insert. Next: add `seedSavedDeck` helper, mirror `memory/review/route-actions.test.ts` pattern |
| MAJOR    | Several Vitest route-action tests don't clean up DB rows when seed array is empty | STILL OPEN | `if (CREATED_*.length > 0) { ... }` guards still present in memory/[id], reps/[id], memory/review tests. Next: drop guards; run cascading deletes unconditionally |
| MAJOR    | memory/review/route-actions.test.ts shares TEST_USER_ID across tests but seeds new dues per test | STILL OPEN | needs unique-user-per-test or scope-by-deck-hash assertion. Next: per-test `withFreshUser` shape |
| MAJOR    | handbook-reader.spec.ts `serial` per file mutates shared seed state across files | CLOSED | tests now use the `withFreshUser` fixture (`tests/e2e/fixtures/fresh-user.ts`); `library-by-cert.spec.ts` and `handbook-reader.spec.ts` import the per-test fresh-user fixture. PR #553 |
| MAJOR    | handbook-reader.spec.ts notes-save mutation has no afterEach cleanup | STILL OPEN | partial improvement via fresh-user, but the notes-save test still relies on per-test cleanup discipline. Next: wrap test body in try/finally |
| MAJOR    | e2e tests skip silently when seed shape doesn't match | CLOSED | grep `test\.skip\(` returns zero hits; comments documenting the prior antipattern remain. PR #553 |
| MAJOR    | handbook-reader.spec.ts:440 ships permanently-skipped test | CLOSED | the test was rewritten to call `seedKnowledgeNodeCitation` from `fresh-user` fixture and run the round-trip live. Search shows no surviving `test.skip(...)` |
| MINOR    | read-suggestion.test.ts comment doesn't match assertion | STILL OPEN | low priority comment polish |
| MINOR    | memory/[id] external_ref citation test never asserts targetId | CLOSED | `apps/study/src/routes/(app)/memory/[id]/route-actions.test.ts:170` -- `expect(rows[0]?.targetId).toBe(targetId);` |
| MINOR    | reps/[id] add-then-delete test order-dependent | STILL OPEN | no `orderBy` on the destructure-row test. Next: add `.orderBy(asc(contentCitation.createdAt))` |
| MINOR    | memory/route-actions.test.ts label-exceeds-limit test relies on absent row | STILL OPEN | needs assertion that no row was written. Next: `expect(stored).toHaveLength(0);` |
| MINOR    | e2e suite `or()` for "feature OR empty-state" both green-pass | CLOSED | the `withFreshUser` fixtures replaced the conditional asserts with deterministic populated-state seeded preconditions. PR #553 |
| MINOR    | memory.spec.ts validation-blocks-empty-submit doesn't assert anything failed | STILL OPEN | low priority browser-native validation polish |
| MINOR    | goal-composer.spec.ts blank-title test never checks for the error | STILL OPEN | low priority |
| MINOR    | calibration.spec.ts second test functionally equivalent to smoke | CLOSED | calibration smoke + populated-state tests now both run via `withFreshUser` -- redundant smoke removed (PR #553 lineage) |
| MINOR    | dashboard.spec.ts logout test submits synthetic form | STILL OPEN | acceptable until UI logout button lands. Trigger: dashboard sprouts a Sign Out button |
| NIT      | Route-action makeEvent boilerplate duplicated across four files | STILL OPEN | each route-actions test still ships its own `makeEvent`. Next: extract to `apps/study/src/lib/test-helpers/route-actions.ts` |
| NIT      | references.test.ts re-creates same fixture five times | STILL OPEN | low priority test polish |
| NIT      | e2e tests log into unverified seed with no env guard | STILL OPEN | trigger: ephemeral PR DB shows up |
| NIT      | library-by-cert.spec.ts leaf-reader assertion overlaps with handbook-reader | STILL OPEN | low priority |

## Summary

Reviewed test quality for the locked study-app surface scope:

- Vitest unit / route-action tests under `apps/study/src/**/*.test.ts` (6 files)
- Playwright e2e under `tests/e2e/` that targets the study app (12 spec files + global setup)

Overall the suite is in better shape than is typical for a project this young: route-action tests hit real DB rows instead of mocking the BC, the handbook-reader e2e mocks the heartbeat clock with `page.clock` (deterministic, no real waits), the `read-suggestion.test.ts` helper imports the threshold constants by name (no hard-coded magic numbers), and the BC layer tests it defers to are explicitly cited in comments.

The bigger concerns are concentrated in two areas:

1. **DB test independence is fragile.** Several Vitest route-action files share the test database with the dev seed but key off `userId`. Almost everything is fine, but a handful of cleanups are conditional on a runtime accumulator (`CREATED_CARD_IDS`/`CREATED_SCENARIO_IDS`) being non-empty, leaving rows behind on early-throw failures and on the `memory/route-actions.test.ts` happy path (which never seeds via `seedCard`). On the e2e side `handbook-reader.spec.ts` and `engine-goal-cutover.spec.ts` mutate per-section / per-plan state on a shared seed user (`learner@airboss.test`) and rely on `serial` mode within the file, but cross-file ordering is not pinned -- two suites editing PHAK §12.9 will collide.
2. **Silent skips and "either-state" e2e assertions are accumulating.** `tests/e2e/handbook-reader.spec.ts` ships an `it.skip("citing-node link round-trip (deferred -- no fixture node yet)")`, `calibration.spec.ts` and `credentials.spec.ts` and `reps.spec.ts` all `test.skip` when seed shape doesn't match, and at least three e2e tests pass against an `or()` of "feature rendered" vs "empty state rendered" which means the test passes whether the feature works or not for that user. Real coverage gaps are hiding behind these "loaded" assertions.

A genuine **critical** lives in `apps/study/src/lib/server/references.test.ts`: the suite never asserts `historicalLens: false` produces a non-historical annotation, and the success cases never confirm the `kind` is `current` -- so a regression that makes everything historical would still pass.

The route-action tests show one **major** correctness gap: `memory/route-actions.test.ts` never inserts the `savedDeck` rows it claims to "rename" / "delete". `renameSavedDeck` is upsert-style, so it works by accident; if the BC ever gates rename on a pre-existing row (the BC test file already covers "label preserved across rename"), this suite will start failing for the wrong reason.

## Issues

### CRITICAL: `loadLessonReferences` historical-lens tests don't assert the negative case

**File:** `apps/study/src/lib/server/references.test.ts`

**Problem:** Two assertions check that an annotation `kind === 'historical'` (one via the `acks` cascade, one via the `historicalLens: true` flag). Neither test asserts that, by default, `kind === 'current'`. The "round-trips through substituteTokens" test produces resolved entries but never inspects `out.resolved[...].annotation` at all. A regression that flipped the default to `historical` -- which would mark every citation in the live UI as historical and visibly break "Per §91.103, the PIC..." rendering -- would still pass this whole file.

**Fix:** Add a positive assertion in the "resolves identifiers and serializes for transport" test that `out.resolved['airboss-ref:regs/cfr-14/91/103?at=2026']?.annotation.kind === 'current'`, and assert the same in a fresh test where `historicalLens` is omitted and no acks are forwarded. The cost is two extra lines per test; the value is that "all current" is now a tested invariant.

### MAJOR: `memory/route-actions.test.ts` never seeds the saved decks it operates on

**File:** `apps/study/src/routes/(app)/memory/route-actions.test.ts`

**Problem:** Every assertion against `savedDeck` reads or expects a row keyed by `deckHash` `rt000001` / `rt000002` / `rt000003`, but no `beforeAll` / per-test step inserts the seed row. The current passes are coincidental: `renameSavedDeck` is implemented as an upsert (the BC test at `libs/bc/study/src/saved-decks.test.ts:108` shows `renameSavedDeck` returning a row the test never inserted), and `deleteSavedDeck` is also upsert-style (creates a dismissed row if missing). A future, perfectly reasonable BC change -- "rename a deck that doesn't exist returns 404 instead of upserting" -- would cascade-break this whole suite.

The route layer test is supposed to confirm form parsing + redirect + action-failure mapping; right now it's actually exercising "BC creates a row when one is missing", which is a BC concern.

**Fix:** Add a `seedSavedDeck` helper mirroring the pattern in `memory/review/route-actions.test.ts` (insert one `savedDeck` row per test inside the test body or `beforeAll`), and use unique deck hashes per test. The cleanup `await db.delete(savedDeck).where(eq(savedDeck.userId, TEST_USER_ID))` already handles teardown.

### MAJOR: Several Vitest route-action test files don't clean up DB rows when the seed array is empty

**File:** `apps/study/src/routes/(app)/memory/[id]/route-actions.test.ts`, `apps/study/src/routes/(app)/reps/[id]/route-actions.test.ts`, `apps/study/src/routes/(app)/memory/review/route-actions.test.ts`

**Problem:** All three files guard the per-table cleanup behind `if (CREATED_CARD_IDS.length > 0) { ... }` (or `CREATED_SCENARIO_IDS.length`). If the suite throws before `seedCard()` / `seedScenario()` can push to that array (e.g. a syntax error during `beforeAll` insert, or a transient DB connection issue mid-test before the first seed), `cardState` / `card` / `scenario` / `contentCitation` rows for `TEST_USER_ID` go un-deleted but the user row also doesn't exist -- so the next run inherits orphans. More importantly, the guard is the wrong shape: `contentCitation` rows are deleted via `eq(contentCitation.createdBy, TEST_USER_ID)` which is a per-user predicate that doesn't need any local accumulator.

**Fix:** Drop the `if (... .length > 0)` guards and run the cascading deletes unconditionally (newest table -> root). Each delete is a no-op when the WHERE matches zero rows. The accumulator is cargo-culted; remove it.

### MAJOR: `memory/review/route-actions.test.ts` shares a single `TEST_USER_ID` across all tests but seeds a new due card per "fallthrough" test

**File:** `apps/study/src/routes/(app)/memory/review/route-actions.test.ts`

**Problem:** The "falls through to creating a new session" test calls `seedDueCard()`, which adds one due card for `TEST_USER_ID`. The "fresh action always creates a new session" test also calls `seedDueCard()`. Both run against the same user, so by the second test the user owns two due cards. That's tolerable today because `cardIdList` is captured per-session and the assertion is `matching.length === 2` (not "deck has exactly the cards seeded by this test"), but it's the classic "test order dependence appears later when a third test asserts on count". The `getDueCards` query inside `startReviewSession` will return both cards and bury invariants the suite means to pin.

**Fix:** Seed a unique user per test (already the pattern in `libs/bc/study/src/saved-decks.test.ts`), or scope assertions to the deck hash AND `currentIndex === 0`. Since Vitest defaults to file-level isolation but parallel-by-file, the cross-file `learner@airboss.test` still gets shared with e2e setup -- that's a separate concern.

### MAJOR: `handbook-reader.spec.ts` is `serial` per file but mutates shared seed state across files

**File:** `tests/e2e/handbook-reader.spec.ts`, `tests/e2e/handbook-amendment.spec.ts`, `tests/e2e/library-by-cert.spec.ts`

**Problem:** `handbook-reader.spec.ts` declares `test.describe.configure({ mode: 'serial' })` and the comment says "Tests in this file share the same dev-seed user and the same PHAK §12.9 read-state row." That's correct within the file, but Playwright runs spec files in parallel by default. `library-by-cert.spec.ts` and `handbook-amendment.spec.ts` both load PHAK §12.9 (`/library/handbook/phak/12/9`) and `handbook-reader.spec.ts` aggressively mutates that section's status, comprehended flag, notes, and `dismissedThisSession` state. A parallel worker hitting `library-by-cert.spec.ts` "renders the leaf reader" while a sibling worker is mid-`setStatusViaSegment(page, 'read')` will see whatever status the other test left behind. Today the reader test asserts only on the title, so the collision is invisible -- but the moment a future test adds "and the status pill says X" it will flake.

**Fix:** Either move the read-state mutation tests onto a freshly-created e2e learner (the auth fixture already supports a per-test `storageState`), or pin Playwright workers to 1 for the handbook suite via `playwright.config` `fullyParallel: false` for files matching `handbook-*.spec.ts`. The shared `learner@airboss.test` for read-only smoke tests is fine; mutating tests need their own user.

### MAJOR: `handbook-reader.spec.ts` "notes save" test mutates state with no isolation from other tests in the file

**File:** `tests/e2e/handbook-reader.spec.ts:288`

**Problem:** "notes save and persist across reload" types `e2e-note-${Date.now()}` into the textarea, asserts it round-trips, then clears the textarea. If the test fails mid-flight (e.g. `expect(textarea).toBeFocused()` times out because of a hydration race) the cleanup never runs and the next run starts with the previous run's `e2e-note-...` content. The assertion uses `toHaveValue(stamp)` which is timestamp-unique so it still passes, but the `notes_md` column accumulates orphan content forever.

**Fix:** Move the cleanup into a `test.afterEach` that runs unconditionally, or wrap the test body in `try { ... } finally { /* clear notes */ }`. Better: the `resetReadState` helper already flips status; extend it to also clear notes when needed, and call it in a `beforeEach` for the read-state describe.

### MAJOR: e2e tests skip silently when the seed shape doesn't match expectations

**File:** `tests/e2e/calibration.spec.ts:21`, `tests/e2e/credentials.spec.ts:22`, `tests/e2e/credentials.spec.ts:52`, `tests/e2e/reps.spec.ts:80-95`, `tests/e2e/library-by-cert.spec.ts:153`

**Problem:** Each of these tests calls `test.skip(true, '...')` when the seed didn't produce the precondition the test needs. Today the seed pipeline is stable (the project comment in `MEMORY.md` notes `abby@airboss.test` is the canonical learner), but the e2e auth fixture signs in as `learner@airboss.test` -- a different user with different seeded content. The suite passes either because the assertion ran or because the test silently skipped. CI has no signal that the "renders detail page when a credential exists" test actually ran today vs. silently green-on-skip.

The reps test at line 80-95 is the most striking: "if Start session is visible, click it; else assert button is disabled". Both branches pass for entirely different (and contradictory) seed states.

**Fix:** Where the test depends on seeded content, harden the seed (insert the required row in a Playwright `globalSetup` step, mirroring `seed-errata.ts`) so the test always runs the asserting branch. Where the test really only smokes "page loaded", keep one assertion and drop the conditional. `test.skip` should be reserved for things genuinely out of scope for an environment, not "the data we want isn't there today".

### MAJOR: `handbook-reader.spec.ts:440` ships a permanently-skipped test

**File:** `tests/e2e/handbook-reader.spec.ts:440`

**Problem:** `test.skip('citing-node link round-trip (deferred -- no fixture node yet)', () => {});` is a no-op test. The comment links to `docs/work-packages/handbook-ingestion-and-reader/tasks.md Phase 16` but it's been `skip`ped indefinitely with no trigger to un-skip. The project rule explicitly bans this pattern: `feedback_no_legacy_in_airboss.md` -> "No `TODO(retire)`, no scheduled-cleanup cron jobs. If it's dead today, drop it today." A skipped test is identical -- it's a known gap pretending to be on the punch list.

**Fix:** Either land the fixture node (if the work-package phase is open, do it now), or delete the skipped test and capture the gap as an item in `docs/work-packages/handbook-ingestion-and-reader/tasks.md`. A skipped test in the file lies about coverage.

### MINOR: `read-suggestion.test.ts` "still shows when unread" comment doesn't match the assertion

**File:** `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/read-suggestion.test.ts:48-52`

**Problem:** The comment claims "First-visit users with prior heartbeats from a previous session can hit the prompt without the explicit `reading` status if a tab crashed mid-read" -- but the test actually exercises the `unread` -> banner-shows path with `openedSecondsInSession: HANDBOOK_SUGGEST_OPEN_SECONDS` already met. So the test isn't proving the "tab crashed mid-read" recovery flow; it's proving "if all the threshold seconds happen to be hit while still `unread`, banner shows". The behavior is correct; the prose mis-describes it.

**Fix:** Either rewrite the comment ("`unread` is treated as a banner-eligible status as long as the cumulative seconds clear the threshold") or add a second test that proves the cross-session-with-crashed-tab case (where `openedSecondsInSession: 0` but `totalSecondsVisible >= threshold` -- which the production rule rejects, so this would actually surface a bug or confirm an intent).

### MINOR: `memory/[id]/route-actions.test.ts` "creates an external_ref citation" doesn't assert the targetId stored

**File:** `apps/study/src/routes/(app)/memory/[id]/route-actions.test.ts:152-169`

**Problem:** The test posts `targetType=external_ref` and `targetId=https://example.com/foo<delim>Example title`, then asserts on `sourceId`, `createdBy`, `sourceType`, `targetType`, `citationContext`. It never asserts on `targetId` -- the very value the form passed in. A regression that swallowed the URL or stored only the title would pass.

**Fix:** Add `expect(rows[0]?.targetId).toBe(targetId);`.

### MINOR: `reps/[id]/route-actions.test.ts` add-then-delete test re-uses the same seeded scenario but doesn't pin scenarioId in the second-row assertion

**File:** `apps/study/src/routes/(app)/reps/[id]/route-actions.test.ts:172-190`

**Problem:** The "deletes a citation owned by the caller" test calls `seedScenario()` to get a fresh `scenarioId`, posts addCitation, then queries `contentCitation` filtered by `eq(contentCitation.sourceId, scenarioId)` and grabs `[row]`. That works because the scenario is fresh, but if a future maintainer adds a second `addCitation` call to the same scenario, the destructured `[row]` becomes order-dependent (Postgres has no implicit order without an `ORDER BY`). It's not a bug today; it's a footgun.

**Fix:** Add `.orderBy(asc(contentCitation.createdAt))` (or pin to `targetId`) so the test reads deterministically regardless of how many citations a scenario carries.

### MINOR: `memory/route-actions.test.ts` "label exceeds limit" test relies on a row that doesn't exist

**File:** `apps/study/src/routes/(app)/memory/route-actions.test.ts:137-149`

**Problem:** The test posts a 256-character label against `deckHash=rt000002`. It asserts the action returns 400 because `SAVED_DECK_LABEL_MAX_LENGTH` is exceeded. The route correctly raises `SavedDeckLabelTooLongError` *before* checking the label, but the BC's `renameSavedDeck` may (today) read the row first and only then validate the label -- meaning the test doesn't prove the error path on the BC side, just that the route maps `SavedDeckLabelTooLongError` to 400. This is fine as a route test, but the BC's `saved-decks.test.ts:149` has the actual contract.

**Fix:** Add a one-line assertion that the row was *not* updated: `const stored = await db.select().from(savedDeck).where(...); expect(stored).toHaveLength(0);` (or "row exists with original label, not the 256-char one"). That confirms the route's failure path didn't accidentally write.

### MINOR: e2e suite uses `or()` to assert "feature OR empty-state" -- both branches green-pass

**File:** `tests/e2e/calibration.spec.ts:14`, `tests/e2e/credentials.spec.ts:12`, `tests/e2e/goal-composer.spec.ts:11`, `tests/e2e/lens-ui.spec.ts:11,28`, `tests/e2e/memory.spec.ts:86`

**Problem:** Each of these tests asserts `await expect(emptyHeading.or(populatedHeading)).toBeVisible()`. The assertion passes whether the feature renders content or shows empty state. A regression that always rendered empty-state for every learner (e.g. a query bug returning `[]`) would not be caught by any of these. The same pattern repeats across the cert dashboard, weakness lens, calibration, and memory review.

**Fix:** Each surface should have at least one e2e test that pins to the populated state by seeding the precondition (cards due, calibration data, weakness signal, an active goal). The current "either-or" tests can stay as smoke tests, but at least one populated-state test per surface should be required.

### MINOR: `memory.spec.ts` "validation blocks empty submit" doesn't assert anything failed

**File:** `tests/e2e/memory.spec.ts:47-52`

**Problem:** The test goes to `/memory/new`, clicks Save without filling fields, and asserts `URL stayed the same`. URL-stayed-same is the browser-native required-validation behavior when an HTML5-required field is empty. But the test doesn't assert that no card was created in the DB, doesn't assert the form's error-message rendering, doesn't assert the field that triggered validation. A regression where Save accidentally submitted a half-baked card and the redirect happened to land back on `/memory/new` (e.g. via a bug in the redirect target) would pass.

**Fix:** Either assert on `:invalid` pseudo-class on the front input (`expect(page.getByLabel('Front (question)')).toHaveJSProperty('validity.valueMissing', true)`) or assert that a follow-up `/memory/browse` doesn't surface an unexpected new row.

### MINOR: `goal-composer.spec.ts` "blank title surfaces inline error" never checks for the error

**File:** `tests/e2e/goal-composer.spec.ts:43-49`

**Problem:** Same shape as memory's empty-submit test. The test name says "surfaces inline error" but the assertion is `URL stayed the same`. Native HTML5 `required` keeps you on the page; the test doesn't prove an inline error UI rendered.

**Fix:** Assert on the actual error message (e.g. `await expect(page.getByText(/title is required/i)).toBeVisible()`) or on the form's invalid state. If the form *only* relies on browser-native validation, rename the test to "blank title is rejected by browser-native validation" so the contract is explicit.

### MINOR: `calibration.spec.ts:17-24` is functionally equivalent to the smoke test above it

**File:** `tests/e2e/calibration.spec.ts`

**Problem:** Both tests in this file load `/calibration` and assert on either empty state or populated state. The second test "empty state links to review + rep session" only asserts when the empty state is visible; otherwise it skips. Net coverage: one heading visibility check + a skip-or-assert dance. The file would be stronger as a single test that seeds calibration data first (via a Playwright `beforeAll` that issues a few card reviews via the API) then asserts the populated UI -- the existing smoke covers the "page loads" case.

**Fix:** Consolidate. Either keep the smoke test and remove the conditional one, or harden the second test to deterministically force the populated-state branch by seeding reviews.

### MINOR: `dashboard.spec.ts:48-67` "logout clears session" submits a synthetic form -- doesn't test the logout button

**File:** `tests/e2e/dashboard.spec.ts:48-67`

**Problem:** The test comment says `Logout is POST-only (no UI button today)`. The test creates a synthetic `<form method="POST">`, submits it via `form.submit()`, and confirms the redirect. That tests the server-side handler in isolation -- not the user-visible logout flow. If the dashboard ever sprouts a Logout button (which it should -- the comment implies it's a known gap) the test will keep passing while the button stays broken.

**Fix:** Once a UI logout exists, drive the test through the visible button. Until then, capture the missing UI as a tracked task in `docs/work-packages/...` and link it from the test comment so it's findable.

### NIT: Route-action test `makeEvent` boilerplate is duplicated across four files

**File:** `apps/study/src/routes/(app)/memory/[id]/route-actions.test.ts`, `apps/study/src/routes/(app)/memory/route-actions.test.ts`, `apps/study/src/routes/(app)/memory/review/route-actions.test.ts`, `apps/study/src/routes/(app)/reps/[id]/route-actions.test.ts`

**Problem:** Every file ships its own ~25-line `makeEvent` and `isFailure` helper. The three route-action files are nearly identical -- the only difference is the URL/route id and which fields land in `params`. A future change to `RequestEvent`'s shape (e.g. adding a required `tracing` field) will need four parallel edits.

**Fix:** Extract a `apps/study/src/lib/test-helpers/route-actions.ts` (or co-locate at the test root) that exposes `makeRequestEvent({ user, params, formData, url, routeId })` and `isFailure`. Each test file imports it and only specifies the bits that vary.

### NIT: `references.test.ts` re-creates the same fixture five times

**File:** `apps/study/src/lib/server/references.test.ts:16-29`

**Problem:** `makeEntry({ id: '...91/103' })` is invoked in five tests with identical defaults. Co-locating the constant (e.g. `const PHAK_91_103_ENTRY = makeEntry({...})`) would shrink each test to one line of "what's different" instead of forcing the reader to re-parse the same overrides each time.

**Fix:** Hoist the common fixture to a module-level constant. Tests that vary the fixture (the `interp/walker-2017` test) keep their own local construction.

### NIT: e2e tests log into an unverified seed with no env guard

**File:** `tests/e2e/global.setup.ts:14`

**Problem:** The setup uses `DEV_PASSWORD` from constants and `learner@airboss.test`. There's no assertion that the dev DB is the one being targeted -- `process.env.DATABASE_URL` is checked in the errata seed step but not for the auth login. If a future change accidentally points the e2e runner at a non-dev DB (staging, ephemeral PR DB), the seed credentials will fail in confusing ways.

**Fix:** Add a `expect(process.env[ENV_VARS.DATABASE_URL] ?? DEV_DB_URL).toContain('localhost')` (or similar guard rail) at the top of the auth setup, mirroring the explicit env check on the errata step.

### NIT: `library-by-cert.spec.ts:140-142` "renders the leaf reader" overlaps with handbook-reader.spec.ts

**File:** `tests/e2e/library-by-cert.spec.ts:139-142`

**Problem:** The test loads `/library/handbook/phak/12/9` and asserts the H1 contains `Atmospheric Stability`. `handbook-reader.spec.ts` already has a much stronger assertion on the same URL (body length, sticky TOC, edition badge). Either the two tests should be aware of each other (and share a comment), or this one should be dropped as redundant smoke.

**Fix:** If the goal is "every route in the library spine renders", keep the assertion narrow (status 200, h1 visible) and drop the title regex -- otherwise it duplicates the handbook-reader contract. If the goal is to prove the cert-spine path lands on the same reader, update the comment to call that out and assert on the breadcrumb back to the cert spine.
