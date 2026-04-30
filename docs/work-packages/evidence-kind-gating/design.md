---
title: 'Design: Evidence Kind Gating'
product: study
feature: evidence-kind-gating
type: design
status: unread
review_status: pending
---

# Design: Evidence Kind Gating

Rationale, alternatives, and key decisions for [spec.md](./spec.md). Read the spec first; this document explains why the spec is shaped the way it is.

## Problem in one paragraph

The dual-gate mastery model (cards + reps) is kind-agnostic. A skill leaf demanding a maneuver demonstration is satisfied by enough recall cards, because the gate logic doesn't ask what kind of evidence cleared it. Learning Philosophy principle 9 says "evidence has to match the kind of knowledge." This WP is the first WP that takes principle 9 seriously at the rollup layer.

## The shape of the change

Today's gate:

```typescript
mastered = (cardsGate === 'pass' || cardsGate === 'not_applicable')
        && (repsGate === 'pass' || repsGate === 'not_applicable');
```

After this WP, per leaf:

```typescript
requiredKinds = TRIAD_EVIDENCE_REQUIREMENTS[leaf.triad]
              + (leaf.requires_teaching ? TEACHING_EVIDENCE_KINDS : []);

mastered = every requiredKind in `requiredKinds` aggregates to 'pass'
           across the leaf's linked knowledge nodes (any-one-passes per kind);
```

The dual gate (`getNodeMastery`) doesn't go away. It still serves as the per-node "is this node done" signal that engine selection consumes. What changes is how **leaves** roll up: from "every linked node is dual-gate-mastered" to "every required evidence kind aggregates to pass somewhere across linked nodes."

These are not equivalent:

- A K leaf with one linked node passing the dual gate (cards passing, reps not_applicable) is mastered under both regimes.
- An S leaf with one linked node passing the dual gate via cards only (no scenarios attached at all) is mastered under the old regime, NOT mastered under the new one.

That difference is the entire point. The old regime over-counted skill leaves; the new one demands the right kind of evidence.

## Design tensions

### Where does the required-evidence-kind set live?

Three places it could:

- **Per-leaf (recommended path).** The leaf carries its own `requiredKinds`. Most expressive; per-leaf overrides are easy. Cost: every leaf has to be authored with the right thing.
- **Per-triad constant (recommended).** A small constant maps `K -> [recall]`, `R -> [scenario]`, `S -> [demonstration | scenario]`. Captures the typical case. Per-leaf overrides via a separate flag (`requires_teaching`) when the triad isn't enough.
- **Per-credential constant.** "All CFI leaves require teaching." Too coarse -- not every CFI leaf does.

The recommended approach: triad constant for the default, per-leaf flag (`requires_teaching`) for the CFI overlay. Captures the bulk of real cases without over-authoring.

### Aggregation rule across linked nodes

A leaf often links to multiple knowledge nodes. Steep turns links to load factor, overbank, coordinated flight. The leaf demands skill evidence (demonstration or scenario). Where does that evidence live?

The maneuver demo itself is one scenario rep, which gets attached to the steep-turn knowledge node (or to a "perform-steep-turns" node). The other linked nodes (load factor, overbank) don't have steep-turn maneuver demos attached -- they have card recall and possibly other scenarios.

If we required every linked node to have demonstration evidence, the leaf would never master because load factor doesn't have a demo. The any-one-passes rule lets the leaf master when the maneuver evidence lives anywhere across the linked node set. Right behavior.

The strict alternative ("every linked node has every required kind") is overly mechanical; it would require authors to duplicate scenarios across every linked node. Rejected.

### What about leaves whose linked nodes are missing teaching evidence content?

A CFI leaf with `requires_teaching=true`. The linked nodes have cards and possibly scenarios. They have no teaching-exercise content yet because we haven't authored teaching exercises.

The teaching gate returns `not_applicable` everywhere (no items at all). The aggregated state is `not_applicable`. That is NOT a pass. The leaf's `missingKinds` lists `teaching`. The leaf is uncovered.

This is the right behavior. The CFI candidate's dashboard says "this leaf needs teaching evidence" -- which it does. The content gap is surfaced. When teaching exercises ship, the gate flips.

### Backwards-compat for the rollup shape

Adding a new field to `LensLeaf.mastery` and `MasteryRollup` is risky because consumers expect a specific shape. The recommended approach (Open Question (d)) is **hard cutover with additive fields**:

