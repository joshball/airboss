---
title: 'Design: Flight Dynamics Sim'
product: sim
feature: flight-dynamics-sim
type: design
status: unread
review_status: pending
---

# Design: Flight Dynamics Sim

Architecture for the flight-dynamics sim MVP. Builds on the shipped Phase 0.5/0.6/0.7/0.8 prototype; replaces the hand-rolled FDM with JSBSim WASM; adds fault model, scenario engine, debrief, rep integration, remaining warning cues, PA28, and an optional horizon view.

## System map

```text
(apps/sim, sim.airboss.test:9600)
  Main thread
    +-- Cockpit route ([scenarioId]/+page.svelte)
    |     UI: instruments, control strip, cheatsheet, scenario banner
    |     Consumes: snapshot stream
    |     Produces: input events -> worker
    +-- Debrief route ([scenarioId]/debrief/+page.svelte)     (Phase 4, new)
    |     UI: scrubber, truth-vs-display panels, input tape, ideal-path overlay
    |     Consumes: ReplayTape
    +-- Sound (Web Audio)
    |     Engine synth (shipped), stall horn (shipped),
    |     warning cues (Phase 5, new)
    +-- FDM worker (apps/sim/src/lib/fdm-worker.ts)
          Replaced Phase 2: now wraps JSBSim WASM via libs/engine/
          Ticks 120 Hz, snapshots 30 Hz, writes replay frames

libs/
  bc/sim/
    fdm/      C172 + PA28 configs (aerodynamic coefficients, mass, engine)
    faults/   (Phase 3, new) TruthState -> DisplayState transform
    scenarios/ scenario defs, runner (existing; extended Phase 4)
    replay/   (Phase 4, new) tape schema + persist helpers
    types.ts  (extended each phase)
  engine/    (NEW -- created Phase 2)
    sim/      fdm-worker-host, tick orchestrator
              [Seeds what FIRC migration will later share]
  sim-fdm/   (NEW -- Phase 2)
    jsbsim.wasm   checked-in WASM blob with hash
    glue.ts        TS bindings to JSBSim C API
  bc/study/  existing; extended Phase 4 to accept ScenarioAttempt from sim

tools/
  jsbsim-port/  (NEW -- Phase 2)
    submodule/   pinned upstream JSBSim commit
    bindings/    our hand-curated glue-code generator
    CMakeLists.txt + Emscripten config
    build.sh     reproducible in CI
    README.md    license + regeneration instructions
```

## Key decision 1: FDM in WASM, built in-tree

Three options considered:

| Option                                        | Pro                                                    | Con                                                                         |
| --------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| A) Depend on `0x62/jsbsim-wasm` npm package   | Zero build effort                                      | Supply chain: 2-star single-author repo executes sim logic. Unauditable.    |
| B) Port JSBSim ourselves in `tools/jsbsim-port/` | Every line auditable; pinned upstream commit             | 2-5 days of Emscripten work; binding layer we own                           |
| C) Keep the hand-rolled TS FDM                | No port work                                           | Low realism ceiling; aft-CG, ground effect, post-stall all custom problems  |

**Chosen: B.** Per the Prime Directive, a stub is a known issue. Option A is a supply-chain hole. Option C ships a known-approximation FDM forever. The port is scoped as a one-time Phase-2 deliverable; after it lands the sim runs on JSBSim for every aircraft it ever adds.

**Implementation notes:**

- Pinned upstream JSBSim commit as a git submodule at `tools/jsbsim-port/submodule/`.
- Emscripten toolchain pinned in `tools/jsbsim-port/.emsdk-version`.
- Binding generator in `tools/jsbsim-port/bindings/` reads only the minimal `FGFDMExec` surface we use: init, set inputs, advance, read state, unload. Not the full FGFDMExec header.
- Output: `libs/sim-fdm/jsbsim.wasm` (binary, committed with SHA-256 hash in `libs/sim-fdm/jsbsim.wasm.sha256`) + `libs/sim-fdm/glue.ts` (TS bindings).
- CI verifies `sha256sum libs/sim-fdm/jsbsim.wasm` matches the committed hash on every build. Any drift = CI fail + regenerate-and-commit step.
- Developer-local rebuild: `bun run sim:fdm:build` (Docker-backed) for anyone touching the port. Everyone else pulls the committed blob.

## Key decision 2: Worker host lives in `libs/engine/`

