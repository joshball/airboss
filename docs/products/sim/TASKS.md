# Sim Tasks

Product backlog for the flight dynamics sim (`apps/sim/`). This is the **post-pivot** sim -- a browser C172 flight simulator with instrument panel, FDM worker, scenarios, debrief, and sound. Not the pre-pivot FIRC course runner (archived at [.archive/products/sim/TASKS-pre-pivot.md](../../.archive/products/sim/TASKS-pre-pivot.md)).

Phase plan of record: [docs/work/plans/20260422-flight-dynamics-sim-plan.md](../../work/plans/20260422-flight-dynamics-sim-plan.md). PRD: [docs/vision/products/proficiency/flight-dynamics-sim/PRD.md](../../vision/products/proficiency/flight-dynamics-sim/PRD.md).

## Shipped

| Phase    | Work                                          | PRs                                |
| -------- | --------------------------------------------- | ---------------------------------- |
| 0        | Feasibility prototype (throwaway)             | (pre-history)                      |
| 0.5      | Expanded prototype -- full six-pack + tach    | (pre-history, ~2026-04-22)         |
| 0.6      | Cockpit polish -- engine sound, layout, icons | (pre-history, ~2026-04-22)         |
| 0.7      | Session 2026-04-24 polish                     | #116, #118, #120, #123, #124, #125 |
| 0.8      | Spring-centered stick + hold-ramp throttle    | #126                               |
| 5.A      | Warning cue library + a11y captions           | #136                               |
| 1        | Phase 1 work package (spec + design + tasks)  | #137                               |
| 3.B1     | Fault-model interface + dev gallery rig       | #140                               |
| 4.B3     | Scenario format extensions + replay tape      | #141                               |
| 3.B5.alt | Static-block altimeter freeze                 | #142                               |

## Active backlog

### Phase 1 -- Work package

