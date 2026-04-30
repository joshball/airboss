---
title: 'Tasks: Evidence Kind Data Layer'
product: study
feature: evidence-kind-data-layer
type: tasks
status: unread
review_status: pending
---

# Tasks: Evidence Kind Data Layer

Phased plan to ship the substrate that closes the three `not_applicable` shims in WP B (`evidence-kind-gating`). Each phase is independently revertable; commits + push happen at the end of each phase.

Anchors: [spec](./spec.md), [design](./design.md), [test plan](./test-plan.md).

## Phase 0 -- Pre-flight

- [ ] Confirm WP B shipped on main: `git log --oneline | grep evidence-kind-gating` shows commit `597b0943` or successor.
- [ ] Confirm migrations directory state: `ls drizzle/` shows `0000_initial.sql`, `0001_engine_goal_cutover.sql`, `0002_evidence_kind_gating.sql`. The new migration takes `0003_*`.
- [ ] Confirm sign-off on the six open questions (a)-(f). No work begins until each is resolved or the user signs "do the right thing" defaults explicitly.

## Phase 1 -- Constants + types

Goal: land the constant + type contract so subsequent phases (schema, BC, authoring) can import from `@ab/constants` against a stable shape.

- [ ] `libs/constants/src/study.ts`: add `CARD_KINDS`, `CardKind`, `CARD_KIND_VALUES`, `CARD_KIND_LABELS`. Position after `CARD_TYPES` block.
- [ ] `libs/constants/src/study.ts`: add `SCENARIO_DEFAULT_ASSESSMENT_METHODS`. Position alongside `ASSESSMENT_METHODS`.
- [ ] `libs/constants/src/study.ts`: extend `SESSION_ITEM_KINDS` with `TEACHING_EXERCISE: 'teaching-exercise'`. `SESSION_ITEM_KIND_VALUES` regenerates via `Object.values`.
- [ ] `libs/types/src/index.ts`: re-export `CardKind` (and any other new types if external consumers will read them) from `@ab/constants`. No duplication, just re-export.
- [ ] `bun run check` passes -- exhaustive `switch` over `SessionItemKind` in any consumer breaks here. Surface the consumers; they get fixed in Phase 5 (BC + UI handlers). For Phase 1, add `// TODO: handle teaching-exercise (evidence-kind-data-layer Phase 5)` in any unavoidable site to keep the build green if the set is large; otherwise fix inline.
- [ ] Commit: `feat(constants): card kinds, scenario default methods, teaching-exercise session-item-kind`. Push.

## Phase 2 -- Schema + migration

Goal: ship the migration. Schema changes are metadata-only (PostgreSQL >= 11 ADD COLUMN with DEFAULT), so the migration is fast on any size table.

- [ ] `libs/bc/study/src/schema.ts`:
  - `card`: add `kind: text('kind').notNull().default(CARD_KINDS.RECALL)`. Add `cardKindCheck` CHECK constraint via `inList(CARD_KIND_VALUES)`.
  - `card`: add `cardUserKindIdx: index('card_user_kind_idx').on(t.userId, t.kind)`.
  - `scenario`: add `assessmentMethods: jsonb('assessment_methods').$type<AssessmentMethod[]>().notNull().default([ASSESSMENT_METHODS.SCENARIO])`.
  - `sessionItemResult.itemKindCheck`: regenerated from the expanded `SESSION_ITEM_KIND_VALUES` (drop + recreate via Drizzle migration).
  - New `teachingExercise` table per the spec's SQL block. Mirrors `scenario`'s shape (id, userId FK to bauthUser, title, prompt, domain, nodeId optional FK to knowledgeNode, isEditable, status default 'active', seedOrigin, createdAt). Indexes on `(user_id, node_id)`.
  - `sessionItemResult`: add `teachingExerciseId: text('teaching_exercise_id').references(() => teachingExercise.id, { onDelete: 'set null' })`. Nullable.
- [ ] Generate migration: `bun run db:generate`. Output should land at `drizzle/0003_evidence_kind_data_layer.sql`. Hand-audit the SQL to confirm:
  - Three `ALTER TABLE ADD COLUMN` (card.kind, scenario.assessment_methods, session_item_result.teaching_exercise_id).
  - One `CREATE TABLE study.teaching_exercise`.
  - One `DROP CONSTRAINT sir_item_kind_check` + `ADD CONSTRAINT sir_item_kind_check` (the expanded value list).
  - One CHECK on `card.kind`.
  - Two indexes (`card_user_kind_idx`, `teaching_exercise_user_node_idx`).
