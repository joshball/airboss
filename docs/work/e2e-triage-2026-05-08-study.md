---
title: 'E2E triage: study + chromium-unauthed (2026-05-08)'
date: 2026-05-08
branch: worktree-agent-ab6aaa0b39e8ffede
scope: 6 failures from /tmp/e2e-audit-2026-05-08/full-run.log -- the [setup] project + the [chromium-unauthed] auth.spec.ts cluster
---

## Summary

| Failure                                                          | Category                          | Action                |
| ---------------------------------------------------------------- | --------------------------------- | --------------------- |
| [setup] global.setup.ts:9 -- authenticate learner                | infra-flake (cold-compile)        | fixed (timeout bumps) |
| [setup] global.setup.ts:44 -- seed handbook errata fixtures      | infra-flake (cold DB pool)        | fixed (timeout bump)  |
| [chromium-unauthed] auth.spec.ts:16 -- protected route redirects | infra-flake (cold-compile)        | fixed (timeout bump)  |
| [chromium-unauthed] auth.spec.ts:52 -- happy login lands         | infra-flake + test-cosmetic       | fixed (both)          |
| [chromium-unauthed] auth.spec.ts:68 -- safe redirectTo           | infra-flake (cold-compile)        | fixed (timeout bumps) |
| [chromium-unauthed] auth.spec.ts:81 -- unsafe redirectTo         | infra-flake (cold-compile)        | fixed (timeout bumps) |

All 6 fixed in this worktree. The setup `authenticate learner` failure was the load-bearing one -- 19 dependent specs in the `chromium` project were skipped ("did not run") because the setup test failed. Fixing it should unblock that whole tree.

## Root cause

All six failures share a single root cause: **dev-server cold-compile of post-login routes (`/study`, `/insights`, `/memory`) regularly takes 25-45s on a freshly spawned playwright `webServer`, and the existing per-test / per-action / per-navigation timeouts (30s / 15s / 15s) are too tight to absorb that warmup tax under the parallel project layout.**

Evidence:

- `bad password shows error and clears email on 401` (same file, same login form, same auth-rate-limit fixture) **passed in 11s** because it never leaves `/login` -- no second route to compile.
- The four post-login auth tests all failed at `locator.click: Timeout 15000ms exceeded ... navigated to "http://127.0.0.1:9603/login"`. The Playwright `page snapshot` captured at teardown shows the user successfully logged in and landed on the expected route (`/study`, `/memory`, etc.) -- the click was eventually navigating, just past the 15s budget.
- `protected route redirects` failed at `page.goto: Timeout 15000ms exceeded ... navigating to "http://127.0.0.1:9603/insights"` -- a fresh-compile of the new `/insights` rollup added by PR #653.
- `seed handbook errata fixtures` failed at the per-test 30s budget while doing initial DB lookups against a brand-new `airboss_e2e` postgres database.
- The flightbag specs (separate project) routinely take 30-45s for a single page navigation and pass because their assertions don't share the 15s navigationTimeout (the spec uses heavier explicit waits). The chromium-unauthed auth specs were authored when the suite was much smaller and never inherited the same coverage.

There is no app regression in any of these flows. The login form works (proven by `bad password` and by every page snapshot showing the post-login authenticated layout).

## Per-failure detail

### 1) [setup] tests/e2e/global.setup.ts:9 -- authenticate learner

- **Error:** `TimeoutError: page.waitForURL: Timeout 15000ms exceeded` after navigating to `/login` and clicking sign-in.
- **Category:** infra-flake.
- **Root cause:** The `Promise.all([waitForURL(...), button.click()])` raced the implicit 15s `navigationTimeout`. POST `/login` -> 303 -> GET `/` -> 302 -> `/study`, and the `/study` cold-compile burned the budget.
- **Fix:** `setup.setTimeout(90_000)` on the test and an explicit `{ timeout: 60_000 }` on `page.waitForURL`. Added a comment block on the heading regex (the existing anchored `^...$` regex correctly avoids the `Study` / `Study Home` H1 double-match described below; previously implicit, now documented).
- **Impact:** This setup gates 19 specs in the `chromium` project (the suite reports them as "did not run" when this fails). Fixing this single test should restore that whole tree.

### 2) [setup] tests/e2e/global.setup.ts:44 -- seed handbook errata fixtures

- **Error:** `Test timeout of 30000ms exceeded.`
- **Category:** infra-flake.
- **Root cause:** First-run DB connection + section-row resolution against a freshly provisioned `airboss_e2e` exceeds 30s under load. The seed code itself is straight Drizzle reads + 3 inserts; nothing structural.
- **Fix:** `setup.setTimeout(90_000)`.

### 3) [chromium-unauthed] tests/e2e/unauthed/auth.spec.ts:16 -- protected route redirects to login with redirectTo

