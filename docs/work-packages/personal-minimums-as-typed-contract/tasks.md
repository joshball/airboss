---
id: personal-minimums-as-typed-contract
title: 'Tasks: Personal Minimums as a Typed Contract'
product: study
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-13
owner: agent
depends_on: []
unblocks:
  - xc-viewer-personal-minimums-overlay
  - decision-debrief-replay
  - logbook-ingestion
tags:
  - personal-minimums
  - weather
  - decision-making
  - typed-primitive
  - lens
  - go-nogo
  - tasks
legacy_fields:
  feature: personal-minimums-as-typed-contract
  type: tasks
---

# Tasks: Personal Minimums as a Typed Contract

Phased plan for [spec.md](./spec.md). Order is dependency-driven: constants + ID generator + Zod schema first (A), then DB schema + BC + lens (B), then the editor surface (C), then the implications subpanel + course nudge (D), then automated + manual close (E). Each phase opens its own PR titled `feat(personal-minimums): <phase> -- <summary>`.

Depends on: none (pure additive). The new table is independent of every existing primitive; the lens is a pure function. The page lives under the existing study app's `(app)` group and inherits auth + layout from there.

## Pre-flight

- [x] Read [spec.md](./spec.md), [design.md](./design.md), [test-plan.md](./test-plan.md), [user-stories.md](./user-stories.md), [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md), [CONSUMER-CONTRACT.md](./CONSUMER-CONTRACT.md) end-to-end.
- [x] Read [course/knowledge/weather/personal-minimums/node.md](../../../course/knowledge/weather/personal-minimums/node.md) -- the pedagogy this primitive persists.
- [x] Read [docs/decisions/011-knowledge-graph-learning-system/decision.md](../../decisions/011-knowledge-graph-learning-system/decision.md) -- the prose/mechanism split.
- [x] Read [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../decisions/016-cert-syllabus-goal-model/decision.md) -- sibling lens shapes.
- [x] Read [docs/decisions/025-wp-frontmatter-contract/decision.md](../../decisions/025-wp-frontmatter-contract/decision.md) -- WP frontmatter contract.
- [x] Read `libs/bc/study/src/schema.ts` carefully -- the `card`, `review`, `cardState` tables are the shape reference; the existing partial-index + composite-FK patterns model the active-record discipline.
- [x] Read `libs/utils/src/ids.ts` -- prefix-ULID convention.
- [x] Read `libs/bc/study/src/lenses.ts` -- existing lens shapes; `projectAgainstPersonalMinimums` should feel like a peer.
- [x] Read `libs/bc/study/src/index.ts` and `libs/bc/study/src/server.ts` -- the runtime / server barrel split. The lens lives in the runtime barrel (pure function); the BC API lives in `/server`.
- [x] Read `libs/types/src/work-package.ts` (if it exists) and similar existing Zod schema files for the project Zod style.
- [x] Read `docs/agents/best-practices.md` and `docs/agents/common-pitfalls.md`.
- [x] Verify the dev DB is reachable: `bun run db status`.
- [x] Run `bun run check` -- 0 errors before starting.

## Implementation

### Phase A: constants + types + ID + Zod schema (foundation)

Foundational; blocks Phases B/C/D. Ships the constants module, the ID generator, the Zod input schema, and the `ConformanceResult` + `PersonalMinimumsObservation` types in `@ab/types`. No DB schema yet; no BC yet; no UI yet. Phase A is pure-code with unit tests so subsequent phases can land against a stable contract.

PR title: `feat(personal-minimums): Phase A -- constants + types + ID + Zod schema`.

#### A.1 Constants

- [x] Create `libs/constants/src/personal-minimums.ts` with `PERSONAL_MINIMUMS_DEFAULTS` and `PERSONAL_MINIMUMS_CONSTRAINTS` per spec.md "Constants" section. The `_DEFAULTS` values match the FAA P-8740-25 Solo / VFR column; the `_CONSTRAINTS` table carries the min/max bounds.
- [x] Re-export from `libs/constants/src/index.ts`.
- [x] Add the two new route constants `STUDY_PERSONAL_MINIMUMS` and `STUDY_PERSONAL_MINIMUMS_HISTORY` to `libs/constants/src/routes.ts` (under the existing study-app route grouping).
- [x] Run `bun run check` -- 0 errors. Commit (`feat(constants): personal-minimums defaults + constraints + routes`).

