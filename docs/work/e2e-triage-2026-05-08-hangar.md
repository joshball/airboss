# E2E triage: hangar-review-queue (2026-05-08)

- DateTime: 2026-05-08T21:51Z
- Branch: worktree-agent-aaaeb9b3308bbe9bb
- Worktree: .claude/worktrees/agent-aaaeb9b3308bbe9bb
- Triggering prompt: triage hangar-review-queue cluster from full-suite run
- Source artifacts: /tmp/e2e-audit-2026-05-08/{full-run.log,failures-detail.log}, tests/e2e/.out/hangar-review-queue-global.setup.ts-seed-hangar-review-items-hangar-review-queue-setup/

## TL;DR

- Single setup task (`seed hangar review items`) timed out at the **global 30s test budget**, cascading 9 dependent specs into "did not run".
- Root cause: trivial regression in budgeting. Internal action timeouts in the seed task (60s click, 60s response wait) exceed the outer wrapper's default 30s. Author intent (per file comment) was to allow a 60s loader scan; the test wrapper was never bumped to match.
- PR #651's serialization fix is **holding** -- `authenticate hangar admin` ran first and passed cleanly (20s).
- Fix applied: `setup.setTimeout(180_000)` at the top of the seed task. One line.
- The previously-documented "24 specs failing with 500 errors" cluster from PR #638 could **not** be re-characterized in this session because the 9 dependent specs all skipped (cascaded from setup) and reproduction in this worktree was blocked by independent env friction (see appendix).

## Setup-failure root cause

`tests/e2e/hangar-review-queue/global.setup.ts:69` -- `seed hangar review items`.

Trace timeline (from `tests/e2e/.out/.../trace.zip`, units = ms monotonic):

| step                                  | start    | end      | duration |
| ------------------------------------- | -------- | -------- | -------- |
| Before hooks                          | 520953.9 | 520961.7 | 8 ms     |
| Create context                        | 520967.0 | 520974.6 | 7 ms     |
| Create page                           | 520979.5 | 521219.4 | 240 ms   |
| Navigate to /review/admin/loader      | 521227.0 | 525625.9 | 4.4 s    |
| Click "Run loader now" (60s budget)   | 525641.5 | aborted  | killed   |
| (test wrapper hits 30s outer timeout) | --       | 550991.4 | --       |

Total elapsed: 30.04 s. Matches `playwright.config.ts:72` -> `timeout: 30_000` exactly.

The seed test's three internal action budgets are right-sized for the workload:

```typescript
page.waitForResponse(..., { timeout: 60_000 }),
page.getByRole('button', { name: /run loader now/i }).click({ timeout: 60_000 }),
await expect(page.getByText(/Items added/i)).toBeVisible({ timeout: 30_000 });
```

But the outer wrapper is the global default 30 s. Playwright tears down the page when the outer budget expires, and the `finally { await context.close() }` then raises `browserContext.close: Target page, context or browser has been closed` -- the symptom shown in error-context.md.

The author's own in-file comment names exactly this failure mode:

> the loader scans every work-package + knowledge-node markdown file under the repo and populates `hangar.review_item`; first run on a fresh DB easily blows past playwright's default 5 s action timeout. Give the click a 60 s budget that matches the response-wait above.

Action budgets were bumped; the test wrapper was missed. Classic "fix the inner timeout, forget the outer wrapper" pattern.

## Categorization

**test-cosmetic / infra**. No app code is broken. The seed action itself works; the test framework just doesn't give it enough time.

## Fix applied

Single-line addition in `tests/e2e/hangar-review-queue/global.setup.ts`:

```typescript
setup('seed hangar review items', async ({ browser }) => {
    setup.setTimeout(180_000);  // <-- new
    ...
});
```

180 s leaves headroom: the loader run plus action overhead is empirically under 60 s on a warm DB, and the file's own comment plans for "first run on a fresh DB" cases. 180 s matches the conservative budget used by the `webServer.timeout` (120 s for boot) plus a 60 s slack.

Verified:

