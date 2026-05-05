---
title: 'Phase 4 review fix plan + closure log'
phase: 4
work_package: study-app-ia-cleanup
created: 2026-05-05
status: done
---

# Phase 4 review fixes -- closure log

Findings from
[`docs/work/reviews/2026-05-05-study-ia-cleanup-phase4-consolidated.md`](../reviews/2026-05-05-study-ia-cleanup-phase4-consolidated.md)
were fixed inline as the review walked. This document records each
finding, the fix, and the verification evidence.

## Findings

| # | Severity | Finding                                                                                                            | Fix                                                                                                                                                                  | Evidence                                                                                                          |
| - | -------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1 | major    | Six `(app)` routes shipped without `data-testid="page-anchor"` on their `<h1>` (CardHeaderPanel, reps/[id], memory/review/[sessionId], reference/knowledge/[slug], library/handbook/.../[section], library/regulations/.../[section]). | Added the testid on each `<h1>`. For the running-review session phase (no on-screen h1), added a visually-hidden `<h1 data-testid="page-anchor">`.                  | `apps/study/src/lib/server/page-anchor-guard.test.ts` -- 2/2 pass; static walk reports zero misses across 53 routes. |
| 2 | major    | `HelpLayout.svelte` rendered its title with `data-testid="helplayout-title"` only, so `/help/[id]` would fail the page-anchor guard. | Renamed the testid to `page-anchor`; updated the one inbound reference in `libs/help/__tests__/HelpLayout.svelte.test.ts`. | `bun x vitest run libs/help/__tests__/HelpLayout.svelte.test.ts` -- 4/4 pass.                                     |
| 3 | minor    | Layout left the `nav-menu` CSS block (~100 lines) after the dropdown markup was removed.                            | Removed every `.nav-menu*` rule + the `.chevron` rule + the `.nav-menu-panel*` rules.                                                                              | `wc -l apps/study/src/routes/(app)/+layout.svelte` -- 326 lines (was 497 pre-Phase-4).                            |
| 4 | minor    | Layout state retained `helpMenu`, `memoryMenu`, `closeDetails`, `handleNavMenuKeydown`, `handleHelpMenuBlur`, `handleHelpItemClick`, `handleMemoryMenuBlur`, `handleMemoryItemClick` after the dropdowns were removed. | Removed all of them in one pass.                                                                                                                                    | `grep -E 'helpMenu\|memoryMenu\|closeDetails\|handleNavMenuKeydown' apps/study/src/routes/(app)/+layout.svelte` -- empty. |
| 5 | nit      | E2E `ia-flow.spec.ts` used `page.getByTestId('page-anchor')` strict-mode -- on the running-review session there are now two anchors in source (one per phase branch), only one rendered at a time. | Switched to `.first()` to make intent explicit even though the rendered count is 1.                                                                                  | `tests/e2e/ia-flow.spec.ts` -- assertion uses `.first()`.                                                         |
| 6 | nit      | Phase 1 deferred items (`nav-learn` testid, `nav-insights` testid) -- close-out check.                              | Both present in the final layout. `nav-insights` shipped in Phase 3; `nav-learn` shipped here.                                                                       | `grep "data-testid=\"nav-" apps/study/src/routes/(app)/+layout.svelte` -- exactly five matches: home/learn/program/insights/reference. |

## Convergent root-cause fixes

- **page-anchor coverage** is now CI-enforced. The static guard
  (`page-anchor-guard.ts` + `.test.ts`) walks every `+page.svelte`
  under `apps/study/src/routes/(app)/` and reports any page that
  doesn't surface the testid via direct h1, sibling `_panels/*`, or
  one of the canonical wrapper components (`<PageHeader>`,
  `<ReferencePage>`, `<HelpLayout>`, `<CardHeaderPanel>`). Adding a
  new route without the testid fails the build at unit-test time --
  before any e2e runs.

## Verification

- `bun run check` -- baseline accepted errors only.
- `bun x vitest run apps/study/src/lib/server/page-anchor-guard.test.ts` -- 2/2 pass.
- `bun x vitest run libs/help/__tests__/HelpLayout.svelte.test.ts` -- 4/4 pass.
- `apps/study` full Vitest suite -- 56/77 pass (21 fail). The 21
  failures are preexisting jsdom / `@testing-library/user-event`
  infrastructure issues; the same suite on `origin/main` shows 22
  fails (one more, since one of those was the HelpLayout title test
  which I updated rather than worked-around).
- E2E `ia-flow.spec.ts` -- not executed in this harness (no Playwright
  server). Manual run gated on the test plan walkthrough; the FLOW
  list expansion is the deliverable here.
- Grep for `nav-memory`, `nav-flight`, `nav-help`, `nav-reps`
  selectors anywhere in `tests/`, `apps/`, `libs/`, `docs/` (excluding
  `.archive/`) -- one match, the negative-assertion list inside the
  Phase 4 nav lock test. No production references.
- Grep for `<details class="nav-menu"` -- no matches.
