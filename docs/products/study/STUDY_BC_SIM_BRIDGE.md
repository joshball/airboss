# Study BC -- sim weakness bridge

How recent sim performance pressures the spaced-rep scheduler, end to end. See work package: [sim-card-mapping](../../work-packages/sim-card-mapping/spec.md).

## Layers

| Layer                                | What it owns                                                                                | File                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Sim BC persistence                   | `getRecentSimWeakness(userId)` -- per-scenario weakness signal from `sim_attempt` history   | [libs/bc/sim/src/persistence.ts](../../../libs/bc/sim/src/persistence.ts)     |
| Constants -- authored mapping        | `SIM_SCENARIO_NODE_MAPPINGS`: scenarioId -> array of `{ nodeId, weight in (0, 1] }`         | [libs/constants/src/sim.ts](../../../libs/constants/src/sim.ts)               |
| Study BC bridge                      | `simWeaknessByNode` (DB-aware) + `aggregateSimNodePressure` (pure helper)                   | [libs/bc/study/src/sim-bias.ts](../../../libs/bc/study/src/sim-bias.ts)       |
| Study engine -- pool filters         | `EnginePoolFilters.simNodePressure: Readonly<Record<string, number>>`                       | [libs/bc/study/src/engine.ts](../../../libs/bc/study/src/engine.ts)           |
| Study engine -- strengthen scoring   | Adds `pressure * ENGINE_SCORING.STRENGTHEN.SIM_PRESSURE_FACTOR` to the candidate score      | [libs/bc/study/src/engine.ts](../../../libs/bc/study/src/engine.ts)           |
| Study engine -- reason resolver      | Attributes `STRENGTHEN_SIM_WEAKNESS_CARD/REP` when sim pressure is the dominant contributor | [libs/bc/study/src/engine.ts](../../../libs/bc/study/src/engine.ts)           |
| Study sessions orchestrator          | `previewSession` calls `simWeaknessByNode` and stuffs the result into `EnginePoolFilters`   | [libs/bc/study/src/sessions.ts](../../../libs/bc/study/src/sessions.ts)       |
| Seed-time validator                  | Fails the build when any `nodeId` in `SIM_SCENARIO_NODE_MAPPINGS` does not resolve          | [scripts/build-knowledge-index.ts](../../../scripts/build-knowledge-index.ts) |

## Flow

```text
                 sim_attempt rows                  knowledge_node rows
                       |                                   |
                       v                                   v
        getRecentSimWeakness(userId)         SIM_SCENARIO_NODE_MAPPINGS
        -> SimWeaknessSignal[]               (typed Record, code-resident)
                       |                                   |
                       +-----------+---------------------+
                                   v
                aggregateSimNodePressure(signals, mappings)
                -> Map<nodeId, pressure in [0, 1]>
                                   |
                                   v
                simWeaknessByNode(userId) -- Map<nodeId, pressure>
                                   |
                                   v
                EnginePoolFilters.simNodePressure (Record<nodeId, pressure>)
                                   |
                                   v
                runEngine -- strengthen-slice card / rep scoring
                + reason: STRENGTHEN_SIM_WEAKNESS_CARD / REP
```

## Aggregation rule

`pressure(node) = clamp01(Sum_{(scenario, node) in mapping} signal(scenario).weight * mapping[scenario][node].weight)`

- Linear, transparent, order-independent.
- Sum-then-clamp lets multiple weak parents share the lift on a node, never above 1.0.
- One ENGINE_SCORING dial controls the magnitude; tuning routes through `SIM_PRESSURE_FACTOR`.

## Reason-code attribution rule

A strengthen-slice slot is attributed to `STRENGTHEN_SIM_WEAKNESS_CARD` (or `_REP`) when the sim-pressure contribution is the largest individual contributor among `relearning`, `ratedAgain`, `ratedHard`, `heavilyOverdue`, `repLowAccuracy`, and `repRecentMiss`. On a tie, sim wins -- the user's recent flight is the freshest evidence.

## When this isn't ADR-shaped

The bridge is internal: one cross-BC call site, one engine field, one scoring dial. It composes with the existing knowledge-graph learning system (ADR 011), the engine scoring coefficients (ADR 014), and the sim surface's loose coupling rule (ADR 015). The work package owns the decisions; the ADRs constrain them.