`libs/engine/` is a new cross-product library for tick-driven simulation substrate. It starts narrow: `libs/engine/src/sim/` with the JSBSim worker host. As FIRC migrates in, `libs/engine/` grows to include the scenario tick orchestrator, scoring, and replay substrate that both sim and FIRC share.

**Why not put it in `libs/bc/sim/`:** BCs own domain logic, not infrastructure. The worker host is infrastructure (worker message pump, WASM lifecycle). It wants to be shared with FIRC. `libs/engine/` is its natural home.

**Why not put it in `apps/sim/src/lib/`:** Because FIRC will use it too. The existing `apps/sim/src/lib/fdm-worker.ts` stays (the worker itself runs in the app), but its internals become a thin shim over `libs/engine/src/sim/fdm-worker-host.ts`.

## Key decision 3: Fault model as a pure transform

`libs/bc/sim/src/faults/` is a pure transform layer: `(truth, activeFaults, t) -> display`. The FDM knows nothing about faults. The instruments know nothing about the FDM. The cockpit reads `DisplayState`; the debrief reads both.

```typescript
// libs/bc/sim/src/faults/types.ts
export interface DisplayState {
	indicatedAirspeed: number;
	altitude: number;
	verticalSpeed: number;
	attitudePitch: number;
	attitudeRoll: number;
	headingIndicated: number;
	turnRate: number;
	slipBall: number;
	vacuumGaugeReading: number;
	alternatorOutput: number;
	batteryVoltage: number;
	/** Catch-all for compass, engine gauges, fuel, etc. -- added as fault kinds grow. */
}

export interface ActiveFault {
	kind: FaultKind;
	/** Sim time (seconds since scenario start) when this fault fired. */
	firedAt: number;
	params: FaultParams;
}

export function applyFaults(
	truth: FdmTruthState,
	activeFaults: readonly ActiveFault[],
): DisplayState;
```

**Why pure:** unit testable without a browser, without a worker, without a scenario. Deterministic for replay. Fault logic evolves by adding new `FaultKind` enum members + a new case branch; no core logic changes.

**Where it runs:** in the worker, on each snapshot emission. Display state is included in the snapshot payload. Cockpit instruments don't do any fault math.

**Instrument components** (Phase 3, extending the six-pack shipped at Phase 0.5) each accept a slice of `DisplayState`:

```svelte
<!-- apps/sim/src/lib/instruments/AttitudeIndicator.svelte -->
<script lang="ts">
import type { DisplayState } from '@ab/bc-sim';
let { display }: { display: Pick<DisplayState, 'attitudePitch' | 'attitudeRoll'> } = $props();
</script>

<svg ...>
	<!-- render pitch ladder + horizon based on display.attitudePitch -->
	<!-- no awareness of whether the vacuum gauge is dead -->
</svg>
```

## Key decision 4: Scenario format stays TS-native

Scenarios are TS modules (`libs/bc/sim/src/scenarios/*.ts`) exporting a `ScenarioDefinition`. Not JSON, not YAML. Authors get full type safety + IDE support + refactor safety as the type evolves.

**Why not JSON/YAML:** external authoring (hangar) doesn't exist yet. When it does, a JSON-serialisable subset can be extracted via a codegen step. Until then TS is strictly better.

**Scenario registry** ([libs/bc/sim/src/scenarios/registry.ts](../../../libs/bc/sim/src/scenarios/registry.ts)) stays the flat source of truth. Adding a scenario = `export const XYZ: ScenarioDefinition` + register it.

**Added optional fields** per Phase 4:

