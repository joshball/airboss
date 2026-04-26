---
title: 'Tasks: Sim-Scenario / Study-Card Mapping'
product: study
feature: sim-card-mapping
type: tasks
status: unread
---

# Tasks: Sim-Scenario / Study-Card Mapping

Depends on:

- [Spaced Memory Items](../spaced-memory-items/spec.md) and [Decision Reps](../decision-reps/spec.md) for the BC + schema baseline.
- [Knowledge Graph](../knowledge-graph/spec.md) for `knowledge_node` rows and the `card.nodeId` / `scenario.nodeId` columns.
- `getRecentSimWeakness` in [libs/bc/sim/src/persistence.ts](../../../libs/bc/sim/src/persistence.ts) (already in main).

## Pre-flight

- [ ] Re-read [spec.md](spec.md) and [design.md](design.md). Confirm the authored mapping table covers every gradable `SimScenarioId` (13 of 15).
- [ ] Confirm the seven non-existing knowledge-node slugs in the table (e.g. `nav-localiser-and-glide-slope-tracking`, `aero-load-factor-and-bank-angle`) either already exist in the seeded graph or have an authored `OVERVIEW.md` ready for this PR's seed run. Where a node does not yet exist, decide per node: author it in this PR, or substitute the closest existing slug. No mapping ships pointing at a missing node.

## Phase 1: Schema-free constant + types

