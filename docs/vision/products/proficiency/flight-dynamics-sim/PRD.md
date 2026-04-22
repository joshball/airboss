---
name: Flight Dynamics Sim
id: prd:prof:flight-dynamics-sim
tagline: Link-Trainer-grade scenarios in a browser tab
status: idea
priority: 2
prd_depth: full
category: proficiency
platform_mode:
  - daily-desk
audience:
  - student-pilot
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
complexity: high
personal_need: 4
depends_on: []
related:
  - prd:prof:decision-reps
  - prd:prof:situational-replay
  - prd:prof:avionics-trainer
surfaces:
  - web
content_reuse:
  - scenarios
  - aircraft-profiles
last_worked: null
---

# Flight Dynamics Sim

## What it does

A browser-based, instruments-first flight simulator for short training scenarios. A real flight dynamics model drives a six-pack, engine gauges, and warning annunciators. Scenarios run 30 seconds to 3 minutes: a takeoff stall, an EFATO, a VMC-into-IMC, a partial panel unusual attitude, a too-far-aft W&B demonstration. Replayable, debriefable, and schedulable by spaced repetition.

Distinctive capability: **instruments can lie**. Vacuum failure drifts the AI slowly. A blocked pitot reads high in a climb. A static block reverses the ASI on descent. The learner sees what's actually happening (from the FDM truth state) alongside what the instruments are telling them -- exactly the surprise that kills real pilots.

## What it looks like

A centered instrument panel: six-pack on top, engine/systems row below, annunciators and flap/gear indicators to the side. Throttle/mixture/prop vertical bars or knobs. A scenario banner at the top sets the scene ("Departure runway 25, 3400 ft MSL, 80F, calm winds. You're a new CFI with a student on their first short-field takeoff."). A tick runs the FDM in a worker; the panel updates at 30-60 Hz.

Below the panel: an intervention strip for CFI scenarios (same ladder as Decision Reps), or a control-input readout for student/PP scenarios. Right side: compact scenario objectives + success criteria. After the scenario: a debrief tape (every input, every state, every deviation) with scrub/step/compare-to-ideal.

Phase 3 adds an optional horizon + low-res ground plane above the panel for VFR maneuvers. Phase 4 adds procedural engine sound.

Key screens:

- **Scenario launcher** -- browse by maneuver / failure / phase of flight
- **Cockpit** -- instrument panel, controls, scenario banner, objectives
- **Debrief** -- timeline scrubber, input tape, truth-vs-display comparison, scoring
- **Progress** -- scenarios attempted/mastered, recurring weaknesses, spaced-rep queue

## Who it's for

- **Student pilots** -- cheap reps of stalls, slow flight, emergency descents, and engine-out decisions before expensive airplane time.
- **Private pilots** -- maintaining proficiency on maneuvers that are legally unnecessary but practically essential (power-on stalls, unusual attitudes, partial panel).
- **Instrument pilots** -- scan discipline, partial-panel work, unusual attitude recovery on the six-pack.
- **CFIs** -- rehearsing how a scenario *feels* in real time so they can coach students through it. Failure-chain awareness.
- **Returning pilots** -- low-stakes way to get the scan back before sitting in an airplane.

## Core features

- **Flight dynamics model** driving truth state at 60-120 Hz (worker) with 30-60 Hz snapshots to instruments.
- **Aircraft profile** (MVP: C172-class; later: PA28, taildragger, complex/HP, twin). Mass/CG/fuel state modeled; aft-CG scenarios produce the real stall behavior.
- **Six-pack** -- ASI, AI, altimeter, turn coord, HI, VSI. Engine instruments (tach, MP if applicable, fuel, oil P/T, CHT, EGT, amps, vacuum).
- **Instrument fault model** -- pitot/static blockage, vacuum failure, alternator failure, gyro tumble. Truth vs display both recorded.
- **Sound** -- procedural or sample-based engine sound tied to RPM. Stall horn, gear/flap warnings, marker beacons, altitude alerter, AP disconnect.
- **Scenario library** -- JSON/YAML scenarios with initial conditions, scripted events (failure triggers), success criteria, intervention gates.
- **Replay + debrief** -- every input + state recorded. Scrub, step, compare to "ideal" path. Calibration scoring.
- **Spaced-rep integration** -- weak scenarios re-queue automatically via the same scheduler that runs Spaced Memory Items.

### Phase 3+ features

- **Horizon + low-res outside view** for VFR maneuvers (Three.js flat terrain + runway + sky).
- **Additional aircraft** (retracts, complex, twin, taildragger).
- **Weather** -- winds aloft, gusts, turbulence, IMC transitions.
- **Multiplayer debrief** -- one plays student, one plays instructor; or async review of recorded tape.

