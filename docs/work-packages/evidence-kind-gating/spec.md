---
id: evidence-kind-gating
title: "Spec: Evidence Kind Gating"
product: study
category: feature
status: in-flight
agent_review_status: pending
human_review_status: pending
created: 2026-04-29
owner: agent
depends_on: []
unblocks: []
tags:
  - evidence
  - schema
legacy_fields:
  feature: evidence-kind-gating
  type: spec
  review_status: pending
---

<!-- Shipped in code but pending user walkthrough; transition to `status: shipped` requires user to set `human_review_status: signed-off`. -->

# Spec: Evidence Kind Gating

Mastery rollup is extended so a syllabus leaf is only considered mastered when the learner has cleared the appropriate evidence kind for that leaf. K-triad leaves accept card recall; S-triad leaves require scenario or demonstration evidence; CFI leaves with `teaching` assessment require teaching-exercise evidence. Today the rollup treats every linked node's mastery the same way regardless of how it was earned -- a CFI candidate can answer cards their way to "mastered" on a leaf that demands a teaching exercise, and a PPL student can do the same on a leaf that demands a demonstration.

This is the deferred phase from [`cert-syllabus-and-goal-composer`](../cert-syllabus-and-goal-composer/spec.md) Out-of-Scope item "Mastery evidence-kind gating," referenced as the follow-on `lens-evidence-gating`. ADR 016's Learning Philosophy principle 9 ("Evidence of mastery has to match the kind of knowledge") is the contract this WP implements.

## Why this WP exists

The dual-gate mastery model (ADR 011, `getNodeMastery` in `libs/bc/study/src/knowledge.ts`) splits mastery between cards and reps:

- Card gate: enough cards exist + their mastered ratio clears the threshold.
- Rep gate: enough scenario reps exist + their accuracy clears the threshold.

That model assumed every node has the same evidence requirements. It doesn't. From principle 9:

> You cannot multiple-choice your way to "demonstrate steep turns." Each node declares what evidence counts (recall card, calculation, scenario decision, simulator demonstration, oral exam answer, teaching exercise). Mastery rolls up only from matching evidence.

Three concrete failure modes today:

1. **PPL Area V Task A Element S1 ("perform steep turns")** is a skill leaf. The graph has a knowledge node for steep turns with cards. A learner who answers the cards correctly has the leaf rendering as "mastered" -- but they have not demonstrated the maneuver. The dashboard claims a level of competency the learner has not earned.
2. **CFI ACS-25 leaves where the *content* is angle-of-attack but the *evidence required* is teaching.** The CFI candidate has to *teach* the concept. Passing cards on it is necessary but not sufficient. Today the leaf reads as mastered as soon as the underlying node clears the dual gate.
3. **Risk-management leaves** want judgment evidence (scenario decisions). A learner who has cards on the underlying knowledge but no scenario reps on the relevant decisions sees the leaf as covered/touched -- but the rollup treats it as mastered if any linked node hits the dual gate, so a node touched by cards alone bypasses the judgment requirement.

This WP changes the contract: a leaf's mastery requires evidence of the *kinds* the leaf demands. Card recall on its own is no longer sufficient for an S leaf or a CFI teaching leaf. The data is already there -- `knowledge_node.assessment_methods` is an existing JSONB array of `AssessmentMethod` strings; sessions emit per-item-kind data; the missing piece is the gating logic that consumes them.

## Anchors

