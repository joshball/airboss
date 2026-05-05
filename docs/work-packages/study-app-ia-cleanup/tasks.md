---
title: 'Tasks: Study App IA Cleanup'
product: study
feature: study-app-ia-cleanup
type: tasks
status: unread
review_status: pending
created: 2026-05-04
---

# Tasks: Study App IA Cleanup

Phased build via `/ball-wp-build` once the spec is signed off. Status legend: `[x]` done, `[ ]` pending.

## Pre-flight

- [ ] Read [spec.md](./spec.md) end to end.
- [ ] Read [design.md](./design.md) -- routes table, content model, e2e strategy.
- [ ] Read [docs/work/plans/20260504-study-app-ia-cleanup.md](../../work/plans/20260504-study-app-ia-cleanup.md) for context on each Q1-Q11.
- [ ] Read [libs/bc/study/src/goals.ts](../../../libs/bc/study/src/goals.ts) and [libs/bc/study/src/plans.ts](../../../libs/bc/study/src/plans.ts) -- confirm the BC distinction the UI is preserving.
- [ ] Read [libs/constants/src/routes.ts](../../../libs/constants/src/routes.ts) -- catalogue the routes that move and the new constants we will add.
- [ ] Read [apps/study/src/routes/(app)/+layout.svelte](../../../apps/study/src/routes/(app)/+layout.svelte) -- the current 12-entry nav.
- [ ] Read [tests/e2e/smoke.spec.ts](../../../tests/e2e/smoke.spec.ts) and [tests/e2e/study-home.spec.ts](../../../tests/e2e/study-home.spec.ts) -- existing e2e patterns to match.

## Phase 1 -- Home + first-run + explain-everything plumbing

Goal: ship the daily-CTA Home, the four explanation surfaces, and the testid convention.

### 1.1 Content source (`libs/help/`)

- [x] Add typed entry map for tooltip definitions: `libs/help/src/glossary/entries.ts` -- `{ key, term, short, longRef, related[] }`.
- [x] Author seed entries for every term in [spec.md](./spec.md) glossary (CTA, IA, BC, Qual, Goal, Plan, Syllabus, Knowledge node, Cards, Reps, Session, Domain, Lens, Calibration, First-run, E2E, testid, Page anchor, Explainer, Glossary drawer -- 20 entries).
- [x] Long-form markdown corpus under `libs/help/src/glossary/content/` (one `.md` per term, 20 files).
- [x] Loader function: `getGlossaryEntry(key)` + `listGlossaryEntries()` + `stripFrontmatter()` returns merged short + long. Vitest unit tests for the loader (9 cases).
- [x] Update [VOCABULARY.md](../../platform/VOCABULARY.md) with Quals, Plan, CTA, IA, BC entries; cross-link to `libs/help/`.

### 1.2 Tooltip primitive (`libs/ui/`)

- [x] `libs/ui/src/components/Tooltip.svelte` -- props `{ for?: string; term?: string; definition?: string; placement?: ...; children: Snippet }`. Reads from a registered glossary resolver (libs/ui stays a leaf in the dep graph; mirrors `info-tip-resolver` pattern). The study app registers via `apps/study/src/lib/help/register.ts`.
- [x] Hover + keyboard focus parity. Touch fallback (tap-to-show); blur / mouseleave dismisses; Esc dismisses + restores focus.
- [x] ARIA: `aria-describedby` on the trigger; tooltip is `role="tooltip"` with a generated id.
- [x] Vitest unit tests for hover, focus, blur, touch, resolver, missing-key, ARIA wiring (7 cases).

### 1.3 Page explainer

