---
title: 'Out of Scope: Evidence Kind Data Layer'
product: study
feature: evidence-kind-data-layer
type: out-of-scope
status: unread
---

# Out of Scope: Evidence Kind Data Layer

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

## Summary

| Item                                                          | Status       | Trigger to revisit                                                                       |
| ------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| CFI ACS-25 transcription / teaching-exercise content          | Follow-on WP | When the CFI cert syllabus is the active authoring target                                |
| Teaching-exercise UX / runtime / session pickup               | Follow-on WP | When the live session pipeline needs to generate teaching exercises                      |
| Per-card / per-scenario bloom tagging                         | Deferred     | When mastery rollup demands bloom-level evidence matching, not just kind                 |
| Engine selection changes                                      | Follow-on WP | When the engine needs to prefer items that close evidence-kind gaps                      |
| Per-kind threshold tunings                                    | Deferred     | When data shows a per-kind threshold mismatch (e.g. scenario reps need a higher minimum) |
| Renaming `card.cardType`                                      | Rejected     | Never -- see detail below                                                                |
| Merging `knowledge_node.assessment_methods` with `scenario.*` | Rejected     | Never -- see detail below                                                                |
| Multi-tenant isolation of teaching-exercise content           | Deferred     | When teaching-exercise content has a cross-user sharing user story                       |
| GIN index on `scenario.assessment_methods`                    | Deferred     | When profiling shows LATERAL UNNEST is a bottleneck                                      |

## CFI ACS-25 transcription / teaching-exercise content

Status: Follow-on WP

What was deferred:
The actual authoring of teaching exercises and the per-leaf `requires_teaching=true` flips for CFI leaves.

Why:
This data-layer WP delivers the substrate: (a) the `requires_teaching` column (shipped in `evidence-kind-gating` WP B), (b) the `teaching_exercise` table (this WP), and (c) the `teaching-exercise` session-item-kind (this WP). The content side -- actually transcribing CFI ACS-25 and authoring real teaching exercises -- is a downstream content WP.

Trigger to revisit:
When the CFI cert syllabus is the active authoring target, or when a CFI candidate user story is in the active backlog.

Implementation pattern when triggered:
Author a new WP via `/ball-wp-spec` for the CFI ACS-25 transcription. The WP fills (a)+(b)+(c) with real content. Pattern: mirror how existing ACS authoring happens via `course/syllabi/<slug>/areas/*.yaml`, plus seed teaching-exercise rows via the `createTeachingExercise` BC.

References:

- [spec.md](./spec.md) Out of Scope item 1
- [spec.md](./spec.md) item 12 ("CFI ACS-25 transcription explicitly out of scope")
- [evidence-kind-gating spec](../evidence-kind-gating/spec.md) -- where `requires_teaching` was introduced

## Teaching-exercise UX / runtime / session pickup

Status: Follow-on WP

What was deferred:
Engine work to select teaching-exercises into a session, plus the UI for a candidate to perform a teaching-exercise.

Why:
This WP adds the session-item-kind so a future engine WP can pick teaching-exercises. v1 ships read-side mastery aggregation only -- if seed data hand-inserts teaching-exercise rows + session_item_result rows, the gate computes against them, but the live session pipeline doesn't generate them yet.

