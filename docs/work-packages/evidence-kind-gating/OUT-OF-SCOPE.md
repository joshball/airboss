---
title: 'Out of Scope: Evidence Kind Gating'
product: study
feature: evidence-kind-gating
type: out-of-scope
status: unread
---

# Out of Scope: Evidence Kind Gating

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

## Summary

| Item                                      | Status       | Trigger to revisit                                                                |
| ----------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| UI rendering of the richer rollup         | Follow-on WP | When cert dashboard / goal composer needs to surface `missingKinds` to learners   |
| Engine selection changes                  | Follow-on WP | When the engine needs to prefer items that close evidence-kind gaps               |
| Per-card / per-scenario authoring tooling | Follow-on WP | When content authors need to set `assessment_methods` outside of seed YAML        |
| Changing dual-gate thresholds             | Deferred     | When data shows a per-kind threshold mismatch (currently global constants stay)   |
| Changing FSRS scheduling weights          | Rejected     | Never -- see detail below                                                         |
| Backfill of teaching-exercise results     | Rejected     | Never -- see detail below                                                         |
| Teaching evidence UI affordance           | Follow-on WP | When teaching exercises are an authored content kind                              |
| Bloom-level gating                        | Deferred     | When mastery rollup demands per-card / per-scenario bloom matching, not just kind |

## UI rendering of the richer rollup

Status: Follow-on WP

What was deferred:
Cert dashboard and goal composer page changes that surface the richer `LeafMasteryState` (including `missingKinds` and `byEvidenceKind`) to learners.