- [ ] Add `SimScenarioNodeLink` and `SIM_SCENARIO_NODE_MAPPINGS` to [libs/constants/src/sim.ts](../../../libs/constants/src/sim.ts) with `Record<Exclude<SimScenarioId, 'playground' | 'playground-pa28'>, readonly SimScenarioNodeLink[]>` typing.
- [ ] Author the 13 mapping rows from [design.md](design.md#authored-mapping).
- [ ] Add `SIM_PRESSURE_FACTOR` to `ENGINE_SCORING.STRENGTHEN` in [libs/constants/src/engine.ts](../../../libs/constants/src/engine.ts). Initial value: `0.5` (mid-range with `RATED_AGAIN: 0.6`, `REP_LOW_ACCURACY: 0.6`).
- [ ] Add `STRENGTHEN_SIM_WEAKNESS_CARD` and `STRENGTHEN_SIM_WEAKNESS_REP` to `SESSION_REASON_CODES`, with labels and slice mapping, in [libs/constants/src/study.ts](../../../libs/constants/src/study.ts).
- [ ] Re-export new constants from [libs/constants/src/index.ts](../../../libs/constants/src/index.ts) (already wildcards but verify).
- [ ] `bun run check` -- 0 errors.

## Phase 2: Constant-level unit tests

- [ ] Add `libs/constants/src/sim.test.ts` (or extend if it exists). Cases:
  - Every key in `SIM_SCENARIO_NODE_MAPPINGS` matches a current `SimScenarioId` (sanity vs typo).
  - Every value array is non-empty.
  - Every `weight` is in `(0, 1]`.
  - Every `nodeId` is a kebab-case slug (`/^[a-z0-9]+(-[a-z0-9]+)*$/`).
- [ ] `bun test libs/constants` -- pass.

## Phase 3: BC bridge -- `simWeaknessByNode`

- [ ] Create `libs/bc/study/src/sim-bias.ts` with:
  - `simWeaknessByNode(userId, options?, db?)` calls [getRecentSimWeakness](../../../libs/bc/sim/src/persistence.ts), iterates the mapping, builds `Map<string, number>` with sum-then-clamp to `[0, 1]`.
  - Pure aggregation helper `aggregateSimNodePressure(signals, mappings)` so unit tests do not need the DB.
- [ ] Export both from [libs/bc/study/src/index.ts](../../../libs/bc/study/src/index.ts).
- [ ] Add `libs/bc/study/src/sim-bias.test.ts`. Cases:
  - Empty signals -> empty map.
  - One weak scenario -> all mapped nodes at `signal.weight * edge.weight`.
  - Two weak scenarios sharing a node -> sum, clamped at 1.0.
  - Scenarios with no mapping (shouldn't happen but guard) -> ignored, no throw.
- [ ] `bun test libs/bc/study` -- pass.

## Phase 4: Seed-time validation

- [ ] Extend the dev-seed pipeline (likely `scripts/seed/` or wherever the knowledge-graph seed runs) with a check that every `nodeId` referenced by `SIM_SCENARIO_NODE_MAPPINGS` resolves to an existing `knowledge_node` row. Fail loudly with the offending `(scenarioId, nodeId)` pairs.
- [ ] Smoke-test the validator against a fresh `bun run db:reset && bun run db:seed`.

## Phase 5: Engine integration

- [ ] Extend `EnginePoolFilters` in [libs/bc/study/src/engine.ts](../../../libs/bc/study/src/engine.ts) with `simNodePressure: Readonly<Record<string, number>>`.
- [ ] Update `scoreStrengthenCard` and `scoreStrengthenRep` to add `(simNodePressure[candidate.nodeId ?? ''] ?? 0) * ENGINE_SCORING.STRENGTHEN.SIM_PRESSURE_FACTOR` to the base score. The `?? ''` guard returns 0 for cards with no `nodeId`; never throws.
- [ ] Update `strengthenCardReason` and `strengthenRepReason` so a non-zero sim pressure attributes the reason as `STRENGTHEN_SIM_WEAKNESS_CARD` / `STRENGTHEN_SIM_WEAKNESS_REP` (priority over `RATED_AGAIN` only when sim pressure is the dominant scoring contributor; tie-broken by which contributor pushed the score over the placement threshold).
- [ ] Wire pool builders in [libs/bc/study/src/sessions.ts](../../../libs/bc/study/src/sessions.ts) (or wherever `EnginePoolFilters` is constructed) to call `simWeaknessByNode(userId)` and populate `simNodePressure`. Default to `{}` when the call returns empty.
- [ ] Existing engine tests must keep passing -- verify by passing `simNodePressure: {}` in fixtures.
- [ ] New engine test cases:
  - Card with `nodeId: 'X'`, `simNodePressure['X'] = 0.8`, all other strengthen factors zero -> selected ahead of an otherwise-identical card with `nodeId: 'Y'`, `simNodePressure['Y'] = 0`.
  - Sim-pressure-driven selection populates the new reason code.
  - Card with `nodeId: null` is unaffected by `simNodePressure`.

## Phase 6: Docs + product touchpoints

- [ ] Add a "Sim weakness propagation" section to [libs/bc/study/src/](../../../libs/bc/study/src/) module README (if one exists) or create a `STUDY_BC_SIM_BRIDGE.md` under `docs/products/study/` that points back here.
- [ ] Update [docs/products/study/PRD.md](../../products/study/PRD.md) with one paragraph linking this work package under "Spaced rep adapts to recent sim performance".
- [ ] Update [docs/products/sim/PRD.md](../../products/sim/PRD.md) noting that grading now feeds study; one-line link to this WP.
- [ ] Update [docs/work/NOW.md](../../work/NOW.md) when the WP is in flight.

## Phase 7: Review + ship

- [ ] Manual test plan walk-through (see [test-plan.md](test-plan.md)).
- [ ] `/ball-review-full` against the branch.
- [ ] Address every finding (critical, major, minor, nit). Re-run `bun run check` and the tests after fixes.
- [ ] Commit, push, open PR.

## Out-of-scope (captured for later, do not start)

- Hangar UI to author the mapping. Trigger: hangar app exists and there is a desire to let CFIs edit links without a code change. At that trigger: migrate the constant to `study.sim_scenario_node_link`, port the seed script to populate from the table, retire the constant.
- Per-component (altitude / heading / stall) sim signal. Trigger: >=10 active learners report that scenario-level lift is too coarse. At that trigger: split `SimWeaknessSignal` into per-component, extend the mapping with optional component qualifiers.
- Reverse direction (study weakness -> sim queue). New product surface; out of this WP.