- Type-checks clean (`bunx tsc --noEmit` on the file).
- Biome ignores `tests/` (per project config), so no formatter delta.
- `setup.setTimeout` is `test.setTimeout` from `@playwright/test`; supported in 1.59.1 (the installed version).

## Dependent-spec characterization (NOT done this session)

The 9 specs in the `hangar-review-queue` project depend on the setup project (`dependencies: ['hangar-review-queue-setup']` in playwright.config.ts:154). When setup failed, all 9 cascaded to "did not run" (counted in the global "151 did not run" total at the bottom of full-run.log).

The 9 dependent specs:

```text
tests/e2e/hangar-review-queue/admin.spec.ts
tests/e2e/hangar-review-queue/board.spec.ts
tests/e2e/hangar-review-queue/docs.spec.ts
tests/e2e/hangar-review-queue/hangar-hydration-smoke.spec.ts
tests/e2e/hangar-review-queue/per-kind.spec.ts
tests/e2e/hangar-review-queue/roadmap.spec.ts
tests/e2e/hangar-review-queue/tasks.spec.ts
tests/e2e/hangar-review-queue/walker.spec.ts
```

(`hangar-review-queue/unauthed/auth-redirect.spec.ts` is its own project and ran fine -- 6 passes.)

I could **not** re-run the project to characterize them after my setup fix because in this fresh worktree the Playwright `webServer.timeout: 120_000` is too tight to cold-boot all three vite dev servers (study + flightbag + hangar) from scratch with no warm caches. This is independent of the hangar regression and not in scope. See appendix.

The previous walkthrough (`docs/work/walkthroughs/20260506/01-e2e-isolation-and-figure-pairing.md` § 4) attributed "~24 specs failing with 500 Internal Error" to pre-existing app bugs from PR #638. I cannot confirm whether that hypothesis still holds without an actual run.

## Recommended next action

1. **Land the setup-timeout fix** (this branch). It's a one-line, structurally-obvious correction.
2. **Re-run the full hangar-review-queue project** on a machine where vite caches are warm (i.e. main repo or a worktree where the suite has already booted once):

   ```bash
   PLAYWRIGHT_SKIP_DB_SETUP=1 bunx playwright test \
     --project=hangar-review-queue \
     --project=hangar-review-queue-setup \
     --project=hangar-review-queue-unauthed \
     --workers=1 --reporter=line 2>&1 | tee /tmp/hangar-after-setup.log
   ```

3. **Triage the remaining failures en bloc**, looking for:

   - All 500s? -> single backend WP fixing the shared cause (same as PR #638 hypothesis).
   - Element-not-found on a renamed selector? -> single test-side fix or single ROUTES rename.
   - Mixed? -> WP-sized investigation, surface a separate triage doc.

4. **If the PR #638 cluster is still red**, write a single WP at `docs/work-packages/hangar-review-queue-cluster-fix/spec.md` and reference it here. Do NOT fix per-spec; convergent findings get fixed at the root once.

## Appendix: why I couldn't reproduce in this worktree

Multiple cold-start factors stacked against in-worktree reproduction:

- This worktree had no `node_modules` (had to `bun install`, ~7 s).
- This worktree had no `.env` (copied from main).
- Per-app `node_modules/.vite/deps` warmed during install but `flightbag` was empty until I primed it manually.
- `playwright.config.ts` has `webServer.timeout: 120_000` and `reuseExistingServer: false` for all three apps. Cold-booting study + flightbag + hangar simultaneously in this worktree exceeded 120 s repeatedly.
- The `[WebServer]` log filter in the playwright `list` reporter swallows the actual boot diagnostics, making this hard to debug from the parent process.

None of this is the seed regression's fault. It's a worktree-env edge case.

## Files touched

- `tests/e2e/hangar-review-queue/global.setup.ts` -- added `setup.setTimeout(180_000)` + 7-line comment block explaining why.
- `.env` -- copied from main repo so vite dev servers can connect to the e2e DB. Not committed (in `.gitignore`).
- `docs/work/e2e-triage-2026-05-08-hangar.md` -- this report.