- [ADR 016 -- Cert, Syllabus, Goal, and the Multi-Lens Learning Model](../../decisions/016-cert-syllabus-goal-model/decision.md). Out of Scope item "Mastery evidence-kind gating" names this WP as the follow-on.
- [ADR 011 -- Knowledge graph + learning system](../../decisions/011-knowledge-graph-learning-system/decision.md). The dual-gate model this WP extends.
- [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md), especially principle 9.
- [Cert, Syllabus, and Goal Composer spec](../cert-syllabus-and-goal-composer/spec.md), Out-of-Scope: "Mastery evidence-kind gating".
- [Cert Dashboard spec](../cert-dashboard/spec.md) (PR #321) -- the consumer that will surface the richer rollup once a follow-on UI WP picks it up.
- [Goal Composer spec](../goal-composer/spec.md) (PR #324) -- another future consumer.
- [Engine Goal Cutover spec](../engine-goal-cutover/spec.md) -- parallel WP touching the same goal model; both ship after sign-off.
- `libs/bc/study/src/knowledge.ts:620-770` -- `getNodeMastery`, `computeCardGate`, `computeRepGate`, `isMastered`. The dual-gate primitive this WP composes on.
- `libs/bc/study/src/credentials.ts:270-440` -- `getCredentialMastery`, the rollup this WP changes.
- `libs/bc/study/src/lenses.ts:155-630` -- `computeMasteryRollup`, `acsLens`, `domainLens`. The lens-side rollup this WP changes.
- `libs/bc/study/src/syllabi.ts:240-280` -- `getKnowledgeNodesForSyllabusLeaf`. The leaf-to-node walk.
- `libs/bc/study/src/schema.ts:185-188` -- `knowledge_node.assessment_methods` column.
- `libs/bc/study/src/schema.ts:1740-1830` -- `syllabus_node.triad`, `required_bloom`. Already shipped fields used to derive evidence requirements.
- `libs/constants/src/study.ts:657-667` -- `ASSESSMENT_METHODS` enum (`recall | calculation | scenario | demonstration | teaching`).
- `libs/constants/src/study.ts:986-1006` -- `NODE_MASTERY_GATES` (`pass | fail | insufficient_data | not_applicable`). The `GateState` shape this WP reuses per evidence kind.
- `libs/constants/src/study.ts:848-854` -- `ACS_TRIAD` (`knowledge | risk_management | skill`).

## In Scope

1. **Triad-to-evidence mapping constant.** `libs/constants/src/study.ts` gains `TRIAD_EVIDENCE_REQUIREMENTS`: a constant mapping `ACSTriad -> readonly AssessmentMethod[]` that names the assessment methods a leaf of that triad demands. Recommended mapping (Open Question (a)):

   ```typescript
   export const TRIAD_EVIDENCE_REQUIREMENTS: Record<ACSTriad, readonly AssessmentMethod[]> = {
   	knowledge: ['recall'],
   	risk_management: ['scenario'],
   	skill: ['demonstration', 'scenario'], // either suffices
   };
   ```

   Plus a separate constant for the CFI pedagogical-leaf requirement:

   ```typescript
   export const TEACHING_EVIDENCE_KINDS: readonly AssessmentMethod[] = ['teaching'];
   ```

   Both ship as readonly arrays so the BC consumer cannot mutate them. `BLOOM_LEVELS` does not influence the mapping (a higher-bloom K leaf still needs recall; depth is graded by the bloom requirement separately, not by adding evidence kinds).

2. **Per-node evidence breakdown.** Each knowledge node already aggregates card mastery and rep accuracy via the dual-gate model. New BC function `getNodeEvidenceState(userId, nodeId, db) -> NodeEvidenceState` returns per-evidence-kind gates:

   ```typescript
   export type GateState = NodeMasteryGate; // 'pass' | 'fail' | 'insufficient_data' | 'not_applicable'

   export interface NodeEvidenceState {
   	nodeId: string;
   	recall: GateState;
   	calculation: GateState;
   	scenario: GateState;
   	demonstration: GateState;
   	teaching: GateState;
   }
   ```

   Each gate uses the same data sources as today's dual gate but filtered by evidence kind:

   - `recall`: cards (existing card pillar).
   - `calculation`: cards whose `card_kind` is `calculation` (a card kind the existing card schema already supports per `libs/constants/src/study.ts` card-kind values; see "Data dependencies" below).
   - `scenario`: scenario reps (existing rep pillar) where the linked scenario's `assessment_method` is `scenario` (judgment-decision rep).
   - `demonstration`: scenario reps where `assessment_method` is `demonstration` (sim flight or maneuver demo).
   - `teaching`: teaching-exercise rep results (a session-item kind that exists in `SESSION_ITEM_KINDS`; the BC currently does not aggregate them per-node, this WP adds that).

   Each kind has the same gate semantic as today: `not_applicable` when no evidence of that kind is attached to the node; `insufficient_data` when fewer than the per-kind minimum exists; `pass` / `fail` when the threshold is cleared / missed. Per-kind thresholds default to the same `CARD_MIN` / `REP_MIN` and `CARD_MASTERY_RATIO_THRESHOLD` / `REP_ACCURACY_THRESHOLD` constants as the current dual gate; introducing per-kind tunings is out of scope.

3. **Leaf gating function.** New BC function `isLeafMastered(userId, syllabusNodeId, db) -> LeafMasteryState` walks the leaf's linked knowledge nodes, computes `getNodeEvidenceState` on each, and checks whether the leaf's required evidence kinds (per `TRIAD_EVIDENCE_REQUIREMENTS[leaf.triad]` plus optional `TEACHING_EVIDENCE_KINDS` via item 6) all clear `'pass'` on at least one linked node (Open Question (c) decides quorum). Returns:

   ```typescript
   export interface LeafMasteryState {
   	leafId: string;
   	mastered: boolean;
   	covered: boolean; // any linked node has any evidence
   	requiredKinds: readonly AssessmentMethod[];
   	byEvidenceKind: Partial<Record<AssessmentMethod, GateState>>; // aggregated across linked nodes
   	missingKinds: readonly AssessmentMethod[]; // required kinds whose aggregated gate is not 'pass'
   }
   ```

   `byEvidenceKind` aggregates across linked nodes via "any node passes" semantic by default (Open Question (c)). `missingKinds` exists so the UI can render "you have recall down but need a scenario" without re-deriving.

4. **Rollup integration -- credentials.** `getCredentialMastery` currently treats a leaf as mastered when every linked node is mastered (the dual-gate boolean). This WP swaps that for `isLeafMastered`. The shape of `CredentialMasteryRollup` grows: each area gains an optional per-evidence-kind breakdown so the dashboard can render "Area V: knowledge mastered, skill missing" without re-walking. Open Question (d) decides backwards-compat shape.

5. **Rollup integration -- lenses.** `acsLens` and `domainLens` use `computeMasteryRollup` over per-leaf mastery booleans. This WP extends `LensLeaf` with the leaf-mastery state shape and `MasteryRollup` with the per-kind aggregate so the lens output can drive the same richer rendering. The lens framework's contract widens; no API breakage because the new fields are additive (Open Question (d)).

6. **CFI pedagogical leaves -- evidence requirement.** Open Question (b) decides the modeling. Recommended: a `requires_teaching` boolean on `syllabus_node` (CHECK: only set when triad is non-null; ignored when leaf isn't an element). Authored on the leaf when the leaf demands teaching evidence on top of whatever the triad says. The leaf's `requiredKinds` then becomes `[...TRIAD_EVIDENCE_REQUIREMENTS[triad], ...(requires_teaching ? TEACHING_EVIDENCE_KINDS : [])]`. The CFI ACS-25 transcription pass (already incremental per cert-syllabus WP) marks `requires_teaching=true` on every CFI K/R/S element where the FAA's standard demands teaching demonstration. Alternative (rejected by Open Question (b)): infer from credential.kind=instructor_cert + an edge type. Inference is implicit and harder to audit per leaf; the explicit flag wins.

7. **Per-evidence-kind data plumbing.** `getNodeEvidenceState` needs:

   - **Card-kind aggregation.** Cards already carry a `kind` (recall vs calculation per existing card schema). The card gate query splits by kind: `recall` gate counts only `recall` cards; `calculation` gate counts only `calculation` cards.
   - **Scenario-method aggregation.** Each scenario carries `assessment_methods` (an array including `scenario` and/or `demonstration`). The scenario rep gate splits per method: a scenario tagged `['demonstration']` only contributes to the demonstration gate; a scenario tagged `['scenario']` only contributes to the scenario gate.
   - **Teaching-exercise aggregation.** A teaching-exercise rep is a session item whose `item_kind = 'teaching-exercise'` (already in `SESSION_ITEM_KINDS`). Per-node aggregation of teaching-exercise results is new BC work; this WP adds it.

   No schema changes to card / scenario / session_item_result are required -- the data is there. The BC change is the rollup-side decomposition by kind.

8. **Engine consumption -- read-only for now.** The engine does not change in this WP. Today `pickContinue` / `pickStrengthen` etc. select from cards + scenarios per the dual-gate filter. After this WP they continue to do so. The richer leaf-mastery state is consumed by the rollup (cert dashboard, lenses) but not the engine selection. A follow-on WP wires the engine to prefer items that close evidence-kind gaps (e.g., when a leaf is missing scenario evidence, the engine pulls scenario reps over cards). This WP records the data shape so that follow-on has the substrate.

9. **Tests.** New unit tests for `TRIAD_EVIDENCE_REQUIREMENTS` (constants), `getNodeEvidenceState` (per-kind gate logic), `isLeafMastered` (quorum + missing-kinds), and the updated `getCredentialMastery` + lens output. Integration tests:

   - PPL learner masters S1 via scenario reps but has no cards -> leaf is mastered, skill kind passes.
   - PPL learner has 100% card mastery on S1's linked node + zero scenario reps -> leaf NOT mastered, scenario kind insufficient_data, skill missing.
   - CFI learner masters teaching exercises on a CFI leaf with `requires_teaching=true` -> leaf mastered.
   - CFI learner has 100% card recall + 100% scenario but zero teaching exercises -> leaf NOT mastered (when `requires_teaching=true`), teaching missing.
   - Risk leaf with linked node touched only by cards -> leaf NOT mastered, scenario missing.

10. **Constants and types.** `libs/constants/src/study.ts` additions: `TRIAD_EVIDENCE_REQUIREMENTS`, `TEACHING_EVIDENCE_KINDS`. `libs/types/src/index.ts`: re-export `LeafMasteryState`, `NodeEvidenceState` from BC types module. No new `XXX_KINDS` enum; the existing `ASSESSMENT_METHODS` covers the closed set.

11. **Schema additions.** Per Open Question (b) recommendation: `syllabus_node.requires_teaching` boolean column, NOT NULL DEFAULT false. CHECK: `requires_teaching = false OR triad IS NOT NULL` (only meaningful on element-level rows). No other schema changes.

12. **YAML authoring update.** Each `course/syllabi/<slug>/areas/...yaml` element entry gains an optional `requires_teaching: true` flag. Validator: when `requires_teaching: true` is set, the leaf's `triad` must be non-null. Build pipeline writes the column on seed.

## Out of Scope (explicit)

- **UI rendering of the richer rollup.** Cert dashboard pages (PR #321) and goal composer pages (PR #324) currently render leaves as `mastered: boolean`. After this WP they have access to the richer state, but the page changes that surface "you have recall down but need a scenario" are a follow-on UI WP. This WP delivers the data layer.
- **Engine selection changes.** The engine continues to pick from cards + scenarios as today. Wiring "prefer items that close evidence-kind gaps" is a follow-on engine WP.
- **Per-card or per-scenario authoring tooling for `assessment_methods`.** The arrays already exist on the schemas; this WP consumes them, doesn't author them. Authoring tooling lives in the hangar app and surfaces in a separate WP.
- **Changing dual-gate thresholds.** `CARD_MASTERY_RATIO_THRESHOLD = 0.8`, `REP_ACCURACY_THRESHOLD = 0.7`, `CARD_MIN = 3`, `REP_MIN = 3` stay. Per-kind tunings (e.g., "recall needs 5 cards minimum" vs "scenario needs 3") are deferred -- ship the per-kind shape first, tune later if data shows a gap.
- **Changing FSRS scheduling weights.** The scheduler stays as-is. This WP is a read-side / rollup change, not a write-side / scheduling change.
- **Backfill of teaching-exercise results.** Today there are zero teaching-exercise reps in the seed data; the gate returns `not_applicable` until teaching exercises ship as content. No retroactive data.
- **A "teaching evidence" UI affordance.** Out of scope here; follow-on once teaching exercises are an authored content kind.
- **Bloom-level gating.** The leaf's `required_bloom` already exists on `syllabus_node`. Whether the per-card / per-scenario evidence reaches the required bloom is not gated here -- that's a separate dimension and would require per-card / per-scenario bloom tagging that is also out of scope.

## Architecture overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Before this WP                                                      │
│    knowledge_node.assessment_methods (jsonb string[])  -- present    │
│    syllabus_node.triad (knowledge|risk_management|skill) -- present  │
│    card.kind (recall | calculation)                    -- present    │
│    scenario.assessment_methods (jsonb string[])        -- present    │
│        |                                                             │
│        v                                                             │
│    getNodeMastery() -> dual gate (card+rep, kind-agnostic)           │
│        |                                                             │
│        v                                                             │
│    getCredentialMastery / acsLens / domainLens                       │
│        rollup leaf as mastered if every linked node is mastered       │
│        no per-evidence-kind decomposition                             │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  After this WP                                                       │
│    syllabus_node.requires_teaching (NEW bool, default false)         │
│        |                                                             │
│        v                                                             │
│    getNodeEvidenceState(userId, nodeId)                              │
│      per-kind gates:  recall | calculation | scenario |              │
│                       demonstration | teaching                       │
│      each gate uses same threshold / minimum constants as today      │
│      filtered by card.kind / scenario.assessment_methods /           │
│      session_item_result.item_kind                                   │
│        |                                                             │
│        v                                                             │
│    isLeafMastered(userId, leafId)                                    │
│      requiredKinds = TRIAD_EVIDENCE_REQUIREMENTS[leaf.triad]         │
│                      + (leaf.requires_teaching ? teaching : [])      │
│      walks linked nodes, aggregates per-kind gates                   │
│      mastered iff every requiredKind has at least one passing node   │
│        |                                                             │
│        v                                                             │
│    getCredentialMastery / acsLens / domainLens                       │
│      richer LeafMasteryState includes byEvidenceKind + missingKinds  │
│      MasteryRollup grows additive per-kind aggregates                │
│        |                                                             │
│        v                                                             │
│    Cert dashboard / goal composer (read-side, follow-on UI WP        │
│    surfaces the richer state)                                        │
└──────────────────────────────────────────────────────────────────────┘
```

## Behavior

### Per-node evidence state algorithm

For a given `(userId, nodeId)`:

1. Pull the count + threshold-clearing count of cards attached to the node, partitioned by `card.kind`. Each kind produces its own `GateState` via the existing `computeCardGate` logic with that kind's count.
2. Pull the count + accuracy of scenario reps attached to the node, partitioned by the scenario's `assessment_methods` array (a scenario can contribute to multiple kinds). Each kind produces its own `GateState` via `computeRepGate`.
3. Pull the count + accuracy of teaching-exercise session_item_results attached to the node. Compute `teaching` gate via `computeRepGate` (same threshold; teaching is a rep-shaped kind).
4. Each kind whose corresponding evidence has count zero attached to the node returns `not_applicable`. Counts above zero but below the minimum return `insufficient_data`. At or above minimum: `pass` if accuracy / mastery clears the threshold, else `fail`.

`calculation` is a card kind handled symmetrically with `recall`.

### Leaf mastery algorithm

For a given `(userId, syllabusNodeId)`:

1. Look up the leaf's `triad` and `requires_teaching` columns.
2. Compute `requiredKinds = TRIAD_EVIDENCE_REQUIREMENTS[triad] + (requires_teaching ? TEACHING_EVIDENCE_KINDS : [])`. For `triad=null` (non-element rows -- shouldn't happen since leaves are elements, but guarded), `requiredKinds = []` and the leaf is trivially mastered when at least one linked node is touched.
3. List the leaf's linked knowledge nodes via `syllabus_node_link`.
4. Per linked node: compute `getNodeEvidenceState`.
5. Aggregate per kind across linked nodes. Default semantic (Open Question (c)): a kind passes for the leaf if **at least one** linked node passes that kind. Aggregated state is `pass | fail | insufficient_data | not_applicable` via the precedence `pass > fail > insufficient_data > not_applicable` (a single `pass` wins; otherwise the strongest-non-pass state propagates).
6. `mastered = every requiredKind has aggregated state 'pass'`. `covered = any linked node has any evidence`. `missingKinds = requiredKinds whose aggregated state is not 'pass'`.

For a leaf where `triad=skill`, the requirement is `['demonstration', 'scenario']`; the recommended mapping treats them as alternatives, so the leaf is mastered when **either** demonstration **or** scenario aggregated to `pass`. Refinement: the constant becomes `Record<ACSTriad, readonly AssessmentMethod[][]>` -- inner array is "all of these," outer array is "any of these." Recommended treatment in the recommended Open Question (a) resolution.

### Aggregation semantics across linked nodes

Open Question (c) chooses the rule. Recommended: "any one node passes" -- a leaf with multiple linked nodes is mastered for evidence kind K when **any single linked node** passes K. This matches the existing `getCredentialMastery` "every link must master" semantic at the leaf level, but inverted for kind aggregation: we don't require every linked node to have its own scenario evidence; we require that *somewhere* across the linked nodes, the leaf has scenario coverage.

The alternative ("every linked node must pass every required kind") is too strict -- a steep-turn leaf links to "load factor," "overbank tendency," and "coordinated flight." Requiring scenario evidence on each is overkill; the leaf mastery comes from the maneuver itself, which generates one evidence trail.

### Rollup shape change -- backwards compat

Open Question (d) chooses the path:

- **Hard cutover (recommended):** `LensLeaf.mastery` and `MasteryRollup` grow additive per-kind fields. Existing consumers reading `mastery.mastered` continue to work; new consumers can read `byEvidenceKind` and `missingKinds`. No shim layer.
- **Backwards-compat shim:** an old shape and a new shape coexist. Adds complexity for a transitional benefit; rejected.

The hard cutover is safe because the existing field (`mastered: boolean`) keeps its meaning ("the leaf passes its required-kind gates"). What changes is the *threshold* for that boolean -- a leaf that returned mastered=true under the dual gate may now return false because its required-kind gates aren't all clear. Cert dashboard rendering may show different totals after the cutover; that's the point.

## BC Surface

New file: `libs/bc/study/src/mastery.ts` (Open Question (e)). This is the WP-recommended location; the function set is large enough to deserve its own module rather than swelling `lenses.ts` or `credentials.ts`.

| File             | Function                          | Signature                                                                                                                                                                                          |
| ---------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mastery.ts`     | `getNodeEvidenceState`            | `(userId: string, nodeId: string, db?: Db) -> Promise<NodeEvidenceState>`                                                                                                                          |
| `mastery.ts`     | `getNodeEvidenceStateMap`         | `(userId: string, nodeIds: readonly string[], db?: Db) -> Promise<Map<string, NodeEvidenceState>>` (batched, mirrors `getNodeMasteryMap`)                                                          |
| `mastery.ts`     | `isLeafMastered`                  | `(userId: string, syllabusNodeId: string, db?: Db) -> Promise<LeafMasteryState>`                                                                                                                   |
| `mastery.ts`     | `getLeafMasteryStateMap`          | `(userId: string, leafIds: readonly string[], db?: Db) -> Promise<Map<string, LeafMasteryState>>` (batched)                                                                                        |
| `mastery.ts`     | `aggregateLeafKindStates`         | `(perNode: NodeEvidenceState[], requiredKinds: readonly AssessmentMethod[]) -> { byKind: Record<AssessmentMethod, GateState>; mastered: boolean; missingKinds: AssessmentMethod[] }` (pure helper) |
| `credentials.ts` | `getCredentialMastery` (extended) | `(userId, credentialId, db?) -> CredentialMasteryRollup` -- now reads via `isLeafMastered`; rollup grows `byEvidenceKind` per area + per credential                                                |
| `lenses.ts`      | `acsLens` (extended)              | unchanged signature; `LensLeaf.mastery` shape grows                                                                                                                                                |
| `lenses.ts`      | `domainLens` (extended)           | unchanged signature; ditto                                                                                                                                                                         |
| `lenses.ts`      | `computeMasteryRollup` (extended) | unchanged signature; output `MasteryRollup` grows `byEvidenceKind`                                                                                                                                 |

### Errors

`MissingTriadOnLeafError` -- thrown by `isLeafMastered` if a leaf has neither `triad` nor `requires_teaching` set (which would mean no required kinds; gracefully handled but flagged for content authors).

## Constants

`libs/constants/src/study.ts` additions:

```typescript
/**
 * The required-evidence-kind sets per ACS triad. Inner array is "all of
 * these required"; outer array is "any of these alternatives." Default
 * mapping per ADR 016 + Learning Philosophy principle 9.
 *
 * Knowledge leaves accept recall card evidence.
 * Risk-management leaves require scenario decision evidence (judgment).
 * Skill leaves accept either demonstration or scenario evidence -- the
 * pilot performs the maneuver in the sim or in real flight, captured as a
 * scenario rep with method 'demonstration' or 'scenario'.
 */
export const TRIAD_EVIDENCE_REQUIREMENTS: Record<ACSTriad, readonly (readonly AssessmentMethod[])[]> = {
	knowledge: [['recall']],
	risk_management: [['scenario']],
	skill: [['demonstration'], ['scenario']],
};

/**
 * Additional evidence kinds required when a syllabus_node carries
 * requires_teaching=true (CFI pedagogical leaves). Stacks ON TOP of the
 * triad mapping -- a CFI K leaf with requires_teaching=true demands recall
 * AND teaching evidence.
 */
export const TEACHING_EVIDENCE_KINDS: readonly AssessmentMethod[] = ['teaching'];
```

`libs/constants/src/study.ts` carries `BLOOM_LEVELS`, `STUDY_PRIORITIES`, `ACS_TRIAD`, `DUAL_GATE_*` -- all already present, unchanged.

## Routes

No new routes. Pages that surface the richer rollup are a follow-on UI WP.

## Validation

| Field / surface                                            | Rule                                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `syllabus_node.requires_teaching`                          | Boolean. CHECK: `requires_teaching = false OR triad IS NOT NULL` (only meaningful on element rows).   |
| `TRIAD_EVIDENCE_REQUIREMENTS[triad]`                       | Every inner array contains entries from `ASSESSMENT_METHOD_VALUES`. Type-checked by Record narrowing. |
| `TEACHING_EVIDENCE_KINDS`                                  | Subset of `ASSESSMENT_METHOD_VALUES`. Type-checked.                                                   |
| Leaf with `triad IS NOT NULL` and zero required kinds      | Theoretically impossible per the constant; runtime guard returns `mastered=true` for safety.          |
| `getNodeEvidenceState` per-kind thresholds                 | Reuse `CARD_MIN`, `REP_MIN`, `CARD_MASTERY_RATIO_THRESHOLD`, `REP_ACCURACY_THRESHOLD` per kind.       |
| Authored YAML `requires_teaching: true` on non-element row | Build pipeline rejects (level mismatch).                                                              |

## Edge cases

- **Leaf links to a node with `assessment_methods=[]`.** The node has no declared methods; `getNodeEvidenceState` returns `not_applicable` for every kind unless attached cards / reps exist. The leaf's required kinds aggregate as `not_applicable` via the linked node, which means `missingKinds` includes the required ones. Leaf is uncovered. This is the right behavior -- a node with no declared methods isn't pretending to provide any kind of evidence.
- **Scenario tagged with two methods.** A scenario with `assessment_methods=['scenario','demonstration']` contributes to both gates. The same rep counts toward both kinds' counts; the gate threshold is computed independently per kind. This matches the existing dual-gate logic for "this scenario covers both judgment and demonstration."
- **CFI leaf with `requires_teaching=true` linked to a node with zero teaching-exercise items.** Teaching gate returns `not_applicable` (no items at all). The leaf's `missingKinds` includes `teaching`. The leaf is uncovered until teaching exercises are authored against the linked node. Right behavior; surfaces the content gap.
- **Skill leaf where only `demonstration` evidence exists, no scenario.** Per the recommended `TRIAD_EVIDENCE_REQUIREMENTS.skill = [['demonstration'], ['scenario']]` (alternatives), demonstration alone satisfies. Leaf is mastered.
- **Risk-management leaf with no scenarios attached anywhere in the linked-node graph.** Scenario gate is `not_applicable` everywhere; aggregated state is `not_applicable`. `missingKinds` includes `scenario`. Leaf is uncovered. The data model correctly surfaces the content gap.
- **Leaf with `triad=null` but `requires_teaching=true`.** CHECK rejects this on insert. If somehow present pre-CHECK, runtime guard treats `requiredKinds = TEACHING_EVIDENCE_KINDS`.
- **Leaf with `triad` set but linked to zero knowledge nodes.** Per existing `getCredentialMastery` behavior the leaf is uncovered. Same here -- `byEvidenceKind` is empty; `missingKinds` lists the triad's required kinds; `mastered=false`.
- **Legacy mastery rollup in a follow-on consumer that hasn't migrated to the richer state.** Existing `mastery.mastered` boolean still works; the value just now reflects the new (stricter) gating. Followups that show stale numbers post-merge are expected; cert dashboard renders the new numbers; this is the intended behavior.
- **`computeMasteryRollup` called with leaves whose `mastery.mastered` was computed under the old logic.** The function is purely additive over the input; it doesn't recompute. If callers pass stale leaves, they get stale rollups. Tasks.md Phase 5 audits every caller.
- **Per-kind gate `not_applicable` on a required kind.** `not_applicable` is NOT a pass. The leaf's `missingKinds` includes that kind. This is intentional: a recall leaf whose linked node has zero cards is *not mastered*, full stop.
- **Pre-existing rows: `syllabus_node.requires_teaching` defaults to false.** Backfill is implicit (NOT NULL DEFAULT false). CFI leaves in the existing seed data start with `requires_teaching=false`; the cert-syllabus follow-on transcription pass updates them as the CFI ACS-25 content lands.

## Open Questions

The user resolves each before tasks.md finalizes.

### (a) Triad-to-evidence mapping -- is the proposed K/R/S right?

**Recommended:**

```typescript
TRIAD_EVIDENCE_REQUIREMENTS = {
	knowledge: [['recall']],
	risk_management: [['scenario']],
	skill: [['demonstration'], ['scenario']], // either suffices
};
```

| Option                                           | For                                                                                               | Against                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Recommended (K=recall, R=scenario, S=dem OR scn) | Matches Learning Philosophy principle 9. Honors that demonstration and scenario both prove skill. | A K leaf at examiner-level depth (e.g. CFI) might want recall AND scenario.                                              |
| Stricter K (recall + scenario at higher cert)    | A CFI K leaf needs both -- the candidate must recall AND demonstrate judgment.                    | Adds a "depth" axis to the constant; complicates the type. Better captured per-leaf via `requires_teaching` analog flag. |
| Add `calculation` to K when bloom>=apply         | Some K elements (e.g. weight + balance) need calculation evidence at apply level.                 | Hard-coding bloom into the mapping; better as a per-leaf annotation if the case is real.                                 |

If the user wants per-cert variation, the constant becomes `Record<CertCategory, Record<ACSTriad, ...>>` -- bigger, but expressive. Spec.md keeps the simple shape pending user pushback.

### (b) CFI teaching evidence -- explicit flag or inferred?

**Recommended: explicit `requires_teaching: boolean` column on `syllabus_node`.**

| Option                                               | For                                                                                                                                                           | Against                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Explicit flag (recommended)                          | Auditable per-leaf. Authoring the CFI ACS makes the requirement obvious -- the YAML row says it. Easy to query: "every CFI leaf with requires_teaching=true." | Adds a column. Authors must remember to set it.                                                                           |
| Inferred from credential.kind=instructor_cert + edge | No new column. The system derives it.                                                                                                                         | Complex inference; depends on exact graph edge types being right. Hard to audit ("why is this leaf demanding teaching?"). |
| Both (column + fallback inference)                   | Explicit when authored; inferred otherwise.                                                                                                                   | Two sources of truth. Mixed-mode authoring is confusing.                                                                  |

### (c) Quorum rule when a leaf links to multiple knowledge nodes

**Recommended: any-one-node-passes per kind.**

| Option                                  | For                                                                                                                                                                                                                   | Against                                                                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Any-one-node-passes (recommended)       | A leaf with multiple knowledge nodes only needs evidence on the one carrying the relevant kind. Matches "scenario evidence of steep turns is the steep-turn maneuver" -- not all linked nodes have to have scenarios. | A leaf whose required kinds spread across separate linked nodes (e.g. one node for the K, one for the S) is mastered as soon as both are individually covered. Right behavior. |
| Every-linked-node-passes-every-kind     | Maximally strict.                                                                                                                                                                                                     | Overspecifies. Steep turns links to load-factor, overbank, coordination -- requiring scenario reps on each is bonkers.                                                         |
| Weighted by `syllabus_node_link.weight` | Honors the link's weight column.                                                                                                                                                                                      | Adds math without clear product value v1. Weights become more meaningful in a follow-on; for v1 stick to boolean any-one-passes.                                               |

### (d) Backwards-compat for the rollup shape change

**Recommended: hard cutover. Existing `mastered: boolean` keeps its name and meaning; new fields are additive.**

| Option                                            | For                                                                                                      | Against                                                                                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hard cutover (recommended)                        | Single shape. Cert dashboard / lenses pick up the new totals immediately. Existing field name unchanged. | Numbers shown in dashboards may shift on release (some leaves go from mastered=true to false because the stricter gate kicks in). Communicate in release notes. |
| Backwards-compat shim                             | Old field for old consumers; new field for new consumers.                                                | Adds permanent complexity. The shim never goes away.                                                                                                            |
| Versioned BC fn (`getCredentialMasteryV1` / `V2`) | Surface both shapes until consumers migrate.                                                             | Permanent dual-API surface. Equivalent cost to the shim.                                                                                                        |

### (e) New BC location

**Recommended: new file `libs/bc/study/src/mastery.ts`.**

| Option                         | For                                                                                                    | Against                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| New `mastery.ts` (recommended) | Owns the per-evidence-kind decomposition cleanly. Easy to test in isolation. Future tunings live here. | One more file. Cross-module imports between `mastery.ts`, `lenses.ts`, `credentials.ts`.                                   |
| Extend `lenses.ts`             | Lens consumers are direct readers.                                                                     | `lenses.ts` already large. Single-responsibility erodes.                                                                   |
| Extend `credentials.ts`        | `getCredentialMastery` is one consumer.                                                                | The mastery primitive is broader than credentials; lens consumers would import from credentials, inverting the dependency. |

## Migration considerations

- **Schema additions ship as a single Drizzle migration** (next sequence number after main): adds `syllabus_node.requires_teaching boolean NOT NULL DEFAULT false` plus the CHECK constraint.
- **Triad-to-evidence mapping is a constant.** Authoring time only; no migration.
- **No backfill of `requires_teaching=true`.** Defaults to false. The cert-syllabus follow-on transcription pass updates CFI ACS-25 leaves as the content lands. This WP doesn't mass-flip the flag.
- **Cert dashboard / lens consumer numbers will shift on release.** A leaf that was mastered under the kind-agnostic dual gate may now be unmastered because its required kinds aren't all clear. This is the point. Release notes call it out so the dashboard doesn't look broken.
- **No FSRS scheduling impact.** Per ADR 011 the scheduler is independent of rollup; verified.
- **Existing tests continue to pass for the kind-agnostic dual gate** -- `getNodeMastery` itself is unchanged. Tests added in this WP cover the new functions only.

## Risks

| Risk                                                                                                                                         | Mitigation                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cert dashboard numbers drop on release because the new gate is stricter; users complain.                                                     | Release notes; "we improved how mastery is computed -- a leaf now requires evidence of the right kind." Surface the explanation in the dashboard's empty / partial state messages.                                                                                                                                                      |
| `getNodeEvidenceState` is too slow per node when called for every leaf in a credential rollup.                                               | Batch helper `getNodeEvidenceStateMap` exists. `getCredentialMastery` calls it once for the credential's full node set; same shape as today's `getNodeMasteryMap` batch.                                                                                                                                                                |
| The triad-to-evidence mapping is wrong for a real ACS leaf and gates someone unfairly.                                                       | Mapping is a constant; if a leaf's mapping is wrong the fix is per-leaf via `requires_teaching` or a leaf-level override flag (deferred). The recommended mapping covers the documented FAA case. Iterate after content authoring confirms.                                                                                             |
| Card kind partition reveals that `recall` cards alone count for K leaves but `calculation` cards exist on the same node and aren't surfaced. | Per-kind decomposition exposes `calculation` as a separate gate; the K leaf doesn't require calculation, so it's `not_applicable` and ignored. Math nodes that authored both kinds get both gates surfaced.                                                                                                                             |
| Scenarios tagged with multiple `assessment_methods` cause double-counting in per-kind gates.                                                 | A scenario contributes to each tagged kind's gate. The dual-gate logic computes per-kind independently; same scenario in multiple gates is by design. Threshold logic is per kind, so no double-count beyond what's intended.                                                                                                           |
| Per-kind thresholds reuse global constants; not all kinds may want the same minimum.                                                         | Tracked. Future tuning surfaces in a follow-on if data shows e.g. "scenario reps need 5-rep minimum to be reliable." Doesn't block this WP.                                                                                                                                                                                             |
| CFI leaves' `requires_teaching=true` flag isn't authored on existing seed data.                                                              | Defaults to false. Cert-syllabus follow-on transcription lights up the flag as CFI content lands. Until then, CFI leaves grade as kind-agnostic-dual-gate-equivalent (no teaching gate is required).                                                                                                                                    |
| Lens consumers (acsLens, domainLens) ship the old boolean rollup to follow-on UIs that haven't migrated.                                     | Hard cutover keeps `mastered: boolean` shape; new fields are additive. Existing UI continues to render; new UI picks up the richer state when it migrates. No mid-migration broken state.                                                                                                                                               |
| Aggregation rule "any-one-passes" is wrong for a leaf where the user expects "every linked node mastered."                                   | `getCredentialMastery` already separately checks "every linked node mastered" for the leaf-level boolean. The any-one-passes rule applies *per evidence kind*. Both rules coexist: leaf is mastered iff (a) every linked node is mastered under the strict dual-gate AND (b) every required kind aggregates to pass via any-one-passes. |
| Engine continues picking same items as today; no closer match to evidence-kind gaps.                                                         | Spec is explicit -- engine work is a follow-on. This WP delivers the data layer; the engine pickup is a separate WP.                                                                                                                                                                                                                    |

## References

- [Design](./design.md) -- rationale, alternatives considered, key decisions
- [Tasks](./tasks.md) -- phased implementation plan
- [Test plan](./test-plan.md) -- manual acceptance scenarios
- [User stories](./user-stories.md) -- learner-perspective narratives
- [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md)
- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md)
- [Learning Philosophy principle 9](../../platform/LEARNING_PHILOSOPHY.md)
- [Cert, Syllabus, and Goal Composer spec](../cert-syllabus-and-goal-composer/spec.md) -- WP whose Out-of-Scope this fulfills
- [Cert Dashboard spec](../cert-dashboard/spec.md) (PR #321) -- consumer; richer rollup picked up in a follow-on UI WP
- [Goal Composer spec](../goal-composer/spec.md) (PR #324) -- consumer; same follow-on
- [Engine Goal Cutover spec](../engine-goal-cutover/spec.md) -- parallel WP; both touch the goal model
