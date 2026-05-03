---
title: 'Test Plan: Evidence Kind Data Layer'
product: study
feature: evidence-kind-data-layer
type: test-plan
status: unread
review_status: pending
---

# Test Plan: Evidence Kind Data Layer

Manual + automated coverage for the substrate (card.kind, scenario.assessment_methods, teaching-exercise session-item-kind) and the mastery rewire that consumes it. WP B (`evidence-kind-gating`) test plan stays valid; this plan adds the cases that exercise the now-real partitions.

Anchors: [spec](./spec.md), [tasks](./tasks.md), [WP B test plan](../evidence-kind-gating/test-plan.md).

## Pre-conditions

- Branch contains all phases through Phase 5 of [tasks](./tasks.md).
- Local DB rebuilt from TS schema: `bun run db reset --force` has run since the schema changes landed. (The project uses `drizzle-kit push`, not `migrate`. The `drizzle/0002_evidence_kind_data_layer.sql` file -- and `0003_*` if Phase 4 split out the BC-level CHECK -- exists for diff-accuracy but is not the runtime apply path.)
- Seed data refreshed: `bun run db reset` runs the full seed orchestrator including the Abby seed user with cards + scenarios.

## Automated tests

### Unit -- constants

- [ ] `CARD_KINDS.RECALL === 'recall'` and `CARD_KINDS.CALCULATION === 'calculation'` (matches the `ASSESSMENT_METHODS` strings exactly).
- [ ] `CARD_KIND_VALUES` contains exactly the two strings above.
- [ ] `SESSION_ITEM_KINDS.TEACHING_EXERCISE === 'teaching-exercise'`.
- [ ] `SESSION_ITEM_KIND_VALUES.includes('teaching-exercise')` and length is 4.

### Unit -- BC validators

- [ ] `createCard` with `kind='recall'` succeeds.
- [ ] `createCard` with `kind='scenario'` throws `InvalidCardKindError`.
- [ ] `createCard` without `kind` defaults to `recall` (read-back confirms).
- [ ] `createScenario` with `assessmentMethods=['scenario']` succeeds.
- [ ] `createScenario` with `assessmentMethods=['scenario','demonstration']` succeeds.
- [ ] `createScenario` with `assessmentMethods=[]` throws `InvalidAssessmentMethodError`.
- [ ] `createScenario` with `assessmentMethods=['scenario','scenario']` throws (dedupe).
- [ ] `createScenario` with `assessmentMethods=['scenario','bogus']` throws.
- [ ] `createScenario` without `assessmentMethods` defaults to `['scenario']`.
- [ ] `createTeachingExercise` happy path; `getTeachingExercise` round-trips; `deleteTeachingExercise` removes.

### Unit -- mastery partitions (`mastery.test.ts` extensions)

Setup: Abby + node N + linked syllabus leaf L (triad/required_kinds vary per case).

