---
title: 'Tasks: Flight Dynamics Sim'
product: sim
feature: flight-dynamics-sim
type: tasks
status: unread
review_status: pending
---

# Tasks: Flight Dynamics Sim

Decomposed work for the flight sim MVP. Companion to [spec.md](spec.md), [design.md](design.md), [user-stories.md](user-stories.md), [test-plan.md](test-plan.md).

Tasks are grouped by phase from the staged plan. Each task lists its sequencing constraint (parallel-safe vs depends-on) and the smallest credible PR it can land as. Per the orchestration plan ([docs/work/plans/20260424-sim-orchestration.md](../../work/plans/20260424-sim-orchestration.md)), the goal is small reviewable PRs that compose, not one giant PR per phase.

## Conventions

- **Status** values: `done` (shipped), `in-flight` (active worktree), `next` (cleared to start), `blocked` (waiting on a sequencing dependency).
- **Track** identifies the sprint in the orchestration plan (e.g., `B1`, `B2`).
- **Parallel** means the task can run alongside others in the same row; **serial** means it must finish before the next row starts.

## Phase 1 -- Work package (this PR)

| # | Task | Status | PR shape |
| - | ---- | ------ | -------- |
| 1.1 | Spec, design, user-stories, tasks, test-plan authored | in-flight | This PR |
| 1.2 | User sign-off | next | User responsibility |

## Phase 2 -- JSBSim WASM FDM (Track B2)

Sequential, single worktree. ~2-5 days per the plan; could be longer.

| # | Task | Sequencing | PR shape |
| - | ---- | ---------- | -------- |
| 2.1 | `tools/jsbsim-port/` scaffold: pinned upstream submodule, Emscripten Dockerfile, `build.sh` reproducing in CI | first | Solo PR |
| 2.2 | Hand-curated bindings for the narrow FGFDMExec surface we use (init, set state, advance, get state, dispose) | after 2.1 | Solo PR |
| 2.3 | `libs/sim-fdm/` package: WASM blob + content-hash + TS glue exporting `FdmWorkerHost` | after 2.2 | Solo PR |
| 2.4 | C172 JSBSim config wired through the binding layer; trim test against desktop reference | after 2.3 | Solo PR |
| 2.5 | Worker host in `libs/engine/src/sim/`: replaces the hand-rolled engine inside `apps/sim/src/lib/fdm-worker.ts` | after 2.4 | Solo PR (large; gates downstream) |
| 2.6 | Determinism test: same `(inputs, seed, initial)` -> identical trajectory across two runs and across page reloads | after 2.5 | Same PR as 2.5 OR follow-up |
| 2.7 | TS-FDM emergency fallback: keep the prototype FDM in tree, wire a "fall back to TS FDM" button when WASM init fails | after 2.5 | Same PR |

**Exit:** C172 1G straight-and-level trim within 2% airspeed and 1 deg AoA at Vno and Vy. Determinism test green. Cockpit unchanged from pilot's seat.

## Phase 3 -- Instrument panel + fault model

Track B1 (interface) sequential before B5.x (per-instrument fan-out).

### B1 -- Fault model interface (single PR, blocks fan-out)

| # | Task | PR shape |
| - | ---- | -------- |
| 3.1 | `libs/bc/sim/src/faults/types.ts`: `FaultKind`, `ScenarioFault`, `FaultParams`, `DisplayState`, `FaultActivation` | One PR with 3.1-3.4 |
| 3.2 | `libs/bc/sim/src/faults/transform.ts`: pure `applyFaults(truth, activations) -> display` with per-fault unit tests | Same PR |
| 3.3 | `libs/bc/sim/src/faults/index.ts` exports + `libs/bc/sim/src/index.ts` re-export | Same PR |
| 3.4 | `apps/sim/src/routes/_dev/instruments/+page.svelte`: storybook gallery scaffold (no instrument-specific fault rendering yet, just the rig) | Same PR |

### B5 fan-out -- per-instrument fault rendering (parallel, one PR each)

After B1 lands, six tracks run in parallel. Each PR adds the fault-aware rendering for one instrument plus its gallery entry.

| # | Task | Track | PR shape |
| - | ---- | ----- | -------- |
| 3.5 | ASI: pitot block + static block rendering | B5.asi | One PR |
| 3.6 | AI: vacuum drift + gyro tumble | B5.ai | One PR |
| 3.7 | Altimeter: static block (frozen) | B5.alt | One PR |
| 3.8 | HI: vacuum drift + gyro tumble + alternator (electric variant; gracefully degrade for vacuum-driven HI) | B5.hi | One PR |
| 3.9 | Turn coordinator: alternator failure (electric instrument) | B5.tc | One PR |
| 3.10 | VSI: static block (zero) | B5.vsi | One PR |

### Engine cluster + annunciators (single PR after B5.\*)