- [x] `libs/ui/src/components/PageExplainer.svelte` -- props `{ pageKey: string; title?: string; children: Snippet; globallyHidden?: boolean }`. Collapsible, with per-page dismissal stored in `localStorage` (the `user_pref` migration lands when prefs schema is touched in a future phase; storage seam is one swap). Decision documented inline in the component.
- [x] Per-page `?` button to re-open after dismissal (peek mode -- doesn't clear the dismissal).
- [ ] Settings toggle ("Hide page explainers") -- the component already accepts `globallyHidden` from the layout; the actual Settings UI toggle is **deferred to Phase 2/Settings WP** (no Settings page surface in Phase 1 scope).

### 1.4 Glossary drawer

- [ ] **Deferred from Phase 1.** Glossary content layer + Tooltip primitive ship in this PR; the drawer overlay is best built once the right-cluster slot in `AppHeader.svelte` and the canonical `/reference/glossary` page are both in scope. Splitting it across phases creates a half-mounted trigger. Re-scope into Phase 3 (where `/reference/glossary` lands), keeping the content + entries already authored.

### 1.5 Number `?` popover

- [ ] **Deferred from Phase 1.** The existing `<InfoTip>` primitive already covers number explainers in `/session/start`; replacing every Home tile metric in one pass is best done after the Home is observed in practice. Re-scope into a dedicated number-explainer slice that lands alongside the Insights rename (Phase 3) so the formula link can target `/insights/...` directly.

### 1.6 Home rebuild (`/study`)

- [x] `apps/study/src/routes/(app)/study/+page.svelte` rebuilt as the daily-CTA home.
- [x] Three states (loader-driven): no goal, goal + no plan, goal + plan. Loader fans out `getPrimaryGoal` + `getActivePlan` and returns one of three discriminated payloads.
- [x] Primary CTA per state: "Set your first goal" / "Build a plan for {goal}" / "Start today's session".
- [ ] Secondary pressure CTAs (review backlog, due reps) -- existing `TilesPanel` already renders these in the goal+plan state. The dedicated `home-cta-secondary` testid is **deferred** until those tiles get the dedicated CTA shape; the panel shows them today as cards, not as the spec's "Review {n} due" / "Run {n} reps" shape.
- [x] `data-testid="page-anchor"` on the `<h1>`. `data-testid="home-cta-primary"` on the big button. `data-testid="first-run-set-goal-cta"` on the no-goal CTA.
- [x] Page explainer at top: "Why am I here?" -- 2-3 sentences with embedded Tooltips for `goal` / `plan`.
- [x] Tooltips on Goal / Plan terms wherever they appear in the Home banner copy.

### 1.7 Best-practices doc

- [x] Add new "E2E selectors" section to [docs/agents/best-practices.md](../../agents/best-practices.md). Verbatim convention from [design.md](./design.md) "E2E strategy".

### 1.8 E2E (Phase 1 slice)

- [x] Stub `tests/e2e/ia-flow.spec.ts` with the FLOW const containing only `ROUTES.STUDY` for now. Adds routes phase by phase.
- [x] Author `tests/e2e/ia-first-run.spec.ts` -- fresh user with no goal: Home shows only the "Set your first goal" CTA. Learn + Insights soft-disable assertions deferred until the five-section nav lands (Phase 4).
- [x] `bun run check` clean (only pre-existing baseline `fast-xml-parser` error remains; verified present on `main`).

### Phase 1 commit point

`feat(study): home + explain-everything plumbing`

## Phase 2 -- Program consolidation

Goal: roll Quals + Goal + Plan onto one `/program` surface with sub-tabs.

### 2.1 Routes + constants

- [x] Add to [libs/constants/src/routes.ts](../../../libs/constants/src/routes.ts): `PROGRAM`, `PROGRAM_TAB(tab)`, `PROGRAM_QUAL(slug)`, `PROGRAM_GOAL(id)`, `PROGRAM_PLAN(id)`, plus the `?tab=` query param key in `QUERY_PARAMS.PROGRAM_TAB`.
- [x] Add `NAV_LABELS.PROGRAM`.

### 2.2 Surface

- [x] `apps/study/src/routes/(app)/program/+layout.svelte` -- tab strip with four tabs: Quals / Goal / Plan / Coverage. Each tab has `data-testid="program-tab-{name}"`.
- [x] `apps/study/src/routes/(app)/program/+page.server.ts` -- routes to the active tab via `?tab=`. Default tab = Goal when one exists, else Quals.
- [x] `apps/study/src/routes/(app)/program/quals/[slug]/+page.svelte` -- existing credential detail content moved here (via `git mv` to preserve history).
- [x] `apps/study/src/routes/(app)/program/goals/[id]/+page.svelte` -- existing goal detail. Primary CTA: "Build my plan" (no plan) or "Start studying" (plan exists). `data-testid="goal-detail-start-cta"`.
- [x] `apps/study/src/routes/(app)/program/plans/[id]/+page.svelte` -- existing plan detail moved here.
- [x] Per-tab page explainer (4 new keys in `PAGE_EXPLAINER_KEYS`).
- [x] `/program/coverage` -- new placeholder summary tab.

### 2.3 Nav update

- [x] Replace Quals / Goals / Plans nav entries with single Program link in [apps/study/src/routes/(app)/+layout.svelte](../../../apps/study/src/routes/(app)/+layout.svelte). `data-testid="nav-program"`.

### 2.4 E2E (Phase 2 slice)

- [x] Expand `ia-flow.spec.ts` FLOW with Program + sub-tabs.
- [x] Author `tests/e2e/ia-goal-to-session.spec.ts` -- populated goal -> "Start studying" -> session entry.

### Phase 2 commit point

`feat(study): program surface (quals + goal + plan)`

## Phase 3 -- Insights + Reference rename, redirects

Goal: rename `/dashboard` -> `/insights`, fold Calibration + Lens under Insights, fold Knowledge + Glossary under Reference, install 301 redirects for every old path.

### 3.1 Routes + constants

- [x] Add to [libs/constants/src/routes.ts](../../../libs/constants/src/routes.ts): `INSIGHTS`, `INSIGHTS_CALIBRATION`, `INSIGHTS_LENS`, `INSIGHTS_LENS_HANDBOOK`, `INSIGHTS_LENS_HANDBOOK_DOC`, `INSIGHTS_LENS_HANDBOOK_CHAPTER`, `INSIGHTS_LENS_WEAKNESS`, `INSIGHTS_LENS_WEAKNESS_BUCKET`, `REFERENCE`, `REFERENCE_KNOWLEDGE`, `REFERENCE_KNOWLEDGE_SLUG`, `REFERENCE_KNOWLEDGE_LEARN`, `REFERENCE_KNOWLEDGE_LEARN_AT`, `REFERENCE_GLOSSARY`, `REFERENCE_GLOSSARY_ID`. Old constants (`DASHBOARD`, `CALIBRATION`, `LENS_*`, `KNOWLEDGE*`, `GLOSSARY*`) kept as `@deprecated` aliases that point at the new paths so external bookmarks in scripts / docs continue to work; in-app callers were migrated to the new constants in this phase.
- [x] Add corresponding `NAV_LABELS` (`INSIGHTS`, `INSIGHTS_CALIBRATION`, `INSIGHTS_LENS`, `REFERENCE`, `REFERENCE_KNOWLEDGE`, `REFERENCE_GLOSSARY`). Q7 noted "Training / Progress / Reference" as a possible label-only swap; Phase 3 ships with "Insights" / "Reference" because the URL family already uses those names and the spec's section taglines describe Insights' role more accurately than "Progress" alone.

### 3.2 Surfaces

- [x] Move `/dashboard/*` content to `/insights/*` via `git mv` (preserves history).
- [x] Move `/calibration/*` to `/insights/calibration/*`.
- [x] Move `/lens/*` to `/insights/lens/*`.
- [x] Move `/knowledge/*` to `/reference/knowledge/*`.
- [x] Move `/glossary/*` to `/reference/glossary/*` (the canonical glossary page; the drawer mounts content from the same source).
- [x] New `/reference/+page.svelte` section index.
- [x] Page explainers on each new index page (insights, calibration, lens-handbook, reference, reference-knowledge, reference-glossary -- six new keys registered in `PAGE_EXPLAINER_KEYS`).
- [x] Insights index also fixes the page-anchor on glossary's shared `ReferencePage` component.

### 3.3 Redirects

- [x] `apps/study/src/hooks.server.ts` extended with a `handleLegacyRedirects` Handle composed via `sequence(handleLegacyRedirects, handleAppRequest)`. Runs FIRST (before auth/session) so unauthenticated users hitting `/dashboard` 301 cleanly to `/insights`. Pure resolver in `apps/study/src/lib/server/legacy-redirects.ts` -- 19 patterns covering `/dashboard`, `/calibration`, `/lens/*`, `/knowledge/*`, `/glossary/*`, plus the Phase 2 `/credentials`, `/goals`, `/plans` rename batch.
- [x] Author `tests/e2e/ia-redirect.spec.ts` -- every legacy path asserts status 301 + correct `Location` pathname (and a query-string preservation case).
- [x] Vitest unit tests for the resolver in `apps/study/src/lib/server/legacy-redirects.test.ts` (10 cases).

### 3.4 Glossary drawer + MetricExplainer (deferred from Phase 1)

- [x] `libs/ui/src/components/GlossaryDrawer.svelte` -- searchable list of glossary entries with an inline expanded detail view, mounted via the new `glossarySlot` snippet on `AppHeader`. Entries are passed in as a prop (libs/ui leaf rule); the study layout sources them from `@ab/help/glossary` via `listGlossaryEntries()`.
- [x] `libs/ui/src/lib/glossary-drawer-state.svelte.ts` -- minimal state machine with Vitest unit tests (6 cases) covering open/close, toggle, selection, and search-clear-on-input transitions.
- [x] `libs/ui/src/components/MetricExplainer.svelte` -- number `?` popover that renders label + value + click-to-open formula / glossary deep-link. Unit tests (4 cases) cover the closed-state, the popover open behaviour, the glossary link, and Esc-to-close.
- [x] `libs/ui/src/components/AppHeader.svelte` gains an optional `glossarySlot` snippet so the drawer mounts in the right cluster between Help search and Flightbag.

### 3.5 E2E (Phase 3 slice)

- [x] Expand `ia-flow.spec.ts` FLOW with Insights + Reference + their children (insights, insights-calibration, insights-lens-handbook, insights-lens-weakness, reference, reference-knowledge, reference-glossary).

### Phase 3 commit point

`feat(study): insights + reference rename with 301 redirects`

## Phase 4 -- Drop dropdowns, finalize section nav

Goal: remove Memory dropdown, remove local Help dropdown, lock the five-section nav and the testid contract.

### 4.1 Nav cleanup

- [x] Remove the `<details>` Memory dropdown in [apps/study/src/routes/(app)/+layout.svelte](../../../apps/study/src/routes/(app)/+layout.svelte). Replaced with a single `nav-learn` link to `/study/learn` (per Q6: section index pages carry sub-nav).
- [x] Remove the local Help dropdown. Global Help search in `AppHeader.svelte` (Phase 1) plus per-page `<PageHelp>` triggers cover every prior affordance; the local `<details>` block is gone with no feature gap.
- [x] Memory child routes (`/memory/browse`, `/memory/new`, `/memory/review`) stay at their existing URLs (per design.md). The nav surface is unified under Learn via the new `LearnTabs.svelte` strip mounted on `/study/learn`, `/memory`, `/reps`, and `/library` index pages.
- [x] Final five top-level entries with testids: `nav-home`, `nav-learn`, `nav-program`, `nav-insights`, `nav-reference`. Locked by the `ia-flow.spec.ts` "top nav exposes exactly the five locked testids" assertion.

### 4.2 CI guard

- [x] Static guard (`apps/study/src/lib/server/page-anchor-guard.ts` + `.test.ts`) walks every `+page.svelte` under `apps/study/src/routes/(app)/` at Vitest time and fails the build if any route does not surface `data-testid="page-anchor"` (directly, via `_panels/*`, or via a canonical wrapper component). Static check runs in `bun run check` -> Vitest -> the unit-node project.
- [x] Playwright `ia-flow.spec.ts` walks the same routes at runtime and asserts the anchor is *visible*; the static guard catches missing anchors at unit-test time before they reach Playwright.

### 4.3 Final E2E pass

- [x] `ia-flow.spec.ts` FLOW expanded: home, learn, learn-cards, learn-cards-browse, learn-cards-new, learn-reps, learn-reps-browse, learn-read, program (+ four sub-tab anchors), insights, insights-calibration, insights-lens-handbook, insights-lens-weakness, reference, reference-knowledge, reference-glossary. New `top nav exposes exactly the five locked testids` test asserts the contract directly.
- [x] `bun run check` clean (only the accepted baseline errors: `fast-xml-parser`, `@ab/aviation`, `three`, `@ab/bc-sim/persistence`, `libs/help/search.ts implicit-any`).

### Phase 4 commit point

`feat(study): drop dropdowns, lock five-section nav`

Squash commits on main (final shipping record):

- Phase 1 -- `a10403a3` `Phase 1: study IA cleanup -- home rebuild + explain-everything plumbing (#649)`
- Phase 2 -- `459ef36c` `feat(study): program surface (quals + goal + plan) (#650)`
- Phase 3 -- `8cc496b1` `feat(study): insights + reference rename with 301 redirects (#653)`
- Phase 4 -- (filled in after merge)

## Post-implementation

- [ ] Manual walkthrough of every step in [test-plan.md](./test-plan.md) by Joshua.
- [x] Phase-by-phase consolidated review walks (`/ball-review-10x` substitute -- the harness can't dispatch parallel reviewers). Phase 1 + 2 + 3 + 4 review files all under `docs/work/reviews/2026-05-05-study-ia-cleanup-phase{1,2,3,4}-*.md`. Findings closed inline.
- [x] Update [docs/products/study/PRD.md](../../products/study/PRD.md) -- IA section reflects the new five-section structure.
- [x] Update [docs/products/study/ROADMAP.md](../../products/study/ROADMAP.md) -- mark this WP complete.
- [ ] Archive [docs/work/plans/20260504-study-app-ia-cleanup.md](../../work/plans/20260504-study-app-ia-cleanup.md) (move to `.archive/` once shipped). *Trigger: after Joshua's manual walkthrough closes.*
- [ ] Sweep walkthrough todo ([20260504-03-goal-detail-walkthrough-TODO.md](../../work/todos/20260504-03-goal-detail-walkthrough-TODO.md)) -- mark items resolved by this WP, leave the rest for follow-up. *Trigger: after Joshua's manual walkthrough closes.*
- [ ] Set `status: done`, `review_status: done` on [spec.md](./spec.md). *Joshua flips after walkthrough.*