```typescript
// libs/bc/sim/src/types.ts (extended)
export interface ScenarioDefinition {
	// ... existing fields ...

	/** Fault events scripted into the scenario. */
	faults?: readonly ScenarioFault[];

	/** Reference trajectory for the debrief's compare-to-ideal overlay. */
	idealPath?: IdealPathDefinition;

	/** Weighted grading signals. Absent = binary pass/fail. */
	grading?: GradingDefinition;

	/** Links scenario to the study rep scheduler. */
	repMetadata?: RepMetadata;
}

export interface IdealPathDefinition {
	/** Stitch together truth-state segments covering the whole run. */
	segments: readonly IdealPathSegment[];
}

export interface IdealPathSegment {
	/** Segment spans [startT, endT] of sim time, seconds. */
	startT: number;
	endT: number;
	/** Target truth-state values and tolerances for this segment. */
	targets: IdealPathTargets;
}

export interface IdealPathTargets {
	altitude?: { value: number; tolerance: number };          // meters
	heading?: { value: number; tolerance: number };           // radians
	indicatedAirspeed?: { value: number; tolerance: number }; // m/s
	verticalSpeed?: { value: number; tolerance: number };     // m/s
	pitch?: { value: number; tolerance: number };             // radians
	roll?: { value: number; tolerance: number };              // radians
}

export interface GradingDefinition {
	/** Sum of weights must equal 1.0 (+/- 0.001). */
	weights: {
		altitudeHold?: number;
		headingHold?: number;
		airspeedHold?: number;
		stallMargin?: number;
		loadFactorMargin?: number;
		decisionLatency?: number;
		landingSpotAccuracy?: number;
	};
	/** Optional hard fail: grade clamped to 0 if any true. */
	hardFailures?: readonly ('crashed' | 'structural_overstress' | 'sustained_stall')[];
}

export interface RepMetadata {
	/** Aggregation domain for weak-areas ranking. */
	domain: SimDomain;
	/** Hint for the scheduler; actual difficulty learned from data. */
	difficulty: 'intro' | 'standard' | 'challenge';
	/** Tags for filter + search. */
	tags: readonly string[];
}

export type SimDomain =
	| 'stalls'
	| 'efato'
	| 'instruments'
	| 'wb'
	| 'unusual_attitudes'
	| 'partial_panel'
	| 'vmc_imc'
	| 'pattern';
```

## Key decision 5: Replay tape -- ring buffer + on-end persist

The worker writes frames into a fixed-size ring buffer at snapshot cadence (30 Hz). On scenario end, the main thread drains the buffer, compresses the frames, persists via a `POST /api/sim/attempts` handler that fans out into `sim.scenario_attempt` (Drizzle-managed; namespace `sim`).

**Why ring buffer:** bounds memory at ~15 MB for the longest supported scenarios (3 min @ 30 Hz = 5400 frames). Gracefully degrades if a scenario unexpectedly runs longer (oldest frames drop; the fact is recorded in tape metadata).

**Frame size budget:** target <= 2 KB/frame serialised, <= 800 bytes compressed. Truth + display + inputs + faults per frame.

**Determinism:** `(scenarioHash, seed, initial, inputs)` -> same frames. JSBSim is deterministic; our worker pump is deterministic (fixed-dt step). Test: record a tape, replay the input stream through a fresh worker, compare frame-by-frame.

**Replay playback:** debrief page fetches the tape, scrubs by frame index, renders instruments in "read-only display-state" mode. No worker involved during debrief.

## Key decision 6: Debrief integrates with study's spaced-rep scheduler

On scenario end, the main thread calls:

```typescript
// apps/sim/src/routes/[scenarioId]/+page.server.ts (or equivalent)
import { createScenarioAttempt } from '@ab/bc-study';
// ...
await createScenarioAttempt(db, userId, {
	scenarioId: result.scenarioId,
	outcome: result.outcome,
	grade: result.grade,          // 0.0 .. 1.0 from GradingDefinition
	elapsedSeconds: result.elapsedSeconds,
	tapeId: persistedTapeId,
	// The scheduler maps grade -> rating.
});
```

**Grade -> rating mapping** (handled inside `createScenarioAttempt` or a thin shim):

| Grade         | FSRS rating |
| ------------- | ----------- |
| >= 0.90       | Easy        |
| 0.75 .. 0.90  | Good        |
| 0.50 .. 0.75  | Hard        |
| < 0.50        | Again       |

Scenarios with `hardFailures` trigger auto-Again when the failure condition is true regardless of numeric grade.

**Why reuse study's scheduler:** one scheduler across the whole platform. Weak scenarios appear in `/session/start` next to weak cards. Diversify slice can surface unused sim domains. Zero parallel infrastructure.

## Key decision 7: Sound stays on the main thread

Web Audio on the main thread, driven by snapshot messages from the worker. This is what Phase 0.6 already ships; Phase 5 extends it.

**Why not AudioWorklet:** AudioWorklets add complexity (their own module graph, cross-origin-isolation requirements for shared memory). The existing two-osc + noise synth meets the bar at <1 ms per frame on the main thread. Stay here until a profile says otherwise.

