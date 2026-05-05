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

- [ ] Add typed entry map for tooltip definitions: `libs/help/src/glossary/entries.ts` -- `{ key, term, short, longRef, related[] }`.
- [ ] Author seed entries for every term in [spec.md](./spec.md) glossary (CTA, IA, BC, Qual, Goal, Plan, Syllabus, Knowledge node, Cards, Reps, Session, Domain, Lens, Calibration, First-run, E2E, testid, Page anchor, Explainer).
- [ ] Long-form markdown corpus under `libs/help/src/glossary/content/` (one `.md` per term).
- [ ] Loader function: `getGlossaryEntry(key)` returns merged short + long. Vitest unit tests for the loader.
- [ ] Update [VOCABULARY.md](../../platform/VOCABULARY.md) with Quals, Plan, CTA, IA, BC entries; cross-link to `libs/help/`.

### 1.2 Tooltip primitive (`libs/ui/`)

- [ ] `libs/ui/src/components/Tooltip.svelte` -- props `{ for: string; placement?: 'top'|'bottom'|'left'|'right' }`. Reads from `getGlossaryEntry`.
- [ ] Hover + keyboard focus parity. Touch fallback (tap-to-show, tap-outside-to-dismiss).
- [ ] ARIA: `aria-describedby` on the trigger; tooltip is `role="tooltip"`.
- [ ] Vitest unit tests for hover, focus, blur, touch behavior.

### 1.3 Page explainer

- [ ] `libs/ui/src/components/PageExplainer.svelte` -- props `{ pageKey: string; title: string; body: Snippet }`. Collapsible, with per-page dismissal stored in `user_pref` (or local storage if no schema yet).
- [ ] Per-page `?` button to re-open after dismissal.
- [ ] Settings toggle ("Hide page explainers") -- one boolean in user prefs. When true, all explainers default-collapsed.

### 1.4 Glossary drawer

- [ ] `libs/ui/src/components/GlossaryDrawer.svelte` -- right-cluster `?` button opens drawer overlay. Searchable list (case-insensitive substring match on term + short + long).
- [ ] Mounts in `AppHeader.svelte` right cluster (next to Flightbag link).
- [ ] Esc / overlay click to dismiss. Trap focus while open.

### 1.5 Number `?` popover

- [ ] `libs/ui/src/components/MetricExplainer.svelte` -- props `{ value: number|string; label: string; formula?: string; entryKey?: string }`. Hover -> one-liner; click `?` -> popover with formula and link to glossary entry.
- [ ] Wire it into Home's "12 due" / "6 ready" tiles as the first consumer.

### 1.6 Home rebuild (`/study`)

- [ ] `apps/study/src/routes/(app)/study/+page.svelte` rebuilt as the daily-CTA home.
- [ ] Three states (loader-driven): no goal, goal + no plan, goal + plan.
- [ ] Primary CTA per state: "Set your first goal" / "Build a plan for {goal}" / "Start today's session".
- [ ] Secondary pressure CTAs (review backlog, due reps) shown only in goal + plan state.
- [ ] `data-testid="page-anchor"` on the `<h1>`. `data-testid="home-cta-primary"` on the big button. `data-testid="home-cta-secondary"` on each pressure CTA.
- [ ] Page explainer at top: "Why am I here?" -- 2-3 sentences.
- [ ] Tooltips on Quals / Goal / Plan terms wherever they appear.

### 1.7 Best-practices doc

- [ ] Add new "E2E selectors" section to [docs/agents/best-practices.md](../../agents/best-practices.md). Verbatim convention from [design.md](./design.md) "E2E strategy".

### 1.8 E2E (Phase 1 slice)

- [ ] Stub `tests/e2e/ia-flow.spec.ts` with the FLOW const containing only `ROUTES.STUDY` for now. Adds routes phase by phase.
- [ ] Author `tests/e2e/ia-first-run.spec.ts` -- Abby with no goal: Home shows only the "Set your first goal" CTA, Learn + Insights nav links are soft-disabled.
- [ ] `bun run check` clean.

### Phase 1 commit point

`feat(study): home + explain-everything plumbing`

## Phase 2 -- Program consolidation

Goal: roll Quals + Goal + Plan onto one `/program` surface with sub-tabs.

### 2.1 Routes + constants

- [ ] Add to [libs/constants/src/routes.ts](../../../libs/constants/src/routes.ts): `PROGRAM`, `PROGRAM_TAB(tab)`, `PROGRAM_QUAL(slug)`, `PROGRAM_GOAL(id)`, `PROGRAM_PLAN(id)`, plus the `?tab=` query param key in `QUERY_PARAMS.PROGRAM_TAB`.
- [ ] Add `NAV_LABELS.PROGRAM`.

### 2.2 Surface

- [ ] `apps/study/src/routes/(app)/program/+layout.svelte` -- tab strip with four tabs: Quals / Goal / Plan / Coverage. Each tab has `data-testid="program-tab-{name}"`.
- [ ] `apps/study/src/routes/(app)/program/+page.svelte` -- routes to the active tab via `?tab=`. Default tab = Goal when one exists, else Quals.
- [ ] `apps/study/src/routes/(app)/program/quals/[slug]/+page.svelte` -- existing credential detail content moved here.
- [ ] `apps/study/src/routes/(app)/program/goals/[id]/+page.svelte` -- existing goal detail. Primary CTA: "Build my plan" (no plan) or "Start studying" (plan exists). `data-testid="goal-detail-start-cta"`.
- [ ] `apps/study/src/routes/(app)/program/plans/[id]/+page.svelte` -- existing plan detail moved here.
- [ ] Per-tab page explainer.

