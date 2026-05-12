---
title: 'Tasks: Evidence Kind Data Layer'
product: study
feature: evidence-kind-data-layer
type: tasks
status: read
review_status: done
---

# Tasks: Evidence Kind Data Layer

Phased plan to ship the substrate that closes the three `not_applicable` shims in WP B (`evidence-kind-gating`). Each phase is independently revertable; commits + push happen at the end of each phase.

Anchors: [spec](./spec.md), [design](./design.md), [test plan](./test-plan.md).

## Phase 0 -- Pre-flight

- [x] Confirm WP B shipped on main: `gh pr view 361 --json state` returns `MERGED`. `mastery.ts` file header (lines 11-37) still documents the three shims; this WP closes them.
- [x] Confirm migration baseline: `ls drizzle/` shows `0000_initial.sql` + `0001_hangar_invitation.sql` (the 11-migration history was collapsed in PR #445; PR #449 absorbed #448). The new migration takes `0002_*`.
- [x] Confirm `drizzle/README.md` operating rule: this project uses `drizzle-kit push` for both dev (`bun run db reset`) and the hosted deploy. The `0002_*` SQL file is a diff-accuracy snapshot, not the runtime apply path. Schema in TS is the source of truth.
- [x] Sign-off on the six open questions (a)-(f) recorded 2026-05-03 -- "do the right thing" defaults adopted, re-opening any requires a spec amendment.

## Phase 1 -- Constants + types

Goal: land the constant + type contract so subsequent phases (schema, BC, authoring) can import from `@ab/constants` against a stable shape.

- [x] `libs/constants/src/study.ts:214-225`: add `CARD_KINDS`, `CardKind`, `CARD_KIND_VALUES`, `CARD_KIND_LABELS`. Position after the `CARD_TYPES` / `CARD_TYPE_VALUES` / `CARD_TYPE_LABELS` block.
- [x] `libs/constants/src/study.ts:671-681`: add `SCENARIO_DEFAULT_ASSESSMENT_METHODS = [ASSESSMENT_METHODS.SCENARIO] as const` alongside `ASSESSMENT_METHODS` / `ASSESSMENT_METHOD_VALUES`.
- [x] `libs/constants/src/study.ts:808-816`: extend `SESSION_ITEM_KINDS` with `TEACHING_EXERCISE: 'teaching-exercise'`. `SESSION_ITEM_KIND_VALUES` regenerates via `Object.values`. (Note: `NODE_MODALITIES` already has a `TEACHING_EXERCISE: 'teaching-exercise'` entry at line 663 -- different axis, leave unchanged.)
- [x] `libs/types/src/index.ts`: re-export `CardKind` (and any other new types if external consumers will read them) from `@ab/constants`. No duplication, just re-export.
- [x] `bun run check` passes -- exhaustive `switch` over `SessionItemKind` in any consumer breaks here. Surface the consumers; they get fixed in Phase 5 (BC + UI handlers). For Phase 1, add `// TODO: handle teaching-exercise (evidence-kind-data-layer Phase 5)` in any unavoidable site to keep the build green if the set is large; otherwise fix inline.
- [x] Commit: `feat(constants): card kinds, scenario default methods, teaching-exercise session-item-kind`. Push.

## Phase 2 -- Schema + migration

Goal: ship the migration. Schema changes are metadata-only (PostgreSQL >= 11 ADD COLUMN with DEFAULT), so the migration is fast on any size table.

- [x] `libs/bc/study/src/schema.ts`:
  - `card` (line 326): add `kind: text('kind').notNull().default(CARD_KINDS.RECALL)`. Add `cardKindCheck` CHECK constraint via `sql.raw(`"kind" IN (${inList(CARD_KIND_VALUES)})`)` -- match the existing `cardTypeCheck` pattern at line 386.
  - `card`: add `cardUserKindIdx: index('card_user_kind_idx').on(t.userId, t.kind)` alongside the existing `cardUserStatusIdx` etc. at lines 354-371.
  - `scenario` (line 541): add `assessmentMethods: jsonb('assessment_methods').$type<AssessmentMethod[]>().notNull().default([ASSESSMENT_METHODS.SCENARIO])`.
  - `sessionItemResult.itemKindCheck` (line 907): the existing CHECK uses `inList(SESSION_ITEM_KIND_VALUES)`, so once the constant is extended in Phase 1 the schema picks up the new value automatically. Drizzle generates a DROP + CREATE constraint pair in the migration.
  - New `teachingExercise` table per the spec's SQL block. Mirrors `scenario`'s shape (id, userId FK to bauthUser with `onDelete: 'cascade', onUpdate: 'cascade'`, title, prompt, domain, nodeId optional FK to knowledgeNode with `onDelete: 'set null'`, isEditable, status default 'active', seedOrigin, createdAt). Indexes on `(user_id, node_id)`. Place after the `scenario` / `scenarioOption` block.
  - `sessionItemResult`: add `teachingExerciseId: text('teaching_exercise_id').references(() => teachingExercise.id, { onDelete: 'set null' })`. Nullable.
- [x] Generate migration: `bunx drizzle-kit generate --name=evidence_kind_data_layer`. Output should land at `drizzle/0002_evidence_kind_data_layer.sql`. Hand-audit the SQL to confirm:
  - Three `ALTER TABLE ADD COLUMN` (card.kind, scenario.assessment_methods, session_item_result.teaching_exercise_id).
  - One `CREATE TABLE study.teaching_exercise`.
  - One `DROP CONSTRAINT sir_item_kind_check` + `ADD CONSTRAINT sir_item_kind_check` (the expanded value list).
  - One CHECK on `card.kind`.
  - Two indexes (`card_user_kind_idx`, `teaching_exercise_user_node_idx`).
  - `_journal.json` has the new entry; both files are co-committed.
- [x] Apply locally via the project convention: `bun run db reset` (drops + recreates DB, pushes TS schema, reseeds). Verify `bun run db psql` then `\d study.card` shows `kind`, `\d study.scenario` shows `assessment_methods`, `\d study.teaching_exercise` exists.
- [x] Add a Phase-4 follow-up task: BC-level CHECK that ties `(item_kind = 'teaching-exercise') = (teaching_exercise_id IS NOT NULL)`. Defer to Phase 4 to avoid blocking Phase 2 on a constraint that depends on the BC writing rows.
- [x] Commit: `feat(schema): card.kind + scenario.assessment_methods + teaching_exercise table`. Push.

## Phase 3 -- BC: cards + scenarios + teaching-exercises CRUD

Goal: BC functions accept and write the new fields. Authoring routes can persist via the BC.

- [x] `libs/bc/study/src/cards.ts:104` (`createCard`) and `:168` (`updateCard`):
  - Accept optional `kind?: CardKind` on `CreateCardInput` and `UpdateCardInput`.
  - Default `CARD_KINDS.RECALL` on create when omitted (mirrors how `cardType` defaults are handled today via the zod schema in `validation.ts`).
  - Validate input: `kind` must be in `CARD_KIND_VALUES`. Add `kind` to `newCardSchema` and `updateCardSchema` in `libs/bc/study/src/validation.ts`. Throw `InvalidCardKindError` (new error class) when the BC sees a value outside the enum (defensive -- zod is the primary line of defense).
  - New helper `getCardsForNodeByKind(userId, nodeId, kind, db?)`. Powers the partitioned read (used downstream by mastery in Phase 5; ship the helper now so tests can write against it).
- [x] `libs/bc/study/src/scenarios.ts:199` (`createScenario`) and the corresponding `updateScenario`:
  - Accept optional `assessmentMethods?: AssessmentMethod[]` on `CreateScenarioInput` / `UpdateScenarioInput`.
  - Default `[ASSESSMENT_METHODS.SCENARIO]` on create. Use `SCENARIO_DEFAULT_ASSESSMENT_METHODS` (added in Phase 1) so the constant is the single source of truth.
  - Validate via `newScenarioSchema` / `updateScenarioSchema` in `libs/bc/study/src/validation.ts`: non-empty, every entry in `ASSESSMENT_METHOD_VALUES`, no duplicates. Throw `InvalidAssessmentMethodError`.
  - New helper `getScenariosForNodeByMethod(userId, nodeId, method, db?)`. Same shape pattern.
- [x] `libs/bc/study/src/teaching-exercises.ts` (NEW):
  - Drizzle row types `TeachingExerciseRow`, `NewTeachingExerciseInput`, `TeachingExercisePatch`.
  - CRUD: `getTeachingExercises`, `getTeachingExercise`, `createTeachingExercise`, `updateTeachingExercise`, `deleteTeachingExercise`. Mirror `scenarios.ts`'s shape.
  - IDs via `createId('texr_')` (or another stable prefix; pick one and ship in `@ab/utils`).
  - `TeachingExerciseNotFoundError`.
- [x] Yaml-cards parser (`scripts/db/seed-cards.ts:39-44` `ParsedCard`, `:72-115` parser, `:172-188` insert):
  - `ParsedCard` shape (line 39) gains `kind?: CardKind`.
  - Fence parser (around line 100-111): read `rec.kind` (string) -- if present, validate against `CARD_KIND_VALUES`; if absent, default to `CARD_KINDS.RECALL`. Push the value into the constructed `ParsedCard` at line 111.
  - At the `createCard` call (line 173) pass `kind: c.kind` alongside the existing `cardType` etc.
- [x] Scenario seed (`scripts/db/seed-content.ts:49-58` `SeedScenario`):
  - `SeedScenario` interface gains `assessmentMethods?: readonly AssessmentMethod[]`.
  - The scenario seeder that consumes `ABBY_SCENARIOS` (in `scripts/db/seed-abby.ts` or wherever the array is iterated -- find via `grep -rn "ABBY_SCENARIOS\b" scripts/`) defaults to `SCENARIO_DEFAULT_ASSESSMENT_METHODS` when the field is omitted and passes through to `createScenario`.
  - Optional: tag specific Abby scenarios with explicit methods (e.g. demonstration-flavored maneuver scenarios get `['scenario','demonstration']`) so the partition has non-default sample data for the mastery tests in Phase 5. If scope creeps, leave all on the default and let the audit script surface them.
- [x] Tests: unit tests for `createCard` (kind validation), `createScenario` (methods validation), `createTeachingExercise` (basic CRUD).
- [x] Commit: `feat(bc-study): card kind, scenario assessment methods, teaching-exercise CRUD`. Push.

## Phase 4 -- Authoring UI + audit scripts

Goal: hangar surfaces the new fields in editors. Audit scripts let the content team see the migration's default vs explicit distribution.

- [x] Hangar card editor (find via `apps/hangar/src/routes/cards/...` or wherever card editing lives -- if none exists yet, surface the field on the relevant create form):
  - Add a `kind` select (RecallCalculation labels from `CARD_KIND_LABELS`). Default `recall`.
  - Required on save. Form action validates against `CARD_KIND_VALUES`.
- [x] Hangar scenario editor:
  - Multi-checkbox over `[scenario, demonstration, recall, calculation]` (filtered subset; teaching is excluded since teaching-exercises are a separate kind).
  - Default `['scenario']`. At least one required.
- [x] `scripts/db.ts` dispatcher: add `check scenario-assessment-methods` and `check card-kinds` subcommands.
  - `check scenario-assessment-methods`: SELECT count(*) GROUP BY assessment_methods. Output: `default: N, explicit: M, breakdown by methods array`.
  - `check card-kinds`: same shape, GROUP BY (domain, kind).
- [x] BC-level CHECK constraint (deferred from Phase 2): `(item_kind = 'teaching-exercise') = (teaching_exercise_id IS NOT NULL)`. Add as a Drizzle check on `sessionItemResult`. Since the project uses `db push`, the constraint goes in TS schema and `bun run db reset` re-applies it; the diff-snapshot SQL file lands as `drizzle/0003_session_item_teaching_exercise_check.sql` via a fresh `drizzle-kit generate --name=session_item_teaching_exercise_check`. (Recommended to keep `0002` clean rather than fold the constraint in.)
- [x] Run audit scripts locally against seed data. Verify output is sane.
- [x] Commit: `feat(hangar): card kind + scenario methods editing; check scripts`. Push.

## Phase 5 -- Mastery wire-up

Goal: rewire `mastery.ts` shims into real partition queries. After this phase, every per-kind gate computes against authored data.

- [x] `libs/bc/study/src/mastery.ts` `getNodeEvidenceStateMap`:
  - **Cards by kind partition.** Replace the single cards query with one that groups by `(card.node_id, card.kind)`. Output a per-(node, kind) totals + mastered counts. Drive `recall` and `calculation` gates from the matching partition (zero rows for a kind on a node => `not_applicable`).
  - **Scenarios by method partition.** Replace the single reps query with one that does `LATERAL UNNEST(scenario.assessment_methods) AS method` (cast through `jsonb_array_elements_text`). Group by `(scenario.node_id, method)`. Drive `scenario` and `demonstration` gates from the matching partition.
  - **Teaching-exercise gate.** New query: `session_item_result` JOIN `teaching_exercise` ON `teaching_exercise_id`. Filter by `item_kind = 'teaching-exercise'` AND completed AND not skipped AND `teaching_exercise.user_id = userId`. Group by `teaching_exercise.node_id`. Drive `teaching` gate via `computeRepGate`.
- [x] Remove the file-header documentation block that names the shims (lines 11-37 of `mastery.ts`). Replace with a brief note that the per-kind partition is now real, with pointers to spec / design.
- [x] Remove the inline `NODE_MASTERY_GATES.NOT_APPLICABLE` constants from the loop end of `getNodeEvidenceStateMap` (the three explicit shim lines for `calculation`, `demonstration`, `teaching`). Replaced by computed values.
- [x] Update existing `mastery.test.ts` cases that hardcoded `calculation: NOT_APPLICABLE` etc. as expected outputs. The card-only-on-S-leaf semantic stays; the explicit values change.
- [x] Add new test cases per the spec's "Tests" section (item 10):
  - Calc-only learner on a K leaf reads as not-mastered with `missingKinds=['recall']`.
  - Hybrid scenario tagged `['scenario','demonstration']` satisfies both gates.
  - CFI learner with three completed `teaching-exercise` rows on a node masters a leaf with `requires_teaching=true` (in concert with the K cards).
  - CFI learner without teaching exercises reads as not-mastered with `missingKinds=['teaching']`.
- [x] Grep verification:
  - `grep -nE "NOT_APPLICABLE.*(calculation|demonstration|teaching)" libs/bc/study/src/mastery.ts` returns empty (no shims left).
  - `grep -nE "card\\.kind|scenario\\.assessment_methods|teaching_exercise" libs/bc/study/src/mastery.ts` returns the expected partition queries.
- [x] `bun test libs/bc/study/src/mastery.test.ts` passes.
- [x] Commit: `feat(mastery): real per-kind partitions replace WP B not_applicable shims`. Push.

## Phase 6 -- Verification + handoff

- [x] `bun run check` -- zero errors, zero warnings.
- [x] `bun test` (full BC suite) -- green.
- [x] `bun run db reset --force` against a clean dev DB -- schema applies via `drizzle-kit push`, full seed succeeds, all `study.card` rows land with `kind='recall'`, all `study.scenario` rows land with the default `['scenario']`.
- [x] `bunx drizzle-kit check` -- the 0002 (and 0003 if Phase 4 split out the BC-level CHECK) snapshots are internally consistent with the TS schema.
- [x] Run audit scripts:
  - `bun run db check scenario-assessment-methods` -- expect "all rows default" pre-content-update.
  - `bun run db check card-kinds` -- expect majority `recall` per the migration default.
- [x] Grep for `not_applicable` in `mastery.ts` -- the only matches should be in the function defaults / fallback cases, not in the per-kind partition logic.
- [x] Grep for "honest" in commits authored by this WP -- zero.
- [x] PR title / body update via `gh pr edit`:
  - Title: `feat(evidence-kind-data-layer): card.kind + scenario.assessment_methods + teaching-exercise item kind`
  - Body: scope shipped, defaults applied per Open Questions, follow-on CFI ACS-25 transcription WP referenced.
- [x] Append final summary to `.ball-coord/to-dispatcher.md`.

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