**Discrete cues** (Phase 5):

- Each cue is a one-shot `AudioBufferSourceNode` fed from a pre-loaded sample buffer.
- Triggers derive from `FdmTruthState` changes (flap detent changed, gear configuration + throttle state, altitude deviation from target). Cue orchestrator is a pure function of the current + previous snapshot.
- Captions: a small `cue-history` panel lists each cue with timestamp + description for a11y.

## Key decision 8: Instruments stay SVG + Svelte

No canvas, no npm gauge library. Each instrument is a Svelte 5 component reading its slice of display state. Already shipped pattern from Phase 0.5; Phase 3 extends with the missing engine cluster gauges and formalises annunciators.

**Why SVG:** accessible (screen readers can traverse the DOM), responsive (scales without rasterisation), themeable (CSS tokens for every color), and zero animation framework overhead. Each component is <200 lines.

## Key decision 9: Horizon (Phase 7) uses Three.js

Three.js is allowed as an npm dep because it does not execute simulation logic -- it renders what the FDM tells it to. Pin the version; audit updates. The scene is minimal:

- Sky dome with a day-sky gradient (no HDRI).
- Ground plane with runway mesh + textured grass.
- Sun as a directional light (no shadows).
- Camera locked to the aircraft body frame, driven by `FdmTruthState.pitch`, `roll`, `heading`, `altitude`.

Load Three.js only when the horizon is toggled on; code-split the scene module.

## Data flow

### Scenario run (live)

```text
Cockpit mounts scenario
  -> worker `init(aircraft, initial, wind, faults)`
Keyboard / mouse input
  -> control-handler -> worker `setInputs`
Worker 120 Hz tick loop
  -> JSBSim step(dt=1/120)
  -> faults.applyFaults(truth) -> display
  -> runner.evaluate(truth, inputs) -> outcome
  -> if snapshot tick: post { truth, display, inputs, outcome, faultsTriggered }
Main thread snapshot handler
  -> update instrument props
  -> sound orchestrator reads snapshot, fires cues
  -> replay-buffer.push(frame)
  -> if outcome != RUNNING: finalise
Finalise
  -> drain replay ring buffer
  -> compress
  -> POST /api/sim/attempts { scenarioId, outcome, grade, tape }
  -> navigate to /[scenarioId]/debrief?attemptId=...
```

### Debrief

```text
Debrief route loads
  -> load ReplayTape by attemptId
  -> verify scenarioHash matches current definition
  -> render scrubber (frame 0..N-1)
  -> scrub event: frame index changes
    -> left panel: render truth instruments
    -> right panel: render display instruments (same components, display-only props)
    -> input-tape chart: cursor follows scrub
    -> ideal-path overlay (if segments cover scrubbed t)
```

### Validation run

```text
bun run check  (in CI + pre-commit)
  -> TS build
  -> bun test libs/bc/sim/           -- FDM, faults, runner, audio mapping
  -> bun test libs/engine/           -- worker host, tick pump
  -> bun test tools/jsbsim-port/     -- build verifier (hash match)
  -> bunx biome check                -- formatting
  -> scripts/sim/validate-scenarios.ts  -- registry completeness, fault trigger reachability
  -> scripts/sim/verify-fdm-hash.sh  -- WASM blob integrity
```

## API surface

### `libs/engine/src/sim/fdm-worker-host.ts`

```typescript
export interface FdmWorkerHost {
	init(args: {
		aircraft: SimAircraftId;
		initial: ScenarioInitialState;
		wind: ScenarioWind;
		faults: readonly ScenarioFault[];
	}): Promise<void>;

	setInputs(inputs: Partial<FdmInputs>): void;

	/** Advance N ticks at fixed SIM_FDM_DT_SECONDS each. */
	advance(nTicks: number): void;

	/** Non-blocking; worker posts SNAPSHOT messages on its own schedule. */
	subscribeSnapshots(onSnapshot: (snap: FdmSnapshot) => void): () => void;

	dispose(): void;
}

export interface FdmSnapshot {
	truth: FdmTruthState;
	display: DisplayState;
	inputs: FdmInputs;
	faultsActive: readonly ActiveFault[];
	faultsTriggeredThisTick: readonly FaultKind[];
	outcome: SimScenarioOutcome;
	outcomeReason: string;
	stepState?: ScenarioStepState;
}
```

### `libs/bc/sim/src/faults/`