- `mastered: boolean` keeps its name and meaning ("the leaf passes its required-kind gates"). The threshold for `true` shifts; the field name doesn't.
- New fields (`byEvidenceKind`, `missingKinds`, `requiredKinds`) are additive. Old consumers ignore them; new consumers use them.

This works because the existing field's semantic ("does this count as mastered") survives -- what shifts is what counts. A pure-additive shape change with a semantically tighter `mastered` is the right shape.

The alternative (versioned API or shim) creates permanent dual-shape complexity. Rejected.

### Engine pickup -- not in this WP

The engine doesn't read leaf-mastery state today; it picks from cards + scenarios per the dual gate. Wiring "prefer items that close evidence-kind gaps" is a real win (a learner whose S leaf is missing scenario evidence should see that scenario sooner) but it's a separate engine WP.

This WP delivers the data layer. Once the rollup carries `missingKinds`, the engine selection can consume it. Spec calls this out under "Engine consumption -- read-only for now."

### Engine cutover happens in parallel

The [`engine-goal-cutover`](../engine-goal-cutover/spec.md) WP routes the engine's targeting through the goal model. Both WPs touch the goal layer but at different surfaces:

- Engine cutover: reads goal -> derives cert + focus + skip filters for the engine slice pickers.
- Evidence-kind gating: reads goal -> resolves leaves -> computes per-leaf mastery for the rollup.

They are independent. They can ship in parallel. Neither blocks the other; sign-off on each is independent.

## Alternatives considered

### Make every node carry per-kind mastery scores

Rejected. The data is already there in `assessment_methods` + card/scenario tagging. Adding a `node_mastery_by_kind` table or column would duplicate what we can compute. Computed-on-read keeps the schema small.

### Compute leaf mastery in SQL via a view

Rejected. The aggregation is pure (over per-node states) and easier to reason about in TypeScript than in a many-CTE SQL view. The per-node fan-out is `O(linked_nodes_per_leaf)` -- small enough that an in-memory walk is fine; a batched fetch keeps round-trips minimal.

### Conflate `scenario` and `demonstration` into one kind

Rejected. They model different things. A scenario is a decision-rep ("you're at 1500 ft AGL with an engine out, what do you do?"); a demonstration is a maneuver execution ("perform steep turns in the sim, scored on heading / altitude / coordination"). Different evidence shapes. Treating them as one would lose the discrimination that matters for skill evaluation.

### Drop `triad=null` rows entirely

Rejected. Section-level rows under elements (rare but possible) carry `triad=null` legitimately. Defensive guard returns trivially mastered when covered.

### Make `requires_teaching` an inferred property

Rejected per Open Question (b). Inference requires the graph to carry consistent edge types (`teaches` etc.) which the current authoring may not. The explicit flag is auditable per leaf. Future work can add inference as a default if the explicit authoring proves redundant.

## Key decisions

| Decision                                                     | Rationale                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Required kinds derived from triad + `requires_teaching` flag | Triad covers the typical case. Per-leaf flag covers CFI pedagogical leaves.                   |
| Any-one-passes aggregation across linked nodes per kind      | Matches "evidence lives somewhere in the linked-node set"; doesn't force per-node redundancy. |
| Hard cutover, additive new fields                            | `mastered: boolean` keeps its name; new fields are additive. No shim layer.                   |
| New `mastery.ts` BC module                                   | The function set is large enough to deserve its own module. Future tunings live here.         |
| `requires_teaching` boolean column on `syllabus_node`        | Explicit, auditable, easy to query. Inference is a future option.                             |
| Per-kind thresholds reuse global constants                   | Keeps the WP small. Per-kind tunings deferred.                                                |
| Engine selection unchanged in this WP                        | Engine pickup is a separate WP. Data layer ships first; engine WP composes on top.            |

## Card kind partition rationale

Cards have a `kind` (recall vs calculation). The card gate today is kind-agnostic -- if a node has 5 cards (3 recall, 2 calculation) and 3 of them pass, the gate counts them collectively.

After this WP, the per-kind decomposition splits:

- `recall` gate: counts only `recall` cards. If a node has 3 recall cards passing, recall gate = pass.
- `calculation` gate: counts only `calculation` cards. If a node has 2 calculation cards (below `CARD_MIN`), calculation gate = insufficient_data.

A K leaf only requires `recall`; calculation is `not_applicable` from the leaf's POV. So the recall-only gate is what matters.