Why:
Cert dashboard pages (PR #321) and goal composer pages (PR #324) currently render leaves as `mastered: boolean`. After this WP they have access to the richer state, but the page changes that surface "you have recall down but need a scenario" are a separate UI WP. This WP delivers the data layer.

Trigger to revisit:
When the data-layer surface lands and the cert dashboard UI needs to surface the gap to learners. Already named in tasks.md Phase 10 -- placeholder paths `docs/work-packages/cert-dashboard-evidence-kinds/` and a goal-composer follow-on.

Implementation pattern when triggered:
Author a follow-on UI WP via `/ball-wp-spec`. Pattern: extend the existing area / leaf rendering in `apps/study/src/routes/(app)/credentials/...` to read `LeafMasteryState.missingKinds` and `byEvidenceKind` from the BC, render per-kind chips or summary lines.

References:

- [spec.md](./spec.md) Out of Scope item 1
- [tasks.md](./tasks.md) Phase 10 -- "Follow-on UI work flagged"
- [Cert Dashboard spec](../cert-dashboard/spec.md) (PR #321)
- [Goal Composer spec](../goal-composer/spec.md) (PR #324)

## Engine selection changes

Status: Follow-on WP

What was deferred:
Engine work to prefer items that close evidence-kind gaps (e.g., when a leaf is missing scenario evidence, the engine pulls scenario reps over cards).

Why:
The engine continues to pick from cards + scenarios as today. This WP records the data shape so the follow-on has the substrate; wiring the selection itself is separate.

Trigger to revisit:
When learners report that the engine doesn't help close known-missing-kind gaps. Or when the cert dashboard's missing-kinds UI lands and the user need is to act on it without manual hunting.

Implementation pattern when triggered:
Thread `LeafMasteryState.missingKinds` into the engine's pool filter; bias `pickStrengthen` / `pickExpand` in `libs/bc/study/src/engine.ts` toward items whose `card.kind` or `scenario.assessment_methods` covers a missing kind. Author via `/ball-wp-spec`.

References:

- [spec.md](./spec.md) Out of Scope item 2
- [spec.md](./spec.md) Risks table -- "Engine continues picking same items as today"

## Per-card / per-scenario authoring tooling for `assessment_methods`

Status: Follow-on WP

What was deferred:
Hangar app authoring surfaces for setting `card.kind` and `scenario.assessment_methods` per row.

Why:
The arrays already exist on the schemas; this WP consumes them, doesn't author them. Authoring tooling lives in the hangar app and is a separate WP.

Trigger to revisit:
When content authors need to set `assessment_methods` outside of seed YAML (i.e. via a UI). `evidence-kind-data-layer` shipped editor fields per its own scope; deeper authoring tooling (bulk editors, per-domain filters, validation surfaces) remains follow-on.

Implementation pattern when triggered:
Mirror existing hangar authoring routes for cards / scenarios at `apps/hangar/src/routes/cards/...` and `apps/hangar/src/routes/scenarios/...`. Add multi-select / chip widgets for `assessment_methods`. Form actions validate against `ASSESSMENT_METHOD_VALUES`.

References:

- [spec.md](./spec.md) Out of Scope item 3

## Changing dual-gate thresholds

Status: Deferred

What was deferred:
Modifying `CARD_MASTERY_RATIO_THRESHOLD = 0.8`, `REP_ACCURACY_THRESHOLD = 0.7`, `CARD_MIN = 3`, `REP_MIN = 3`, or introducing per-kind tunings.

Why:
Per-kind tunings (e.g., "recall needs 5 cards minimum" vs "scenario needs 3") are deferred -- ship the per-kind shape first, tune later if data shows a gap. Premature tuning without evidence is the wrong order.

Trigger to revisit:
When telemetry / user reports show per-kind threshold mismatch (e.g. "scenario reps need 5-rep minimum to be reliable").

Implementation pattern when triggered:
Add per-kind constant blocks (e.g. `SCENARIO_REP_MIN`, `DEMONSTRATION_ACCURACY_THRESHOLD`) in `libs/constants/src/study.ts`. Thread them into `computeCardGate` / `computeRepGate` via a kind-aware variant in `libs/bc/study/src/mastery.ts`.

References:

- [spec.md](./spec.md) Out of Scope item 4
- [spec.md](./spec.md) Risks -- "Per-kind thresholds reuse global constants"

## Changing FSRS scheduling weights

Status: Rejected

What was rejected:
Any changes to FSRS scheduling (the spaced-repetition scheduler).

Why:
The scheduler stays as-is. This WP is a read-side / rollup change, not a write-side / scheduling change. Per ADR 011 the scheduler is independent of rollup. Mixing read-side gating into write-side scheduling would conflate two systems with different invariants.

References:

- [spec.md](./spec.md) Out of Scope item 5
- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md)

## Backfill of teaching-exercise results

Status: Rejected

What was rejected:
A retroactive backfill of teaching-exercise session_item_result rows.

Why:
Today there are zero teaching-exercise reps in the seed data; the gate returns `not_applicable` until teaching exercises ship as content. There is no retroactive data to backfill, and synthesizing fake teaching evidence would falsely show CFI leaves as mastered.

References:

- [spec.md](./spec.md) Out of Scope item 6

## A "teaching evidence" UI affordance

Status: Follow-on WP

What was deferred:
A UI affordance for recording / performing a teaching exercise.

Why:
Teaching exercises are not yet an authored content kind in v1; surfacing a UI without content would be a stub. Out of scope until the follow-on CFI ACS-25 transcription WP lands content.

Trigger to revisit:
When teaching exercises are an authored content kind (likely landing with the CFI ACS-25 transcription WP).

Implementation pattern when triggered:
Mirror scenario-rep UX at `apps/study/src/routes/(app)/sessions/...` for the rep recording surface. The new affordance reads a `teaching_exercise` row and records a `session_item_result` with `item_kind='teaching-exercise'`. Author via `/ball-wp-spec`.

References:

- [spec.md](./spec.md) Out of Scope item 7
- [evidence-kind-data-layer spec](../evidence-kind-data-layer/spec.md) -- where the `teaching_exercise` table was specced

## Bloom-level gating

Status: Deferred

What was deferred:
Gating that checks whether per-card / per-scenario evidence reaches the leaf's `required_bloom`.

Why:
The leaf's `required_bloom` already exists on `syllabus_node`. Whether the per-card / per-scenario evidence reaches the required bloom is a separate dimension and would require per-card / per-scenario bloom tagging, which is itself out of scope.

Trigger to revisit:
When mastery rollup demands bloom-level evidence matching, not just kind. Likely surfaces when a learner clears a kind gate with low-bloom evidence and the dashboard shows "mastered" when the leaf demanded apply-or-higher.

Implementation pattern when triggered:
Add `card.bloom` and `scenario.bloom` columns (text, CHECK in `BLOOM_LEVELS`). Extend `getNodeEvidenceStateMap` in `libs/bc/study/src/mastery.ts` to partition by bloom in addition to kind. Author via `/ball-wp-spec`.

References:

- [spec.md](./spec.md) Out of Scope item 8