### 2.3 Nav update

- [ ] Replace Quals / Goals / Plans nav entries with single Program link in [apps/study/src/routes/(app)/+layout.svelte](../../../apps/study/src/routes/(app)/+layout.svelte). `data-testid="nav-program"`.

### 2.4 E2E (Phase 2 slice)

- [ ] Expand `ia-flow.spec.ts` FLOW with Program + sub-tabs.
- [ ] Author `tests/e2e/ia-goal-to-session.spec.ts` -- populated goal -> "Start studying" -> session entry.

### Phase 2 commit point

`feat(study): program surface (quals + goal + plan)`

## Phase 3 -- Insights + Reference rename, redirects

Goal: rename `/dashboard` -> `/insights`, fold Calibration + Lens under Insights, fold Knowledge + Glossary under Reference, install 301 redirects for every old path.

### 3.1 Routes + constants

- [ ] Add to [libs/constants/src/routes.ts](../../../libs/constants/src/routes.ts): `INSIGHTS`, `INSIGHTS_CALIBRATION`, `INSIGHTS_LENS`, `INSIGHTS_LENS_HANDBOOK`, `INSIGHTS_LENS_WEAKNESS`, `REFERENCE`, `REFERENCE_KNOWLEDGE`, `REFERENCE_GLOSSARY`.
- [ ] Add corresponding `NAV_LABELS` (subject to Q7 -- Training/Progress/Reference vs Program/Insights/Reference).

### 3.2 Surfaces

- [ ] Move `/dashboard/+page.svelte` content to `/insights/+page.svelte`.
- [ ] Move `/calibration/*` to `/insights/calibration/*`.
- [ ] Move `/lens/*` to `/insights/lens/*`.
- [ ] Move `/knowledge/*` to `/reference/knowledge/*`.
- [ ] Move `/glossary/*` to `/reference/glossary/*` (the canonical glossary page; the drawer mounts content from the same source).
- [ ] Page explainers on each new index page.

### 3.3 Redirects

- [ ] `apps/study/src/hooks.server.ts` (or extend if exists) -- 301 redirect map for every renamed path. See `redirectMap` table in [design.md](./design.md).
- [ ] Author `tests/e2e/ia-redirect.spec.ts` -- every old path returns 301 to its new home.

### 3.4 E2E (Phase 3 slice)

- [ ] Expand `ia-flow.spec.ts` FLOW with Insights + Reference + their children.

### Phase 3 commit point

`feat(study): insights + reference rename with 301 redirects`

## Phase 4 -- Drop dropdowns, finalize section nav

Goal: remove Memory dropdown, remove local Help dropdown, lock the five-section nav and the testid contract.

### 4.1 Nav cleanup

- [ ] Remove the `<details>` Memory dropdown in [apps/study/src/routes/(app)/+layout.svelte](../../../apps/study/src/routes/(app)/+layout.svelte). Replace with a single `nav-learn` link to `/study/learn` (or fold into Home with a tab strip per Q6).
- [ ] Remove the local Help dropdown. Global Help in `AppHeader.svelte` is the only Help.
- [ ] Memory child routes (`/memory/browse`, `/memory/new`, `/memory/review`) become sub-nav on the Learn -> Cards index page (tab strip), not top-level nav items.
- [ ] Final five top-level entries with testids: `nav-home`, `nav-learn`, `nav-program`, `nav-insights`, `nav-reference`.

### 4.2 CI guard

- [ ] Add a check (script or test) that fails the build if any route under `apps/study/src/routes/(app)/**` ships without `data-testid="page-anchor"` on its `<h1>`. Implement as a Playwright test that walks `ia-flow.spec.ts` FLOW and asserts `page-anchor` visibility on each.

### 4.3 Final E2E pass

- [ ] `ia-flow.spec.ts` includes every top-level route + every Program tab. Asserts no console errors.
- [ ] `bun run check` clean.

### Phase 4 commit point

`feat(study): drop dropdowns, lock five-section nav`

## Post-implementation

- [ ] Manual walkthrough of every step in [test-plan.md](./test-plan.md) by Joshua.
- [ ] `/ball-review-full` for a parallel review pass; fix everything before flipping `status: done`.
- [ ] Update [docs/products/study/PRD.md](../../products/study/PRD.md) -- IA section reflects the new five-section structure.
- [ ] Update [docs/products/study/ROADMAP.md](../../products/study/ROADMAP.md) -- mark this WP complete.
- [ ] Archive [docs/work/plans/20260504-study-app-ia-cleanup.md](../../work/plans/20260504-study-app-ia-cleanup.md) (move to `.archive/` once shipped).
- [ ] Sweep walkthrough todo ([20260504-03-goal-detail-walkthrough-TODO.md](../../work/todos/20260504-03-goal-detail-walkthrough-TODO.md)) -- mark items resolved by this WP, leave the rest for follow-up.
- [ ] Set `status: done`, `review_status: done` on [spec.md](./spec.md).
