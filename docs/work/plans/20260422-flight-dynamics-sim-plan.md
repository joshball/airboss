---
date: 2026-04-22
machine: Joshua-MBP
branch: main
revision: 1
prompt: >
  "So, document all this research, and ideas, and come up with a plan for
  all this"
context: >
  User wants a staged plan for building a browser flight dynamics sim in
  airboss. Companion to the research doc and the PRD. This is the "how we
  get from idea to shipped" view -- not yet a work package, but the roadmap
  that a work package would be cut from.
---

# Flight Dynamics Sim -- Staged Plan

Companion documents:

- PRD: [docs/vision/products/proficiency/flight-dynamics-sim/PRD.md](../../vision/products/proficiency/flight-dynamics-sim/PRD.md)
- Research: [docs/work/todos/20260422-flight-dynamics-sim-research.md](../todos/20260422-flight-dynamics-sim-research.md)

This plan is **not yet sequenced against the rest of the roadmap.** Study MVP user-zero testing comes first (per [NOW.md](../NOW.md)). The sim is behind that, likely behind the FIRC migration (`apps/firc/`), and potentially behind an Avionics Trainer MVP. Treat this as a "ready to cut a work package when its turn comes" artifact.

## Guiding constraints

1. **Security first.** No third-party code executes in our sim loop unless we have read and vendored it. FDM WASM is ours, built from pinned upstream. See research doc.
2. **Instruments-first.** Six-pack before horizon. No graphics in MVP.
3. **Short scenarios, not free flight.** Scenario rep loop is the product.
4. **Truth-vs-display is a feature from day one.** Failure modes bake in, not bolt on.
5. **Fits the existing rep/debrief/spaced-rep engine.** Do not build a parallel scheduler. Do not build a parallel replay system. Reuse study/.
6. **No scope creep.** Terrain, weather, multiplayer, real-sim bridges are deferred products.

## Phases

### Phase 0 -- Feasibility prototype (throwaway)

**Goal:** prove the rep loop works with a simple FDM and a small instrument panel. Validate the UX shape before the real FDM port.

- Hand-rolled TypeScript FDM in a Web Worker: single-engine piston, ~500 lines. Force/moment eqns, RK4 integrator, lookup tables for CL/CD/Cm vs AoA.
- Three instruments: ASI, altimeter, AI. SVG in Svelte.
- One scenario: departure stall. Initial conditions at Vr, learner controls throttle + pitch, success = don't stall; failure = stall + recovery.
- Keyboard-only input.
- No sound, no graphics, no debrief.

**Exit criteria:** FDM ticks deterministically, instruments update smoothly, one scenario playable end-to-end. Proves the worker/snapshot pattern and the Svelte instrument pattern.

**Scope:** ~3-5 days. Throwaway; its purpose is learning, not shipping.

### Phase 1 -- Spec and work package

**Goal:** turn the prototype's lessons + the PRD into a proper work package.

- `/ball-wp-spec flight-dynamics-sim` to author spec.md, tasks.md, test-plan.md, design.md, user-stories.md.
- Decisions to lock:
  - Aircraft scope for MVP (I recommend: C172 only).
  - Scenario list for MVP (3-5 from the PRD set).
  - Control input scope (keyboard + mouse; gamepad deferred; HID yoke deferred).
  - Surface: standalone `apps/sim/` vs module in `apps/study/`. (I recommend standalone per architecture doc.)
  - FDM path: JSBSim WASM port (recommended) vs hand-rolled (prototype only).
  - BC layout: `libs/bc/sim/` mirrors `libs/bc/study/`. Tick loop goes in `libs/engine/` (shared with future FIRC migration).

**Exit criteria:** signed-off work package. User-reviewed.

### Phase 2 -- FDM port

**Goal:** ship a production-grade FDM as a WASM worker, running C172 aerodynamics at 120 Hz.

- Set up `tools/jsbsim-port/` with pinned upstream JSBSim submodule, Emscripten toolchain, and our own binding layer (study 0x62/jsbsim-wasm as reference; do not depend on it).
- CMake + Emscripten build reproducible in CI. Output `libs/sim-fdm/jsbsim.wasm` + TS glue.
- Worker wrapper in `libs/engine/` exposing: set input state, advance N ticks, get output state.
- Integration test: Cessna 172 configuration, 1G straight-and-level trim, compare airspeed/AoA/pitch to known-good JSBSim desktop values to validate the port.
- Deterministic replay test: same input stream + initial state -> identical output trajectory across runs.

**Exit criteria:** FDM produces known-correct C172 behavior; deterministic; worker-based; no npm deps for the FDM itself.

### Phase 3 -- Instrument panel + fault model

**Goal:** complete six-pack and engine gauges rendering FDM truth state, with the first-class fault model.

