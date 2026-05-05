---
title: 'Phase 4 review (consolidated 10x walk)'
phase: 4
work_package: study-app-ia-cleanup
created: 2026-05-05
status: unread
review_status: done
---

# Phase 4 review -- consolidated 10x walk

Sub-agent harness can't dispatch parallel reviewers, so the 10 specialist
checklists were walked sequentially against the Phase 4 diff. Each
section below records the findings and their disposition. Findings were
fixed inline as they surfaced (per CLAUDE.md "ALWAYS FIX EVERYTHING from
a review"); the consolidated fix-plan in
[`docs/work/plans/2026-05-05-study-ia-cleanup-phase4-review-fixes.md`](../plans/2026-05-05-study-ia-cleanup-phase4-review-fixes.md)
records closure evidence.

## 1. UX

- **Five-section nav locked** -- Home / Learn / Program / Insights /
  Reference. The Memory `<details>` dropdown and the Help `<details>`
  dropdown are gone; testids `nav-home`, `nav-learn`, `nav-program`,
  `nav-insights`, `nav-reference` are the entire top-level surface.
- **Learn section index** -- `/study/learn` opens with a `PageHeader`
  (page-anchor) + `LearnTabs` strip + `PageExplainer` (`learn` key,
  registered in `PAGE_EXPLAINER_KEYS`) + a card grid linking into the
  three sub-areas. Mirrors the Reference Phase 3 pattern -- sections
  are discoverable as a unit before the user dives into any single one.
- **Tab strip mirrored on the section index pages** -- `/memory`, `/reps`,
  `/library` each render `LearnTabs` at the top. Active state derives
  from `page.url.pathname` so deep-linking to any sub-section keeps
  the orientation visible.
- **Help affordance** -- the only Help in the chrome is the global
  `HelpSearch` snippet on `AppHeader.svelte` (Phase 1) plus the
  per-page `<PageHelp>` triggers (already universal). No
  feature-gap surfaced from the local Help dropdown removal: it
  exposed `/help` and `/help/concepts`; both routes still exist and
  remain reachable via `/help` deep links from the search results.
- Finding (resolved): the Phase 1 + Phase 2 nav left `nav-learn` and
  `nav-insights` deferred. Phase 4 closes both -- `nav-learn` lands
  here, `nav-insights` already shipped in Phase 3 (verified via
  layout grep).

## 2. Svelte 5 correctness

- New components use runes only. `LearnTabs.svelte` uses `$props`,
  `$derived` over `pathMatches`. No `$:` / `export let` / `<slot>` /
  Svelte-4 stores anywhere in the diff.
- Layout cleanup retired four `$state` HTMLDetailsElement bindings,
  four event handlers, and a `<svelte:window onkeydown>` listener
  alongside the dropdown markup. Removal verified via grep for
  `memoryMenu`, `helpMenu`, `closeDetails`, `handleNavMenuKeydown` --
  all empty.
- `LearnTabs` `active` prop is a discriminated union (`'learn' |
  'cards' | 'reps' | 'read'`) so callers can't pass a typo. The
  union widens automatically when a future surface lands.

## 3. Security

- No new auth boundaries, no new server actions, no new form posts.
- Page-anchor static guard reads files via Node `fs` lazily-loaded
  from `process.getBuiltinModule` so the module passes the
  `noNodejsModules` Biome rule when the file path is widened in
  the future. Today the guard lives under `apps/study/src/lib/server`
  which is server-only territory; the lazy pattern is defensive.
- The new `learn-*` testid family is read-only DOM metadata; no
  server contract attached.

## 4. Performance

- Layout shed a `<svelte:window>` keydown listener and four `onfocusout`
  handlers. Net: fewer event subscriptions on every page mount.
- Static page-anchor guard is fs-only and runs in Vitest -- no impact
  on production bundles or CI runtime budget (one walk over ~50
  files in <100ms locally).
- `LearnTabs` mounts on three high-traffic pages (`/memory`, `/reps`,
  `/library`); no async work or $effect inside, just `$derived`
  prefix matches over the URL pathname.

## 5. Architecture

- New library boundary: `apps/study/src/lib/components/LearnTabs.svelte`
  -- study-specific, lives in the app, does not leak into `libs/ui/`
  because the active-state logic is study-route-aware.
- New static guard: `apps/study/src/lib/server/page-anchor-guard.ts`
  + `.test.ts`. Lives in `lib/server` because it walks the project
  filesystem; co-located with `legacy-redirects.ts` (same
  "server-only utility" tier).
- Constants additions:
  - `ROUTES.LEARN = '/study/learn'`
  - `NAV_LABELS.LEARN`, `NAV_LABELS.LEARN_CARDS`,
    `NAV_LABELS.LEARN_REPS`, `NAV_LABELS.LEARN_READ`
  - `PAGE_EXPLAINER_KEYS.LEARN = 'learn'`
- No deprecated routes left without a replacement. The Memory and
  Reps and Library URLs intentionally stayed put per design.md
  ("their nav surface moves into Learn -> Cards / Reps, but the URLs
  do not change") -- so no Phase 4 redirect entries are needed in
  `legacy-redirects.ts`.

## 6. Patterns / project conventions

- `LearnTabs.svelte` mirrors the `program/+layout.svelte` strip
  pattern from Phase 2: same `aria-current`, same `data-testid="<scope>-tab-{name}"`
  shape, same active-prefix-match logic.
- `LearnTabs` reads from `NAV_LABELS` rather than literal strings.
- All new routes go through `ROUTES`. Search confirms no inline
  `/study/learn` strings outside `ROUTES.LEARN` definition.
- Cross-lib imports use `@ab/*` aliases; intra-app imports use `$lib/*`.

## 7. Correctness

- Layout `learnActive` derived covers the four prefix matches
  (`/study/learn`, `/memory`, `/reps`, `/library`) so Learn stays lit
  on every sub-section.
- `LearnTabs` `active="learn"` override on the index page handles the
  case where `page.url.pathname === '/study/learn'` doesn't match any
  of `ROUTES.MEMORY` / `ROUTES.REPS` / `ROUTES.LIBRARY` prefixes; the
  Overview tab lights up explicitly.
- E2E flow uses `getByTestId('page-anchor').first()` so the running-
  review session page (which carries a visually-hidden anchor in
  parallel with on-screen content) doesn't fail with "strict mode
  violation: multiple elements" -- there's still only one anchor per
  rendered phase, but `.first()` future-proofs the assertion.
- Finding (resolved): five `<h1>` instances under `(app)` lacked the
  `page-anchor` testid (`memory/[id]/_panels/CardHeaderPanel.svelte`,
  `reps/[id]/+page.svelte`, `memory/review/[sessionId]/+page.svelte`,
  `reference/knowledge/[slug]/+page.svelte`,
  `library/handbook/.../[section]/+page.svelte`,
  `library/regulations/.../[section]/+page.svelte`). All updated; the
  static guard now reports zero misses.

## 8. Accessibility

- The `<details>` dropdowns being removed eliminates the keyboard-
  escape state machine + the `aria-haspopup="menu"` summaries. The
  five replacement nav items are plain `<a>` tags with `aria-current`
  on the active one -- simpler and AAA-clean.
- `LearnTabs` uses `aria-label="Learn sub-sections"` on the `<nav>`
  and `aria-current="page"` on the active tab; same shape as the
  Program tabs.
- Visually-hidden h1 on the running-review session uses the canonical
  sr-only pattern (`position: absolute; clip: rect(0,0,0,0)`); SR
  users hear the heading, sighted users see the per-card counter.
- Finding (resolved): the visually-hidden h1 needed an explicit
  `.visually-hidden` style block in `memory/review/[sessionId]/+page.svelte`
  (the page didn't already have one). Added inline with the other
  CSS.

## 9. Backend

- No backend changes in Phase 4. `legacy-redirects.ts` not extended
  (Memory + Reps + Library URLs stay where they are, so no new 301s
  needed). The hooks chain composed in Phase 3 (`handleLegacyRedirects`
  -> `handleAppRequest`) is unchanged.
- No new server load, no new form action, no new BC entry point.
- Page-anchor guard runs in Vitest unit project; not a server-time
  concern.

## 10. Schema

- No DB schema changes. No migrations. No Drizzle changes.
- `PAGE_EXPLAINER_KEYS.LEARN = 'learn'` adds one new value to the
  validated allowlist -- the `study.user_pref` `page_explainer.dismissed`
  map gains a new accepted key. No migration needed: the JSON map
  is open-shaped and the validator is the authoritative gate.

---

## Convergent root-cause fixes

- **page-anchor coverage** -- six pages were missing the testid. The
  static guard surfaced them in one pass; all fixed with one edit per
  file (or, for handbook + regulations sections, the `<h1>` already
  carried the title -- just needed the testid). The guard now runs
  in Vitest CI and will catch the next regression at static-check time.
- **Dropdown removal** -- four pieces of state, four handlers, one
  window listener, ~100 lines of CSS all removed in one pass. No
  half-finished trail.

## After-fix verification

- `bun run check` -- baseline accepted errors only (`fast-xml-parser`,
  `@ab/aviation`, `three`, `@ab/bc-sim/persistence`,
  `libs/help/search.ts implicit-any`). No new errors. No warnings.
- `apps/study` Vitest suite -- the new `page-anchor-guard.test.ts`
  passes (2/2). The HelpLayout test was updated to read
  `page-anchor` instead of `helplayout-title`; passes (4/4 in
  `libs/help/__tests__`). Other test failures in the suite (~21)
  are preexisting jsdom/`@testing-library/user-event` infrastructure
  issues, unchanged from `origin/main`.
- Grep for `nav-memory`, `nav-flight`, `nav-help`, `nav-reps` testids
  -- only one match: the negative-assertion list in the Phase 4 nav
  lock test. No live references.
- Grep for `<details class="nav-menu"` -- no matches in the diff
  baseline.