#### A.2 ID generator

- [x] Add `generatePersonalMinimumsId = (): string => createId('pmin')` to `libs/utils/src/ids.ts`. Place it under the Study BC section (the table lives in the study schema).
- [x] Add a one-line doc comment naming the table the prefix maps to.
- [x] Run `bun run check` -- 0 errors. Commit (`feat(utils): generatePersonalMinimumsId() -> pmin_<ULID>`).

#### A.3 Zod input schema + lens types

- [x] Create `libs/types/src/personal-minimums.ts` exporting:
  - `personalMinimumsInputSchema` (Zod) per spec.md "Zod schema" section, with the `crosswindTotalKt <= windTotalKt` refinement.
  - `PersonalMinimumsInput = z.infer<typeof personalMinimumsInputSchema>`.
  - `PersonalMinimumsObservation` interface (the lens input shape).
  - `ConformanceResult` interface (the lens output shape).
- [x] Re-export from `libs/types/src/index.ts`.
- [x] Add a JSDoc on each exported symbol citing this WP and the knowledge-node id (`wx-personal-minimums`).
- [x] Run `bun run check` -- 0 errors. Commit (`feat(types): personal-minimums input schema + lens types`).

#### A.4 Phase A close

- [x] Add unit tests at `libs/types/src/__tests__/personal-minimums.test.ts`:
  - Schema accepts the `PERSONAL_MINIMUMS_DEFAULTS` shape directly.
  - Schema rejects `ceilingFt: -1` with a path of `['ceilingFt']`.
  - Schema rejects `crosswindTotalKt: 25, windTotalKt: 20` with a path of `['crosswindTotalKt']`.
  - Schema rejects `visibilitySm: 150` (over max) with a path of `['visibilitySm']`.
  - Schema rejects `notes: <4001 char string>` with a path of `['notes']`.
- [x] Run `bun test libs/types` -- all green. Run `bun run check` -- 0 errors.
- [x] Open PR `feat(personal-minimums): Phase A -- constants + types + ID + Zod schema`. Body summarizes the constants + the Zod refinement + the lens-type contract.

### Phase B: DB schema + BC API + lens projection

Ships the `study.personal_minimums` table, the BC functions (`getActivePersonalMinimums`, `getPersonalMinimumsHistory`, `createPersonalMinimumsRevision`, `deactivatePersonalMinimums`), and the lens projection (`projectAgainstPersonalMinimums`). Regenerates `drizzle/0000_initial.sql` from the updated schema per repo discipline (no migration file).

PR title: `feat(personal-minimums): Phase B -- DB schema + BC API + lens projection`.

#### B.1 Drizzle table

- [x] Add `personalMinimums` table to `libs/bc/study/src/schema.ts` per spec.md "Data model" section. Column shape, CHECK constraints, partial unique index, and the two read-indexes all match the spec table.
- [x] Re-export `PersonalMinimumsRow` and `NewPersonalMinimumsRow` (`$inferSelect` / `$inferInsert`).
- [x] Regenerate the drizzle baseline via `drizzle-kit generate`. Per `drizzle/README.md` the legitimate path is a journaled `drizzle-kit generate` (the project uses `db push`, never hand-written numbered migrations); this co-generated `drizzle/0001_personal_minimums.sql` + the journal/snapshot entry. The runtime schema source of truth stays `libs/**/schema.ts`.
- [x] Run `bun run db reset && bun run db seed` -- confirm the new table exists, the partial index applies, and `seed` runs clean.
- [x] Run `bun run check` -- 0 errors. Commit (`feat(bc-study): personal_minimums Drizzle table + indexes + checks`).

#### B.2 BC API (server-only)

- [x] Create `libs/bc/study/src/personal-minimums.ts` exporting:
  - `getActivePersonalMinimums(userId): Promise<PersonalMinimumsRow | null>` -- selects WHERE `user_id = $1 AND is_active = true` LIMIT 1.
  - `getPersonalMinimumsHistory(userId): Promise<PersonalMinimumsRow[]>` -- selects WHERE `user_id = $1` ORDER BY `effective_from DESC`.
  - `createPersonalMinimumsRevision(userId, input: PersonalMinimumsInput): Promise<PersonalMinimumsRow>` -- transactional:
    1. UPDATE the existing active row: `SET is_active = false, effective_until = now() WHERE user_id = $1 AND is_active = true`.
    2. INSERT the new row with `is_active = true, effective_from = now(), effective_until = null`, ID via `generatePersonalMinimumsId()`.
    3. Emit `audit_log` row referencing both prior and next via `auditWrite` from `@ab/audit`.
    4. Return the new row.
  - `deactivatePersonalMinimums(userId): Promise<void>` -- UPDATE the existing active row: `SET is_active = false, effective_until = now()`. No insert. Emits audit_log.
