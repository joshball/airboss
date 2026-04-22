---
date: 2026-04-22
machine: Joshua-MBP
branch: main
revision: 1
prompt: >
  "It would be nice to have a connection to MSFS... but that would only be for
  PC users. What is a realistic (scoped work) flight sim that we could build on
  here? I was originally thinking without any visual outside the airplane...
  Keep a six pack and throttles... short scenarios to show LOC, and stalls on
  takeoff..." [then scope questions about sound, graphics, browser delivery]
context: >
  User wants to understand the scope of building a browser-based flight
  dynamics sim for airboss. Instruments-only Link-Trainer-style first,
  optional graphics + sound later, optional MSFS bridge for PC users much
  later. This doc captures the research so we don't redo it next session.
---

# Flight Dynamics Sim -- Research

Research log for a browser-based flight dynamics simulator inside airboss. The product itself lives at [docs/vision/products/proficiency/flight-dynamics-sim/PRD.md](../../vision/products/proficiency/flight-dynamics-sim/PRD.md). The staged plan lives at [docs/work/plans/20260422-flight-dynamics-sim-plan.md](../plans/20260422-flight-dynamics-sim-plan.md).

## The training premise

The Link Trainer, Frasca IFR trainers, and Redbird ATDs prove that **a six-pack, throttles, and a physics model is enough** for high-value training in:

- Instrument scan (PP, partial panel, unusual attitudes)
- Stall recognition and recovery (including takeoff stalls, accelerated stalls)
- Loss of control inflight (LOC-I) -- spatial disorientation, spiral recovery
- Weight and balance consequences (aft CG stall behavior, forward CG flare issues)
- Engine failure after takeoff (EFATO) decision-making
- Pitot-static and vacuum failures (where the instruments *lie*)

No outside view is needed for these. In fact, hood/partial-panel training is *better* without one -- illegitimate attitude cues are what we're training against.

A horizon line + low-res terrain becomes valuable for:

- VFR maneuvers (slow flight, steep turns, emergency descents)
- Ground reference (turns about a point, S-turns, rectangular course)
- Pattern work, crosswind landings
- Collision avoidance / see-and-avoid drills

Sound matters across all of the above: engine RPM by ear, stall horn, gear/flap warnings, marker beacons, altitude alerters.

## Flight Dynamics Model (FDM) options

### Option A -- Port JSBSim to WASM ourselves (recommended)

JSBSim is the FDM behind FlightGear, NASA research, and many ArduPilot/PX4 SITL setups. XML aircraft definition; decades of validated aerodynamics. C++, Emscripten-compilable.

**Pros:** highest fidelity. Existing aircraft configs (C172, PA28, SR22, J3 Cub, gliders). Academic/industry track record.

**Cons:** ~2-5 days of Emscripten work; binding surface is non-trivial; LGPL-2.1 (we can dynamically link; keep the WASM blob swappable). We own the port and can audit every line of the binding code.

**Reference implementations to study (do not depend on):**