- [ ] **Recall-only K leaf.** Three mastered `kind='recall'` cards on N. K leaf L (triad=K, no requires_teaching). Expected: `getNodeEvidenceState(N).recall = pass`, `calculation = not_applicable`. `isLeafMastered(L) = mastered=true, missingKinds=[]`.
- [ ] **Calculation-only K leaf, recommended K=recall mapping.** Three mastered `kind='calculation'` cards on N. K leaf L. Expected: `recall = not_applicable`, `calculation = pass`. `isLeafMastered(L) = mastered=false, missingKinds=['recall']`.
- [ ] **Mixed kinds.** Three mastered recall + three mastered calc on N. K leaf L. Expected: `recall = pass`, `calculation = pass`. Mastered.
- [ ] **Judgment-only scenario gate.** One scenario tagged `['scenario']` with three correct rep attempts. R leaf L (triad=risk_management). Expected: `scenario = pass`, `demonstration = not_applicable`. `isLeafMastered(L) = mastered=true`.
- [ ] **Demonstration-only scenario.** Scenario tagged `['demonstration']` with three correct reps. S leaf L. Expected: `scenario = not_applicable`, `demonstration = pass`. `isLeafMastered(L) = mastered=true` (skill mapping accepts either demonstration or scenario).
- [ ] **Hybrid scenario.** Scenario tagged `['scenario','demonstration']` with three correct reps. S leaf L. Expected: `scenario = pass`, `demonstration = pass`. Mastered.
- [ ] **Card-only on S leaf (WP B regression).** Three mastered `kind='recall'` cards on N. S leaf L (triad=skill). Expected: `recall = pass`, `scenario = not_applicable`, `demonstration = not_applicable`. `isLeafMastered(L) = mastered=false, missingKinds=['demonstration', 'scenario']` (or whichever single group the algorithm picks per the WP B aggregation rule). Same outcome as WP B; partition adds detail without changing the mastery boolean.
- [ ] **CFI K leaf with teaching evidence.** Three completed `teaching-exercise` rows linked via `teaching_exercise.node_id = N`. Three mastered recall cards on N. CFI K leaf L with `requires_teaching=true`. Expected: `recall = pass`, `teaching = pass`. `isLeafMastered(L, cert='cfi') = mastered=true`.
- [ ] **CFI K leaf without teaching.** Three mastered recall cards. Zero teaching-exercise rows. `requires_teaching=true`. Expected: `teaching = not_applicable`. `isLeafMastered(L, cert='cfi') = mastered=false, missingKinds=['teaching']`.
- [ ] **Multiple linked nodes with cross-kind coverage.** Leaf L links to N1 and N2. N1 has recall cards, N2 has scenario reps tagged `['scenario']`. R leaf L (triad=risk_management, requires `[scenario]`). Expected: `recall=pass` aggregated from N1, `scenario=pass` aggregated from N2. `isLeafMastered(L) = mastered=true` (R leaf only requires scenario; recall is incidentally present but irrelevant).

### Unit -- partition query correctness

- [ ] LATERAL UNNEST against a scenario tagged with no methods (defensive -- BC default + CHECK should prevent this row, but if one exists): the query yields zero rows for that scenario, no exceptions thrown.
- [ ] LATERAL UNNEST against three scenarios on the same node, methods `['scenario']`, `['demonstration']`, `['scenario','demonstration']`: counts per (node, method) are `scenario=2 scenarios, demonstration=2 scenarios` (the hybrid contributes to both).
- [ ] Cards groupBy on a node with cards in both kinds: per-kind counts are correct, mastered counts respect `cardState.stability > 30`.

### Integration -- migration

- [ ] On a fresh DB, run `bun run db reset --force` (uses `drizzle-kit push` from TS schema). Verify:
  - `study.card.kind` exists, NOT NULL, default 'recall', CHECK passes for 'recall' and 'calculation', rejects 'scenario'.
  - `study.scenario.assessment_methods` exists as jsonb, NOT NULL, default `'["scenario"]'::jsonb`.
  - `study.session_item_result.item_kind` accepts 'teaching-exercise' (insert + read back).
  - `study.session_item_result.item_kind` rejects 'random-string' (the CHECK still enforces the closed set).
  - `study.teaching_exercise` table exists, FK to `bauth.user(id)` and `study.knowledge_node(id)` work.
- [ ] On a populated DB (post-WP-B seed):
  - `SELECT count(*) FROM study.card WHERE kind IS NULL` -- zero (default applied).
  - `SELECT DISTINCT assessment_methods FROM study.scenario` -- exactly `["scenario"]` until authoring updates.
  - `SELECT count(*) FROM study.session_item_result WHERE item_kind NOT IN ('card','rep','node_start')` -- zero (no teaching-exercise rows yet).

### Integration -- audit scripts

- [ ] `bun run db check scenario-assessment-methods` against fresh seed: prints `default: N, explicit: 0, breakdown: { ["scenario"]: N }`.
- [ ] After authoring one scenario with `['demonstration']`: `default: N-1, explicit: 1`.
- [ ] `bun run db check card-kinds` against fresh seed: prints per-domain counts, all `recall`.

## Manual acceptance

### M1 -- Hangar card editor

1. Open a card-edit page (or create flow) in hangar.
2. Verify a `kind` selector appears with options `Recall` and `Calculation`. Default is `Recall`.
3. Save with `Calculation`. Round-trip the page; the value persists.
4. Attempt to save without selecting (or with an invalid value injected via devtools). Verify the form rejects.
5. Author a calculation card linked to a knowledge node. After save, run the audit script -- the row appears in the `calculation` bucket.