- [x] Use the existing `db` import from `@ab/db/connection` and the `auditWrite` helper from `@ab/audit`.
- [x] Re-export every function from `libs/bc/study/src/server.ts` (the server-only barrel).
- [x] Do NOT re-export from `libs/bc/study/src/index.ts` -- the BC mutates the DB; runtime barrel must stay browser-safe.
- [x] Run `bun run check` -- 0 errors. Commit (`feat(bc-study): personal-minimums BC API (read + revision + deactivate)`).

#### B.3 Lens projection (browser-safe pure function)

- [x] Create `libs/bc/study/src/personal-minimums-lens.ts` exporting `projectAgainstPersonalMinimums(minimums: PersonalMinimumsRow, observation: PersonalMinimumsObservation): ConformanceResult`. Pure function -- no DB, no fs, no node:* imports. Implements:
  - Per-field comparison (ceiling, visibility, windTotal, crosswind) producing the `fields.*.{observed, floor, withinFloor}` triple.
  - Overall `pass`: `'within'` when every field is within floor; `'below'` when any field is below; `'unknown'` when `minimums` is null (the function signature says it isn't, but callers may pass null -- guard explicitly and document).
  - `notes[]` carries human-readable "ceiling 800 ft AGL below your 1500 ft floor at KMKL" strings.
  - Night-aware: when `observation.isNight === true`, the function reads the same numeric floors (v1 does not split day-vs-night floors per spec; see OUT-OF-SCOPE.md for the future day/night split).
- [x] Re-export from `libs/bc/study/src/index.ts` as a value re-export. Verify `check-browser-globals.ts` accepts it (the file must have zero node:* imports and zero `@ab/db/connection` reach).
- [x] Run `bun run check` -- 0 errors. Commit (`feat(bc-study): personal-minimums lens projection (browser-safe)`).

#### B.4 Phase B close

- [x] Add unit tests at `libs/bc/study/src/__tests__/personal-minimums.test.ts`:
  - `getActivePersonalMinimums` returns null when the user has no records.
  - `createPersonalMinimumsRevision` against a clean state returns a row with `is_active = true` + `effective_until = null`.
  - A second `createPersonalMinimumsRevision` for the same user flips the first row's `is_active = false` and stamps `effective_until` non-null, and the new row carries `is_active = true`.
  - `getPersonalMinimumsHistory` returns both rows ordered by `effective_from DESC`.
  - `deactivatePersonalMinimums` flips the active row without inserting; subsequent `getActivePersonalMinimums` returns null.
  - The partial unique index rejects two simultaneous `is_active = true` rows for the same user (insert directly, expect a unique-constraint failure).
- [x] Add unit tests at `libs/bc/study/src/__tests__/personal-minimums-lens.test.ts`:
  - All-within observation produces `pass: 'within'`, every field's `withinFloor: true`.
  - Ceiling below floor produces `pass: 'below'`, `fields.ceiling.withinFloor: false`, `notes` contains the per-field message.
  - Crosswind below floor produces `pass: 'below'`.
  - The function is pure (call twice with the same inputs, deep-equal output).
- [x] Run `bun test libs/bc/study` -- all green. Run `bun run check` -- 0 errors.
- [x] Open PR `feat(personal-minimums): Phase B -- DB schema + BC API + lens projection`. Body summarizes the table shape + BC functions + lens contract.

### Phase C: editor surface

Ships the `/personal-minimums` reader + editor + history pages under the study app. v1 is form-based (no in-place inline editing of individual fields; the entire form opens, the entire form saves). Inline validation surfaces Zod failures before submit.

PR title: `feat(personal-minimums): Phase C -- editor surface (study app)`.

#### C.1 Reader / editor page

- [ ] Create `apps/study/src/routes/(app)/personal-minimums/+page.server.ts`:
  - `load`: read the active record via `getActivePersonalMinimums(locals.user.id)` and the latest 5 history rows via `getPersonalMinimumsHistory(locals.user.id)`.
  - `actions.save`: validate FormData via `personalMinimumsInputSchema.safeParse`; on failure return `fail(400, { errors })`; on success call `createPersonalMinimumsRevision(locals.user.id, input)`; redirect back to the page.
  - `actions.deactivate`: call `deactivatePersonalMinimums(locals.user.id)`; redirect.
- [ ] Create `apps/study/src/routes/(app)/personal-minimums/+page.svelte`:
  - Renders the active record (or the empty-state form pre-seeded with `PERSONAL_MINIMUMS_DEFAULTS`).
  - "Edit" toggle opens the form inline; per-field controls are `<input type="number">` with min/max attributes mirroring `PERSONAL_MINIMUMS_CONSTRAINTS`.
  - Form submission uses SvelteKit's `enhance` to keep the active record visible while saving.
  - On save: shows a toast / banner ("saved at HH:MM; effective immediately") and re-renders the new active record in read mode.
  - Uses existing UI primitives from `@ab/ui` for inputs, buttons, and the banner.
- [ ] Add an `+layout` breadcrumb or nav-link from the existing study app navigation pointing at `/personal-minimums` (use the existing nav pattern -- this WP doesn't reshape navigation).
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(study/personal-minimums): reader + editor page`).

#### C.2 History page

- [ ] Create `apps/study/src/routes/(app)/personal-minimums/history/+page.server.ts`: loads `getPersonalMinimumsHistory(locals.user.id)`.
- [ ] Create `apps/study/src/routes/(app)/personal-minimums/history/+page.svelte`:
  - Lists every revision, newest first, with `effective_from` -> `effective_until` window and the per-field values.
  - Read-only; no edit / delete controls. (Editing happens by creating a new revision on the main page.)
  - Notes field renders rendered markdown if present (server-side render via the existing markdown pipeline).
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(study/personal-minimums): read-only history page`).

#### C.3 Phase C close

- [ ] Add Playwright e2e tests at `tests/e2e/personal-minimums.spec.ts`:
  - Empty-state: pilot navigates to `/personal-minimums`, sees the empty state pre-seeded with defaults, fills the form, saves, sees the saved record.
  - Edit flow: existing record renders in read mode; click Edit, change ceiling, save, see the new value as active.
  - Validation: enter `crosswindTotalKt: 25, windTotalKt: 20` and submit; expect the inline error to surface and the save NOT to fire.
  - History: after two edits, `/personal-minimums/history` shows three rows (one active + two superseded) ordered newest-first.
- [ ] Run `bun test:e2e tests/e2e/personal-minimums.spec.ts` -- all green. Run `bun run check` -- 0 errors.
- [ ] Open PR `feat(personal-minimums): Phase C -- editor surface (study app)`. Body summarizes the routes + form actions + e2e coverage.

### Phase D: implications subpanel + knowledge-node nudge

Ships the "Show what these minimums imply" subpanel on the main page + a short course-step nudge pointing learners from the existing `wx-personal-minimums` knowledge node to the new editor surface.

PR title: `feat(personal-minimums): Phase D -- implications subpanel + course nudge`.

#### D.1 Implications subpanel

- [ ] Create `apps/study/src/routes/(app)/personal-minimums/_lib/implications.ts` (server-only helper for `+page.server.ts`):
  - Loads every registered wx-engine scenario via `WX_SCENARIO_VALUES`. For each, reads `data/wx-scenarios/<slug>/truth.json` lazily.
  - For each scenario's `truth.airMasses[*]` (and the chained station registry), builds a synthetic `PersonalMinimumsObservation` (ceiling, visibility, wind, crosswind, isNight derived from `validAt`).
  - Calls `projectAgainstPersonalMinimums(activeMinimums, observation)` for each station x scenario pair.
  - Returns `{ scenario: string; station: string; result: ConformanceResult }[]` flattened, filtered to `pass: 'below'` entries.
- [ ] Wire the helper into `+page.server.ts:load` -- only call it when `activeMinimums !== null`.
- [ ] Update `+page.svelte` to render the subpanel below the active record. If `activeMinimums === null`, render a placeholder ("set your minimums to see implications"). If `activeMinimums` is set, render the list of violations grouped by scenario.
- [ ] Add a "night currency could not be verified -- once logbook ingestion ships this will say something" placeholder block. The placeholder is intentional -- it pre-wires the UX seam for the future logbook consumer.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(study/personal-minimums): implications subpanel against wx-engine scenarios`).

#### D.2 Course-step nudge

- [ ] Identify the existing course-step in `course/courses/` that teaches the `wx-personal-minimums` node (search `applied_by` references and existing study-plan sections; the weather-comprehensive course likely already has a step that cites this node).
- [ ] Add a one-paragraph trailing nudge to that course step pointing at `/personal-minimums` ("Now that you understand why -- record yours here"). Use the existing markdown directives the course-step renderer supports.
- [ ] If no such course step exists, add a short note to `course/knowledge/weather/personal-minimums/node.md` "Practice" section pointing at the route (do NOT rewrite the node's pedagogy).
- [ ] Run `bun run check` -- 0 errors. Commit (`docs(course): nudge from wx-personal-minimums node to /personal-minimums route`).

#### D.3 Phase D close

- [ ] Extend the Playwright spec from C.3 to cover the implications subpanel:
  - With an active record whose ceiling is high (5000 ft) and visibility is high (10 SM), the subpanel renders the "no violations" empty state.
  - With an active record whose ceiling is low (500 ft), the subpanel surfaces at least one wx-engine scenario as a violation.
  - The night-currency placeholder is always visible (informational, not behind a query).
- [ ] Run `bun test:e2e tests/e2e/personal-minimums.spec.ts` -- all green. Run `bun run check` -- 0 errors.
- [ ] Open PR `feat(personal-minimums): Phase D -- implications subpanel + course nudge`. Body summarizes the implication checks + the nudge.

### Phase E: review + close

Final pass: run `/ball-review-full`, fix every finding, regenerate consumer-contract example values once a wx-engine scenario has actually been run against the new minimums, set `agent_review_status: done`, hand off to user for the manual walk-through.

PR title: `chore(personal-minimums): Phase E -- review + close`.

#### E.1 Full review

- [ ] Run `/ball-review-full` against the entire surface: `libs/types/src/personal-minimums.ts`, `libs/constants/src/personal-minimums.ts`, `libs/utils/src/ids.ts` (the new line), `libs/bc/study/src/{schema.ts,personal-minimums.ts,personal-minimums-lens.ts}`, `apps/study/src/routes/(app)/personal-minimums/**`, `tests/e2e/personal-minimums.spec.ts`.
- [ ] Fix every finding (critical, major, minor, nit -- the entire review is a punch list per the repo discipline).
- [ ] Re-run `bun run check` and the e2e spec -- both clean.

#### E.2 Consumer-contract polish

- [ ] If the review surfaced any drift between `CONSUMER-CONTRACT.md` and the shipped code (function signature changes, additional fields, additional `notes[]` shapes), update the contract doc.
- [ ] Add a one-line pointer from the xc-viewer follow-on backlog (see [xc-viewer VISION.md](../../vision/products/pre-flight/xc-viewer/VISION.md)) acknowledging that this WP is the unblocking primitive.

#### E.3 WP close

- [ ] Set `agent_review_status: done` on every WP file in this directory.
- [ ] Update `docs/work/NOW.md` to flag the WP as ready for human walk-through (per the repo's NOW.md discipline; do NOT change `human_review_status` -- that's user-only).
- [ ] Open the final PR titled `chore(personal-minimums): Phase E -- review + close`. Body lists the review findings fixed + the consumer-contract polish.
- [ ] Hand off to user for `human_review_status: walked` -> `signed-off`.

## Final close

- [ ] All five phases shipped. The new table exists with revision history; the BC API works; the lens projection is pure and browser-safe; the editor surface renders; the implications subpanel surfaces real violations; the course-step nudge points learners at the editor.
- [ ] `bun run wp show personal-minimums-as-typed-contract` returns a clean read with `status: draft -> in-flight -> signed-off` ready for the user to flip to `shipped` after their walk-through.
- [ ] The CONSUMER-CONTRACT.md is the entrypoint for every future consumer (xc-viewer-personal-minimums-overlay, decision-debrief-replay, logbook-ingestion); each gets its own WP that depends on this one.
