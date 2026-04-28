---
status: in-progress
created: 2026-04-28
source: leftover from PR #284 (consolidate-wp-batch) + PR #287 (e2e-suite-cleanup)
---

# Post-#284 follow-up: e2e cleanup + verification gaps

## Why this exists

PRs #284, #285, #286, #287 closed the consolidation work for #279/#280/#282 and got `bun run check` + vitest + pytest green. Four e2e tests are still red and three verification asks were noted but not executed. This WP closes them out.

## Work items

### 1. Pre-hydration script body resolves to `undefined` under Vite SSR (PRODUCT BUG)

After PR #287 fixed `injectPreHydrationScript` to use `replaceAll`, the served HTML now writes `<script>undefined</script>` instead of the script body. Direct unit invocation of `injectPreHydrationScript(html, PRE_HYDRATION_SCRIPT)` works correctly. The bug is at the import boundary -- `PRE_HYDRATION_SCRIPT` resolves to `undefined` at request time inside `apps/study/src/hooks.server.ts`, even though the constant is exported with a value from `libs/themes/generated/pre-hydration.ts`.

This is a **real product regression** affecting FOUC mitigation across all three apps (study, sim, hangar) in both dev and prod. Was hidden before #287 because the original `replace` only swapped the placeholder in the comment block, leaving the script tag's placeholder intact -- the script never executed in any environment.

**Investigation pointers:**
- Confirm via direct curl: `curl -s -H "Cookie: appearance=dark" http://localhost:9600/login | grep '<script>'`. Should show the function body, not `undefined`.
- Check whether the Vite SSR module-cache is loading a stale or partially-evaluated copy of `libs/themes/generated/pre-hydration.ts`.
- Check whether the wildcard alias (`@ab/themes/*` -> `libs/themes/*`) resolves correctly for the generated subpath under SvelteKit's SSR. Compare to `import { PRE_HYDRATION_SCRIPT_CSP_HASH } from '../../libs/themes/generated/pre-hydration.ts'` in `apps/study/svelte.config.js` which works.
- Add `console.log` instrumentation inside `transformPageChunk` to print `typeof PRE_HYDRATION_SCRIPT` at request time. If `'undefined'`, the import is the problem; if a long string, `injectPreHydrationScript` is the problem.

**Acceptance:**
- `curl http://localhost:9600/login` returns HTML where `<script>` contains the IIFE function body.
- `tests/e2e/unauthed/theme-fouc.spec.ts` -- both `appearance=dark cookie` and `prefers-color-scheme: dark` tests pass.
- All three apps (study, sim, hangar) verified.

### 2. `knowledge-learn.spec.ts` -- replaceState click test

`tests/e2e/knowledge-learn.spec.ts:39` ("clicking a phase button updates the URL via replaceState") fails after PR #287's selector tightening: clicking the Reveal stepper button doesn't update the URL with `?step=reveal`. The earlier two tests in the same file (deep-link via `?step=verify` and `?step=discover`) pass, so the page renders and the URL-sync `$effect` works on initial load.

Possible causes:
- The stepper button click target may be the `<span>` inside the `<button>`, not the `<button>` itself, blocking the `onclick` handler.
- The `$effect` that calls `replaceState` may not fire when `currentPhase` is set programmatically by `selectPhase()` -- check whether `currentPhase` reactivity is wired through `$state` correctly.
- Playwright's `.click()` may race the Svelte 5 reactivity update.

**Acceptance:**
- Test passes consistently (10 runs, no flakes).

### 3. `handbook-reader.spec.ts` -- mark-as-read flake

`tests/e2e/handbook-reader.spec.ts:210` ("mark as read persists across reload; re-read resets") fails on the comprehended-checkbox persistence step. PR #287 replaced `waitForLoadState('networkidle')` with `waitForURL` settling, but the form action's redirect race still trips it.

**Investigation pointers:**
- Check whether the `set-comprehended` form action uses `use:enhance` or a plain POST. If plain POST, the URL goes through `?/set-comprehended` then redirects.
- Add explicit `page.waitForResponse` for the action's POST AND the subsequent redirect's load.

**Acceptance:**
- Test passes consistently (10 runs).

### 4. New-file inventory across the 3 consolidated PRs

PR #284 merged tree-equivalent code from #279, #280, #282. Verify exhaustively that every NEW file added in those PRs landed on main. Existing tree-diff verification was done at the architecture-summary level; this is a focused list pass.

**Method:**
- For each closed PR (#279, #280, #282), run `gh pr view <N> --json files --jq '.files[] | select(.changeType == "ADDED") | .path'` to list new files.
- For each new file, verify it exists on current `origin/main`.
- Surface any missing files.

**Acceptance:**
- Report of new-file presence per PR. Zero missing OR a follow-up commit adding the missing files.

### 5. Per-PR manual diff walk

Beyond the architecture-level confirmation, walk each closed PR's diff (#279, #280, #282) hunk-by-hunk against `origin/main` to flag anything subtle that the consolidation may have dropped. Focus areas:
- Constants additions (`libs/constants/`)
- Test files
- Type definitions
- Comment blocks that document why something is the way it is

**Acceptance:**
- Per-PR walk note: clean / list of items missed.

### 6. Test coverage audit for #279/#280/#282 functionality

PR #286 added some post-consolidation tests but coverage may still be thin. For each consolidated PR's surface area:
- **#279 auth-rate-limit:** verify the persistence-restart test exists and asserts the right thing (the integration test in `libs/auth/src/rate-limit.test.ts`). Verify policies in `libs/constants/src/auth.ts` are exercised.
- **#280 study-schema-tightening:** verify FK cascade + scenario_option invariants are tested at the BC layer. The schema is structurally enforced now -- BC tests should cover ownership invariants explicitly.
- **#282 extract-hangar-bc:** verify BC query helpers (`dashboard-queries`, `jobs-queries`, `getReferenceSummary`, `countAuditEntriesSince`, `countAllUsers`) all have unit tests.

**Acceptance:**
- Per-area coverage report.
- Tests added where coverage is missing (filed as new tests in this PR).

## Out of scope

- Reviving the deferred work packages (`extract-sim-instruments`, `sim-scenario-table`) -- they have their own gating triggers.
- Adding e2e tests for new product surfaces -- this WP is closing existing gaps, not adding new coverage.

## Test plan

- `bun run check` clean
- `bun run test` (vitest): 218 files / 2932+ passing
- `bun run test e2e`: 47/47 passing (4 currently red turn green)
- `python -m pytest tools/handbook-ingest/tests/`: 89 passed (no regressions)