### M2 -- Hangar scenario editor

1. Open a scenario-edit page.
2. Verify a multi-select / checkbox group appears for `Scenario`, `Demonstration`, `Recall`, `Calculation`. Default has `Scenario` checked.
3. Save with `Scenario` + `Demonstration`. Round-trip; both persist.
4. Try to save with no boxes checked. Form rejects.
5. Verify the audit script reports the row in the `["scenario","demonstration"]` bucket.

### M3 -- Mastery readback after authoring

1. With Abby's seed user, create three `kind='calculation'` cards on a single knowledge node and master them (FSRS stability > 30 -- requires either a manual stability bump in the DB or the seed-abby pathway).
2. View the cert dashboard / lens UI for a K leaf linked to that node. Expected: leaf NOT mastered (because K requires recall in the recommended mapping). The richer rollup state (visible via dev tools / API) shows `byEvidenceKind = { recall: not_applicable, calculation: pass }` and `missingKinds = ['recall']`.
3. Add three mastered `kind='recall'` cards on the same node. Refresh. Leaf now mastered; `missingKinds = []`.

### M4 -- Teaching gate end-to-end

1. Insert one `teaching_exercise` row linked to a CFI K node N (via direct seed insert -- the engine does not yet generate them).
2. Insert three completed `session_item_result` rows with `item_kind='teaching-exercise'`, `teaching_exercise_id=<N's exercise id>`, `is_correct=true`.
3. With CFI cert, view a leaf linked to N where `requires_teaching=true`. Expected: `teaching = pass`. Combined with mastered recall cards on N, leaf reads as mastered.
4. Drop the three session_item_result rows. Refresh. Expected: `teaching = not_applicable` (no rows), `missingKinds = ['teaching']`, leaf not mastered.

### M5 -- Schema-push safety

1. Against a populated dev DB (rich abby seed), apply the schema delta via `bun run db push` (drizzle-kit push, not reset). Drizzle prints the planned ALTERs; confirm they match the spec's `0002_*.sql` shape (3 ADD COLUMN, 1 CREATE TABLE, 1 DROP+ADD CHECK, 1 CHECK on card.kind, 2 indexes).
2. Verify no rows lost: `SELECT count(*) FROM study.card` matches before / after; same for `study.scenario` and `study.session_item_result`.
3. Verify `card.kind` distribution is 100% `recall` immediately after push.
4. Verify `bun run check` passes.
5. Verify `bun test` passes against the migrated DB.

### M6 -- Backout

1. With Phase 5 merged, simulate a backout: revert the relevant TS schema changes in `libs/bc/study/src/schema.ts` and re-run `bun run db push`. Drizzle generates the inverse delta (DROP COLUMN, DROP TABLE, restore the CHECK with the original value list).
2. Verify the schema returns to the WP B baseline (no `card.kind`, no `scenario.assessment_methods`, no `teaching_exercise` table).
3. Confirm no orphaned rows in `session_item_result` (if any teaching-exercise rows were inserted during testing, they're rejected by the CHECK once it tightens).
4. Forward-test that the inverse `0002_*.sql` snapshot generated via `drizzle-kit generate` after the schema revert is the inverse of the original (sanity-check, not a runtime path).

## Acceptance criteria

- All automated tests pass (unit + integration).
- All manual scenarios M1-M6 complete with expected outcomes.
- `bun run check` zero errors, zero warnings.
- Grep for `not_applicable` constant assignments inside `getNodeEvidenceStateMap`'s per-kind output (the lines that hardcoded the shim) returns empty.
- `mastery.ts` file header no longer documents three shims; documents the real partition shape.
- Audit scripts run cleanly and produce informational output for the content team.

## Out of scope for this test plan

- Teaching-exercise *runtime* (engine pickup, in-session UX).
- CFI ACS-25 content authoring acceptance (covered by the follow-on content WP).
- Performance benchmarking of LATERAL UNNEST (only profile if production data shows hot path).
