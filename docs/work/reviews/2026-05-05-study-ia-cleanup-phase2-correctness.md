# Correctness review -- study-ia-cleanup Phase 2

issues_found: 4

## C-1 (major) -- `/program?tab=goal` redirects to the GOAL detail when one exists, but the FLOW e2e walks `/program` only

`apps/study/src/routes/(app)/program/+page.server.ts` redirects `/program` (no tab) and `/program?tab=goal` to `ROUTES.PROGRAM_GOAL(parent.primaryGoal.id)`. The flow test in `tests/e2e/ia-flow.spec.ts` expects `program-tab-{quals|goal|plan|coverage}` testids on the redirected target. They live on `/program/+layout.svelte`, which renders for every child under `/program/*`. So the redirect chain from `/program` -> `/program/goals/{id}` keeps the tabs visible. Good.

However, the FLOW spec stop is `path: ROUTES.PROGRAM` and the loader for the seed user (Abby) has a primary goal -> redirect lands on the goal detail. The detail page mounts `<PageHeader>` which now emits `data-testid="page-anchor"` on its h1. That works.

Sanity check: when no goal exists (a fresh user), the redirect lands on `/program/quals` and the page-anchor is on the Quals h1. Also works. No fix needed; called out so a future reviewer doesn't claim the FLOW is broken.

## C-2 (minor) -- `parseProgramTab` rejects the canonical default

`apps/study/src/lib/program/default-tab.ts` returns `null` when the `?tab=` value is unknown, including the empty string. The `+page.server.ts` falls through to `parent.defaultTab` in that case. Correct behavior; documented in the function jsdoc and exercised by the unit test.

No fix; flagged so the next reviewer doesn't repeat the analysis.

## C-3 (minor) -- The `goal-detail-start-cta` testid wraps a span around `<Button>`

`apps/study/src/routes/(app)/program/goals/[id]/+page.svelte:57` introduces `<span data-testid="goal-detail-start-cta">` around the `<Button>` because the shared Button component hardcodes `data-testid="button-root"`. Two consequences:

- Playwright `getByTestId('goal-detail-start-cta')` returns the span, not the link. The new spec compensates with `cta.getByRole('link').click()`.
- Screen readers see a non-interactive span wrapping an interactive link. The link is still focusable and announces correctly; the span has no semantic role.

Cleaner alternative: extend `Button.svelte` to accept a `testid` prop. That's a UI-component change that affects every other Button caller and is out of scope for Phase 2. The wrap-span pattern is the documented escape hatch and matches the e2e selector convention.

No fix in this slice. Future improvement: add the prop.

## C-4 (info) -- `+layout.svelte` re-derives active sub-tab from the URL

`apps/study/src/routes/(app)/program/+layout.svelte` derives `qualsActive`, `goalsActive`, `plansActive`, `coverageActive` via `pathMatches(page.url.pathname, ROUTES.PROGRAM_*)`. There is no `?tab=` reading because the URL itself is the canonical state once `/program` redirects to a child. Direct `/program?tab=plan` deep links resolve to `/program/plans` (or `/program/plans/{id}`) before the layout renders, so the URL path always tells the truth. Good.
