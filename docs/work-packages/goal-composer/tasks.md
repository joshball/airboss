---
title: 'Tasks: Goal Composer'
product: study
feature: goal-composer
type: tasks
status: draft
review_status: pending
created: 2026-04-28
adr: 016
phase: 9
---

# Tasks: Goal Composer (ADR 016 phase 9)

Status: draft. Phased build via `/ball-wp-build` once spec is signed off.

Status legend: `[x]` done, `[ ]` pending.

## Phase 1 -- Index page (`/goals`)

- [ ] `apps/study/src/routes/(app)/goals/+page.server.ts` -- load `listGoals(userId)` + `getPrimaryGoal(userId)`; group rows by status
- [ ] `apps/study/src/routes/(app)/goals/+page.svelte` -- grouped list (active / paused / completed / abandoned), primary pinned, star toggle calls `setPrimaryGoal`
- [ ] "New goal" CTA -> `/goals/new`
- [ ] Empty state: zero goals total -> hero card with "Create your first goal" + brief copy
- [ ] Empty state: zero goals in a status group -> collapsed group with count `0`
- [ ] Loader unit tests (Vitest): grouping + primary-pinning logic

## Phase 2 -- Create page (`/goals/new`)

- [ ] `+page.server.ts` -- `create` action: parse with `createGoalInputSchema`, call `createGoal`, redirect to `/goals/[id]`
- [ ] `+page.svelte` -- form with title, notes (markdown textarea), target date (optional), `is_primary` checkbox
- [ ] Inline Zod error rendering using `fail(400, { error, fieldErrors })` shape from plans-detail
- [ ] Cancel button -> `/goals`
- [ ] Loader unit test: redirect on auth fail; action unit test: schema rejection round-trip

## Phase 3 -- Detail page read mode (`/goals/[id]`)

- [ ] `+page.server.ts` -- `load`: `getOwnedGoal`, `getGoalSyllabi`, `getGoalNodes`, `getGoalNodeUnion`; throw 404 on `GoalNotFoundError` / `GoalNotOwnedError`
- [ ] `+page.svelte` -- header (title, status pill, primary star, target date), notes (rendered markdown), syllabus list, node list, "node union: N" summary
- [ ] Status action buttons: pause / resume / complete / abandon (each calls `updateGoal` action with the new status)
- [ ] "Make primary" button (single form action -> `setPrimaryGoal`)
- [ ] "Archive" button (`archiveGoal`); confirms via `ConfirmAction` component then redirects to `/goals`
- [ ] Action map for `GoalAlreadyPrimaryError` -> inline 400 with friendly copy

## Phase 4 -- Detail page edit mode (`/goals/[id]?edit=1`)

- [ ] Edit toggle: clicking "Edit" appends `?edit=1`; "Save" / "Cancel" strip it
- [ ] Edit form: title, notes, target date (cleared with explicit "no target date"), status select
- [ ] `update` action: parse with `updateGoalInputSchema`, call `updateGoal`, redirect to `/goals/[id]` (no edit param)
- [ ] Syllabus-picker modal mounted in edit mode
- [ ] Node-picker modal mounted in edit mode (see Phase 5)
- [ ] Per-row weight sliders for `goal_syllabus` and `goal_node`; blur saves via `setGoalSyllabusWeight` / `setGoalNodeWeight`
- [ ] Per-row "Remove" buttons via `removeGoalSyllabus` / `removeGoalNode`

## Phase 5 -- Node picker (the new interaction)

- [ ] `apps/study/src/routes/(app)/goals/[id]/_node-picker.svelte` -- modal component
- [ ] Filter chips: domain (multi), cert relevance (multi via `CERT_VALUES`), lifecycle (skeleton/started/complete)
- [ ] Text search box, debounced 200 ms; queries `listNodesWithFacets({ q, domains, certs, lifecycle })`
- [ ] Result list: virtualised if needed; row shows title, domain badge, lifecycle pill, primary cert
- [ ] Already-attached nodes greyed out and disabled
- [ ] "Add" -> `addGoalNode` form action; on success, modal stays open and the row flips to disabled
- [ ] Empty / no-match copy
- [ ] Picker unit tests (Vitest): filter combination + already-attached suppression
- [ ] Picker e2e (Playwright): open, filter, search, add, close

## Phase 6 -- Help, polish, tests

- [ ] `apps/study/src/lib/help/content/goals.ts` -- HelpPage covering compose flow, primary semantics, status lifecycle, node-picker tips
- [ ] PageHelp drawer mounted on `/goals`, `/goals/new`, `/goals/[id]`
- [ ] Theme tokens only -- no hex colours; pass `bun run lint:theme`
- [ ] Playwright e2e: full create + compose + primary + archive flow
- [ ] Vitest: every action error class mapped (404 / 400 / inline)
- [ ] `bun run check` clean

## Phase 7 -- Verification

- [ ] User walks the test plan; flips `status: done` in spec/tasks/test-plan/design/user-stories
- [ ] Agent flips `review_status: done` after `/ball-review-full` closes findings
- [ ] Update `docs/work/NOW.md`: mark ADR 016 phase 9 complete; remove from "in flight"
- [ ] ADR 016 migration table: phase 9 status -> Shipped (PR #...)