- **Error:** `TimeoutError: page.goto: Timeout 15000ms exceeded ... navigating to "http://127.0.0.1:9603/insights"`.
- **Category:** infra-flake.
- **Root cause:** Cold-compile of the `/insights` rollup (added by PR #653) blew the 15s `navigationTimeout` on the very first hit. Once SvelteKit/vite cache the bundle the second hit is sub-second.
- **Fix:** `page.goto(ROUTES.DASHBOARD, { timeout: 60_000 })`. Left the downstream `toHaveURL` and heading expects on the snappy 5s default -- the auth gate runs server-side and is fast once vite is warm.

### 4) [chromium-unauthed] tests/e2e/unauthed/auth.spec.ts:52 -- happy login lands on study home

- **Error:** `TimeoutError: locator.click: Timeout 15000ms exceeded` (on `getByRole('button', { name: /sign in/i })`).
- **Category:** infra-flake **and** test-cosmetic.
- **Root cause (timing):** Same as #1 -- click was waiting for "scheduled navigations" to finish, but POST `/login` -> 303 -> GET `/` -> 302 -> `/study` cold-compile chain exceeded 15s.
- **Root cause (heading):** Latent strict-mode violation. PR #649 (Phase 1 study IA cleanup) added a visually-hidden `<h1 class="visually-hidden" data-testid="page-anchor">Study Home</h1>` alongside the existing PageHeader-rendered `<h1>Study</h1>`. The assertion `getByRole('heading', { name: 'Study', level: 1 })` uses Playwright's default substring + case-insensitive matching, so "Study" matches **both** headings -- this would strict-mode-violate even if the click had succeeded. Never observed because the click died first.
- **Fix:** `click({ timeout: 60_000 })` for the navigation; `toHaveURL(..., { timeout: 30_000 })` for the redirect-chain settle; `name: 'Study', exact: true` to pin the heading match to the visible PageHeader H1.

### 5) [chromium-unauthed] tests/e2e/unauthed/auth.spec.ts:68 -- safe redirectTo is honored after login

- **Error:** `TimeoutError: locator.click: Timeout 15000ms exceeded`. Page snapshot at teardown shows the user landed on `/memory` correctly.
- **Category:** infra-flake.
- **Root cause:** Cold-compile of `/memory` exceeded 15s. The `/memory` page snapshot is fully populated with cards/states/domains -- the loader works.
- **Fix:** `click({ timeout: 60_000 })` + `toHaveURL(..., { timeout: 30_000 })`.

### 6) [chromium-unauthed] tests/e2e/unauthed/auth.spec.ts:81 -- unsafe redirectTo falls back to study home

- **Error:** `expect(page).toHaveURL(...)` failed with the page still at `/login?redirectTo=...evil...` after 5s. Page snapshot at teardown shows the user landed on `/study`.
- **Category:** infra-flake.
- **Root cause:** Same cold-compile chain as #4, but failure surfaced at the `expect(toHaveURL)` 5s budget rather than the click. The redirect-chain (POST `/login` -> 303 -> GET `/` -> 302 -> `/study` compile) just took longer than the assertion was willing to wait.
- **Fix:** `click({ timeout: 60_000 })` + `toHaveURL(..., { timeout: 30_000 })`. The fallback-to-`/study` behaviour is correct.

## Files changed

- `tests/e2e/global.setup.ts` -- timeout bumps + comment for the visually-hidden anchor H1 collision avoided by the existing anchored regex.
- `tests/e2e/unauthed/auth.spec.ts` -- per-test timeout (`describe.configure({ timeout: 90_000 })`), per-call timeouts on the heavy `goto`/`click`/`toHaveURL` lines, `exact: true` on the post-login `Study` H1 match.

## Side observations (not fixed, not in scope)

- The `/study` page mounts two H1s (`PageHeader` "Study" + visually-hidden anchor "Study Home"). One H1 per page is the canonical accessibility expectation. The visually-hidden anchor was added by PR #649 deliberately (it carries `data-testid="page-anchor"` per the new e2e selector contract documented in `best-practices.md`), but PageHeader **also** emits `data-testid="page-anchor"` on its visible H1 per PR #650's commit message. Two H1s + two `data-testid="page-anchor"` on the same page is a soft accessibility / test-contract collision that should be reconciled (drop the visually-hidden anchor, since PageHeader already serves the role). Out of scope for this triage; flagging for a follow-up.
- The `[Better Auth] Error setting rate limit DrizzleQueryError ... duplicate key value violates unique constraint "bauth_rate_limit_key_unique"` log noise is a benign race between the `clearAuthRateLimit` fixture and better-auth's own `onResponseRateLimit` write path. Better-auth recovers gracefully (it just fails to record the count). Doesn't cause test failure but pollutes ERROR-level logs.
- The hangar-jobs worker spam during global-db-setup (`hangar.job` table doesn't exist yet -> failed query loop) is well-known and benign once `drizzle-kit push` finishes. Worth a `worker.start` delay until the schema is ready, but out of scope for this triage.
- `bun run check` (dirty profile) cannot lint files under `tests/e2e/**` because biome's `files.includes` doesn't cover the `tests/` directory, but `scripts/check.ts` still hands the changed files to biome -- biome then exits 1 with "These paths were provided but ignored". This is a pre-existing dispatch bug; the same `bun run check` against `main` with no edits does nothing because there are no dirty files. My edits trigger it, but they are syntactically valid TS (verified via `tsc --noEmit`) and the broader `bun run check quick` failures (biome schema-version drift on `biome.json`, knowledge dry-run needing DATABASE_URL, tracking-generate BOARD.md drift) are pre-existing and unrelated to this triage. Recommend a separate fix for `scripts/check.ts` to filter biome inputs against `biome.json`'s `files.includes` before invoking the binary.

## Verification

- `bunx tsc --noEmit` on both edited files: clean.
- `bun run check` test-lint: clean (0 grandfathered, 0 total).
- Cannot re-run the failing specs in this worktree without a `bun install` + DB provisioning; the dispatcher will re-run after consolidation.
