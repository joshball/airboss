# Study PRD

Product requirements for the `apps/study` surface. The detailed feature specs live in [docs/work-packages/](../../work-packages/); this PRD is the index that says what the product is and links the work that delivered each piece.

## Spaced rep adapts to recent sim performance

When a learner has been grading low on a sim scenario, the study scheduler lifts the cards and reps tied to the knowledge nodes that scenario exercises. The signal is `getRecentSimWeakness` (sim BC) -> `simWeaknessByNode` (study BC bridge) -> per-node pressure on the strengthen slice's card / rep scorers, multiplied by `ENGINE_SCORING.STRENGTHEN.SIM_PRESSURE_FACTOR`. Slot rows attributed to that lift carry the `STRENGTHEN_SIM_WEAKNESS_CARD` or `STRENGTHEN_SIM_WEAKNESS_REP` reason code so the runner UI can cite the recent flight as the reason the card is here.

Authored sim-scenario -> knowledge-node mapping lives in [`SIM_SCENARIO_NODE_MAPPINGS`](../../../libs/constants/src/sim.ts). See work package: [sim-card-mapping](../../work-packages/sim-card-mapping/spec.md).

## Links

- [Study BC sim bridge](STUDY_BC_SIM_BRIDGE.md) -- how the cross-BC bridge is wired
- [Roadmap](ROADMAP.md) -- deferred + upcoming work
- [ADR 011 -- Knowledge Graph Learning System](../../decisions/011-knowledge-graph-learning-system/decision.md)
- [ADR 014 -- Engine Scoring Coefficients](../../decisions/014-engine-scoring-coefficients.md)
- [ADR 015 -- Sim Surface Loose Coupling](../../decisions/015-sim-surface-loose-coupling.md)