### Future (post-MVP, PC-only; separate product)

- **MSFS / X-Plane bridge** -- stream real-sim state into airboss scoring. Desktop sidecar process required. Not a browser sim; a grading/debrief overlay.

## Core scenarios (MVP set)

| Scenario | Phase | Teaches |
| --------------------------------------- | ------- | --------------------------------------------------------- |
| Departure stall, short field            | Takeoff | Stall recognition at high AoA + low altitude |
| Engine failure after takeoff            | Takeoff | EFATO decision, best-glide, landing-spot commit |
| Aft-CG slow flight                      | Cruise  | W&B consequences; aft-stick stall behavior |
| Unusual attitude recovery (nose-high)   | Cruise  | Stall-first recovery sequence |
| Unusual attitude recovery (nose-low)    | Cruise  | Spiral-first recovery sequence |
| Vacuum failure on instruments           | Cruise  | Lying AI/HSI; cross-check against T/B and compass |
| Pitot blockage in climb                 | Climb   | ASI reads high; pitch-and-power backup |
| Static blockage in descent              | Descent | Alt frozen, VSI zero, ASI reversed |
| VMC into IMC                            | Cruise  | 180-degree turn discipline; scan transition |
| Partial-panel ILS                       | Approach| Scan on T/B, compass, ASI, altimeter |

MVP ships with 3-5 of these; remainder follow.

### Phase 0.5 shipped

Three scenarios live in `apps/sim/` today:

- **Playground** -- free-fly from runway 09, parking brake set, no objective.
- **First Flight** -- 9-step guided tutorial (release brake, Vr takeoff, climb, level off, turn, descend, flare).
- **Departure Stall** -- takeoff scenario with a scripted trim-drift failure at 200 ft AGL to teach stall recognition before the horn.

Shipped with the hand-rolled C172 FDM: lateral axis (roll / yaw / coordinated turn), trim, parking brake, flaps, wind, stall warning on AoA, auto-coordinate autopilot. Cockpit: full six-pack (ASI, AI, altimeter, turn coord, HI, VSI) plus tachometer, V-speeds sidebar, WX panel, control-input panel with trim-ghost and STALL annunciator, keybindings help, reset confirm, stall horn via Web Audio.

## Technical challenges

- **FDM port quality.** The decision to port JSBSim to WASM ourselves (vs depend on someone's port) is the critical path. See [research doc](../../../../work/todos/20260422-flight-dynamics-sim-research.md) for the plan.
- **Tick determinism and replay.** If we want scrub-replay, the tick must be deterministic given inputs + seed. JSBSim is, but we need to capture every input with a timestamp.
- **Instrument lie model.** Truth-vs-display has to work cleanly in the state pipeline. Fault model lives alongside the display, not inside the FDM.
- **Sound on mobile.** AudioContext requires user gesture to start; handle gracefully. iOS has additional restrictions.
- **60+ Hz in a worker without jank.** The worker approach should be fine; verify early with a throwaway prototype.
- **Scope creep.** "Just add a moving map" will turn this into FlightGear. Hard boundaries: instruments-first, horizon-only-if-needed, no terrain, no nav DB (scenarios carry their own world state).
- **Supply chain risk.** No npm dep for simulation logic. WASM built from pinned upstream + our bindings. See research doc security section.

## Audience challenges

- Pilots expect photorealism because MSFS exists. Framing: "this is a *training tool*, not a sim game." Compare to Frasca / Redbird / CPT -- instruments-first trainers are a recognized category.
- Serious training value lives in short, repeatable, debriefable scenarios. Users may come in expecting "let me free-fly for an hour." That's not what this is. UX should direct them to scenarios, not free mode, at least initially.
- Control fidelity: keyboard/mouse fine for MVP; real yoke users will want HID support. Plan for it, don't build it yet.
- CFIs will ask "can I use this for real training credit?" Answer: no -- it's not an FAA-approved ATD. Value is pre-lesson prep and post-lesson review, not logged time.

## Relationship to other airboss products

- **Decision Reps** (`prd:prof:decision-reps`) -- shares the intervention ladder UX and scenario-rep loop. Sim scenarios can *be* Decision Reps with a cockpit attached.
- **Situational Replay** (`prd:prof:situational-replay`) -- NTSB cases become much more powerful when you can *fly* the setup before seeing what the real pilot did.
- **Avionics Trainer** (`prd:prof:avionics-trainer`) -- complementary. Avionics trainer teaches workflows (button sequences); sim teaches aerodynamics and scan. Long-term they could be combined (load an approach on the sim panel), but keep them separate products for now.
- **FIRC migration** (`apps/firc/`, future) -- the airboss-firc scenario/tick engine is a direct ancestor. Audit it before building the sim tick loop; likely heavy reuse.