```typescript
export function applyFaults(
	truth: FdmTruthState,
	activeFaults: readonly ActiveFault[],
	config: AircraftConfig,
): DisplayState;

export function evaluateFaultTriggers(
	def: ScenarioDefinition,
	truth: FdmTruthState,
	activeFaults: readonly ActiveFault[],
	currentStepId: string | undefined,
): {
	nextActive: readonly ActiveFault[];
	triggeredThisTick: readonly FaultKind[];
};
```

### `libs/bc/sim/src/replay/`

```typescript
export function createReplayBuffer(capacityFrames: number): ReplayBuffer;

export interface ReplayBuffer {
	push(frame: ReplayFrame): void;
	drain(): readonly ReplayFrame[];
	readonly length: number;
}

export function compressTape(tape: ReplayTape): Uint8Array;
export function decompressTape(bytes: Uint8Array): ReplayTape;
export function hashScenario(def: ScenarioDefinition): string;
```

### `libs/bc/study/src/reps.ts` (extended)

```typescript
export async function createScenarioAttempt(
	db: Db,
	userId: string,
	attempt: {
		scenarioId: SimScenarioId;
		outcome: SimScenarioOutcome;
		grade: number;
		elapsedSeconds: number;
		tapeId: string | null;
		domain: SimDomain;
	},
): Promise<ScenarioAttempt>;
```

Maps `grade` to FSRS rating per Key decision 6 and writes through the same review pathway used by cards and existing reps.

### New route constants

```typescript
// libs/constants/src/routes.ts
SIM_DEBRIEF: (scenarioId: SimScenarioId, attemptId: string) =>
	`/${scenarioId}/debrief?attemptId=${attemptId}` as const,
SIM_INSTRUMENT_GALLERY: '/_dev/instruments',
```

## Component structure