| # | Task | PR shape |
| - | ---- | -------- |
| 3.11 | Oil pressure, oil temp, fuel L+R, ammeter, vacuum gauges as Svelte SVG | One PR |
| 3.12 | Annunciator strip: gear, flap motor, alternator, low voltage, low fuel | Same PR |
| 3.13 | a11y: per-instrument `aria-label` + 1 Hz off-screen live region narration | Same PR (or split if reviews are large) |
| 3.14 | Storybook gallery extended to cover every gauge + every fault state | Same PR |

**Exit:** Every fault from the spec table renders correctly on every affected instrument. Gallery page screenshots green.

## Phase 4 -- Scenario engine + debrief (Track B3, then D1)

### B3 -- Scenario format extensions + replay tape (parallel with B2)

| # | Task | PR shape |
| - | ---- | -------- |
| 4.1 | Extend `ScenarioDefinition` with `faults`, `idealPath`, `grading`, `repMetadata` fields. Migrate three shipped scenarios to the optional fields (no-op for them, but exercises the typing) | One PR |
| 4.2 | `libs/bc/sim/src/replay/`: `ReplayFrame`, `ReplayTape`, scenario-hash function, ring-buffer writer, `serializeTape` / `deserializeTape` round-trip | One PR |
| 4.3 | Scenario runner reads `def.faults`, evaluates triggers per tick, fires activations, emits `faultsTriggered[]` per tick | One PR |
| 4.4 | Worker writes 30 Hz frames into the ring; on outcome, drains + posts `TAPE` message; main thread persists tape | One PR |

### D1 -- Debrief route + scrub replay (after B3 + B5.\*)

| # | Task | PR shape |
| - | ---- | -------- |
| 4.5 | `/[scenarioId]/debrief/+page.svelte`: timeline scrubber, keyboard navigable, frame scrubber driving truth + display panels | One PR |
| 4.6 | Trajectory traces (alt, IAS, alpha, pitch, roll, throttle) over time | Same PR |
| 4.7 | Truth panel + display panel rendered side by side, synchronized | Same PR |
| 4.8 | "Compare to ideal" overlay when `def.idealPath` set | One PR |
| 4.9 | Run Again button returning to cockpit at initial conditions | Same PR as 4.5 |

### Three Phase 4 seed scenarios

| # | Task | PR shape |
| - | ---- | -------- |
| 4.10 | Departure stall promoted to formal scenario (idealPath, grading, repMetadata) | One PR |
| 4.11 | EFATO scenario (engine failure ~400 ft AGL, decision-and-commit grading) | One PR |
| 4.12 | Vacuum-failure scenario (cruise, AI drifts, recognition + scan-transition grading) | One PR |

### Spaced-rep wiring

| # | Task | PR shape |
| - | ---- | -------- |
| 4.13 | `libs/bc/study/src/reps.ts` extended with `createScenarioAttempt` accepting `(scenarioId, grade, tapeRef, domain)` | One PR |
| 4.14 | Drizzle migration: `sim.scenario_attempt` table + reps linkage | Same PR |
| 4.15 | Sim home page surfaces "Suggested next" pulled from the reps engine | One PR |

**Exit:** Three seed scenarios runnable end-to-end with debrief, scrub replay, and re-queue. Tape persists. Replay rejects tapes whose `scenarioHash` no longer matches the current definition.

## Phase 5 -- Sound (Track A1)

Already shipped in PR #136. The remaining items are sample assets (currently procedural/synth-generated) and follow-up wiring.

| # | Task | Status | Notes |
| - | ---- | ------ | ----- |
| 5.1 | Gear warning, flap motor, marker beacons, altitude alert, AP disconnect | done | PR #136 |
| 5.2 | Visible captions panel | done | PR #136 |
| 5.3 | Wire altitude-alert `setTarget` from Phase 4 scenario authoring | next | After Phase 4.1 |
| 5.4 | Wire marker-beacon trigger from Phase 4 navaid model | next | After Phase 4 navaid lands; navaid model is a Phase 4 stretch goal |
| 5.5 | Wire AP-disconnect trigger from a future autopilot model | post-MVP | No AP in MVP |

## Phase 6 -- PA28 + remaining MVP scenarios (Tracks C1, C2)

### C1 -- PA28 config (after Phase 2)

| # | Task | PR shape |
| - | ---- | -------- |
| 6.1 | `libs/bc/sim/src/fdm/pa28.ts` mirroring `c172.ts` shape; JSBSim Archer-III config wired through the binding layer | One PR |
| 6.2 | Aircraft picker dropdown in free mode; scenarios pin via `ScenarioDefinition.aircraft` | One PR |
| 6.3 | Trim test: PA28 1G straight-and-level matches JSBSim desktop reference within 2% airspeed and 1 deg AoA at Vy and Vno | Same PR as 6.1 |

### C2 -- Remaining MVP scenarios (parallel after C1, B5.\*, B3)

Each ships as its own PR.