- [x] Spec, design, user-stories, tasks, test-plan authored (#137)
- [ ] User sign-off

### Phase 2 -- FDM port (JSBSim)

Replace the hand-rolled FDM with JSBSim compiled to WASM, running in the worker.

- [ ] `tools/jsbsim-port/` with pinned upstream submodule + Emscripten toolchain
- [ ] Reproducible CI build -> `libs/sim-fdm/jsbsim.wasm` + TS glue
- [ ] Worker wrapper in `libs/engine/` (set input / advance N ticks / get output)
- [ ] Integration test: C172 1G straight-and-level trim matches desktop JSBSim reference
- [ ] Deterministic replay test: same input stream + initial state -> identical trajectory

### Phase 3 -- Instrument panel + fault model

Full panel, with truth-vs-display separation so instrument faults are first-class.

- [x] `TruthState -> DisplayState` transform layer (#140)
- [x] Storybook gallery page rig at `/_dev/instruments` (#140)
- [ ] Per-instrument fault rendering (B5 fan-out):
  - [x] B5.alt -- static block freezes altimeter (#142)
  - [ ] B5.asi -- pitot block (climb -> reads like altimeter); static block (descent -> reverses)
  - [ ] B5.ai -- vacuum drift; gyro tumble
  - [ ] B5.hi -- vacuum drift; gyro tumble; alternator (electric variant gracefully degrades)
  - [ ] B5.tc -- alternator failure (electric instrument fades with bus volts)
  - [ ] B5.vsi -- static block (zero VSI)
- [ ] B6 -- Engine cluster: oil pressure, oil temp, fuel quantity L+R, ammeter, vacuum
- [ ] B6 -- Annunciators: gear, flap motor, alternator, low voltage, low fuel
- [ ] B6 -- Accessibility: per-instrument `aria-label` + 1 Hz live region narration
- [ ] B6 -- Gallery extended to cover every gauge in every fault state
- [ ] B7 -- Cockpit reads `DisplayState` end-to-end (after every B5 lands)

### Phase 4 -- Scenario engine + debrief

Scenarios runnable end-to-end with scrubbable replay.

- [ ] Scenario format (JSON/YAML): initial conditions, scripted events (time + state triggers), success/failure criteria
- [ ] Tick orchestrator driving FDM + fault model + scenario script
- [ ] Input capture with timestamps
- [ ] Debrief page: timeline scrubber, truth-vs-display dual display, input tape, ideal-path comparison where authored
- [ ] Wire into study spaced-rep scheduler so weak scenarios re-queue
- [ ] Three seed scenarios: departure stall, EFATO, vacuum failure

### Phase 5 -- Sound (remaining)

Engine sound shipped in 0.6 as a procedural two-osc + band-passed noise synth. Warning cue library shipped in #136.

- [x] Stall horn (#136 carry-through)
- [x] Gear warning (#136)
- [x] Flap motor (#136)
- [x] Marker beacons (cue plumbing #136; trigger pending Phase 4 navaid work)
- [x] Altitude alert (cue plumbing #136; trigger pending Phase 4 scripted altitudes)
- [x] AP disconnect (cue plumbing #136; trigger pending future AP model)
- [x] Mute + volume controls (#136 extends the existing mute toggle to every cue)
- [x] Mobile gesture-to-start (#136 inherits existing pattern)
- [x] Visible captions for every audio cue (#136 adds `<AudioCaptions>` `aria-live` panel)
- [ ] **Engine sound quality upgrade** -- the current procedural synth sounds like a 1980s arcade. Replace with sample-based playback (single C172 startup/idle/cruise/shutdown loop, playback-rate scaled by RPM) or upgraded multi-oscillator additive with formant filters and exhaust resonance. Must keep current mute / gesture-start / scenario-stop lifecycle and `RAMP_TAU_SECONDS` smoothing.

### Phase 6 -- Second aircraft + remaining MVP scenarios

- [ ] PA28 aircraft config (mass, aero coefficients, engine model)
- [ ] Aircraft picker per scenario (each scenario pins an aircraft)
- [ ] Aft-CG slow flight scenario
- [ ] Unusual attitudes scenario
- [ ] Partial panel scenario
- [ ] VMC-into-IMC scenario

### Phase 7 -- Horizon + low-res outside view (optional)

- [ ] Three.js horizon + flat terrain + runway mesh + sky/sun
- [ ] Driven by FDM pitch/roll/heading/altitude
- [ ] Toggleable per scenario (instrument-only scenarios keep it off)
- [ ] One VFR maneuver scenario that actually needs the view (steep turns or ground reference)

## Standing polish backlog (smaller items found during user-zero flying)

These are bugs and quality-of-life items that surface between phases. Not gated on any formal sign-off; fix as found.

- [ ] Engine cluster gauges next to the tach (Phase 3 scope; stub for now)
- [ ] OAT + density altitude readouts (needs non-ISA weather model first)
- [ ] Configurable keybindings (deferred from Phase 0.6)
- [ ] InfoTip / PageHelp for the cockpit route

## Deferred (post-MVP)

Captured from the plan doc for visibility. Not active backlog.

- Weather model (winds, gusts, turbulence, IMC transitions)
- HID yoke / throttle quadrant support
- Taildragger / complex / twin aircraft
- MSFS + X-Plane grading bridges (separate product)
- Multiplayer / async debrief

## Relationship to other backlogs

- **Formal sequencing** per [NOW.md](../../work/NOW.md) and the plan doc: FIRC migration (`apps/firc/`) ships first, then Avionics Trainer MVP, then this sim MVP. User may choose to run the sim sooner; that decision overrides the plan ordering.
- **FIRC migration impact:** when `apps/firc/` lands, the airboss-firc scenario/tick engine may cover much of Phase 4. Audit before building the scenario engine from scratch.

## Notes

- Engine is currently the hand-rolled TypeScript FDM in `libs/bc/sim/src/fdm/` -- not JSBSim yet.
- BC tests: `cd libs/bc/sim && bun test` (61 tests as of 2026-04-24).
- Ghost-reversion hazard: working in worktrees and merging via `git update-ref` leaves the parent tree out of sync. Always `git status` the parent before committing anything there.
