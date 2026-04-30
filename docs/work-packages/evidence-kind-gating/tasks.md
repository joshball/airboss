---
title: 'Tasks: Evidence Kind Gating'
product: study
feature: evidence-kind-gating
type: tasks
status: unread
review_status: pending
---

# Tasks: Evidence Kind Gating

Phased plan for [spec.md](./spec.md). Order is dependency-driven: constants + schema first, BC primitives next, rollup integration after, tests + docs.

Depends on: cert-syllabus-and-goal-composer (shipped; provides `syllabus_node`, `triad`, `syllabus_node_link`, `getKnowledgeNodesForSyllabusLeaf`). Depends on: knowledge-graph (shipped; provides `knowledge_node` with `assessment_methods`). Depends on: study-plan-and-session-engine (shipped; provides session_item_result with item_kind taxonomy).

## Pre-flight

- [ ] Read `docs/decisions/016-cert-syllabus-goal-model/decision.md` Out-of-Scope item naming this follow-on.
- [ ] Read `docs/decisions/011-knowledge-graph-learning-system/decision.md` mastery model.
- [ ] Read `docs/platform/LEARNING_PHILOSOPHY.md`, principle 9 in particular.
- [ ] Read `docs/work-packages/cert-syllabus-and-goal-composer/spec.md` Out of Scope.
- [ ] Read `libs/bc/study/src/knowledge.ts:620-770`. Confirm dual-gate primitives -- `getNodeMastery`, `computeCardGate`, `computeRepGate`, `isMastered`. The new per-kind gates compose on this.
- [ ] Read `libs/bc/study/src/credentials.ts:270-440`. Confirm `getCredentialMastery` rollup shape.
- [ ] Read `libs/bc/study/src/lenses.ts:155-630`. Confirm `acsLens`, `domainLens`, `computeMasteryRollup`.
- [ ] Read `libs/bc/study/src/syllabi.ts:240-280`. Confirm `getKnowledgeNodesForSyllabusLeaf`.
- [ ] Read `libs/bc/study/src/schema.ts:185-188` for `knowledge_node.assessment_methods`. Read `:1740-1830` for `syllabus_node.triad` + element-level CHECK.
- [ ] Read `libs/constants/src/study.ts:657-667` for `ASSESSMENT_METHODS`. Read `:986-1006` for `NODE_MASTERY_GATES`. Read `:848-854` for `ACS_TRIAD`.
- [ ] Read existing card-kind taxonomy in `libs/constants/src/study.ts` to confirm `recall` vs `calculation` partitioning is supported by current schema (`card.kind` column).
- [ ] Read `SESSION_ITEM_KINDS` to confirm `teaching-exercise` is an existing item kind.
- [ ] Read this WP's spec.md. Confirm Open Questions (a)-(e) resolved by user before writing code.
- [ ] Verify DB on port 5435.
- [ ] Verify `bun run check` passes on baseline main.

## Implementation

### Phase 0: Constants

- [ ] Add `TRIAD_EVIDENCE_REQUIREMENTS` to `libs/constants/src/study.ts` per the recommended mapping (Open Question (a)). Type: `Record<ACSTriad, readonly (readonly AssessmentMethod[])[]>`.
- [ ] Add `TEACHING_EVIDENCE_KINDS` constant.
- [ ] Re-export from `libs/constants/src/index.ts`.
- [ ] Add labels: `TRIAD_EVIDENCE_REQUIREMENT_LABELS` for UI surfaces in follow-on WPs.
- [ ] Run `bun run check`. Expect 0 errors.
- [ ] Commit.

### Phase 1: Schema -- `syllabus_node.requires_teaching`

- [ ] Per Open Question (b) recommendation: add `requires_teaching boolean NOT NULL DEFAULT false` column to `syllabus_node` in `libs/bc/study/src/schema.ts`.
- [ ] Add CHECK constraint: `requires_teaching = false OR triad IS NOT NULL` (only meaningful on element rows). Use `sql.raw()` per existing schema convention.
- [ ] Generate migration via `bun run db:gen`. Inspect resulting SQL: one ADD COLUMN, one ADD CONSTRAINT.
- [ ] Run `bun run db:migrate` against dev DB. Verify column appears.
- [ ] Run `bun run check` clean.
- [ ] Commit.

### Phase 2: BC primitive -- `getNodeEvidenceState`

- [ ] Create `libs/bc/study/src/mastery.ts` per Open Question (e).
- [ ] Define `NodeEvidenceState`, `LeafMasteryState`, `GateState` types.
- [ ] Implement `getNodeEvidenceState(userId, nodeId, db)`:
	- [ ] Per-kind card aggregation. Card-kind partition: `recall` cards counted for `recall` gate; `calculation` cards counted for `calculation` gate.
	- [ ] Per-kind scenario aggregation. Scenario method partition: scenarios with `assessment_methods` containing `scenario` count toward scenario gate; same for `demonstration`.
	- [ ] Teaching-exercise aggregation: query `session_item_result` where `item_kind = 'teaching-exercise'` joined to scenarios attached to the node. Compute via `computeRepGate`.
	- [ ] Each kind reuses `computeCardGate` / `computeRepGate` with that kind's scoped count + ratio.