```text
apps/sim/src/
├── routes/
│   ├── +page.svelte                         (existing -- scenario picker)
│   ├── [scenarioId]/+page.svelte            (existing -- cockpit, extended)
│   ├── [scenarioId]/debrief/+page.svelte    (NEW, Phase 4)
│   ├── [scenarioId]/debrief/+page.ts        (NEW, Phase 4)
│   └── _dev/instruments/+page.svelte        (NEW, Phase 3 -- gallery)
├── lib/
│   ├── instruments/
│   │   ├── Asi.svelte                        (existing)
│   │   ├── AttitudeIndicator.svelte          (existing)
│   │   ├── Altimeter.svelte                  (existing)
│   │   ├── TurnCoordinator.svelte            (existing)
│   │   ├── HeadingIndicator.svelte           (existing)
│   │   ├── Vsi.svelte                        (existing)
│   │   ├── Tachometer.svelte                 (existing)
│   │   ├── OilPressure.svelte                (NEW, Phase 3)
│   │   ├── OilTemp.svelte                    (NEW, Phase 3)
│   │   ├── FuelQuantity.svelte               (NEW, Phase 3)
│   │   ├── Ammeter.svelte                    (NEW, Phase 3)
│   │   ├── VacuumGauge.svelte                (NEW, Phase 3)
│   │   └── Annunciators.svelte               (NEW, Phase 3)
│   ├── panels/
│   │   ├── ControlInputs.svelte              (existing)
│   │   ├── KeyboardCheatsheet.svelte         (existing)
│   │   ├── ScenarioStepBanner.svelte         (existing)
│   │   ├── VSpeeds.svelte                    (existing)
│   │   ├── WxPanel.svelte                    (existing)
│   │   └── CueHistory.svelte                 (NEW, Phase 5 -- a11y captions)
│   ├── debrief/
│   │   ├── Scrubber.svelte                   (NEW, Phase 4)
│   │   ├── InputTape.svelte                  (NEW, Phase 4)
│   │   ├── DualInstrumentPanels.svelte       (NEW, Phase 4)
│   │   └── IdealPathOverlay.svelte           (NEW, Phase 4)
│   ├── horizon/
│   │   └── HorizonScene.svelte               (NEW, Phase 7; code-split)
│   ├── control-handler.ts                     (existing)
│   ├── control-ramp.ts                        (existing)
│   ├── engine-sound.svelte.ts                 (existing)
│   ├── stall-horn.svelte.ts                   (existing)
│   ├── warning-cues.svelte.ts                 (NEW, Phase 5)
│   ├── fdm-worker.ts                          (existing -- shim over libs/engine/)
│   └── worker-protocol.ts                     (existing -- extended Phase 2/3)

libs/
├── bc/sim/src/
│   ├── types.ts                               (extended each phase)
│   ├── audio-mapping.ts                        (existing)
│   ├── audio-mapping.test.ts                   (existing)
│   ├── fdm/
│   │   ├── c172.ts                             (existing -- replaced by JSBSim config Phase 2)
│   │   ├── pa28.ts                             (NEW, Phase 6)
│   │   ├── engine.ts                           (existing -- shimmed into JSBSim Phase 2)
│   │   ├── physics.ts                          (existing -- kept as TS fallback FDM)
│   │   └── physics.test.ts                     (existing)
│   ├── faults/
│   │   ├── types.ts                            (NEW, Phase 3)
│   │   ├── apply-faults.ts                     (NEW, Phase 3)
│   │   ├── evaluate-triggers.ts                (NEW, Phase 3)
│   │   └── apply-faults.test.ts                (NEW, Phase 3)
│   ├── replay/
│   │   ├── types.ts                            (NEW, Phase 4)
│   │   ├── buffer.ts                           (NEW, Phase 4)
│   │   ├── compress.ts                         (NEW, Phase 4)
│   │   ├── hash-scenario.ts                    (NEW, Phase 4)
│   │   └── replay.test.ts                      (NEW, Phase 4)
│   └── scenarios/
│       ├── registry.ts                         (existing; extended each scenario wave)
│       ├── runner.ts                           (existing; extended Phase 4)
│       ├── runner.test.ts                      (existing)
│       ├── playground.ts                       (existing)
│       ├── first-flight.ts                     (existing)
│       ├── departure-stall.ts                  (existing; grading added Phase 4)
│       ├── efato.ts                             (NEW, Phase 4)
│       ├── vacuum-failure.ts                   (NEW, Phase 4)
│       ├── aft-cg-slow-flight.ts               (NEW, Phase 6)
│       ├── unusual-attitude-nose-hi.ts         (NEW, Phase 6)
│       ├── unusual-attitude-nose-lo.ts         (NEW, Phase 6)
│       ├── partial-panel.ts                    (NEW, Phase 6)
│       ├── vmc-into-imc.ts                     (NEW, Phase 6)
│       ├── pitot-blockage-climb.ts             (NEW, Phase 6)
│       └── static-blockage-descent.ts          (NEW, Phase 6)
├── engine/                                     (NEW, Phase 2)
│   └── src/
│       ├── sim/
│       │   ├── fdm-worker-host.ts               (NEW)
│       │   └── tick-pump.ts                     (NEW)
│       └── index.ts
├── sim-fdm/                                    (NEW, Phase 2)
│   ├── jsbsim.wasm                              (binary)
│   ├── jsbsim.wasm.sha256                       (hash)
│   └── glue.ts                                  (TS bindings)
└── constants/src/
	├── sim.ts                                   (existing; extended)
	└── routes.ts                                (existing; extended)

tools/
└── jsbsim-port/                                (NEW, Phase 2)
	├── submodule/                               (git submodule)
	├── bindings/                                 (hand-curated glue gen)
	├── CMakeLists.txt
	├── .emsdk-version
	├── build.sh
	└── README.md
```

## Scenario catalogue at end of MVP

| Scenario                  | Phase | Domain            | Faults           | Steps? | Grading                                                  |
| ------------------------- | ----- | ----------------- | ---------------- | ------ | -------------------------------------------------------- |
| Playground                | 0.5   | free              | none             | no     | endless                                                  |
| First Flight              | 0.5   | tutorial          | none             | yes    | step progression                                         |
| Departure Stall           | 0.5   | stalls            | none             | no     | altitude hold, stall margin, recovery latency            |
| EFATO                     | 4     | efato             | engine_cut*      | no     | decision latency, best-glide speed, landing-spot commit  |
| Vacuum Failure            | 4     | instruments       | vacuum_failure   | no     | heading hold, transition-to-T/B latency                  |
| Aft-CG Slow Flight        | 6     | wb                | none             | yes    | airspeed hold within tolerance; stall-break recognition  |
| Unusual Attitude Nose-Hi  | 6     | unusual_attitudes | none             | no     | recovery time, g-margin                                  |
| Unusual Attitude Nose-Lo  | 6     | unusual_attitudes | none             | no     | recovery time, g-margin, airspeed recovery order         |
| Partial Panel             | 6     | partial_panel    | vacuum_failure + alternator | yes  | heading hold on T/B + compass, altitude hold           |
| VMC into IMC              | 6     | vmc_imc           | none (visual only; Phase 7 adds the scene collapse) | no | 180-turn accuracy, scan discipline |
| Pitot Blockage (climb)    | 6     | instruments       | pitot_block      | no     | airspeed recognition latency, pitch-and-power control    |
| Static Blockage (descent) | 6     | instruments       | static_block     | no     | altitude recognition latency, alternate static handling  |

