---
date: 2026-05-08
machine: agent-worktree
branch: fix/e2e-h1-collision-round2-2026-05-08
revision: 1
trigger: dispatcher dispatch -- chromium triage round 2
context: 10 chromium failures from full e2e run captured at /tmp/e2e-audit-2026-05-08-round2/
status: done
review_status: done
---

# E2E triage 2026-05-08 round 2 -- chromium

## Summary

10 distinct chromium failures investigated. Three root causes:

- **One real source regression** (load-bearing across 2 tests + a latent collision in the auth-setup post-login assertion): the `/study` home page mounted two H1s with the same `data-testid="page-anchor"` (PageHeader's visible "Study" plus a visually-hidden anchor "Study Home"). Strict-mode Playwright assertions against the page-anchor testid started failing across the chromium suite. Per `docs/agents/best-practices.md`: "Exactly one page-anchor per page."
- **Six stale tests** that lagged behind post-IA-cleanup naming (study-app-ia-cleanup Phase 3 renamed `/dashboard` -> `/insights`, retired the standalone Stats / Memory / Reps / Calibration nav entries in favor of Study / Learn / Program / Insights / Reference, and moved the goal composer URL family from `/goals/...` to `/program/goals/...`).
- **One cold-compile timeout** on the handbook-reader form-action POST (15s -> 30s, mirrors the pattern PR #719 applied to the auth setup path).

Two additional fixes uncovered while verifying:

- A latent hydration race in `goal-composer.spec.ts` (Svelte's one-way `value={seed?.title ?? ''}` bind racing against Playwright's `fill`).
- Two more `/goals/` -> `/program/goals/` updates in engine-goal-cutover that the headline regex change missed.

All 10 originally-failing tests + 4 collateral tests now pass. `bun run check branch` clean.

## Per-failure triage

### 1) dashboard.spec.ts:5 -- renders Dashboard heading

| Field        | Value                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| Category     | test-cosmetic                                                                                         |
| Root cause   | `ROUTES.DASHBOARD` resolves to `/insights` post-IA-cleanup; the page H1 is "Insights" not "Dashboard" |
| Fix          | Update test name + heading expectation to "Insights" (commit 6e32eb00, `tests/e2e/dashboard.spec.ts`) |
| Verification | `bunx playwright test tests/e2e/dashboard.spec.ts:12 --project=chromium` -> pass                      |

### 2) dashboard.spec.ts:10 -- primary nav exposes all surfaces

| Field        | Value                                                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category     | test-cosmetic                                                                                                                                                                                               |
| Root cause   | Test expects "Stats" link with aria-current and a "Memory" `<details>` disclosure -- the actual nav exposes Study/Learn/Program/Insights/Reference per `apps/study/src/routes/(app)/+layout.svelte:198-216` |
| Fix          | Rewrite assertions for the post-IA-cleanup nav; preserve the Flightbag header-cluster check (commit 6e32eb00)                                                                                               |
| Verification | `bunx playwright test tests/e2e/dashboard.spec.ts:17` -> pass                                                                                                                                               |

### 3) dashboard.spec.ts:43 -- nav links navigate to their surfaces

| Field        | Value                                                                                                                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category     | test-cosmetic                                                                                                                                                                                                          |
| Root cause   | Test clicks Memory `<summary>` and Overview menuitem -- neither exist in the current nav. Also accepts only `pathname === ROUTES.PROGRAM` for the Program link, but `/program` server-redirects to its default sub-tab |
| Fix          | Walk the actual Study/Learn/Program/Insights nav; allow `pathname.startsWith('/program/')` (commits 6e32eb00, 32100612)                                                                                                |
| Verification | `bunx playwright test tests/e2e/dashboard.spec.ts:46` -> pass                                                                                                                                                          |

### 4) dashboard.spec.ts:64 -- logout clears session and returns to login

| Field        | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| Category     | test-cosmetic                                                 |
| Root cause   | Same Dashboard -> Insights heading rename                     |
| Fix          | Update heading assertion to "Insights" (commit 6e32eb00)      |
| Verification | `bunx playwright test tests/e2e/dashboard.spec.ts:69` -> pass |

### 5) engine-goal-cutover.spec.ts:90 -- /plans/[id] shows banner pointing at goal composer

| Field        | Value                                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category     | test-cosmetic                                                                                                                                                                                                             |
| Root cause   | Test asserts `href.toMatch(/^\/goals\//)` but the goal composer URL family is `/program/goals/...` post-IA-cleanup                                                                                                        |
| Fix          | Update regex to `/^\/program\/goals\//`. Two additional `/goals/` -> `/program/goals/` updates landed in the same file (`:136` `pathname.startsWith` check, `:222` cross-flow landing check) (commits 6e32eb00, 32100612) |
| Verification | `bunx playwright test tests/e2e/engine-goal-cutover.spec.ts --project=chromium` -> 7 passed                                                                                                                               |

### 6) goal-composer.spec.ts:24 -- create flow: create then redirect to detail

| Field        | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category     | real-regression (latent hydration race) + test-cosmetic (URL family)                                                                                                                                                                                                                                                                                                                                                                                             |
| Root cause   | The Title input has `value={seed?.title ?? ''}` -- a one-way bind. If Svelte hydrates after Playwright's `fill` has typed, the bind re-renders the field to `''`, leaving the input focused but valueless. HTML5 `required` then blocks form submit and the test sits at `/program/goals/new` until the redirect-URL assertion times out. The page-snapshot evidence: title textbox `[active]` (got focus) but no value, no error banner (form never submitted). |
| Fix          | Add `await page.waitForLoadState('networkidle')` before fill, mirroring the pattern in `reps.spec.ts:50`. Also update the redirect regex to `/program/goals/goal_/` (commit 32100612)                                                                                                                                                                                                                                                                            |
| Verification | `bunx playwright test tests/e2e/goal-composer.spec.ts --project=chromium` -> all pass                                                                                                                                                                                                                                                                                                                                                                            |

### 7) handbook-reader.spec.ts:278 -- mark as read persists across reload; re-read resets

| Field        | Value                                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category     | infra (cold-compile timeout)                                                                                                                                                                                                    |
| Root cause   | `waitForFormAction`'s 15s `waitForResponse` budget is below the cold-start cost of the SvelteKit form action's first POST (drizzle prepared-statement warmup + section-resolve query + audit insert) on a fresh dev server boot |
| Fix          | Bump to 30s. Mirrors the cold-compile mitigation PR #719 applied to the auth setup path (commit 6e32eb00)                                                                                                                       |
| Verification | `bunx playwright test tests/e2e/handbook-reader.spec.ts:281 --project=chromium` -> pass                                                                                                                                         |

### 8) ia-first-run.spec.ts:18 -- home shows only "Set your first goal" CTA for a fresh user

| Field        | Value                                                                                                                                                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category     | real-regression                                                                                                                                                                                                                                                   |
| Root cause   | `apps/study/src/routes/(app)/study/+page.svelte` mounted two `<h1>` elements with the same `data-testid="page-anchor"` -- PageHeader's visible "Study" plus a visually-hidden anchor "Study Home". `getByTestId('page-anchor')` strict-mode-violated against both |
| Fix          | Drop the visually-hidden duplicate H1 + style block; PageHeader already serves the canonical anchor role per `docs/agents/best-practices.md` (commit 6e32eb00)                                                                                                    |
| Verification | `bunx playwright test tests/e2e/ia-first-run.spec.ts --project=chromium` -> pass                                                                                                                                                                                  |

### 9) smoke.spec.ts:22 -- /insights loads with a heading

| Field        | Value                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Category     | test-cosmetic                                                                                        |
| Root cause   | `AUTHED_ROUTES` heading regex for `ROUTES.DASHBOARD` was `/^dashboard$/i`; the page H1 is "Insights" |
| Fix          | Update regex to `/^insights$/i` (commit 6e32eb00)                                                    |
| Verification | `bunx playwright test tests/e2e/smoke.spec.ts:24:3 --project=chromium` -> pass                       |

### 10) smoke.spec.ts:51 -- no console errors on dashboard load

| Field        | Value                                                                        |
| ------------ | ---------------------------------------------------------------------------- |
| Category     | test-cosmetic                                                                |
| Root cause   | Same Dashboard -> Insights heading rename                                    |
| Fix          | Update heading expectation to "Insights" (commit 6e32eb00)                   |
| Verification | `bunx playwright test tests/e2e/smoke.spec.ts:53 --project=chromium` -> pass |

### 11) study-home.spec.ts:17 -- SH-1: lands at /study and renders progress + today + tiles + map

| Field        | Value                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category     | real-regression                                                                                                                                      |
| Root cause   | Same H1 collision as #8 -- `getByRole('heading', { name: 'Study', level: 1 })` strict-mode-violated against the duplicate "Study" + "Study Home" h1s |
| Fix          | Same source fix dropping the visually-hidden duplicate (commit 6e32eb00)                                                                             |
| Verification | `bunx playwright test tests/e2e/study-home.spec.ts:17 --project=chromium` -> pass                                                                    |

## Files changed

Source:

- `apps/study/src/routes/(app)/study/+page.svelte` -- drop the visually-hidden `<h1>Study Home</h1>` + the now-unused `.visually-hidden` style block.

Tests:

- `tests/e2e/dashboard.spec.ts` -- rewrite for post-IA-cleanup nav + Insights heading; allow `/program/*` landing.
- `tests/e2e/engine-goal-cutover.spec.ts` -- `/goals/` -> `/program/goals/` in three sites.
- `tests/e2e/goal-composer.spec.ts` -- wait for hydration before filling Title; URL regex update.
- `tests/e2e/handbook-reader.spec.ts` -- `waitForFormAction` 15s -> 30s.
- `tests/e2e/smoke.spec.ts` -- `/insights` heading regex; "no console errors" heading update.
- `tests/e2e/global.setup.ts`, `tests/e2e/unauthed/auth.spec.ts` -- drop now-stale comments about the visually-hidden anchor.

## Commits

- 6e32eb00 -- fix(e2e+study): resolve H1 collision + sync stale dashboard tests
- 32100612 -- fix(e2e): goal-composer hydration race + remaining /goals/ -> /program/goals

## Verification

`bun run check branch` -> all checks passed (biome, theme-lint, help-ids, browser-globals, svelte-check:study).

Per-spec chromium runs (PLAYWRIGHT_SKIP_DB_SETUP=1, workers=1):

- dashboard.spec.ts -- 5 tests pass
- engine-goal-cutover.spec.ts -- 7 tests pass (full file)
- goal-composer.spec.ts -- all 4 tests pass (full file)
- handbook-reader.spec.ts:281 -- pass (alone; full-file flake on a different test pre-existed and is not introduced by these changes)
- ia-first-run.spec.ts -- pass
- smoke.spec.ts -- 11 tests pass (full file)
- study-home.spec.ts -- 4 tests pass (full file)
