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
