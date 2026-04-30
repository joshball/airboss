---
title: 'Test Plan: Evidence Kind Gating'
product: study
feature: evidence-kind-gating
type: test-plan
status: unread
review_status: pending
---

# Test Plan: Evidence Kind Gating

Manual acceptance tests for [spec.md](./spec.md). Prefix `EKG-`.

## Setup

- Study app running at `localhost:9600`.
- Logged in as `abby@airboss.test` (the canonical dev test learner).
- PostgreSQL on port 5435, `study` schema migrated through this WP's `0NNN_evidence_kind_gating.sql` (adds `syllabus_node.requires_teaching`).
- Phase 6 YAML authoring + build pipeline run; abby's seed data includes:
	- A PPL ACS Area V leaf (skill, S1) with at least one linked knowledge node.
	- A PPL ACS Area V leaf (knowledge, K1) with at least one linked node.
	- A PPL ACS Area V leaf (risk, R1) with at least one linked node.
	- A CFI ACS-25 leaf with `requires_teaching=true` (manually inserted for test purposes if Phase 6 hasn't transcribed CFI content yet).
- abby has cards on the K1 leaf's linked node (recall and/or calculation).
- abby has scenario reps on the R1 leaf's linked node (some tagged `scenario`, some tagged `demonstration`).
- abby has zero teaching-exercise reps.
- `bun run check` passes on the branch.

---

## Schema

### EKG-1: `syllabus_node.requires_teaching` column shape

1. `psql -h localhost -p 5435 -d airboss -c '\d study.syllabus_node'`
2. **Expected:** `requires_teaching boolean NOT NULL DEFAULT false` column present.
3. **Expected:** CHECK constraint `requires_teaching = false OR triad IS NOT NULL` (visible under `Check constraints:`).

### EKG-2: CHECK rejects requires_teaching=true on non-element rows

1. Attempt: `INSERT INTO study.syllabus_node (id, syllabus_id, level, code, title, ordinal, is_leaf, requires_teaching) VALUES ('sln_test', '<syl_id>', 'task', 'TEST', 't', 99, false, true);`
2. **Expected:** CHECK violation (`syllabus_node_requires_teaching_check`).

### EKG-3: Existing rows default to false

1. `SELECT count(*) FROM study.syllabus_node WHERE requires_teaching = true;` (pre-seed-update).
2. **Expected:** 0. The column was added with `DEFAULT false` and no backfill.

---

## Constants

### EKG-10: `TRIAD_EVIDENCE_REQUIREMENTS` shape matches spec

1. Open `bun run repl`.
2. `import { TRIAD_EVIDENCE_REQUIREMENTS, TEACHING_EVIDENCE_KINDS, ACS_TRIAD, ASSESSMENT_METHODS } from '@ab/constants';`
3. **Expected:**
	- `TRIAD_EVIDENCE_REQUIREMENTS.knowledge` = `[['recall']]`.
	- `TRIAD_EVIDENCE_REQUIREMENTS.risk_management` = `[['scenario']]`.
	- `TRIAD_EVIDENCE_REQUIREMENTS.skill` = `[['demonstration'], ['scenario']]`.
	- `TEACHING_EVIDENCE_KINDS` = `['teaching']`.
4. **Expected:** every value is in `ASSESSMENT_METHOD_VALUES`. Every key is in `ACS_TRIAD_VALUES`.

---

## BC -- `getNodeEvidenceState`

### EKG-20: Recall-only node

1. Pick a knowledge node with cards (recall kind), no scenarios, no teaching reps.
2. Call `getNodeEvidenceState(abbyId, nodeId, db)` from a vitest harness.
3. **Expected:** `recall=pass` (or fail / insufficient_data based on actual counts), `calculation=not_applicable`, `scenario=not_applicable`, `demonstration=not_applicable`, `teaching=not_applicable`.

### EKG-21: Mixed recall + scenario node

1. Pick a node with cards AND scenario reps (tagged `scenario`).
2. Call `getNodeEvidenceState`.
3. **Expected:** `recall` reflects the card gate; `scenario` reflects the rep gate. Other kinds `not_applicable`.

### EKG-22: Demonstration-tagged scenario

1. Pick a node attached to a scenario whose `assessment_methods` includes `demonstration`.
2. Run reps on that scenario (3+ reps with high accuracy).
3. Call `getNodeEvidenceState`.
4. **Expected:** `demonstration=pass`, `scenario=pass` if the scenario has both methods (it contributes to both gates).

### EKG-23: Teaching gate when no teaching items exist

1. Pick a node with no teaching-exercise items.
2. **Expected:** `teaching=not_applicable`.

### EKG-24: Insufficient data on a kind

1. Pick a node with 1 recall card. Recall gate threshold is `CARD_MIN=3`.
2. **Expected:** `recall=insufficient_data`, others as appropriate.

### EKG-25: Batched call

1. Call `getNodeEvidenceStateMap(abbyId, [n1, n2, n3, ..., n50], db)`.
2. **Expected:** Returns a Map of size 50; each entry's per-kind shape matches the per-node call.
3. **Expected:** Single round-trip per pillar (verify in test logs / `EXPLAIN`).

---

## BC -- `isLeafMastered`

### EKG-30: PPL S1 leaf with cards-only on linked node -> not mastered

1. abby has cards on the linked node, zero scenarios.
2. Call `isLeafMastered(abbyId, sln_S1_id, db)`.
3. **Expected:** `mastered=false`. `requiredKinds` = `[demonstration, scenario]` (one of). `byEvidenceKind.scenario=not_applicable` and `.demonstration=not_applicable`. `missingKinds` includes one of the required alternates.

### EKG-31: PPL S1 leaf with scenario reps -> mastered

1. Add 3 scenario reps tagged `scenario` against the linked node, accuracy > 0.7.
2. Call `isLeafMastered`.
3. **Expected:** `mastered=true`. `byEvidenceKind.scenario=pass`. `missingKinds=[]`.

### EKG-32: PPL S1 leaf with demonstration reps only -> mastered

1. Replace the scenario reps with reps on a scenario tagged `demonstration` (3+ reps, high accuracy).
2. Call `isLeafMastered`.
3. **Expected:** `mastered=true`. `byEvidenceKind.demonstration=pass`. `byEvidenceKind.scenario=not_applicable`. `missingKinds=[]` (alternative satisfied).

### EKG-33: PPL R1 leaf with cards-only -> not mastered

1. abby has cards on the linked node, zero scenarios.
2. **Expected:** `mastered=false`. `requiredKinds=[scenario]`. `missingKinds=['scenario']`.

### EKG-34: PPL R1 leaf with scenario reps -> mastered

1. Add 3 scenario reps tagged `scenario`.
2. **Expected:** `mastered=true`.

### EKG-35: PPL K1 leaf with recall cards -> mastered

1. abby has recall cards on the linked node, threshold cleared.
2. Call `isLeafMastered`.
3. **Expected:** `mastered=true`. `byEvidenceKind.recall=pass`.

### EKG-36: CFI K leaf with `requires_teaching=true` and recall but no teaching -> not mastered

1. Set `syllabus_node.requires_teaching=true` on the CFI K leaf.
2. abby has recall cards on the linked node (passing).
3. Call `isLeafMastered`.
4. **Expected:** `mastered=false`. `requiredKinds=['recall', 'teaching']`. `byEvidenceKind.teaching=not_applicable`. `missingKinds=['teaching']`.

### EKG-37: CFI K leaf with both recall + teaching -> mastered

1. Add 3 teaching-exercise items + reps against the linked node, accuracy clears threshold.
2. Call `isLeafMastered`.
3. **Expected:** `mastered=true`. `byEvidenceKind.teaching=pass`.

### EKG-38: Multi-linked-node leaf, any-one-passes per kind

1. Leaf links to 3 knowledge nodes. One has scenario reps, others don't. Leaf is risk_management.
2. Call `isLeafMastered`.
3. **Expected:** `mastered=true`. The any-one-passes rule means scenario evidence on any single linked node satisfies the leaf's scenario requirement.

### EKG-39: Leaf with `triad=null` (defensive)

1. Manually craft a syllabus_node with `triad=null, is_leaf=true` (rare; this is the section-level case).
2. Call `isLeafMastered`.
3. **Expected:** trivially mastered when covered, false when uncovered. No crash.

### EKG-40: Batched call

1. Call `getLeafMasteryStateMap(abbyId, [leaf1, ..., leaf50], db)`.
2. **Expected:** Map of size 50. Per-leaf states match per-leaf calls. Single round-trip per pillar.

---

## Credential rollup

### EKG-50: `getCredentialMastery` reflects new gating

1. Pre-WP baseline: snapshot `getCredentialMastery(abbyId, 'private')` results on main.
2. On the cutover branch, snapshot again.
3. **Expected:** `masteredLeaves` may be lower (stricter gating); per-area breakdown now carries `byEvidenceKind`.

### EKG-51: Per-area breakdown

1. Call `getCredentialMastery(abbyId, 'private')`.
2. **Expected:** each `area` entry has a `byEvidenceKind` field. Pick Area V; the recall/scenario/demonstration entries reflect what abby has done.
3. **Expected:** if abby has cards but no scenarios on Area V, the area's `byEvidenceKind.scenario` is `not_applicable` or `fail` and the leaves missing scenario surface in the per-leaf rollup.

### EKG-52: Credential-level per-kind aggregate

1. Call `getCredentialMastery`.
2. **Expected:** the credential-level rollup carries a `byEvidenceKind` projection across all areas. Visualizable as "across the whole PPL, you pass recall on 80% of leaves, scenario on 40%."

---

## Lens output

### EKG-60: ACS lens carries `LeafMasteryState`

1. Call `acsLens(db, abbyId, { goal: abbyPrimaryGoal, filters: { areaCodes: ['V'] } })`.
2. **Expected:** every leaf's `mastery` field is a `LeafMasteryState` shape (mastered, covered, requiredKinds, byEvidenceKind, missingKinds).
3. **Expected:** the rollup at every internal node carries `byEvidenceKind`.

### EKG-61: Domain lens uses node's assessment_methods

1. Call `domainLens(db, abbyId, { goal: abbyPrimaryGoal })`.
2. **Expected:** each domain branch's leaves are knowledge nodes; their `mastery` reflects the per-kind gates of the node, derived from the node's `assessment_methods` array.

### EKG-62: Lens output backwards-compatible

1. Existing callers reading `leaf.mastery.mastered` continue to work.
2. **Expected:** no compile error in pre-existing consumer code.

---

## YAML authoring

### EKG-70: YAML validator accepts `requires_teaching: true` on element rows

1. Add `requires_teaching: true` to a CFI element entry in `course/syllabi/cfi-acs-25/areas/...yaml`.
2. Run `bun run db seed syllabi`.
3. **Expected:** seed succeeds; the column is set to true on the resulting `syllabus_node`.

### EKG-71: YAML validator rejects `requires_teaching: true` on non-element rows

1. Attempt to set `requires_teaching: true` on a task entry.
2. **Expected:** seed fails with a clear error: "requires_teaching only valid on element rows."

---

## Edge cases

### EKG-80: Leaf with zero linked nodes

1. Pick a leaf authored without `knowledge_nodes:` entries.
2. Call `isLeafMastered`.
3. **Expected:** `mastered=false`, `covered=false`. `byEvidenceKind={}`. `missingKinds = requiredKinds`.

### EKG-81: Scenario tagged with multiple methods

1. Add a scenario with `assessment_methods=['scenario','demonstration']`.
2. Run reps on it.
3. **Expected:** the same reps contribute to both the `scenario` and `demonstration` gates. Per-gate threshold computed independently. No double-count beyond the intended both-gates contribution.

### EKG-82: Stale lens consumer rendering

1. After the cutover, visit `/credentials/private` (PR #321 page).
2. **Expected:** page renders. Number of mastered leaves may be lower than pre-merge. The page does NOT crash.

---

## Regression -- existing flows

### EKG-90: `getNodeMastery` itself unchanged

1. Call the existing `getNodeMastery(abbyId, nodeId, db)`.
2. **Expected:** same shape and values as pre-merge. The dual-gate primitive is untouched.

### EKG-91: Engine items unchanged

1. Run `previewSession()` for abby.
2. **Expected:** same items as pre-merge. The engine doesn't consume evidence-kind state in this WP; selection is unaffected.

### EKG-92: Cert dashboard renders

1. Visit `/credentials/private`.
2. **Expected:** page renders. Empty / partial states render correctly (no division-by-zero on per-kind rollups).