Trigger to revisit:
When the live session pipeline needs to generate teaching exercises (typically same trigger as CFI ACS-25 transcription, but it's a separate engine WP).

Implementation pattern when triggered:
Mirror how `pickStrengthen` / `pickExpand` / `pickContinue` in `libs/bc/study/src/engine.ts` select scenarios. A `pickTeachingExercise` (or extension of an existing picker) reads from `teaching_exercise` filtered by node and missing-kind state. Author via `/ball-wp-spec`.

References:

- [spec.md](./spec.md) Out of Scope item 2
- [spec.md](./spec.md) "Engine pickup -- read-only for now"

## Per-card / per-scenario bloom tagging

Status: Deferred

What was deferred:
A per-card or per-scenario bloom-level annotation that lets the mastery rollup check whether evidence reaches the leaf's `required_bloom`.

Why:
The leaf's `required_bloom` already exists; whether per-card / per-scenario evidence reaches the bloom level is a separate dimension beyond per-kind partitioning. This WP only ships per-kind. Bloom tagging is a second axis.

Trigger to revisit:
When the mastery rollup demands bloom-level evidence matching, not just kind. Likely surfaces when a user can clear a kind gate with low-bloom evidence and the dashboard shows "mastered" when the leaf demanded apply-or-higher recall.

Implementation pattern when triggered:
Add `card.bloom` and `scenario.bloom` columns (text, CHECK in `BLOOM_LEVELS`). Extend `getNodeEvidenceStateMap` to partition by bloom in addition to kind. Author via `/ball-wp-spec`.

References:

- [spec.md](./spec.md) Out of Scope item 3

## Engine selection changes

Status: Follow-on WP

What was deferred:
Wiring "engine picks calculation cards when a leaf is missing calculation evidence" or "engine prefers items that close evidence-kind gaps."

Why:
WP B and this WP scope are explicit: the engine continues to pick from cards + scenarios as today. The per-kind data shape is delivered for the rollup, not the picker.

Trigger to revisit:
When learners report that the engine doesn't help them close known-missing-kind gaps even though the dashboard surfaces them. Or when the cert dashboard's missing-kinds UI lands and the user need is to act on it without manual hunting.

Implementation pattern when triggered:
Author a follow-on engine WP. Pattern: thread `LeafMasteryState.missingKinds` into the engine's pool filter; bias `pickStrengthen` / `pickExpand` toward items whose `card.kind` or `scenario.assessment_methods` covers a missing kind.

References:

- [spec.md](./spec.md) Out of Scope item 4
- [spec.md](./spec.md) item 8 / "Engine pickup -- read-only for now"

## Per-kind threshold tunings

Status: Deferred

What was deferred:
Distinct `CARD_MIN`, `REP_MIN`, `CARD_MASTERY_RATIO_THRESHOLD`, `REP_ACCURACY_THRESHOLD` values per evidence kind.

Why:
Constants stay global for v1. Ship the partitioning first, tune later if data demands it. Premature optimization without evidence of mismatch.

Trigger to revisit:
When telemetry / user reports show a per-kind threshold mismatch -- e.g. "scenario reps need a 5-rep minimum to be reliable" or "calculation cards plateau too fast at 0.8."

Implementation pattern when triggered:
Add per-kind constant blocks (e.g. `SCENARIO_REP_MIN`, `DEMONSTRATION_ACCURACY_THRESHOLD`) in `libs/constants/src/study.ts`. Thread them into `computeCardGate` / `computeRepGate` via a kind-aware variant. Author tasks.md changes for `mastery.ts`.

References:

- [spec.md](./spec.md) Out of Scope item 5

## Renaming `card.cardType`

Status: Rejected

What was rejected:
Renaming or removing the existing `card.cardType` column (values `basic | cloze | regulation | memory_item`).

Why:
`card_type` describes presentation form, not knowledge kind. It is a different axis from the new `card.kind` (`recall | calculation`). Both columns are load-bearing for different consumers; merging or renaming would conflate orthogonal concepts.

References:

- [spec.md](./spec.md) Out of Scope item 6
- [spec.md](./spec.md) Constants section explaining the two axes

## Merging `knowledge_node.assessment_methods` with `scenario.assessment_methods`

Status: Rejected

What was rejected:
Any migration that merges or unifies `knowledge_node.assessment_methods` and `scenario.assessment_methods` into a single concept.

Why:
`knowledge_node.assessment_methods` describes which methods are *valid* for evaluating that node. `scenario.assessment_methods` (this WP) describes which methods *this specific scenario* implements. Different concepts; both stay.

References:

- [spec.md](./spec.md) Out of Scope item 7

## Multi-tenant isolation of teaching-exercise content

Status: Deferred

What was deferred:
Cross-user sharing semantics for teaching-exercise content.

Why:
Teaching-exercise rows carry `user_id` like cards / scenarios; cross-user sharing follows the same path. The sharing path itself is out of scope for v1 (no user story exists yet).

Trigger to revisit:
When teaching-exercise content has a cross-user sharing user story (e.g. CFI mentor publishes exercises to candidates). Same shape as the open cards/scenarios sharing question.

Implementation pattern when triggered:
Mirror whatever sharing pattern lands for cards / scenarios. The `teaching_exercise` row already carries `user_id` and `seed_origin`, so the sharing primitives apply uniformly.

References:

- [spec.md](./spec.md) Out of Scope item 8

## GIN index on `scenario.assessment_methods`

Status: Deferred

What was deferred:
A GIN index on `scenario.assessment_methods` to accelerate `LATERAL UNNEST` queries.

Why:
The LATERAL UNNEST runs once per `getNodeEvidenceStateMap` call and is bounded by scenario count and per-row method count (typically 1 or 2). Pre-emptive index addition would be premature optimization without profile evidence.

Trigger to revisit:
When profiling shows LATERAL UNNEST on `scenario.assessment_methods` is a bottleneck (e.g. mastery rollup latency budget exceeded).

Implementation pattern when triggered:
Add `index('scenario_methods_gin').using('gin', t.assessmentMethods)` to the schema. Single-line change in `libs/bc/study/src/schema.ts`; `bun run db reset` re-applies via `drizzle-kit push`.

References:

- [spec.md](./spec.md) Risks section -- "LATERAL UNNEST on `scenario.assessment_methods` is slow"
- [tasks.md](./tasks.md) Out of scope item -- "GIN index on `scenario.assessment_methods` -- only if profiling shows the LATERAL UNNEST is a bottleneck"
