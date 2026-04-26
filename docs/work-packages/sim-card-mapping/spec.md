---
title: 'Spec: Sim-Scenario / Study-Card Mapping'
product: study
feature: sim-card-mapping
type: spec
status: unread
---

# Spec: Sim-Scenario / Study-Card Mapping

The bridge that lets a sim weakness signal -- "you keep grading low on `ils-approach`" -- pressure the right study cards in the spaced-rep scheduler.

`getRecentSimWeakness(userId)` ([libs/bc/sim/src/persistence.ts](../../../libs/bc/sim/src/persistence.ts)) already produces the per-scenario weight signal. The missing piece is a typed authoritative mapping from each [SimScenarioId](../../../libs/constants/src/sim.ts) to the [knowledge_node](../../../libs/bc/study/src/schema.ts) ids it exercises. Once authored, the study session engine reads the signal, fans it out across the linked nodes, and uses the per-node weight to lift cards in the strengthen slice.

This work package defines the data model, the authored mapping for the 13 graded scenarios that exist today, and the engine integration that turns the signal into card-level pressure.

## Why this matters

Without a mapping, `getRecentSimWeakness` is dead code. The whole point of grading the sim is to feed weakness back into spaced rep so a learner who keeps blowing the ILS sees more localiser-tracking and glide-slope cards next session. Without this bridge that loop never closes.

## Success Criteria

- One authored, typed mapping covers every gradable [SimScenarioId](../../../libs/constants/src/sim.ts) (excluding `playground` / `playground_pa28`, which are not graded).
- Each scenario maps to >= 1 [knowledgeNode.id](../../../libs/bc/study/src/schema.ts) it exercises, with per-edge weight in (0, 1].
- The engine consumes [SimWeaknessSignal](../../../libs/bc/sim/src/persistence.ts), translates it into per-node sim pressure, and lifts strengthen-slice scores for cards / reps attached to those nodes.
- Lift coefficient is configurable in [ENGINE_SCORING](../../../libs/constants/src/engine.ts), not inlined.
- Adding a new sim scenario fails the build until a mapping row exists.
- Removing a knowledge node cleanly invalidates the row (compile-time error or seed validation error -- not silent dangling).

## Scope

### In

- New constants surface `SIM_SCENARIO_NODE_MAPPINGS` in [libs/constants/src/sim.ts](../../../libs/constants/src/sim.ts) keyed by `SimScenarioId`, value is `readonly { nodeId: string; weight: number }[]`.
- A type-level exhaustiveness check that fails compilation when a new `SimScenarioId` is added without a mapping entry.
- A seed-time validation script that confirms every `nodeId` resolves to a real `knowledge_node.id`.
- Authored entries for all 13 graded scenarios (everything in [SCENARIO_REGISTRY](../../../libs/bc/sim/src/scenarios/registry.ts) except `playground` and `playground_pa28`).
- New BC function `simWeaknessByNode(userId, options?)` in [libs/bc/study/src/](../../../libs/bc/study/src/) that calls `getRecentSimWeakness`, applies the mapping, and returns `Map<nodeId, weight>`.
- Engine integration: `EnginePoolFilters` gains a `simNodePressure: Readonly<Record<string, number>>` field; strengthen-slice scoring consumes it through a new `ENGINE_SCORING.STRENGTHEN.SIM_PRESSURE_FACTOR` weight.
- Two new [SESSION_REASON_CODES](../../../libs/constants/src/study.ts): `STRENGTHEN_SIM_WEAKNESS_CARD`, `STRENGTHEN_SIM_WEAKNESS_REP`.
- Unit tests for the mapping helpers, the BC fn, and the engine scoring change.

### Out

