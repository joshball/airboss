---
title: Sim PRD
product: sim
type: prd
status: current
date: 2026-04-26
supersedes: ../../.archive/products/sim/PRD.md
---

# Sim PRD

What `apps/sim/` does today and what's queued next. Per-feature spec lives in [docs/work-packages/flight-dynamics-sim/](../../work-packages/flight-dynamics-sim/spec.md), not inline here.

For the why, see [VISION.md](VISION.md). For the FIRC-era PRD, see [.archive/products/sim/PRD.md](../../.archive/products/sim/PRD.md).

## Sim grading feeds the study scheduler

Recent sim weakness lifts the study cards / reps tied to the knowledge each scenario exercises. The signal is `getRecentSimWeakness` (sim BC) -> `simWeaknessByNode` (study BC bridge) -> per-node pressure on the strengthen slice's card / rep scorers, multiplied by `ENGINE_SCORING.STRENGTHEN.SIM_PRESSURE_FACTOR`. Slot rows attributed to that lift carry the `STRENGTHEN_SIM_WEAKNESS_CARD` or `STRENGTHEN_SIM_WEAKNESS_REP` reason code so the runner UI can cite the recent flight as the reason the card is here. See [docs/products/study/STUDY_BC_SIM_BRIDGE.md](../study/STUDY_BC_SIM_BRIDGE.md) for the layered breakdown. Linked work package: [sim-card-mapping](../../work-packages/sim-card-mapping/spec.md).

## Shipped

| Surface                | What it does                                                                                  | Spec                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/`                    | Scenarios index. Lists available scenarios; click to fly.                                    | [flight-dynamics-sim](../../work-packages/flight-dynamics-sim/spec.md)                |
| `/cockpit/[id]`        | Cockpit view. Six-pack + engine gauges + annunciator strip. Keyboard / mouse control.         | [flight-dynamics-sim](../../work-packages/flight-dynamics-sim/spec.md)                |
| `/horizon/[id]`        | Outside-the-cockpit 3D horizon view. Surface-loose-coupled per ADR 015.                       | [ADR 015](../../decisions/015-sim-surface-loose-coupling.md)                          |
| `/dual/[id]`           | Cockpit + horizon side-by-side. Composes both surfaces; spawns its own FDM worker.            | [ADR 015](../../decisions/015-sim-surface-loose-coupling.md)                          |
| `/debrief/[runId]`     | Scrubbable post-run tape. Truth vs display per tick. Ideal-path overlay. Input tape view.     | [flight-dynamics-sim](../../work-packages/flight-dynamics-sim/spec.md)                |
| `/history`             | Per-pilot run history. Click into any prior run's debrief.                                    | --                                                                                    |
| FDM worker             | JSBSim-style hand-rolled FDM running in a Web Worker. Truth state computed every tick.         | [flight-dynamics-sim](../../work-packages/flight-dynamics-sim/spec.md)                |
| Aircraft profiles      | C172 (canonical), PA-28 (second profile).                                                     | [flight-dynamics-sim](../../work-packages/flight-dynamics-sim/spec.md)                |
| Scenario library       | Departure stall, EFATO, vacuum, pitot/static, partial panel, unusual attitudes, aft-CG, nose-low, VMC-into-IMC. | [flight-dynamics-sim](../../work-packages/flight-dynamics-sim/spec.md) |
| Sim grading evaluator  | Tick-by-tick scoring against ideal path. Outputs run weaknesses keyed to knowledge nodes.     | [flight-dynamics-sim](../../work-packages/flight-dynamics-sim/spec.md)                |
| Study scheduler bridge | Sim weakness pressure on study card / rep scorers per node.                                  | [sim-card-mapping](../../work-packages/sim-card-mapping/spec.md)                      |
| Engine sound + theme   | Harmonic stack engine audio; theme tokens for cockpit, horizon, debrief surfaces.            | --                                                                                    |

## In flight or imminent

| Item                                                                  | State              | Notes                                                                                                                    |
| --------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Cockpit panel extraction (`CockpitPanel.svelte`)                      | Queued             | Per ADR 015 follow-up. Lets the dual page render the full panel, not just four primary gauges.                            |
| Phase 7 horizon view continuation                                     | In flight          | 3D horizon visual fidelity, instrument-strip overlay tuning.                                                              |
| Additional aircraft profiles                                          | Backlog            | Cherokee variants, complex/HP, glass.                                                                                     |
| More scenarios                                                        | Backlog            | Crosswind landing, gust front, microburst, mountain wave, ridge soaring, ditching.                                       |
| Anti-cheating / engagement integrity                                  | Out of scope (v1)  | The FIRC-era PRD specified extensive anti-cheating (engagement timing, rate limits, evidence hash, AFK flag, honeypots). Not load-bearing for a no-FAA-credit pilot performance platform. Revisit only if a FIRC pack ships. |

## Out of scope (intentionally)

- **3D scenery / world rendering.** Sim is instruments-first. The horizon view is minimal by design. If a scenario needs immersive VFR cues, MSFS/X-Plane is the right tool.
- **AI traffic / ATC.** Single-pilot scenarios only, today.
- **Multiplayer.** Out of scope until v1 ships.
- **FAA log credit.** Sim runs aren't FAA-recognized training time. They feed proficiency, not currency.

## References

- [VISION.md](VISION.md)
- [ROADMAP.md](ROADMAP.md)
- [docs/work-packages/flight-dynamics-sim/spec.md](../../work-packages/flight-dynamics-sim/spec.md) -- canonical spec
- [docs/work-packages/sim-card-mapping/spec.md](../../work-packages/sim-card-mapping/spec.md) -- study scheduler bridge
- [ADR 015](../../decisions/015-sim-surface-loose-coupling.md) -- sim surface loose coupling
- [docs/work/plans/20260422-flight-dynamics-sim-plan.md](../../work/plans/20260422-flight-dynamics-sim-plan.md) -- staged plan
