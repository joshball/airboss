---
title: 'Phase 3 review fix plan'
phase: 3
work_package: study-app-ia-cleanup
created: 2026-05-05
status: done
---

# Phase 3 review fix plan

Findings surfaced during the consolidated 10x walk
(`docs/work/reviews/2026-05-05-study-ia-cleanup-phase3-consolidated.md`)
were fixed inline as the build progressed. This file records each
finding's resolution with grep-evidence so the closure is verifiable.

## Findings + resolution

### 1. Glossary page missing `data-testid="page-anchor"`

- Source: UX walk.
- Severity: major (Phase 4 CI guard would fail).
- Fix: `libs/aviation/src/ui/ReferencePage.svelte` -- added
  `data-testid="page-anchor"` to the `<h1>`.
- Evidence: `grep -n 'page-anchor' libs/aviation/src/ui/ReferencePage.svelte`
  -> line 50.

### 2. Layout `pathname === '/dashboard'` literal-string compare typed-out by ROUTES union

- Source: Svelte / TS walk.
- Severity: critical (svelte-check fail).
- Fix: collapsed `fullBleed` derivation to
  `page.url.pathname === ROUTES.INSIGHTS`; the legacy path is 301'd
  before render so the comparison was unreachable anyway.
- Evidence: `bun run check` clean (only the accepted baseline
  errors remain).

### 3. Hard-coded `/knowledge/...` href in unit tests

- Source: Correctness walk -- post-migration, tests asserting old
  href shape would fail because BC + lib code now emits
  `/reference/knowledge/...`.
- Severity: major.
- Fix: updated `apps/study/src/routes/(app)/study/_lib/today-prose.test.ts`
  and `libs/bc/study/src/cards-public.test.ts` to expect the new path.
- Evidence: tests pass --
  `bunx vitest run apps/study/src/routes/(app)/study/_lib/today-prose.test.ts libs/bc/study/src/cards-public.test.ts`
  -> 42 pass.

### 4. Old `ROUTES.*` constants referenced from in-app callers

- Source: Patterns walk.
- Severity: minor (deprecated aliases worked, but in-app callers
  should reach for the new constants so the deprecations can be
  removed at the 6-month mark).
- Fix: bulk sed sweep across 13 apps/ files and 7 libs/ files,
  swapping `ROUTES.{DASHBOARD,CALIBRATION,LENS*,KNOWLEDGE*,GLOSSARY*}`
  to the `INSIGHTS_*` / `REFERENCE_*` family.
- Evidence: `grep -rln "ROUTES\.\(DASHBOARD\|CALIBRATION\|LENS\b\|LENS_HANDBOOK\|LENS_HANDBOOK_DOC\|LENS_HANDBOOK_CHAPTER\|LENS_WEAKNESS\|LENS_WEAKNESS_BUCKET\|KNOWLEDGE\b\|KNOWLEDGE_SLUG\|KNOWLEDGE_LEARN\|KNOWLEDGE_LEARN_AT\|GLOSSARY\b\|GLOSSARY_ID\)" apps/ libs/`
  -> only `libs/constants/src/routes.ts` (the deprecation declarations themselves) remains.

### 5. `libs/themes/picker/pre-hydration.ts` and `generated/pre-hydration.ts` had `/dashboard`-only flightdeck check

- Source: Correctness + perf walk.
- Severity: major (Insights index would have rendered with the wrong
  layout class until the SSR layout took over -- a brief flash).
- Fix: extended the pre-hydration script to flag both `/insights`
  and `/dashboard` as flightdeck paths, and ran `bun themes:emit` to
  regenerate the inline script + CSP hash.
- Evidence: generated `libs/themes/generated/pre-hydration.ts` now
  includes `path === '/insights'` in the flightdeck branch.

### 6. Glossary drawer state-machine test ran in node-only project

- Source: Svelte walk.
- Severity: minor (test failed with "$state is not defined").
- Fix: renamed `glossary-drawer-state.test.ts` to
  `glossary-drawer-state.svelte.test.ts` so vitest's `unit-dom`
  project picks it up with the Svelte plugin loaded.
- Evidence: `bunx vitest run libs/ui/__tests__/glossary-drawer-state.svelte.test.ts`
  -> 6 pass.

## Open items

None. Phase 3 closes here; Phase 4 (drop dropdowns, lock five-section
nav, CI guard) is dispatched separately per the task brief.