- [ ] Apply locally: `bun run db:migrate`. Verify `\d study.card` shows `kind`, `\d study.scenario` shows `assessment_methods`, `\d study.teaching_exercise` exists.
- [ ] Add a Phase-4 follow-up task: BC-level CHECK that ties `(item_kind = 'teaching-exercise') = (teaching_exercise_id IS NOT NULL)`. Defer to Phase 4 to avoid blocking Phase 2 on a constraint that depends on the BC writing rows.
- [ ] Commit: `feat(schema): card.kind + scenario.assessment_methods + teaching_exercise table`. Push.

## Phase 3 -- BC: cards + scenarios + teaching-exercises CRUD

Goal: BC functions accept and write the new fields. Authoring routes can persist via the BC.

- [ ] `libs/bc/study/src/cards.ts`:
  - `createCard` / `updateCard`: accept optional `kind?: CardKind`. Default `CARD_KINDS.RECALL` on create when omitted.
  - Validate input: `kind` must be in `CARD_KIND_VALUES`. Throw `InvalidCardKindError` (new error class) when not.
  - New helper `getCardsForNodeByKind(userId, nodeId, kind, db?)`. Powers the partitioned read (used downstream by mastery in Phase 5; ship the helper now so tests can write against it).
- [ ] `libs/bc/study/src/scenarios.ts`:
  - `createScenario` / `updateScenario`: accept optional `assessmentMethods?: AssessmentMethod[]`. Default `[ASSESSMENT_METHODS.SCENARIO]` on create.
  - Validate: non-empty, every entry in `ASSESSMENT_METHOD_VALUES`, no duplicates. Throw `InvalidAssessmentMethodError`.
  - New helper `getScenariosForNodeByMethod(userId, nodeId, method, db?)`. Same shape pattern.
- [ ] `libs/bc/study/src/teaching-exercises.ts` (NEW):
  - Drizzle row types `TeachingExerciseRow`, `NewTeachingExerciseInput`, `TeachingExercisePatch`.
  - CRUD: `getTeachingExercises`, `getTeachingExercise`, `createTeachingExercise`, `updateTeachingExercise`, `deleteTeachingExercise`. Mirror `scenarios.ts`'s shape.
  - IDs via `createId('texr_')` (or another stable prefix; pick one and ship in `@ab/utils`).
  - `TeachingExerciseNotFoundError`.
- [ ] Yaml-cards parser (`scripts/db/seed-cards.ts`):
  - `ParsedCard` shape gains `kind?: CardKind`.
  - Parse fence: read `rec.kind` (string) -- if present, validate against `CARD_KIND_VALUES`; if absent, default to `CARD_KINDS.RECALL`.
  - Write the value through to `seedCardsForUser` insert.
- [ ] Scenario seed (`scripts/db/seed-content.ts`):
  - `ScenarioRecord` shape gains `assessmentMethods?: AssessmentMethod[]`.
  - Validate at parse time. Default `[ASSESSMENT_METHODS.SCENARIO]` when omitted.
  - Pass through to insert.
- [ ] Tests: unit tests for `createCard` (kind validation), `createScenario` (methods validation), `createTeachingExercise` (basic CRUD).
- [ ] Commit: `feat(bc-study): card kind, scenario assessment methods, teaching-exercise CRUD`. Push.

## Phase 4 -- Authoring UI + audit scripts

Goal: hangar surfaces the new fields in editors. Audit scripts let the content team see the migration's default vs explicit distribution.

- [ ] Hangar card editor (find via `apps/hangar/src/routes/cards/...` or wherever card editing lives -- if none exists yet, surface the field on the relevant create form):
  - Add a `kind` select (RecallCalculation labels from `CARD_KIND_LABELS`). Default `recall`.
  - Required on save. Form action validates against `CARD_KIND_VALUES`.
- [ ] Hangar scenario editor:
  - Multi-checkbox over `[scenario, demonstration, recall, calculation]` (filtered subset; teaching is excluded since teaching-exercises are a separate kind).
  - Default `['scenario']`. At least one required.
- [ ] `scripts/db.ts` dispatcher: add `check scenario-assessment-methods` and `check card-kinds` subcommands.
  - `check scenario-assessment-methods`: SELECT count(*) GROUP BY assessment_methods. Output: `default: N, explicit: M, breakdown by methods array`.
  - `check card-kinds`: same shape, GROUP BY (domain, kind).
- [ ] BC-level CHECK constraint (deferred from Phase 2): `(item_kind = 'teaching-exercise') = (teaching_exercise_id IS NOT NULL)`. Add as a Drizzle check on `sessionItemResult`. Drizzle generates a follow-up migration; or fold into `0003` if not yet pushed to a shared environment. Recommended: separate `0004_session_item_teaching_exercise_check.sql` so `0003` stays clean.
- [ ] Run audit scripts locally against seed data. Verify output is sane.
- [ ] Commit: `feat(hangar): card kind + scenario methods editing; check scripts`. Push.