- [ ] Implement `getNodeEvidenceStateMap(userId, nodeIds, db)` -- batched, mirrors `getNodeMasteryMap`. Single round-trip per pillar with IN-list filtering.
- [ ] Author `mastery.test.ts` covering:
	- [ ] Recall-only node (only recall cards) -> `recall=pass`, others=`not_applicable`.
	- [ ] Calculation-only node -> `calculation=pass`, others=`not_applicable`.
	- [ ] Scenario-only node (only scenario reps tagged 'scenario') -> `scenario=pass`, others=`not_applicable`.
	- [ ] Demonstration-only node -> `demonstration=pass`, others=`not_applicable`.
	- [ ] Teaching-only node -> `teaching=pass`, others=`not_applicable`.
	- [ ] Mixed-evidence node -> multiple kinds each independently gated.
	- [ ] Batched call against 50 ids returns correct per-id state.
- [ ] Re-export from `libs/bc/study/src/index.ts`.
- [ ] Run `bun test libs/bc/study/src/mastery.test.ts`. Run `bun run check`. Commit.

### Phase 3: BC primitive -- `isLeafMastered`

- [ ] In `mastery.ts`, implement the pure helper `aggregateLeafKindStates(perNode, requiredKinds)`:
	- [ ] For each kind in any of the linked nodes' states, aggregate via "any-one-passes": precedence `pass > fail > insufficient_data > not_applicable`.
	- [ ] Return `byKind`, `mastered` (every required kind aggregates to `pass`), `missingKinds`.
	- [ ] Handle the alternates shape (`[['demonstration'], ['scenario']]`) -- skill leaf is mastered when any inner array's kinds all aggregate to pass.
- [ ] Implement `isLeafMastered(userId, syllabusNodeId, db)`:
	- [ ] Pull leaf row (triad, requires_teaching).
	- [ ] Compute `requiredKinds`.
	- [ ] List linked knowledge nodes via `getKnowledgeNodesForSyllabusLeaf` (or inline equivalent).
	- [ ] Call `getNodeEvidenceStateMap` on the linked node ids.
	- [ ] Call `aggregateLeafKindStates`.
	- [ ] Return the `LeafMasteryState`.
- [ ] Implement `getLeafMasteryStateMap(userId, leafIds, db)` -- batched.
- [ ] Author tests:
	- [ ] PPL S1 leaf (skill) with linked node touched only by recall cards -> not mastered, missingKinds includes scenario/demonstration alternative.
	- [ ] PPL S1 leaf with linked node touched by scenario rep tagged 'scenario' -> mastered.
	- [ ] PPL S1 leaf with linked node touched by scenario rep tagged 'demonstration' -> mastered.
	- [ ] PPL R1 leaf with linked node touched only by cards -> not mastered, missingKinds includes scenario.
	- [ ] PPL R1 leaf with linked node touched by scenario -> mastered.
	- [ ] CFI K leaf with `requires_teaching=true` and linked node passing recall but no teaching -> not mastered, missingKinds=['teaching'].
	- [ ] CFI K leaf with `requires_teaching=true` and node passing both recall + teaching -> mastered.
	- [ ] Leaf with multiple linked nodes; one passes scenario, others don't -> mastered (any-one-passes per kind).
	- [ ] Leaf with `triad=null` (defensive) -> trivially mastered when covered, false when uncovered.
- [ ] Run `bun test libs/bc/study/src/mastery.test.ts`. Commit.

### Phase 4: `getCredentialMastery` integration

- [ ] In `libs/bc/study/src/credentials.ts`, swap the per-leaf "every linked node mastered" calculation in `getCredentialMastery` to use `isLeafMastered`.
- [ ] Extend `CredentialMasteryRollup` shape: each area gains `byEvidenceKind: Record<AssessmentMethod, GateState>`. Aggregate via "majority-pass over leaves" or "any-pass" -- pick the shape that matches the cert dashboard's needs (see Open Question (d)).
- [ ] The credential-level rollup gains the same per-kind aggregate.
- [ ] Update `credentials.test.ts`:
	- [ ] Existing tests for "leaf mastered when every linked node mastered" become "leaf mastered when required kinds clear." Numbers may shift in fixture-driven assertions; update the fixtures.
	- [ ] New tests covering the per-kind area / credential aggregates.
- [ ] Run `bun test libs/bc/study/src/credentials.test.ts`. Commit.

### Phase 5: Lens integration

- [ ] In `libs/bc/study/src/lenses.ts`, extend `LensLeaf` type:
	- [ ] `mastery` field becomes `LeafMasteryState` (the new shape) instead of `{ mastered: boolean; covered: boolean }`. Existing `mastered` and `covered` fields stay as fields on the new shape so existing consumer code works.