- Svelte SVG components for each six-pack instrument, engine gauges, annunciators, flap/gear indicator.
- Fault model layer: `TruthState -> DisplayState` transformation, per-instrument fault configs (pitot-block, static-block, vacuum, alternator, gyro tumble).
- Record both truth and display in the replay tape.
- Storybook-style gallery page to eyeball every instrument in every fault state.
- Accessibility: keyboard-readable instrument values for screen readers; colorblind-safe warnings.

**Exit criteria:** panel renders cleanly at 60 fps; every fault visible and documented; replay captures both layers.

### Phase 4 -- Scenario engine + debrief

**Goal:** scenarios runnable end-to-end, with scrub-replay + debrief.

- Scenario format (JSON or YAML; follow the study BC pattern): initial conditions, scripted events (time or state triggers), success/failure criteria.
- Tick orchestrator driving FDM + fault model + scenario script.
- Input capture with timestamps.
- Debrief page: timeline scrubber, truth-vs-display dual display, input tape, comparison to "ideal" path where authored.
- Wire into the study spaced-rep scheduler so weak scenarios re-queue.
- Three seed scenarios: departure stall, EFATO, vacuum failure.

**Exit criteria:** three scenarios playable, replayable, debriefable, and scheduled.

### Phase 5 -- Sound

**Goal:** procedural engine + warning cues.

- Web Audio AudioWorklet engine. Start with sample-based (`playbackRate = rpm / 2300`); upgrade to procedural if the sample approach feels wrong.
- Warning cue library: stall horn, gear warning, flap motor, marker beacons, altitude alert, AP disconnect. Each a short sample triggered by FDM/scenario events.
- Mute/volume controls; mobile-friendly gesture-to-start.
- Accessibility: visible captions for every audio cue.

**Exit criteria:** full scenario playable with sound adding real information; mute-and-still-playable.

### Phase 6 -- Second aircraft + remaining MVP scenarios

**Goal:** prove the FDM/panel/scenario architecture generalizes.

- Add PA28 config (mass, aero coefficients, engine model).
- Aircraft picker per scenario (each scenario pins an aircraft; pickers only for free mode).
- Fill out remaining MVP scenarios from the PRD list (aft-CG slow flight, unusual attitudes, partial panel, VMC-into-IMC).

**Exit criteria:** 8-10 scenarios, 2 aircraft, all replayable + scheduled.

### Phase 7 -- Horizon + low-res outside view (optional)

**Goal:** enable VFR/LOC scenarios that genuinely need visual feedback.

- Three.js horizon + flat terrain + runway mesh + sky/sun.
- Driven by FDM pitch/roll/heading/altitude.
- Toggleable per scenario (instrument-only scenarios keep it off).

**Exit criteria:** at least one VFR maneuver scenario (steep turns? ground reference?) feels right with the view.

### Post-MVP candidates (not scheduled)

- Weather model (winds, gusts, turbulence, IMC transitions).
- HID yoke / throttle quadrant support.
- Taildragger / complex / twin aircraft.
- MSFS + X-Plane grading bridges (separate product).
- Multiplayer / async debrief.

## Risks and unknowns

- **JSBSim port effort.** Estimate is 2-5 days but could be worse if the binding surface is larger than expected. Mitigation: Phase 0 prototype gives us the UX shape so we're not blocked waiting on the port. If the port bogs, the hand-rolled FDM can ship an MVP while we finish the real thing.
- **Supply chain posture cost.** Refusing to depend on jsbsim-wasm / engine-sound-generator npm packages costs us days of re-implementation vs `npm install`. Worth it. The user is explicit about this.
- **Determinism.** JSBSim's native integrator is deterministic, but Emscripten + worker + snapshotting could introduce non-determinism. Verify with replay test in Phase 2.
- **FIRC migration overlap.** When `apps/firc/` lands, the airboss-firc scenario/tick engine may already cover much of Phase 4. Audit before building. Possibly collapse the plan significantly if reuse is high.
- **Scope inflation from excited stakeholders (me).** Terrain, weather, multiplayer, real-sim bridges are all post-MVP. If any of them sneak into the work package scope during Phase 1, push back hard.

## Sequencing against the rest of the roadmap

Per [NOW.md](../NOW.md), current priority is **Step 8: manual test passes on shipped study features.** Nothing else starts before user-zero has walked through every shipped feature.

After that, the ordering question is:

1. FIRC migration (`apps/firc/`) -- unlocks reuse of the existing airboss-firc engine, which may collapse this plan's Phase 4.
2. Avionics Trainer MVP (`prd:prof:avionics-trainer`) -- separate product, simpler, similar "panel + scenario" shape. Good warmup.
3. Flight Dynamics Sim MVP (this doc).

I recommend doing FIRC migration before the sim, specifically to avoid building a second scenario engine we'll throw away.

## What to do now

Nothing builds yet. Capture is the work:

- [x] Research doc written.
- [x] PRD authored.
- [x] Plan (this doc) written.
- [x] IDEAS.md updated with a pointer (see companion edit).
- [ ] User review of research + PRD + plan.
- [ ] Park until the dependency queue clears.
