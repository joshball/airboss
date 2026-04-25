---
title: 'Spec: Flight Dynamics Sim'
product: sim
feature: flight-dynamics-sim
type: spec
status: unread
review_status: pending
---

# Spec: Flight Dynamics Sim

A browser-based, instruments-first flight simulator for short training scenarios. A real flight dynamics model drives a six-pack, engine gauges, and warning annunciators. Scenarios run 30 seconds to 3 minutes: takeoff stalls, EFATOs, vacuum failures, partial panel, unusual attitudes. Replayable, debriefable, schedulable by spaced repetition. Distinctive capability: **instruments can lie**.

## Summary

A **standalone surface** (`apps/sim/`) driven by a **JSBSim WASM** FDM in a Web Worker, rendering a full six-pack + engine gauges in SVG, with a scenario engine that orchestrates scripted events, truth-vs-display recording, a scrubbable debrief, and spaced-rep integration with the study app.

MVP ships **C172 only**, **8-10 scenarios**, **keyboard + mouse** only. Three scenarios already landed in the Phase 0.5/0.6/0.7/0.8 prototype; the rest ship in Phases 4 and 6.

This work package covers Phases 2-7 of the staged plan at [docs/work/plans/20260422-flight-dynamics-sim-plan.md](../../work/plans/20260422-flight-dynamics-sim-plan.md). Phase 0 (feasibility) and Phase 0.5/0.6/0.7/0.8 (prototype) are prior art; see [Prior art](#prior-art) below.

## Problem

Pilots need rehearsable, debriefable, short-format practice for:

- Stall recognition and recovery (takeoff, accelerated, aft-CG).
- Loss of control inflight (LOC-I) -- spatial disorientation, spiral recovery.
- Instrument failures where **the gauges lie** (vacuum, pitot-static, alternator, gyro tumble).
- Weight-and-balance consequences (aft-CG stall behavior).
- Engine failure after takeoff (EFATO) decision-making.
- VMC-into-IMC 180-degree turn discipline.
- Partial-panel scan work.

No tool covers this browser-native. MSFS / X-Plane / FlightGear are immersive sims, not short-scenario trainers. Frasca / Redbird / CPT are expensive hardware. Paper-based "chair flying" has zero feedback. A browser-based Link-Trainer-grade loop is the gap.

## Decisions locked in

| # | Decision                   | Locked                                                                                                                                      |
| - | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Aircraft scope for MVP     | **Cessna 172 only.** PA28 lands in Phase 6. Taildragger / complex / twin are post-MVP.                                                      |
| 2 | MVP scenario set           | **8-10 scenarios** across departure stall, EFATO, vacuum failure, aft-CG slow flight, unusual attitudes (nose-hi + nose-lo), partial panel, VMC-into-IMC, pitot blockage, static blockage. |
| 3 | Control input scope        | **Keyboard + mouse only.** Gamepad + HID yoke deferred post-MVP.                                                                            |
| 4 | Surface                    | **Standalone `apps/sim/`** (already exists). Not a module inside `apps/study/`.                                                             |
| 5 | FDM path                   | **JSBSim WASM port, built in-tree.** Hand-rolled TS FDM is prototype-only; ships as a temporary fallback while the port lands.              |
| 6 | BC layout                  | **`libs/bc/sim/`** mirrors `libs/bc/study/`. Tick-loop substrate eventually moves to `libs/engine/` when FIRC migrates in.                  |
| 7 | Scenario format            | **TypeScript modules** (same shape as existing `libs/bc/sim/src/scenarios/*.ts`) -- not JSON/YAML. Authors write typed scenario defs.        |
| 8 | Supply chain posture       | **No npm deps for simulation logic.** JSBSim WASM built from a pinned upstream submodule + in-tree bindings. Reference ports are reference only. |
| 9 | Replay substrate           | **Ring-buffered input + snapshot tape** written by the worker, consumed by the debrief page. Deterministic replay from `(inputs, seed, initialState)`. |
| 10 | Fault model location       | **`libs/bc/sim/src/faults/`** -- pure `TruthState -> DisplayState` transform layer. FDM knows nothing about faults; faults know nothing about the FDM integrator. |
| 11 | Sound architecture         | **Web Audio AudioContext** on the main thread, driven by `FdmTruthState` snapshots. Engine sound procedural (shipped Phase 0.6); discrete cues sample-based (Phase 5). |
| 12 | Scheduler integration      | **Reuse study's spaced-rep scheduler.** Each scenario attempt emits a `RepAttempt` into `libs/bc/study/` so weak scenarios re-queue through the existing engine. |
| 13 | Instrument rendering       | **SVG in Svelte 5, one component per gauge.** No canvas, no npm gauge lib. Already shipped for the six-pack + tach in Phase 0.5.            |

## Prior art

### Phase 0 -- throwaway feasibility prototype

Hand-rolled TS FDM in a Web Worker, 3 instruments, 1 scenario (departure stall), keyboard-only. Proved the worker-snapshot pattern + SVG instrument pattern. Discarded.

### Phase 0.5 -- expanded prototype (shipped 2026-04-22)

Hand-rolled C172 FDM with lateral axis (roll / yaw / coordinated turn), trim, parking brake, flaps with drag + CL shift, wind, stall warning on AoA. Full six-pack + tach. V-speeds sidebar, WX panel, control-input strip, keybindings help, reset confirm. Stall horn via Web Audio. Three scenarios: **Playground**, **First Flight** (9-step tutorial), **Departure Stall** (scripted trim drift). 38 FDM tests green.

### Phase 0.6 -- cockpit polish (shipped 2026-04-22)

Procedural engine sound (two-osc additive + band-passed noise) tied to RPM, throttle gain, AoA-strain detune, dynamic-pressure wind noise. W/S swapped to stick-forward semantics. Mute/pause state icons. Always-visible keyboard cheatsheet. Cockpit tightened to fit 1280x800. 55 BC tests green (38 FDM + 17 audio mapping).

### Phase 0.7 -- session 2026-04-24 polish (shipped)

PRs #116, #118, #120, #123, #124, #125.

### Phase 0.8 -- spring-centered stick + hold-ramp throttle (shipped)

PR #126. Primary flight controls spring-center when released; throttle uses hold-ramp (press-and-hold ramps toward commanded value).

### Work-in-flight at this spec's authoring

PR #128 merged (Bundle B, study surface). The sim backlog at [docs/products/sim/TASKS.md](../../products/sim/TASKS.md) lists the phases this spec covers.

## Data model

### Worker protocol (main-thread <-> FDM worker)

The existing protocol in [apps/sim/src/lib/worker-protocol.ts](../../../apps/sim/src/lib/worker-protocol.ts) is the baseline. Phase 2 preserves the message shape while swapping the FDM engine inside the worker. No schema change visible to the cockpit.

### Scenario definition -- preserved

The `ScenarioDefinition` TS type in [libs/bc/sim/src/types.ts](../../../libs/bc/sim/src/types.ts) stays. Phase 4 adds the following optional fields without breaking the three shipped scenarios:

| Field           | Type                         | Required | Purpose                                                                             |
| --------------- | ---------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `faults`        | `readonly ScenarioFault[]`   | Optional | Declares failure events (vacuum, pitot, static, alternator, gyro tumble) + triggers |
| `idealPath`     | `IdealPathDefinition`        | Optional | Truth-state trajectory segments for debrief comparison                              |
| `grading`       | `GradingDefinition`          | Optional | Weighted success signals beyond pass/fail (altitude hold, heading hold, stall margin) |
| `repMetadata`   | `RepMetadata`                | Optional | Links scenario to the study rep scheduler (`domain`, `difficulty`, `tags`)          |

New types live at [libs/bc/sim/src/types.ts](../../../libs/bc/sim/src/types.ts) alongside the existing shapes. See [design.md](design.md) for full field-level specs.

### Fault model

```typescript
// libs/bc/sim/src/faults/types.ts
export type FaultKind =
	| 'pitot_block'
	| 'static_block'
	| 'vacuum_failure'
	| 'alternator_failure'
	| 'gyro_tumble';

export interface ScenarioFault {
	kind: FaultKind;
	/** Trigger: time (sec), AGL (m), or explicit script step id. */
	trigger:
		| { kind: 'time_seconds'; at: number }
		| { kind: 'altitude_agl_meters'; above: number }
		| { kind: 'on_step'; stepId: string };
	/** Optional severity/curve parameters per fault kind. */
	params?: FaultParams;
}

export interface FaultParams {
	/** Vacuum: drift rate (deg/sec) applied to AI pitch/roll. */
	vacuumDriftDegPerSec?: number;
	/** Alternator: seconds until bus voltage collapses. */
	alternatorDecaySeconds?: number;
	/** Gyro tumble: whether full tumble cycles continue post-trigger. */
	gyroTumbleContinues?: boolean;
}
```

### Replay tape

```typescript
// libs/bc/sim/src/replay/types.ts
export interface ReplayFrame {
	/** Sim time (seconds since scenario start). */
	t: number;
	/** Full truth-state snapshot (serialisable). */
	truth: FdmTruthState;
	/** Full display-state snapshot (post fault-model). */
	display: DisplayState;
	/** Pilot + scripted inputs as of this tick. */
	inputs: FdmInputs;
	/** Fault activations that fired this tick (empty array when none). */
	faultsTriggered: readonly FaultKind[];
}

export interface ReplayTape {
	scenarioId: SimScenarioId;
	/** Hash of the scenario definition used; replay rejects tape if changed. */
	scenarioHash: string;
	/** RNG seed used (for any future non-determinism; 0 today). */
	seed: number;
	/** Initial state the run started from. */
	initial: ScenarioInitialState;
	/** Frames written at snapshot cadence (~30 Hz). */
	frames: readonly ReplayFrame[];
	/** Final run result (success/failure/timeout/aborted). */
	result: ScenarioRunResult;
}
```

### Rep attempt linkage

Phase 4 wires each scenario outcome into the existing study BC. Minimum surface added:

| Field                 | Type                | Purpose                                                                        |
| --------------------- | ------------------- | ------------------------------------------------------------------------------ |
| `scenarioAttempt.tape` | `ReplayTapeRef`     | Reference to the persisted replay tape (ULID; blob lives in object storage or compressed JSON row) |
| `scenarioAttempt.grade` | `number`            | 0.0 to 1.0, from `GradingDefinition`. Feeds into scheduler re-queue logic.     |
| `scenarioAttempt.domain` | `SimDomain`        | Mirrors `RepMetadata.domain` for weak-area aggregation.                        |

Storage decision deferred to the Phase 4 design pass: compressed JSON column on `sim.scenario_attempt` row vs external blob. Either way the schema change lands behind Drizzle, on the `sim` namespace.

## Behavior

### Phase 2 -- JSBSim WASM FDM

Replace the hand-rolled FDM with JSBSim running in the worker. Observable behavior preserved from the pilot's seat: same V-speeds, same stall break, same trim feel on the C172 -- just higher fidelity. Aft-CG, ground effect, propwash on the rudder, and near-stall handling all become correct rather than approximated.

**Build path:** `tools/jsbsim-port/` with a pinned submodule of upstream JSBSim, an Emscripten toolchain, and an in-tree binding generator. Output: `libs/sim-fdm/jsbsim.wasm` + TS glue. CI builds reproducibly; the WASM blob is checked in with a content hash.

**Worker wrapper** lives in `libs/engine/` (created in Phase 2) with the contract:

```typescript
// libs/engine/src/sim/fdm-worker-host.ts
export interface FdmWorkerHost {
	init(aircraft: SimAircraftId, initial: ScenarioInitialState, wind: ScenarioWind): Promise<void>;
	setInputs(inputs: Partial<FdmInputs>): void;
	advance(nTicks: number): void;
	snapshot(): FdmTruthState;
	dispose(): void;
}
```

The existing `apps/sim/src/lib/fdm-worker.ts` is the caller. Phase 2 swaps the implementation, not the call sites.

### Phase 3 -- Instrument panel + fault model

**Truth-vs-display separation.** The FDM emits `FdmTruthState`. A pure transform `TruthState -> DisplayState` applies active faults. Each instrument reads `DisplayState`; the replay tape records both.

**Fault taxonomy:**

| Fault                | Affects                                  | Behavior                                                                          |
| -------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| Pitot block          | ASI                                      | Reads like a second altimeter above the block altitude; reads zero on descent.    |
| Static block         | ASI + Altimeter + VSI                    | Altimeter frozen; VSI zero; ASI reverses sense (reads high on descent).           |
| Vacuum failure       | AI + HI (directional gyro)               | Slow drift (default 1 deg/sec, configurable). Tumble optional.                    |
| Alternator failure   | All electric (turn coord, radios, electric AI in complex; panel lights) | Battery drains on a configurable timeline. Electric instruments fail in order.    |
| Gyro tumble          | AI + HI (if gyros)                       | AI pitches and rolls to mechanical limits; HI spins.                              |

**Complete panel** (Phase 3 target):

- Six-pack: ASI, AI, Altimeter, Turn Coordinator, HI, VSI. (All six already shipped at Phase 0.5.)
- Engine cluster: Tachometer (shipped), oil pressure, oil temp, fuel L+R, ammeter, vacuum. (Tach shipped; remaining five are Phase 3.)
- Annunciators: gear position + warning, flap motor / position (shipped as control strip; formalise as annunciator), alternator, low voltage, low fuel.

**Accessibility:**

- Keyboard-readable values: each instrument exposes its indicated value + units via `aria-label` + an off-screen live region that updates at 1 Hz.
- Colorblind-safe: warnings use shape + position + text, not color alone.

**Storybook-style gallery:** `apps/sim/src/routes/_dev/instruments/+page.svelte` renders every instrument at every truth state + every fault state for visual regression.

### Phase 4 -- Scenario engine + debrief

**Scenario runner** already exists ([libs/bc/sim/src/scenarios/runner.ts](../../../libs/bc/sim/src/scenarios/runner.ts)). Phase 4 extends it:

1. **Fault triggers.** Runner reads `def.faults`, evaluates each trigger per tick, activates + publishes `faultsTriggered`.
2. **Input capture.** Every input change timestamped in the tape.
3. **Snapshot tape.** Worker writes 30 Hz frames into a ring buffer; on scenario end, the main thread drains the ring, persists the tape, emits a `RepAttempt`.
4. **Debrief page.** New route `apps/sim/src/routes/[scenarioId]/debrief/+page.svelte`:
	- Timeline scrubber (0 to end, keyboard-navigable).
	- Dual display: truth-state panel on the left, what-the-instruments-showed on the right. Scrub keeps them in sync.
	- Input tape below: throttle / elevator / trim / aileron / rudder traces over time.
	- "Compare to ideal" when `def.idealPath` is set: ghosted trajectory overlaid on the timeline.
	- "Run again" button returns to the cockpit at initial conditions.
5. **Rep scheduler.** On run end, call `libs/bc/study/src/reps.createScenarioAttempt(...)` (or equivalent) with the grade. The existing spaced-rep engine picks it up.

**Three seed scenarios** added or promoted:

- Departure stall (shipped; promoted to formal scenario with grading + ideal path).
- EFATO: engine failure after takeoff, from ~400 ft AGL, grades on decision speed + landing-spot commit + airspeed discipline.
- Vacuum failure: AI drifts during cruise; grades on recognition time, transition to T/B scan, and heading-hold accuracy.

### Phase 5 -- Sound (remaining warning cues)

Engine sound shipped in Phase 0.6. Stall horn shipped in Phase 0.5. Phase 5 adds:

| Cue                  | Trigger                                         | Source                |
| -------------------- | ----------------------------------------------- | --------------------- |
| Gear warning         | Gear up + throttle below 12", or gear not down + flaps > 20 | Short sample loop     |
| Flap motor           | Flap detent change                              | Short sample (1.5 sec) |
| Marker beacons       | Approach scenarios crossing OM/MM/IM            | Morse-code samples    |
| Altitude alert       | Alt deviation from selected alt > 200 ft        | Short sample          |
| AP disconnect        | AP master disengaged                            | Short sample          |

All cues share the existing `SIM_STORAGE_KEYS.MUTE` toggle. Each cue has a **visible caption** in the control strip for accessibility.

### Phase 6 -- PA28 + remaining MVP scenarios

**PA28 aircraft config** lives at `libs/bc/sim/src/fdm/pa28.ts` mirroring `c172.ts`. JSBSim already ships an Archer III config; port it through the same binding layer as the C172 config. Differences that matter pedagogically:

- Low-wing vs high-wing visual cue (post-Phase-7 only; irrelevant instrument-only).
- Vs0/Vs1 and stall feel (JSBSim handles correctly).
- One fuel tank selector (C172 is both; PA28 is left/right). Implied by config only; no UX change in MVP.

**Aircraft picker** lands as a dropdown in free-mode only. Scenarios pin their aircraft via `ScenarioDefinition.aircraft`.

**Remaining MVP scenarios:**

| Scenario               | Teaches                                                         |
| ---------------------- | --------------------------------------------------------------- |
| Aft-CG slow flight     | W&B consequences, aft-stick stall behavior                      |
| Unusual attitudes (nose-hi) | Stall-first recovery sequence                              |
| Unusual attitudes (nose-lo) | Spiral-first recovery sequence                              |
| Partial panel          | Scan on T/B + compass + ASI + altimeter; AI/HI failed           |
| VMC-into-IMC           | 180-turn discipline, scan transition from outside to inside     |
| Pitot blockage (climb) | ASI reads high; pitch-and-power backup                          |
| Static blockage (descent) | Altimeter frozen, VSI zero, ASI reversed                     |

Each scenario ships with: `steps` (if tutorial-style) OR `criteria` + `grading`, `faults` (if instrument failure is the trigger), `idealPath`, `repMetadata`. Target 8-10 total MVP scenarios including the three that seed Phase 4.

### Phase 7 -- Horizon + low-res outside view (optional)

A Three.js canvas above the panel shows a flat horizon (sky gradient, ground gradient, runway mesh, sun). Driven by `FdmTruthState.pitch`, `roll`, `heading`, `altitude`. Toggleable per scenario; instrument-only scenarios leave it off.

**One VFR maneuver scenario** ships alongside to prove the visual is load-bearing (steep turns, ground reference turn about a point, or a short pattern).

Performance budget: 60 fps at 1280x800; horizon adds <= 50 MB RAM and no FDM jank. Three.js itself is acceptable as an npm dep because it does not execute simulation logic; pin the version and audit upgrades.

## Validation

| Field / input                            | Rule                                                                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ScenarioDefinition.aircraft`            | Must be a member of `SIM_AIRCRAFT_IDS`. MVP allows `c172` or `pa28`.                                                                    |
| `ScenarioFault.kind`                     | Must be in `FaultKind` enum.                                                                                                            |
| `ScenarioFault.trigger.at` (time)        | Non-negative; less than `criteria.timeoutSeconds` when both present.                                                                    |
| `ScenarioFault.trigger.above` (AGL)      | Non-negative; less than a sane altitude ceiling (e.g., 50,000 ft).                                                                      |
| `ScenarioFault.trigger.stepId` (step)    | Must match an `id` in `def.steps`.                                                                                                      |
| `GradingDefinition` weights              | Must sum to 1.0 (+/- 0.001).                                                                                                            |
| `IdealPathDefinition.segments[].endT`    | Monotonically increasing; each <= `criteria.timeoutSeconds`.                                                                            |
| `ReplayTape.scenarioHash`                | Computed at load. Mismatch = tape rejected with a user-facing "scenario has changed since you flew it" message.                         |
| Worker FDM tick dt                       | `SIM_FDM_DT_SECONDS` (1/120 s). Deviations > 10% flagged in dev console.                                                                |
| Snapshot cadence                         | `SIM_SNAPSHOT_INTERVAL_SECONDS` (1/30 s). Cockpit render loop must not depend on snapshot cadence matching display refresh.             |
| Fault params                             | Per-kind schema: e.g., `vacuumDriftDegPerSec` in [0.1, 10]; `alternatorDecaySeconds` in [10, 600].                                       |
| PA28 aircraft config                     | Static-trim verifies against JSBSim desktop reference within 2% airspeed and 1 degree AoA at 1G straight-and-level at Vno and Vy.       |

## Edge cases

| Case                                                                                  | Behavior                                                                                                                                                |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User tabs away from the cockpit for 2 minutes.                                        | Worker keeps ticking at 120 Hz. Snapshot cadence throttles to 1 Hz (visibility API). Returning un-throttles. Scenario timeout still runs on sim time.    |
| JSBSim WASM instantiation fails (corrupt blob, missing file, OOM).                     | Cockpit renders an error card with "fall back to TS FDM" button. TS FDM stays shipped as emergency fallback. Log to dev console + toast.                |
| Scenario definition changes after a tape was recorded.                                | Debrief rejects the tape ("scenario changed; replay unavailable"). Offer "run again" on the current definition. Old tapes remain in the user's list.    |
| Fault fires during a step the runner hasn't reached.                                  | Fault trigger is independent of step progression; the scenario's author pins faults to triggers they trust. No special handling.                         |
| User presses the reset key mid-scenario.                                              | Existing ResetConfirm flow. On confirm: scenario aborted, tape written as `ABORTED` outcome, rep-attempt not credited.                                  |
| Replay tape exceeds 10 MB.                                                            | Default cap: 3-minute scenarios at 30 Hz + ~2 KB/frame = ~11 MB uncompressed. Compress the frames array (LZ-style JSON) before persist. Cap total at 5 MB post-compression; longer runs drop intermediate frames to keep the tape. |
| Two tabs running the sim at once.                                                     | Each tab owns its own worker; no shared state. Scenario progress local to tab; on rep-attempt emission the last writer wins (acceptable for MVP).       |
| Mobile Safari: user taps in and AudioContext refuses to start.                         | Existing gesture-to-start pattern from Phase 0.5/0.6 handles this. No new work.                                                                         |
| `prefers-reduced-motion`.                                                             | Scrubber animations + instrument needle transitions respect the token-level reduced-motion path. Horizon scene uses `requestAnimationFrame` throttled to 30 fps when reduce-motion set. |
| Emscripten build fails in CI on a developer platform (M-series Mac).                  | Build in Docker; checked-in WASM + hash is the source of truth. Developers do not rebuild WASM locally unless touching the port.                        |
| User attempts scenario before the rep scheduler has a record.                         | First attempt creates the scenario in `scenarios` if missing (idempotent) and writes the first `ScenarioAttempt`. Subsequent runs update the usual path. |
| Fault declared but unreachable (e.g., `altitude_agl_meters: 5000` on a scenario that tops out at 1000 ft). | Validator warning at scenario-registry load time. Scenario still ships; fault simply never fires.                                                     |

## Out of scope

- **Weather model beyond per-scenario wind.** Turbulence, gusts, IMC visual transition, icing are all post-MVP. The wind field stays per-scenario static.
- **Multi-engine / complex / retract / taildragger aircraft.** PA28 is as exotic as MVP gets.
- **MSFS / X-Plane grading bridges.** Separate future product.
- **Multiplayer / async debrief (watch someone else's tape).** Post-MVP.
- **HID yoke, rudder pedals, throttle quadrant.** Post-MVP. Keyboard + mouse carries MVP.
- **Real terrain / moving map / navigation database.** Scenarios carry their own world state.
- **FAA-approved ATD status.** The sim is a training tool, not a logged-time device. No pursuit of FAA approval.
- **Authoring UI for scenarios.** Authors edit TS modules. Hangar surface picks this up later.
- **Post-MVP aircraft configs inside Phase 6 scope.** SR22, J3 Cub, gliders are future.
- **Engine sound upgrade to a procedural WASM synth.** Phase 0.6's two-osc + noise synth is good enough. Antonio-R1-style procedural synth is a post-MVP optimization.

## Open questions

Resolved or explicitly deferred:

| Question                                                                              | Resolution                                                                                                                                          |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenario authoring format                                                             | TS modules. Already shipping. JSON/YAML proposed in the plan but TS gives type safety + IDE support + refactor ease. |
| Standalone `apps/sim/` vs module in `apps/study/`                                     | Standalone. Already shipping at `sim.airboss.test:9600`. Moving into study breaks the multi-host architecture.                                       |
| `libs/engine/` location                                                               | Create it in Phase 2 with the JSBSim worker host. FIRC migration later fills out the rest (scoring, replay), sharing `libs/engine/` with the sim.    |
| Replay tape storage                                                                   | Compressed JSON in a `sim.scenario_attempt.replay_tape` column for MVP. External blob storage when tape sizes force it (post-MVP).                  |
| Grade -> scheduler mapping                                                            | The existing study scheduler takes a 0.0-1.0 correctness signal. Map `grade >= 0.85` -> "Good", `0.60-0.85` -> "Okay", `< 0.60` -> "Again". Exact thresholds in [design.md](design.md). |
| JSBSim licensing (LGPL-2.1)                                                           | Dynamic link via WASM ABI. Keep the WASM blob swappable (no static linking into our TS bundle). Document the license + source in `tools/jsbsim-port/README.md`. |
| Port strategy: binding generator per-header vs hand-written bindings                  | Study `0x62/jsbsim-wasm`'s auto-generator from `FGFDMExec.h` as reference; write ours hand-curated for the narrow surface we need. Narrower is auditable. |

Genuine open questions (flag for user before Phase 2 starts, but not blocking Phase 1 sign-off):

- **Object-storage for tapes vs in-row JSON.** Defer until a tape exceeds 1 MB in practice. In-row is simpler. This is a Phase 4 decision, not Phase 1.
- **Whether `apps/sim/` renames to `apps/firc/` post-migration (per architecture doc) or the sim stays as `apps/sim/` and FIRC ships as a third app.** The architecture doc says the sim becomes FIRC's surface; post-pivot that framing has softened. Revisit after Phase 4 when scenario-engine reuse is obvious. Not blocking MVP.
- **Whether Phase 7 horizon is in-MVP or post-MVP.** Plan says "optional." Recommend shipping it because VMC-into-IMC benefits from the IMC transition being visually dramatic. Revisit after Phase 6 lands.

## References

- Product vision: [docs/vision/products/proficiency/flight-dynamics-sim/PRD.md](../../vision/products/proficiency/flight-dynamics-sim/PRD.md)
- Staged plan: [docs/work/plans/20260422-flight-dynamics-sim-plan.md](../../work/plans/20260422-flight-dynamics-sim-plan.md)
- Research log: [docs/work/todos/20260422-flight-dynamics-sim-research.md](../../work/todos/20260422-flight-dynamics-sim-research.md)
- Orchestration: [docs/work/plans/20260424-sim-orchestration.md](../../work/plans/20260424-sim-orchestration.md)
- Sim backlog: [docs/products/sim/TASKS.md](../../products/sim/TASKS.md)
- Pivot framing: [docs/platform/PIVOT.md](../../platform/PIVOT.md)
- Surface architecture: [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md)
- Design principles: [docs/platform/DESIGN_PRINCIPLES.md](../../platform/DESIGN_PRINCIPLES.md)
- Vocabulary: [docs/platform/VOCABULARY.md](../../platform/VOCABULARY.md)
- ADR 012 (reps substrate): [docs/decisions/012-reps-session-substrate.md](../../decisions/012-reps-session-substrate.md)
- ADR 014 (engine scoring coefficients): [docs/decisions/014-engine-scoring-coefficients.md](../../decisions/014-engine-scoring-coefficients.md)
- Prototype FDM: [libs/bc/sim/src/fdm/](../../../libs/bc/sim/src/fdm/)
- Prototype scenarios: [libs/bc/sim/src/scenarios/](../../../libs/bc/sim/src/scenarios/)
- Cockpit: [apps/sim/src/routes/\[scenarioId\]/+page.svelte](../../../apps/sim/src/routes/[scenarioId]/+page.svelte)
- JSBSim upstream: https://github.com/JSBSim-Team/jsbsim
- JSBSim docs: https://jsbsim-team.github.io/jsbsim/
- 0x62 reference port: https://github.com/0x62/jsbsim-wasm