Why not require `calculation` for some K leaves? The triad mapping doesn't currently encode that. A node with calculation cards is presumed to provide them as supplementary evidence; the leaf's required-kind set determines what's actually demanded.

Future refinement could let a leaf override its required kinds with a `required_evidence_kinds` JSON column that supersedes the triad mapping. Spec.md mentions this in Open Question (a) as the per-leaf override path; not implemented in v1.

## Domain lens vs ACS lens

The ACS lens walks `syllabus_node` -> `syllabus_node_link` -> `knowledge_node`. Each leaf has a `triad`, so the required-kind set comes from the triad mapping.

The Domain lens walks `knowledge_node.domain` directly. Each leaf is a knowledge node, not a syllabus_node, so it has no `triad`. The required-kind set comes from the node's own `assessment_methods` array -- the node's authored declaration of "what kinds of evidence I'm meant to provide."

This split matches the lens semantic: the ACS lens is about what the FAA test demands at this leaf; the Domain lens is about what the node itself is meant to provide. Same underlying primitive (`getNodeEvidenceState`), different leaf-gating logic.

## Operations

### Release notes

The cert dashboard's number of mastered leaves may decrease. This is expected. Release notes should:

1. Explain the change ("we now require evidence of the right kind to count a leaf as mastered").
2. Surface examples ("a leaf about steep turns now requires either scenario or demonstration evidence; recall cards alone are no longer sufficient").
3. Point to the missingKinds surface for actionable guidance.

If the user wants the cert dashboard to highlight what's changed (e.g., "12 leaves shifted from mastered to not-yet"), that's a follow-on UI work item -- this WP just provides the data.

### Rollback

This WP is read-side only. Schema changes are additive (`requires_teaching` column with default false; the constraint is purely additive). No rollback is needed in the destructive sense. If the new gating is too strict, the BC fix is a matter of relaxing thresholds or adjusting the triad mapping in a follow-on PR -- the schema stays.

A "true" rollback (revert this WP entirely) means:

1. `git revert` the BC PR.
2. The `requires_teaching` column stays in the schema (no harm; defaults to false).
3. `getCredentialMastery` reverts to the kind-agnostic dual gate.

Cert dashboard numbers shift back. No data loss.

### Verification post-release

- Run `bun run db check` (or whatever the equivalent observability surface is) to confirm cert dashboard renders for representative users without crashes.
- Spot-check abby's primary cert dashboard pre/post-merge; confirm the numeric shift is in the expected direction (some leaves moving from mastered=true to mastered=false because the new gate is stricter).
- Confirm no follow-on consumer crashes on the additive fields.

## Follow-on opportunities

These are flagged in spec.md as out of scope; resolution captured here so nothing is left dangling.

| Item                                                      | Status                                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| UI surface for `missingKinds` (cert dashboard, lens UI)   | Follow-on UI WP triggered after this WP merges. Data is here; pages pick it up.                                |
| Engine selection that prefers items closing evidence gaps | Follow-on engine WP. Data is here; selection logic in a separate WP.                                           |
| Per-kind thresholds (e.g. `SCENARIO_REP_MIN=5`)           | Tracked. Add when data shows a gap.                                                                            |
| `required_evidence_kinds` per-leaf override column        | Tracked. Add when a real leaf needs to override the triad mapping.                                             |
| Bloom-level gating per evidence kind                      | Tracked. Requires per-card / per-scenario bloom tagging; out of scope here.                                    |
| Inference-based `requires_teaching` (no explicit flag)    | Considered and rejected for v1. Revisit if explicit authoring proves redundant after CFI ACS-25 transcription. |
| Backfill teaching-exercise content                        | Independent content work. Tracked in cert-syllabus follow-on transcription.                                    |
| Cert dashboard release notes for the number shift         | Out of scope here; the cert-dashboard team handles release notes.                                              |

## References

- [spec.md](./spec.md)
- [tasks.md](./tasks.md)
- [test-plan.md](./test-plan.md)
- [user-stories.md](./user-stories.md)
- [Cert, Syllabus, and Goal Composer design](../cert-syllabus-and-goal-composer/design.md)
- [ADR 011 design](../../decisions/011-knowledge-graph-learning-system/decision.md) -- dual-gate primitive
- [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md)
- [Learning Philosophy principle 9](../../platform/LEARNING_PHILOSOPHY.md)
- [Engine Goal Cutover spec](../engine-goal-cutover/spec.md) -- parallel WP