- A DB-resident, hangar-edited mapping table. Mapping is code-resident and reviewed via PR. Rationale in [design.md](design.md).
- UI to author or browse the mapping (deferred until hangar exists).
- Reverse direction (study weakness -> sim queue suggestion). That is a future product surface, not this WP.
- Mappings to question-bank rows or scenario rows. Cards and reps both attach to nodes today ([card.nodeId](../../../libs/bc/study/src/schema.ts), [scenario.nodeId](../../../libs/bc/study/src/schema.ts)); routing through the node is the canonical path.
- Tape-frame-level signals (e.g. "this learner busts altitude on every steep turn"). The signal granularity is the scenario's overall grade total, per [SIM_BIAS](../../../libs/constants/src/sim.ts).

## Data Model

### `SIM_SCENARIO_NODE_MAPPINGS` (constants, code-resident)

| Field        | Type                                       | Notes                                                     |
| ------------ | ------------------------------------------ | --------------------------------------------------------- |
| Key          | `SimScenarioId`                            | One row per graded scenario.                              |
| `nodeId`     | `string` (knowledge_node.id slug)          | Must resolve in DB at seed time.                          |
| `weight`     | `number` in `(0, 1]`                       | Edge weight. Multiplied with `SimWeaknessSignal.weight`.  |

Type defined as `Record<SimScenarioId, readonly SimScenarioNodeLink[]>` so `Object.keys` exhaustiveness fails the build on a new scenario without a mapping.

### `simWeaknessByNode` return shape

`Map<string, number>` -- node id to aggregated weight in `[0, 1]`. Aggregation rule is sum-then-clamp; see [design.md](design.md#weight-propagation).

## Validation

| Rule                                                                                              | Where it runs                  |
| ------------------------------------------------------------------------------------------------- | ------------------------------ |
| Every `SimScenarioId` (except `playground`, `playground_pa28`) has a mapping                      | Compile time (exhaustiveness). |
| Each mapping has >= 1 `SimScenarioNodeLink`                                                       | Unit test in constants.        |
| Each `weight` is in `(0, 1]`                                                                      | Unit test in constants.        |
| Each `nodeId` resolves to a `knowledge_node.id` in DB                                             | Seed validation script.        |
| Sum of per-scenario edge weights need not equal 1 (multi-node coverage is independent emphasis).  | Documented, not enforced.      |

## Edge Cases

- **Scenario flagged weak but its nodes have zero linked cards/reps.** The pressure value still surfaces through the node; the engine scorers naturally have nothing to multiply against, so no lift applied. Counts as "scheduled for the future", not a bug.
- **Same node referenced by multiple weak scenarios.** Aggregate via sum-then-clamp at 1.0 (see design). A learner who is weak on both `efato` and `partial-panel` should see emergency-procedures cards lifted, not lifted twice as much.
- **Scenario removed from the registry.** Mapping entry is removed in the same PR. Compile-time check on `Record<SimScenarioId, ...>` catches accidental orphans.
- **Knowledge node renamed or removed.** Seed validation fails. Author updates the mapping. No silent dangling.
- **Learner has no recent sim attempts.** `getRecentSimWeakness` returns `[]`, `simWeaknessByNode` returns empty map, engine scoring contributes 0 for sim pressure. No-op path is the default.

## Out of Scope (resolved, not deferred)

| Surfaced consideration                              | Resolution                                                                                                                                                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hangar-authored mapping table                       | Drop until hangar exists. Code-resident is correct for today's ~15 scenarios; PR review is the workflow.                                                                                                                                                  |
| Per-component sim signal (altitude vs heading vs stall) | Drop. The grade total is a noisy enough signal at MVP; per-component fan-out is premature. Revisit only if observed lift is too coarse in practice. Tracked as a follow-up trigger: "if the sim signal proves too blunt after >=10 active learners use it." |
| Reverse direction (study weakness -> sim suggestions) | Drop from this WP. Belongs to a future "rehearsal queue" surface; capture as an idea in [IDEAS.md](../../platform/IDEAS.md) by the author of that future product.                                                                                          |
| Tape-frame-level grading feedback                   | Drop. Granularity follows what the sim BC already exposes (per-scenario `gradeTotal`). Going finer requires re-architecting `SIM_BIAS`; not justified here.                                                                                               |