## Phase 5 -- Mastery wire-up

Goal: rewire `mastery.ts` shims into real partition queries. After this phase, every per-kind gate computes against authored data.

- [ ] `libs/bc/study/src/mastery.ts` `getNodeEvidenceStateMap`:
  - **Cards by kind partition.** Replace the single cards query with one that groups by `(card.node_id, card.kind)`. Output a per-(node, kind) totals + mastered counts. Drive `recall` and `calculation` gates from the matching partition (zero rows for a kind on a node => `not_applicable`).
  - **Scenarios by method partition.** Replace the single reps query with one that does `LATERAL UNNEST(scenario.assessment_methods) AS method` (cast through `jsonb_array_elements_text`). Group by `(scenario.node_id, method)`. Drive `scenario` and `demonstration` gates from the matching partition.
  - **Teaching-exercise gate.** New query: `session_item_result` JOIN `teaching_exercise` ON `teaching_exercise_id`. Filter by `item_kind = 'teaching-exercise'` AND completed AND not skipped AND `teaching_exercise.user_id = userId`. Group by `teaching_exercise.node_id`. Drive `teaching` gate via `computeRepGate`.
- [ ] Remove the file-header documentation block that names the shims (lines 11-37 of `mastery.ts`). Replace with a brief note that the per-kind partition is now real, with pointers to spec / design.
- [ ] Remove the inline `NODE_MASTERY_GATES.NOT_APPLICABLE` constants from the loop end of `getNodeEvidenceStateMap` (the three explicit shim lines for `calculation`, `demonstration`, `teaching`). Replaced by computed values.
- [ ] Update existing `mastery.test.ts` cases that hardcoded `calculation: NOT_APPLICABLE` etc. as expected outputs. The card-only-on-S-leaf semantic stays; the explicit values change.
- [ ] Add new test cases per the spec's "Tests" section (item 10):
  - Calc-only learner on a K leaf reads as not-mastered with `missingKinds=['recall']`.
  - Hybrid scenario tagged `['scenario','demonstration']` satisfies both gates.
  - CFI learner with three completed `teaching-exercise` rows on a node masters a leaf with `requires_teaching=true` (in concert with the K cards).
  - CFI learner without teaching exercises reads as not-mastered with `missingKinds=['teaching']`.
- [ ] Grep verification:
  - `grep -nE "NOT_APPLICABLE.*(calculation|demonstration|teaching)" libs/bc/study/src/mastery.ts` returns empty (no shims left).
  - `grep -nE "card\\.kind|scenario\\.assessment_methods|teaching_exercise" libs/bc/study/src/mastery.ts` returns the expected partition queries.
- [ ] `bun test libs/bc/study/src/mastery.test.ts` passes.
- [ ] Commit: `feat(mastery): real per-kind partitions replace WP B not_applicable shims`. Push.

## Phase 6 -- Verification + handoff

- [ ] `bun run check` -- zero errors, zero warnings.
- [ ] `bun test` (full BC suite) -- green.
- [ ] `bun run db:check` (drizzle metadata audit) -- the 0003 migration matches schema.ts.
- [ ] Run audit scripts:
  - `bun run db check scenario-assessment-methods` -- expect "all rows default" pre-content-update.
  - `bun run db check card-kinds` -- expect majority `recall` per the migration default.
- [ ] Grep for `not_applicable` in `mastery.ts` -- the only matches should be in the function defaults / fallback cases, not in the per-kind partition logic.
- [ ] Grep for "honest" in commits authored by this WP -- zero.
- [ ] PR title / body update via `gh pr edit`:
  - Title: `feat(evidence-kind-data-layer): card.kind + scenario.assessment_methods + teaching-exercise item kind`
  - Body: scope shipped, defaults applied per Open Questions, follow-on CFI ACS-25 transcription WP referenced.
- [ ] Append final summary to `.ball-coord/to-dispatcher.md`.

## Out of scope (do not start in this WP)

- CFI ACS-25 transcription -- separate content WP.
- Engine selection changes (engine prefers cards/scenarios that close evidence-kind gaps) -- separate WP.
- Per-kind threshold tunings (`CARD_MIN`, `REP_MIN`) -- defer until data shows a need.
- Teaching-exercise UX runtime in sessions (engine pick + UI render) -- separate WP.
- GIN index on `scenario.assessment_methods` -- only if profiling shows the LATERAL UNNEST is a bottleneck.
