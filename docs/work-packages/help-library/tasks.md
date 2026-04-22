---
title: 'Tasks: Help Library'
product: study
feature: help-library
type: tasks
status: unread
---

# Tasks: Help Library

## Pre-flight

- [ ] Read [docs/work/todos/20260422-reference-system-architecture.md](../../work/todos/20260422-reference-system-architecture.md) -- libs/help, cross-library search, routes sections.
- [ ] Read [docs/work/reviews/2026-04-22-app-wide-ux.md](../../work/reviews/2026-04-22-app-wide-ux.md) -- map gaps to the seven help pages in spec.md.
- [ ] Confirm wp-reference-system-core has landed `@ab/aviation` with `ReferenceText.svelte`, the registry, and the wiki-link scanner. This WP consumes them; blocking dependency.
- [ ] Read `libs/constants/src/routes.ts` -- follow the existing pattern for `ROUTES` entries.
- [ ] Read `apps/study/src/routes/(app)/+layout.svelte` -- understand nav structure before adding Help entry.

## Implementation

### Phase 1 -- libs/help workspace + schema + registry

- [ ] Create `libs/help/` workspace with `package.json` (`@ab/help`), `tsconfig.json`, `src/index.ts` barrel.
- [ ] Wire `@ab/help` into the root `package.json` workspaces list and `tsconfig` path aliases.
- [ ] Create `libs/help/src/schema/help-section.ts` -- `HelpSection` type + `HelpTags`, `AppSurface`, `HelpKind` enums.
- [ ] Create `libs/help/src/schema/help-page.ts` -- `HelpPage` type.
- [ ] Create `libs/help/src/schema/help-registry.ts` -- `HelpRegistry` type + in-memory singleton implementation (`registerPages`, `getAllPages`, `getPage`, `search` stub).
- [ ] Create `libs/help/src/validation.ts` -- tag-axis gates, unique-id gates, `documents` path gate, `related` resolution gate.
- [ ] Unit tests: registry idempotent re-registration; validation catches missing required tags; validation catches duplicate section ids.
- [ ] Run `bun run check` -- 0 errors. Commit.

### Phase 2 -- UI primitives

- [ ] Create `libs/help/src/ui/HelpLayout.svelte` -- page shell: TOC sidebar, main column, search slot.
- [ ] Create `libs/help/src/ui/HelpSection.svelte` -- collapsible section with anchor id, renders markdown body through `ReferenceText.svelte` from `@ab/aviation`.
- [ ] Create `libs/help/src/ui/HelpTOC.svelte` -- nested TOC, aria-current on the section in view.
- [ ] Create `libs/help/src/ui/HelpCard.svelte` -- pull-out card primitive for how-to snippets inside a section body.
- [ ] Export from `libs/help/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors. Commit.

### Phase 3 -- Cross-library search + query parser

- [ ] Create `libs/help/src/search.ts` -- `search(query, filters)` that calls `@ab/aviation`'s search, combines with the help index, returns `{ aviation: Result[], help: Result[] }` grouped by library with explicit source-type labels.
- [ ] Create `libs/help/src/query-parser.ts` -- parse `tag:X rules:ifr "exact phrase"` into structured `SearchFilters` + free-text term. Grammar documented in design.md.
- [ ] Implement within-category ranking: exact-match on display name or alias, then alias-match, then keyword/body match. No cross-category implicit ranking.
- [ ] Create `libs/help/src/ui/HelpSearch.svelte` -- search widget with grouped results, library + source-type labels, filter chips, keyboard shortcuts (`/` focus, `[`/`]` jump groups, Enter activate, Escape close).
- [ ] Unit tests: query parser round-trip for each facet; ranking order for exact vs alias vs keyword matches; grouping preserves library boundaries.
- [ ] Run `bun run check` -- 0 errors. Commit.

### Phase 4 -- Study app help content

- [ ] Create `apps/study/src/lib/help/content/` directory.
- [ ] Author `getting-started.ts` -- sections covering what airboss is, how to start, invite-only note (addresses login dev-accounts + no-signup gap).
- [ ] Author `dashboard.ts` -- one section per dashboard panel (CTA, reviews-due, scheduled-reps, calibration, weak-areas, activity, cert-progress, map, study-plan).
- [ ] Author `memory-review.ts` -- FSRS review flow, rating semantics, confidence-prompt determinism.
- [ ] Author `reps-session.ts` -- decision rep flow, confidence sampling predictability, skip-set behavior, keyboard shortcuts.
- [ ] Author `calibration.ts` -- what the score means, overconfident vs underconfident reading, what to do about gaps.
- [ ] Author `knowledge-graph.ts` -- 7 phases, dual-gate mastery, discovery-first pedagogy, how to navigate the graph.
- [ ] Author `keyboard-shortcuts.ts` -- every kbd binding in the app, cross-linked to the page it applies to.
- [ ] Create `apps/study/src/lib/help/index.ts` -- aggregated `studyHelpPages` export.
- [ ] Run `bun run check` -- validation passes on all seven pages, 0 errors. Commit.

### Phase 5 -- Routes, nav, registration

- [ ] Add `HELP` and `HELP_SLUG(slug)` entries to `libs/constants/src/routes.ts`.
- [ ] Create `apps/study/src/lib/help/register.ts` -- calls `registerPages(studyHelpPages)` from `@ab/help`.
- [ ] Call `register.ts` from the root layout `+layout.ts` load function (module-init path, runs once per server boot).
- [ ] Create `apps/study/src/routes/(app)/help/+page.server.ts` -- loads `getAllPages()`, groups by `appSurface`.
- [ ] Create `apps/study/src/routes/(app)/help/+page.svelte` -- grouped index list via `HelpLayout`.
- [ ] Create `apps/study/src/routes/(app)/help/[slug]/+page.server.ts` -- loads `getPage(slug)`, 404 on miss.
- [ ] Create `apps/study/src/routes/(app)/help/[slug]/+page.svelte` -- renders the page through `HelpLayout` + `HelpSection`.
- [ ] Mount `HelpSearch` in `apps/study/src/routes/(app)/+layout.svelte` top nav (button + Cmd+K palette).
- [ ] Add Help nav item linking to `ROUTES.HELP`.
- [ ] Run `bun run check` -- 0 errors. Commit.

## Post-implementation

- [ ] Full manual test per test-plan.md.
- [ ] Request implementation review.
- [ ] Commit docs updates.