| # | Task | Track |
| - | ---- | ----- |
| 6.4 | Aft-CG slow flight | C2.aftcg |
| 6.5 | Unusual attitudes (nose-hi) | C2.uahi |
| 6.6 | Unusual attitudes (nose-lo) | C2.ualo |
| 6.7 | Partial panel | C2.pp |
| 6.8 | VMC-into-IMC | C2.vmcimc |
| 6.9 | Pitot blockage (climb) | C2.pitot |
| 6.10 | Static blockage (descent) | C2.static |

**Exit:** 8-10 scenarios shipped (3 from Phase 4 + up to 7 from Phase 6). Both aircraft selectable in free mode.

## Phase 7 -- Horizon + low-res outside view (Track B4, optional)

Independent of every other track. Can run in parallel with anything after Phase 1 sign-off, though the visual benefit is largest after Phase 6 lands the VMC-into-IMC scenario.

| # | Task | PR shape |
| - | ---- | -------- |
| 7.1 | Three.js scene above the panel: sky gradient, ground plane, sun directional light | One PR |
| 7.2 | Runway mesh + simple terrain quilt within 5 NM | Same PR |
| 7.3 | Driven by `FdmTruthState.pitch / roll / heading / altitude` at 60 fps | Same PR |
| 7.4 | Per-scenario toggle (`def.horizon: 'on' | 'off'`); off by default for instrument-only | Same PR |
| 7.5 | One VFR maneuver scenario that needs the horizon (steep turns or ground reference) | Separate PR |
| 7.6 | Performance budget: 60 fps at 1280x800; reduced-motion path drops to 30 fps and disables parallax | Same PR as 7.1 |

**Exit:** Horizon shippable. At least one VFR scenario uses it. Performance budget held.

## Standing polish backlog (interleaved across phases)

These are small items found by user-zero flying. They land between phases as found, not in a single PR.

| # | Task | Source |
| - | ---- | ------ |
| P.1 | Engine cluster gauges next to the tach (oil pressure, oil temp, fuel L+R, ammeter, vacuum) | Folded into Phase 3.11 |
| P.2 | OAT + density altitude readouts | After non-ISA weather model (post-MVP weather work) |
| P.3 | Configurable keybindings UI | Deferred from Phase 0.6; revisit after Phase 4 |
| P.4 | InfoTip / PageHelp on the cockpit route | Use the help system after Phase 4 |
| P.5 | Engine cluster a11y narration | Folded into Phase 3.13 |

## Sequencing summary

```text
Phase 1 (sign-off)
  |
  +-- A1 [Phase 5 cues + captions]                    DONE  (PR #136)
  +-- A2 [Phase 1 work package]                        IN-FLIGHT  (this PR)
  |
  v (after sign-off)
  +-- B1 [Phase 3 fault interface + gallery rig]       NEXT
  +-- B2 [Phase 2 JSBSim port]                         NEXT (sequential)
  +-- B3 [Phase 4 scenario format + replay tape]       NEXT (parallel with B2)
  +-- B4 [Phase 7 horizon]                             NEXT (parallel with B2/B3)
  |
  v (after B1)
  +-- B5.{asi, ai, alt, hi, tc, vsi} -- six parallel PRs
  |
  v (after B2 + B3 + B5.*)
  +-- C1 [Phase 6 PA28 config]                         NEXT
  +-- C2.{aftcg, uahi, ualo, pp, vmcimc, pitot, static} -- seven parallel PRs
  +-- D1 [Phase 4 debrief route]                       NEXT
  |
  v (after D1 + C2.*)
  +-- D2 [standing polish] -- ongoing, ships interleaved
```

## Effort and risk

| Phase | Tasks | Risk |
| ----- | ----- | ---- |
| 2 | 7 | High -- Emscripten + binding work; JSBSim-on-WASM is the load-bearing port |
| 3 | 14 | Medium -- six parallel instrument PRs; fault model interface must be right first |
| 4 | 15 | Medium-high -- replay tape persistence + study integration spans two BCs |
| 5 | 5 | Low -- mostly already shipped; remaining wiring follows Phase 4 |
| 6 | 10 | Medium -- second aircraft validates the binding layer; scenarios are content work |
| 7 | 6 | Low -- Three.js is well-trodden; perf budget is the only real risk |

Total: ~57 tasks across 6 phases. Many parallel; expect 25-35 PRs total to MVP.

## How to start

When Phase 1 signs off, the orchestrator [docs/work/plans/20260424-sim-orchestration.md](../../work/plans/20260424-sim-orchestration.md) spawns Sprint B child worktrees. The first three to kick off are B1 (interface), B2 (JSBSim port), B3 (scenario format) -- all independent. The user can choose to insert B4 (horizon) for visual milestones, or hold it until Phase 6.

Each child worktree owns its branch end-to-end: build, test, biome, push, PR, squash-merge, delete. Orchestrator pulls main between merges. Standing polish PRs interleave on the orchestrator's own branch as they surface.
