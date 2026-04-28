---
feature: full-codebase
category: testing
date: 2026-04-27
branch: main
issues_found: 17
critical: 0
major: 4
minor: 8
nit: 5
---

## Summary

The test suite is in good shape overall. ~204 unit/spec files cover the bounded contexts, sources ingest pipeline, auth helpers, UI primitives, and a small but well-shaped Playwright e2e suite. BC integration tests use real Postgres with per-suite seed origins / per-test isolated users, which is the correct boundary for SQL aggregation logic. FSRS, engine, credentials DAG, and validators are pinned down by tight assertions. The notable gaps: several sizable BC modules (`cards.ts` 596 LOC, `snooze.ts` 401 LOC, `stats.ts` 380 LOC, `reviews.ts` 268 LOC, `validation.ts` 168 LOC) have no companion `*.test.ts`; the auth suite covers only `auth.ts` (cookies/logout/email untested); the e2e smoke test asserts a heading regex that no longer matches the rendered page; and BC tests that share the dev DB occasionally fall back to "lower bound" assertions because foreign rows leak into the aggregates.

## Issues

### MAJOR: smoke.spec.ts asserts a heading that does not exist on the dashboard

- **File**: tests/e2e/smoke.spec.ts:11
- **Problem**: `AUTHED_ROUTES` declares the dashboard heading as `/learning dashboard/i`, but `apps/study` renders the heading as `Dashboard` (level 1) -- both `tests/e2e/dashboard.spec.ts:7` and `global.setup.ts:25` confirm the live H1 is `Dashboard` (or "Learning Dashboard" tolerated by setup as legacy). The smoke test currently passes because the regex is case-insensitive *and* matches "Dashboard" as a substring? No -- `/learning dashboard/i` requires the literal "learning " prefix, which the rendered H1 lacks. Either smoke.spec.ts is consistently failing in CI, or the H1 is actually "Learning Dashboard" somewhere it shouldn't be (drift between what the route renders and what setup tolerates). Either way, the test is not pinning down the real contract.
- **Fix**: Either change to `/^dashboard$/i` (matches the H1 currently rendered), or unify the source of truth: hoist the "learning dashboard" -> "Dashboard" rename into the route copy and drop the "(learning )?" tolerance from `global.setup.ts:25`. The setup already documents this as "older copies"; finish the rename and have one regex.

### MAJOR: BC modules with no automated coverage

- **File**: libs/bc/study/src/cards.ts (596 LOC), snooze.ts (401), stats.ts (380), reviews.ts (268), validation.ts (168), handbook-validation.ts (331), feedback.ts (88), formatters.ts (52), card-cross-references.ts (67)
- **Problem**: These modules ship the most user-visible BC behavior (card CRUD, review submission, snooze rules, dashboard stats, validation guards, handbook citation validation) but have zero `*.test.ts` files. Some logic is exercised indirectly via the `route-actions.test.ts` suites in `apps/study/src/routes/(app)/memory`, but indirect coverage doesn't pin down branch behavior the way a focused unit test does. `validation.ts` and `handbook-validation.ts` are pure-function and trivially testable; their absence is a hole that lets validation drift land silently.
- **Fix**: Add unit tests for the pure branches first: `validation.ts` (every `validateX` -> `*ValidationError` path), `handbook-validation.ts` (each rule), `formatters.ts` (each formatter on a representative input), `feedback.ts` (each branch). For `cards.ts` / `reviews.ts` / `snooze.ts` / `stats.ts`, add DB-backed integration tests following the `credentials.test.ts` / `dashboard.test.ts` pattern (per-suite SUITE_TAG + per-test isolated users + afterAll cleanup).

### MAJOR: Auth lib: cookies, logout, and email transports untested

- **File**: libs/auth/src/cookies.ts (148 LOC), logout.ts (33 LOC), email/templates.ts, email/transport.ts
- **Problem**: `auth.test.ts` covers `requireAuth` / `requireRole` only. `cookies.ts` (session cookie shaping), `logout.ts` (POST-only logout flow), and the email subdir (verification + reset templates) have no unit tests. Auth code is the kind of thing that breaks subtly and silently -- a wrong cookie attribute or an expired-link path that throws on a missing template is the failure mode you only see in production.
- **Fix**: Add `cookies.test.ts` covering each cookie attribute (Secure, HttpOnly, SameSite, Path, expiry math) and the read-back parser. Add `logout.test.ts` covering session-row deletion + cookie clear. Add `email/templates.test.ts` snapshot-pin the rendered subject + body for each template variant.

### MAJOR: Render-mode dispatchers (web/print/tts/plain-text) have no coverage

- **File**: libs/sources/src/render/modes/web.ts, print.ts, tts.ts, plain-text.ts (each file 11+ LOC)
- **Problem**: `libs/sources/src/render/substitute.test.ts` exists, but the per-mode link renderers (`renderWebLink`, `renderPrintLink`, `renderTtsLink`, `renderPlainTextLink`) and the print footnote-sink protocol are not directly tested. These are the surface contract for "what does a citation look like in HTML vs print vs TTS vs plain-text." If a mode regresses (e.g. print stops emitting footnotes, TTS stops spelling out section numbers), the only tripwire is the cross-cutting `references.test.ts` happy path.
- **Fix**: Add a `modes.test.ts` (or per-mode `*.test.ts`) that pins down the rendered string for one citation entry per mode -- this catches the regressions the cross-cutting tests miss.

