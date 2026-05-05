---
title: 'Phase 3 review (consolidated 10x walk)'
phase: 3
work_package: study-app-ia-cleanup
created: 2026-05-05
status: done
review_status: done
---

# Phase 3 review -- consolidated 10x walk

Sub-agent harness can't dispatch parallel reviewers, so the 10 specialist
checklists were walked sequentially against the Phase 3 diff. Each
section below records the findings and their disposition. Findings were
fixed inline as they were surfaced (per CLAUDE.md "ALWAYS FIX
EVERYTHING from a review"); the consolidated fix-plan in
`docs/work/plans/2026-05-05-study-ia-cleanup-phase3-review-fixes.md`
records the closure evidence.

## 1. UX

- **Section index pages** -- `/insights` and `/reference` open with a
  `PageHeader` (auto page-anchor) + `PageExplainer` ("Why am I here?").
  Reference index shipped as a brand-new card grid linking into
  Knowledge / Glossary / Library; Insights inherits the existing
  dashboard panels. `nav-insights` / `nav-reference` testids attached.
- **Sub-page explainers** -- calibration, lens-handbook, knowledge,
  glossary all gain a `PageExplainer` in addition to the page header.
  Six new keys registered in `PAGE_EXPLAINER_KEYS`.
- **Drawer trigger** -- mounted in the right cluster between
  HelpSearch and Flightbag. Opens the same content as the canonical
  `/reference/glossary` page (one source -- `@ab/help/glossary`).
- Finding (resolved): glossary's `ReferencePage` was the only Phase 3
  surface without `data-testid="page-anchor"`; added in
  `libs/aviation/src/ui/ReferencePage.svelte`.

## 2. Svelte 5 correctness

- All new components use runes (`$state`, `$derived`, `$effect`,
  `$props`) -- no `$:` / `export let` / `<slot>` / Svelte-4 stores.
- `GlossaryDrawerState` lives in `.svelte.ts` so the runes work
  outside a component instance; the test file is renamed to
  `*.svelte.test.ts` so it runs in the `unit-dom` project that loads
  the Svelte vite plugin.
- `MetricExplainer` annotated with the `a11y_no_noninteractive_element_interactions`
  ignore; the host span carries the keyboard trap so Esc works
  regardless of which descendant has focus, and the inner button is
  the actual focusable trigger.
- Finding (resolved): initial draft of the "current dashboard path"
  derived in the layout used `pathname === '/dashboard'`, which the
  ROUTES literal type rejected; collapsed to `pathname === ROUTES.INSIGHTS`
  since the legacy path is 301'd before render.

## 3. Security

- Redirect resolver is a pure regex match -> closed builder set,
  no caller-supplied `Location` text. No SSRF / open-redirect surface.
- `handleLegacyRedirects` runs FIRST (before auth) so a banned user
  hitting `/dashboard` 301s without ever touching the session lookup;
  the auth gate only sees canonical paths.
- Drawer + MetricExplainer render plain text content from the static
  `@ab/help/glossary` corpus (no user input); the long-form pre-tag
  preserves whitespace but escapes via Svelte's default text mode.
- No new schema / migration -- nothing to review on the auth boundary.

## 4. Performance

- Drawer entries are passed in via `listGlossaryEntries()` once at
  mount; filtering is `$derived` and runs only when `query` changes.
  The corpus is ~20 entries, fully bundled (no async work).
- Redirect rules are an in-memory `readonly` array; first-match-wins
  walk is O(N) per request but N=19 and the regex anchors are
  `^/segment\b...$` so each test is a single linear scan. Fine.
- Theme `FLIGHTDECK_PATH_PREFIXES` extended to include `/insights`;
  the matcher is unchanged, just one extra prefix.
- No layout regressions -- `fullBleed` still maps to the same surface,
  just under the renamed path.

## 5. Architecture

- `libs/ui` stays a leaf -- `GlossaryDrawer` accepts entries via
  prop, doesn't import `@ab/help`. `AppHeader` exposes `glossarySlot`
  as a snippet (mirrors `helpSearch`), keeping the cycle break.
- `apps/study/src/lib/server/legacy-redirects.ts` is a pure module
  with a public typed export; the SvelteKit handle in
  `hooks.server.ts` is a thin wrapper. Resolver is unit-testable
  without the framework.
- Sequence ordering: `sequence(handleLegacyRedirects, handleAppRequest)`
  so legacy paths skip the auth + session work entirely.
- BC boundaries unchanged; this WP is pure UI/route work as the
  spec's "Non-goals" mandates.

## 6. Pattern compliance

- All routes go through `ROUTES`. New constants added; old constants
  retained as `@deprecated` aliases that point to the new paths so
  external scripts / docs continue to work and in-app callers
  migrate over time. In-app callers already migrated in this phase
  (sweep over apps/study + libs/{aviation,help,bc}).
- Page-explainer keys registered in `PAGE_EXPLAINER_KEYS`; the
  closed-set validator on `/api/page-explainer` already enforces
  the allowlist.
- All hard-coded path literals replaced with the typed constants;
  the redirect map is the only place that contains literal old
  paths, which is correct because the old paths no longer have a
  canonical `ROUTES` entry by design.

## 7. Correctness

- Redirect resolver: 10 unit tests cover every pattern + trailing
  slash + query-string preservation + URL-encoded slug round-trip.
- Drawer state machine: 6 unit tests cover open/close/toggle,
  selection round-trip, and the "typing clears selection" rule.
- MetricExplainer: 4 unit tests cover the closed-state default, the
  popover open / formula render, the glossary deep link, and the
  Esc-to-close + focus-restore.
- E2E: ia-redirect.spec.ts asserts status code 301 (not just `.url`)
  and the `Location` pathname for every legacy path; ia-flow.spec.ts
  expanded with the seven new Phase 3 stops.
- Finding (resolved): cards-public.test.ts and today-prose.test.ts
  hard-coded `/knowledge/...` href expectations; updated to
  `/reference/knowledge/...` to match the new canonical path emitted
  by `ROUTES.REFERENCE_KNOWLEDGE_SLUG`.

## 8. Accessibility

- New section index pages emit `data-testid="page-anchor"` via
  `PageHeader` (existing pattern).
- Drawer reuses the existing `Drawer` primitive (focus trap, scrim,
  Esc-close already wired).
- Drawer trigger button has `aria-expanded` reflecting open state,
  `aria-label="Glossary"` for SR users.
- MetricExplainer trigger has `aria-expanded`, `aria-controls` to
  the popover id, and `aria-label="What is {label}?"`. Esc closes
  and restores focus to the trigger.
- Tooltips inside explainers use the existing `<Tooltip>` primitive
  (hover + focus parity).
- `ReferencePage`'s `<h1>` now carries `data-testid="page-anchor"`.

## 9. Backend / loaders

- No new server load functions; the moved page.server.ts files keep
  their existing data fetches. The lens index `/insights/lens`
  redirect target updated from `LENS_HANDBOOK` to
  `INSIGHTS_LENS_HANDBOOK` (the deprecated alias would have worked
  too but the new constant is the canonical reference).
- Hooks: `handleAppRequest` (renamed internal) preserves the prior
  auth + banned-user + security headers + logging behaviour
  verbatim. The `sequence` composition is the single new wiring.

## 10. Schema

- No DB changes. PAGE_EXPLAINER_KEYS allowlist gains six rows; the
  `study.user_pref` table keys are scalar strings and the
  validation registry already accepts any string -- no migration.
- `userPrefSchema` for `study.page_explainer.dismissed` is
  `z.record(z.string().min(1), z.literal(true))` so the new keys
  flow through without a schema bump.

## Convergent fixes

- **Old constant -> new constant migration** -- 13 files in apps/
  and 7 in libs/ swept to the INSIGHTS_*/REFERENCE_* names in one
  pass; the deprecated aliases survive for external callers /
  redirect-window safety.
- **Theme pre-hydration script** -- `/insights` added to the
  flightdeck-theme prefix list in both the resolve table and the
  generated pre-hydration script (regenerated via `bun themes:emit`).
  The legacy `/dashboard` prefix kept as defense-in-depth even
  though the hook redirects before render.

## Open items

- None. Spec Q7 noted "Training / Progress / Reference" as a
  possible label-only swap; this phase ships with the URL-family
  names ("Insights", "Reference") because they describe the section
  contents more accurately than "Progress" alone. If Joshua flips
  the label later, it's a one-line `NAV_LABELS` change and the
  feature-spec rationale stays intact.
- Phase 4 deferred (per task brief): drop the Memory + Help nav
  dropdowns, finalize the five-section nav, install the CI guard
  that fails the build if a route ships without `page-anchor`.