| Repo | Status | Notes |
| ------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| [JSBSim-Team/jsbsim](https://github.com/JSBSim-Team/jsbsim) | Upstream; active | LGPL-2.1. The source of truth. |
| [csbrandt/JSBSim.js](https://github.com/csbrandt/JSBSim.js) | Stale (v0.0.4, old) | Old Emscripten port. Reference only; likely out of date vs current JSBSim. |
| [0x62/jsbsim-wasm](https://github.com/0x62/jsbsim-wasm) | Active (Feb 2026, v1.2.4-beta.4) | 2 stars, single-author. MIT wrapper + LGPL WASM. Auto-generates TS bindings from `FGFDMExec.h`. Excellent **reference** for our own build. |

**Security posture:** do not take either jsbsim-wasm or JSBSim.js as a npm dep. Read their build scripts, understand the binding generator, write our own in `tools/jsbsim-port/` from upstream JSBSim. Every line of glue code is ours and reviewable. WASM blob is built from pinned upstream JSBSim commit + our bindings, checked into the repo with a hash.

### Option B -- Hand-rolled TypeScript FDM

Single-engine piston in ~500-1000 lines: force and moment equations, Runge-Kutta integrator, lookup tables for CL/CD/Cm vs AoA. Good enough for stall / spiral / takeoff scenarios.

**Pros:** zero supply chain. No C++/Emscripten. Fast to iterate on. Easy to debug (pure TS).

**Cons:** we will rediscover every aerodynamic subtlety the hard way. Realism ceiling is low. Multi-engine, high-AoA post-stall, ground effect, propwash, crosswind ground handling -- all become custom engineering problems we don't want.

**Verdict:** fine for a **throwaway prototype** to validate the rep loop + instrument UI while we build the JSBSim port in parallel. Not the long-term answer.

### Option C -- X-Plane / MSFS bridge

Both sims are desktop-only and require a native bridge (SimConnect for MSFS, UDP for X-Plane). Useful much later as a *grading* overlay for users who fly MSFS/X-Plane: stream their state into our scenario runner, score them, replay. Not a browser sim and not on the critical path.

### Decision

- **Phase 0-2 (scope validation):** hand-rolled TS FDM, single aircraft (C172-ish), good enough for stall + LOC + EFATO + W&B scenarios.
- **Phase 3+ (real product):** JSBSim WASM port, multiple aircraft configs, high-fidelity behavior. Port ourselves; audit every line.
- **Future (post-MVP, PC-only):** MSFS + X-Plane bridges as a separate product.

## Instrument rendering

Pure SVG or Canvas in Svelte. No dependency required. Each instrument reads from a shared `$state` snapshot updated by the FDM worker.

**Six-pack:** airspeed, attitude indicator, altimeter, turn coordinator, heading indicator, VSI.

**Engine/systems:** tachometer, manifold pressure (if complex), fuel (L/R), oil P/T, CHT/EGT, ammeter, vacuum.

**Annunciators:** stall warning horn (audible + visual), gear warning, flap position, pitot heat.

**The "lying instrument" trick is first-class.** The FDM publishes truth state; each instrument has a *fault model* that maps truth -> displayed value. Faults we want to model:

- Pitot blockage (ASI reads wrong, behaviors vary with ice vs water)
- Static blockage (altimeter / VSI / ASI all affected, ASI reads backwards on descent)
- Vacuum failure (AI and HSI drift, slowly and deceptively)
- Alternator failure (everything electrical dies on a timeline as the battery drains)

This is a training differentiator MSFS can't casually do. Build it in from day one.

## Sound

Web Audio API. Two layers:

- **Procedural engine sound** driven by RPM. Reference: [Antonio-R1/engine-sound-generator](https://github.com/Antonio-R1/engine-sound-generator) (MIT, WASM). Good synthesis quality, works in browser. Evaluate but again, ours to reimplement or vendor carefully.
- **Sample-based fallback** -- one C172 runup sample with `playbackRate = rpm / 2300` gets us 80% quality for 1% of the work. Fine for MVP.
- **Discrete cues** -- stall horn, gear warning, flap motor, marker beacons, altitude alerter, autopilot disconnect. All short samples.

Sound is high-learning-value per hour-of-build. Not optional for MVP.

## Graphics (optional)

Order of effort, cheapest first:

1. **Horizon line + sky/ground gradient.** Pure CSS or a single Three.js plane. ~2 hours.
2. **Procedural flat terrain + runway mesh.** Three.js. ~1 day.
3. **Skybox + sun angle + cloud layers.** Three.js. ~1-2 days.
4. **Real terrain.** Cesium. 10-100x complexity + bandwidth. Skip unless VFR nav becomes a product.

User preference: start without graphics. Add the horizon line early as a Phase-3 feature because **VFR maneuvers and LOC demonstration need it to be fair**. Everything beyond horizon is future.

## MSFS / X-Plane bridge (far future)

- MSFS: SimConnect SDK, Windows-only, C/C++. Needs a native bridge process (Tauri sidecar or standalone WebSocket server) that the browser connects to.
- X-Plane: UDP protocol, cross-platform, simpler. Can be driven from a small Node/Bun process.
- Use case: grade real MSFS/X-Plane flights against airboss scenarios (e.g. "fly the ILS 28R here and we'll score your tracking"). **Not a sim-we-built**; it's a scoring/replay overlay.
- Belongs as a separate product, not bundled into the sim MVP.

## Security posture (explicit, because user asked)

- **No npm deps** for FDM, sound synth, or anything executing simulation logic. Read their code, understand it, reimplement or vendor with a pinned hash.
- **WASM blobs** built from pinned upstream source + our glue. Build reproducibly in CI. Check the blob into the repo (not npm) so diffs are visible.
- **Three.js / dev dependencies** (if used for horizon/graphics only) -- acceptable as npm deps because they don't execute simulation logic, but pin versions and audit updates.
- **Engine sound synth** -- procedural WASM synth is tempting but a single pinned sample + playbackRate avoids the supply chain question entirely for MVP.

## What this unblocks

Beyond the obvious "build a sim" payoff, this also unblocks:

- **Rich scenario content** across study, proficiency, and pre-flight surfaces (reusable FDM events).
- **W&B teaching** that actually *shows* the aft-CG stall, not just discusses it.
- **Instrument failure training** that goes beyond flashcards.
- **Replay and debrief** with fine-grained state -- every control input, every decision gate.
- **Spaced-rep scheduling of scenarios**: if you bobble the EFATO, the system queues it again in 3 days.

## Open questions

- Aircraft scope for MVP: just C172, or C172 + PA28 + something taildragger?
- Control input: keyboard/mouse only for MVP, or gamepad from day one? (HID yoke later.)
- Scenario authoring format: JSON? YAML? A small DSL? (Probably follow the existing `libs/bc/study/` scenario pattern.)
- Do we ship the sim as a standalone surface (`apps/sim/`) or as a module inside `apps/study/`? Architecture doc says new surface; I agree, but let's revisit after Phase 0 prototype.
- Post-FIRC-migration: the sim overlaps with `apps/firc/` scenario engine from airboss-firc. Audit what that engine does before building -- we may reuse the tick loop wholesale.

## Sources

- [JSBSim upstream](https://github.com/JSBSim-Team/jsbsim)
- [JSBSim docs](https://jsbsim-team.github.io/jsbsim/)
- [JSBSim.js -- stale Emscripten port](https://github.com/csbrandt/JSBSim.js)
- [0x62/jsbsim-wasm -- modern reference port](https://github.com/0x62/jsbsim-wasm)
- [Antonio-R1 engine sound generator](https://github.com/Antonio-R1/engine-sound-generator)
- [Pomax "Are We Flying" -- JS flight sim writeup](https://pomax.github.io/are-we-flying/)
- [Red Blob Games -- WebAudio motor](https://www.redblobgames.com/x/2147-webaudio-motor/)