### MINOR: Weak assertions in route-actions tests rely on toBeTruthy / toBeDefined for content checks

- **File**: apps/study/src/routes/(app)/memory/route-actions.test.ts:147, apps/study/src/routes/(app)/memory/[id]/route-actions.test.ts:235, apps/hangar/src/lib/server/users.test.ts:41
- **Problem**: `expect(result.data.fieldErrors.label).toBeTruthy()` only guarantees the error is non-empty, not that the message is correct. `expect(row).toBeDefined()` after a SELECT only proves the row exists but not its content (the file does follow up with content asserts; the toBeDefined line is redundant noise). `expect(expr).toBeDefined()` for a Drizzle SQL chunk asserts only that the helper returned *something* -- the test acknowledges this in its comment ("we only assert truthiness here") but a single concrete `(jane% OR ...)` shape pinned via `expr.toString()` or `expr.queryChunks` would catch a real regression.
- **Fix**: Replace `fieldErrors.label).toBeTruthy()` with `).toContain('Label must be ...')` or `).toMatch(/at most \d+/)`. Drop the redundant `expect(row).toBeDefined()` -- the next-line content asserts already prove the row's existence and shape. For `buildUserSearchWhere`, snapshot the SQL fragment via `expr.getSQL().queryChunks` to pin the actual LIKE pattern.

### MINOR: knowledge.cert.test.ts asserts only lower bounds because it shares dev-DB rows

- **File**: libs/bc/study/src/knowledge.cert.test.ts:235, 241-242, 273
- **Problem**: The test comment says "Other dev-DB nodes may also have PPL minimumCert, so assert lower bound." Lower-bound asserts pass when the BC under-counts (regression slips through) as long as some other node bumps the count above the floor. The exact-equality contract is what the BC actually promises.
- **Fix**: Either (a) scope the read to `seedOrigin = SUITE_TAG` so the count is exact (the rest of the suite already uses this pattern), or (b) compare `result.totalAfterSeeding - resultBeforeSeeding === expectedDelta` by snapshotting the row counts before/after the seed.

### MINOR: BC tests share TEST_USER_ID across describe blocks; cross-test leak risk

- **File**: libs/bc/study/src/sessions.test.ts:40, scenarios.test.ts:44, calibration.test.ts:33, dashboard.test.ts:43 (and several others)
- **Problem**: A single top-level `TEST_USER_ID` is reused by every test in the file. Each test seeds rows under that user; tests that read back the user's full state see prior tests' rows. `dashboard.test.ts` sidesteps this with `isolatedUser()` for the weak-areas tests but uses BASE_USER for others; `calibration.test.ts` does the same with `withFreshUser`. Other files (e.g. `sessions.test.ts`) don't, so a future "lists all sessions for user" test would see siblings.
- **Fix**: Adopt the `withFreshUser` / `isolatedUser` pattern uniformly for any test that reads aggregated user data. Tests that only verify a single insert/update path can keep the shared user.

### MINOR: tests/e2e/handbook-reader.spec.ts:395 ships a pure no-op skip

- **File**: tests/e2e/handbook-reader.spec.ts:395
- **Problem**: `test.skip('citing-node link round-trip (deferred -- no fixture node yet)', () => {})` is a documentation marker that lives in the test runner forever. Skipped tests rot. The comment above it points to a Phase 16 task; the task should own the unskip, not the test file.
- **Fix**: Delete the skipped test. Track the deferred coverage in `docs/work-packages/handbook-ingestion-and-reader/tasks.md` Phase 16 only. When the fixture node is added, write the real test.

### MINOR: e2e theme-fouc.spec.ts uses toBeTruthy on string attributes

- **File**: tests/e2e/unauthed/theme-fouc.spec.ts:56-58, 139, 141
- **Problem**: `expect(snap.theme).toBeTruthy()` passes for any non-empty string, including `"undefined"` or `"null"` (string literals). The intent is "set to a real theme name." The `toBe('study/sectional')` test on line 64 demonstrates the right level of specificity.
- **Fix**: Replace `toBeTruthy()` with the actual expected value or a regex like `expect(snap.theme).toMatch(/^[a-z]+\/[a-z]+$/)`. If the test deliberately can't predict the theme (because cookie is not seeded), assert `expect(snap.theme).not.toBe('')` and `.not.toBe('null')`.

### MINOR: NoActivePlanError import-only "test"

- **File**: libs/bc/study/src/plans.test.ts:220-224
- **Problem**: `it('imports NoActivePlanError', () => { expect(NoActivePlanError).toBeDefined(); })` adds nothing the import statement doesn't already prove. If the symbol is renamed, the file fails to type-check before the test runs.
- **Fix**: Delete this test. The import on line 14 is the rename guard.