`*` engine_cut is a throttle override (throttle = 0, engine off) rather than a fault-kind. Implemented via scripted input.

Total: 12 scenarios across the MVP set. Within the 8-10 target if we drop the two early tutorials (Playground, First Flight) from the count.

## Risks

| Risk                                                                                      | Mitigation                                                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JSBSim port takes longer than 2-5 days.                                                   | Hand-rolled TS FDM ships as fallback; work in parallel. If port misses, MVP ships on TS FDM and ports land in a Phase-2 follow-up.                                 |
| Determinism breaks somewhere between WASM + worker + snapshotting.                        | Phase 2 ships a determinism test: record input stream, replay, compare frames. Fails early.                                                                        |
| Replay tape size blows past 5 MB compressed.                                              | Cap total at 5 MB. Drop intermediate frames when over. Document the fact in tape metadata.                                                                         |
| Fault-kind enum expands and breaks existing tapes.                                        | Tapes hash scenario def + embed active faults explicitly. Adding a fault kind doesn't invalidate old tapes; removing or renaming does. Migration plan per-removal. |
| Instrument gallery drifts from reality as FaultKinds evolve.                              | Gallery is a route test target: Playwright visual diff per instrument x fault matrix. Runs in CI.                                                                 |
| Scheduler integration surfaces scenarios that aren't ready.                                | `RepMetadata` is optional; scenarios without it don't get scheduled. Pre-flight step on every scenario confirms metadata before registry export.                  |
| Horizon scene causes jank at 60 Hz on low-end laptops.                                    | Code-split; load only when toggled. Profiled in Phase 7. If needed, cap at 30 fps with reduced-motion.                                                            |
| PA28 aerodynamics differ meaningfully from C172 in ways scenarios assume C172 behavior.   | Each scenario pins its aircraft. PA28 scenarios only land after PA28 config is validated against JSBSim desktop reference.                                        |
| Audio adds jank during the 120 Hz tick.                                                    | Audio is on the main thread; the worker has no audio work. Main-thread audio updates run at 30 Hz from snapshots. Already shown viable in Phase 0.6.              |
| LGPL boundary question with JSBSim WASM.                                                  | WASM is loaded as a blob + JS ABI. No static linking. `tools/jsbsim-port/README.md` documents the compliance posture. Keep blob swappable; do not minify.         |
| CI environment cannot build JSBSim from source repeatably.                                | WASM + hash committed. CI verifies hash only. Rebuild is a manual, Docker-backed dev task. Gate the submodule update behind explicit intent.                      |

## Key decisions recap

| # | Decision                                                      | Why                                                                        |
| - | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1 | FDM in WASM, built in-tree, pinned upstream                   | Supply chain posture; auditability; fidelity ceiling                       |
| 2 | Worker host in `libs/engine/`                                 | Shared with future FIRC migration; not BC domain logic                     |
| 3 | Fault model as pure transform                                 | Testable; deterministic; orthogonal to FDM                                 |
| 4 | Scenario format stays TS-native                               | Type safety, IDE support, refactor ease; JSON subset later if hangar needs |
| 5 | Replay tape: ring buffer + on-end persist                     | Bounded memory; graceful degradation; deterministic                        |
| 6 | Study spaced-rep scheduler owns sim attempts                  | One scheduler across the platform; weak sim scenarios appear in /session/start |
| 7 | Sound on main thread                                          | Phase 0.6 proved viable; AudioWorklet adds cross-origin-isolation pain     |
| 8 | Instruments stay SVG + Svelte                                 | Accessible, scalable, themeable; shipped pattern works                     |
| 9 | Horizon is Three.js, code-split, optional                     | Needed for VFR; acceptable dep because no sim logic                        |