- [ ] Extend `MasteryRollup` type:
	- [ ] Adds `byEvidenceKind: Record<AssessmentMethod, GateState>`.
	- [ ] Adds `missingKindsByLeaf?: Map<string, AssessmentMethod[]>` so consumers can render "this leaf needs scenario evidence" without re-walking.
- [ ] Update `acsLens` to call `getLeafMasteryStateMap` and produce the richer `LensLeaf.mastery`.
- [ ] Update `domainLens` accordingly. Domain leaves don't have a `triad` directly; they're knowledge nodes, so the leaf gating uses the **node's** `assessment_methods` array to derive `requiredKinds`. (Domain lens does not have a syllabus_node; it walks the knowledge graph directly.)
- [ ] Update `computeMasteryRollup` to compute the per-kind aggregate over its input leaves.
- [ ] Update `lenses.test.ts`:
	- [ ] Existing rollup tests still pass with the additive fields.
	- [ ] New tests: lens output for a goal whose leaves have unmet evidence kinds shows the missing kinds.
- [ ] Run `bun test libs/bc/study/src/lenses.test.ts`. Commit.

### Phase 6: YAML authoring update

- [ ] Update `course/syllabi/<slug>/areas/...yaml` schema in the build pipeline to accept optional `requires_teaching: true` on element entries.
- [ ] Validator: when `requires_teaching: true` is set, the leaf's `triad` must be non-null. Hard fail otherwise.
- [ ] Build pipeline writes the column on seed.
- [ ] Update `tools/syllabi-build/` (or whatever the existing seed pipeline location is) to include the new field.
- [ ] Add a sample `requires_teaching: true` entry on at least one CFI leaf (when CFI ACS-25 transcription happens; for this WP, ship the schema + validator only -- content is incremental).
- [ ] Author tests for the YAML validator covering the new field + the `requires_teaching=true with triad=null` reject case.

### Phase 7: Update knowledge-domain lens for non-syllabus surfaces

- [ ] `domainLens` walks the goal's reachable knowledge nodes by domain. Each leaf is a knowledge node, not a syllabus_node, so it has no `triad`. For domain lens leaf gating, the required kinds come from the node's `assessment_methods` array directly.
- [ ] Implement a `getNodeRequiredKinds(node)` helper that maps the node's `assessment_methods` -> required kinds. The mapping may be 1:1 (each method becomes a required kind) or grouped (recall + calculation are alternatives for K nodes); spec out in design.md and decide with the user during sign-off.
- [ ] Domain lens leaf is mastered when every required kind from the node's `assessment_methods` aggregates to pass (single-node aggregation; no syllabus_node_link to walk).
- [ ] Tests: domain lens leaf with K node passing recall but no scenario -> mastered (recall is the only required kind for a K node). Domain lens leaf with S node passing recall but no demonstration -> not mastered.

### Phase 8: Integration test pass against abby's seed data

- [ ] Run the full credential mastery rollup for abby on a credential where she has mixed evidence.
- [ ] Confirm the breakdown shows per-kind state per area.
- [ ] Visit `/credentials/private` (PR #321) -- existing UI; numbers may shift but page still renders.
- [ ] Document the number shift in the PR body so reviewers expect it.

### Phase 9: Documentation

- [ ] Update [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../decisions/016-cert-syllabus-goal-model/decision.md) Out-of-Scope -> mark "Mastery evidence-kind gating" as shipped.
- [ ] Update [docs/work/NOW.md](../../work/NOW.md) -- add this WP to "recently closed" once merged.
- [ ] Cross-link from [docs/work-packages/cert-syllabus-and-goal-composer/spec.md](../cert-syllabus-and-goal-composer/spec.md) Out of Scope -> link to this WP.
- [ ] Author release notes for the cert dashboard number shift in `docs/work/notes-on-mastery-numbers.md` or wherever the project keeps release notes.

### Phase 10: Follow-on UI work flagged

- [ ] Open a placeholder for the follow-on UI WP that surfaces `missingKinds` in the cert dashboard. Path: `docs/work-packages/cert-dashboard-evidence-kinds/`. Spec authored separately when the user decides to schedule it.
- [ ] Same for the goal composer follow-on if the goal composer should surface "your goal has 3 leaves missing scenario evidence."

## Verification

- [ ] `bun run check` passes 0 errors, 0 warnings.
- [ ] `bun test libs/bc/study/` passes.
- [ ] All scenarios in `test-plan.md` exercised manually with abby's seed data.
- [ ] Cert dashboard renders without crashing; numbers reflect the new gating (may differ from pre-merge).
- [ ] `grep -rn "TRIAD_EVIDENCE_REQUIREMENTS\|TEACHING_EVIDENCE_KINDS" libs/` returns the expected sites.
- [ ] No linter / no unused-export warnings in `libs/constants/src/study.ts`.