### MINOR: vi.mock above the vi import in source-jobs.test.ts

- **File**: apps/hangar/src/lib/server/source-jobs.test.ts:23
- **Problem**: `vi.mock(...)` appears at line 23, but `import { vi } from 'vitest'` is on line 28. This works because Vitest hoists `vi.mock` calls above imports and auto-injects `vi`, but the file is misleading to read and the explicit import on line 28 is dead.
- **Fix**: Move `import { describe, expect, it, vi } from 'vitest'` to the top with the other imports and delete the duplicate import on line 28.

### MINOR: source-fetch.test.ts uses `as any` casts to fake job context

- **File**: apps/hangar/src/lib/server/source-fetch.test.ts:55-60, source-jobs.test.ts:57-62
- **Problem**: `result: null as any`, `error: null as any`, `createdAt: new Date() as any` defeat the type system the file imports `JobContext` to enforce. If the row schema changes, these tests pass without exercising the new shape.
- **Fix**: Build a real `JobRow` literal with all required fields (the row type is small) or extract a `makeJobContext()` factory typed against `JobContext` so future schema drift surfaces as a type error.

### NIT: UI tests use toBeTruthy on getByTestId returns

- **File**: libs/ui/__tests__/Tabs.svelte.test.ts:36, BrowseListItem.svelte.test.ts:48-51, ConfirmAction.svelte.test.ts:18 + 37-39, DataTable.svelte.test.ts (8x), Card.svelte.test.ts:25+31, Banner.svelte.test.ts:17+57, others (~30 occurrences across libs/ui/__tests__)
- **Problem**: `getByTestId(...)` already throws if the element is missing, so `expect(...).toBeTruthy()` adds zero verification. The intent is "this region exists" -- which is fine -- but it reads as if it's checking content.
- **Fix**: Either drop the `expect(...).toBeTruthy()` (the `getByTestId` call alone is the assertion) or convert to `expect(screen.queryByTestId('...')).not.toBeNull()` so the read is "I expected this to be there." Better still: assert on the *content* (`.textContent`, `.getAttribute('data-state')`, etc.) -- that's what the test plan says it cares about.

### NIT: validateSyllabusTree pin-down tests rely on not.toThrow

- **File**: libs/bc/study/src/syllabi.test.ts:43, 75, 105, 131
- **Problem**: `expect(() => validateSyllabusTree(...)).not.toThrow()` says "happy path doesn't error" but doesn't pin down the *return shape*. If the validator silently starts returning an empty array or null for a valid tree, this test passes.
- **Fix**: Assert on the validator's return value: shape, count of validated nodes, or invariants like "every leaf has a parent."

### NIT: Tests that depend on `new Date()` without seam

- **File**: libs/bc/study/src/test-support.ts:86, dashboard.test.ts (multiple), scenarios.test.ts (multiple)
- **Problem**: Helper code paths default `completedAt` to `new Date()` and time-based filters (within last 7 days, due in N days) measure against actual wall clock. Tests that backdate work around it; tests that don't are subtly time-dependent.
- **Fix**: Already largely handled (callers pass explicit `completedAt`). For the few that don't, accept a `now` parameter on the helpers and pass `NOW = new Date('2026-04-19T12:00:00Z')` (mirroring `srs.test.ts:5`) so the suite is hermetic.

### NIT: setRegsDerivativeRoot / setHandbooksDerivativeRoot are global mutable state

- **File**: libs/sources/src/regs/resolver.ts:32, libs/sources/src/handbooks/resolver.ts:55
- **Problem**: Tests that touch resolvers (`regs/cache.test.ts`, `regs/idempotence.test.ts`, `regs/smoke.test.ts`, `handbooks/smoke.test.ts`, `handbooks/resolver.test.ts`) all `setX(tmpRoot)` in beforeEach and restore in afterEach. The restore is correct, but if a test throws before afterEach runs, sibling tests in the same Vitest project see the temp root from the failed test (which has been `rmSync`'d). Vitest projects run separately, so cross-suite collisions are unlikely, but the pattern is fragile.
- **Fix**: Pass the derivative root through the call site instead of holding it in a module-level variable. The ingest functions already accept `derivativeRoot` as an option (`runHandbookIngest({ derivativeRoot })`); the resolvers should follow suit so the test override is per-call, not per-process.

### NIT: e2e calibration.spec.ts:21 conditionally skips based on dev-DB state

- **File**: tests/e2e/calibration.spec.ts:21
- **Problem**: `test.skip(true, 'learner already has calibration data -- empty-state CTAs not present')` makes the test pass on a populated dev DB and run on a fresh one. Same code, different verdicts. Skip-on-state hides regressions: if the empty-state CTAs disappear and the dev DB has data, no one notices.
- **Fix**: Use a separate test user (or a Playwright `beforeEach` that resets calibration data for a fixture user) so the empty-state path is always exercised. Alternative: make this an integration test in `libs/bc/study` that asserts the empty-state heading copy is shipped, decoupled from runtime DB state.
