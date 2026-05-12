---
title: 'Out of Scope: Flight Dynamics Sim'
product: sim
feature: flight-dynamics-sim
type: out-of-scope
status: unread
---

# Out of Scope: Flight Dynamics Sim

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                    | Status       | Trigger to revisit                                                              |
| ------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| Weather model beyond per-scenario static wind           | Deferred     | When a scenario pedagogically requires turbulence, gusts, IMC transition, icing |
| Multi-engine / complex / retract / taildragger aircraft | Deferred     | When MVP's C172 + PA28 fleet is proven and a course needs a different airframe  |
| MSFS / X-Plane grading bridges                          | Follow-on WP | When users ask to fly the same scenarios in a desktop sim and grade in airboss  |
| Multiplayer / async debrief (watch someone else's tape) | Deferred     | When community / instructor-debrief features become a product goal              |
| HID yoke / rudder pedals / throttle quadrant            | Deferred     | When a user reports kbd+mouse can't teach a specific maneuver well enough       |
| Real terrain / moving map / navigation database         | Rejected     | Never -- see detail below                                                       |
| FAA-approved ATD status                                 | Rejected     | Never -- see detail below                                                       |
| Authoring UI for scenarios                              | Follow-on WP | When the hangar surface picks up scenario authoring                             |
| Aircraft configs beyond C172 + PA28 in Phase 6          | Deferred     | When a course requires SR22 / J3 Cub / glider / etc.                            |
| Procedural WASM engine sound synth                      | Rejected     | Never -- see detail below                                                       |
| Configurable keybindings UI                             | Deferred     | After Phase 4 ships; revisit if users ask                                       |
| InfoTip / PageHelp on the cockpit route                 | Deferred     | After Phase 4 ships; use the help system                                        |

## Weather model beyond per-scenario static wind

Status: Deferred

What was deferred / rejected / postponed:
The weather model stays at a per-scenario static wind vector
(`ScenarioWind`). Turbulence, gusts, IMC visual transition, and icing
are not modelled in the FDM or display layer.

Why:
MVP scope discipline. The first eight to ten scenarios teach stall
recognition, EFATO decisions, vacuum-failure recognition, partial-panel
scan, and unusual-attitude recovery. None of those teach value-add from
turbulence or icing modelling. Per-scenario static wind covers VMC-into-IMC's
wind component; the IMC visual cue happens via the Phase 7 horizon (off by
default for instrument-only scenarios). Tasks.md item P.2 ("OAT + density
altitude readouts") is gated on this same weather-model decision and rides
the same trigger.

Trigger to revisit:
When authoring a scenario whose pedagogy genuinely depends on a dynamic
weather event (turbulence-induced stall, ice accumulation drill, gust-front
crosswind on landing). Surface the scenario before building the model; the
scope of "what kind of weather" is set by the scenario.

Implementation pattern when triggered:
Mirror the fault-model split at `libs/bc/sim/src/faults/` -- a pure
`TruthState -> DisplayState` transform layer keyed off a `WeatherEvent`
type with discrete kinds (turbulence, icing, gust). The FDM stays
weather-naive; the wrapper applies forces. Add `weatherEvents` to
`ScenarioDefinition` mirroring the `faults` field shape.

References:

- [spec.md](./spec.md) "Out of scope" item: "Weather model beyond per-scenario wind"
- [tasks.md](./tasks.md) standing polish item P.2 (OAT + density altitude)
- [design.md](./design.md) wind / weather data shapes

## Multi-engine / complex / retract / taildragger aircraft

Status: Deferred

What was deferred / rejected / postponed:
The aircraft fleet for MVP is C172 (Phase 0.5 shipped) and PA28 (Phase 6).
No multi-engine, no complex (constant-speed prop + retract gear), no
taildragger, no high-performance.

Why:
MVP-scope decision #1 in `spec.md`: "Cessna 172 only. PA28 lands in Phase 6.
Taildragger / complex / twin are post-MVP." JSBSim handles all these airframes
correctly at the FDM level, so the deferral is about UI scope (gear handle,
prop control, fuel selector affordances, second-engine cluster) and
scenario authoring, not FDM capability.

Trigger to revisit:
When a course needs a different airframe class. Likely first triggers:
commercial-pilot training (complex / high-performance endorsements),
glider rating, taildragger transition curriculum.

Implementation pattern when triggered:
Mirror the C172 -> PA28 pattern from Phase 6. New aircraft config at
`libs/bc/sim/src/fdm/<aircraft>.ts`, pinned upstream JSBSim aircraft
def re-bound through the existing binding layer, ID added to
`SIM_AIRCRAFT_IDS`. UI additions (gear handle, prop control, second
fuel tank selector) go in the cockpit route's control strip and follow
the existing instrument component pattern.

References:

- [spec.md](./spec.md) Decision #1 (aircraft scope for MVP)
- [spec.md](./spec.md) Phase 6 section (PA28 config pattern)

## MSFS / X-Plane grading bridges

Status: Follow-on WP

What was deferred / rejected / postponed:
A bridge from MSFS / X-Plane (SimConnect / UDP) that feeds truth state
into airboss's grading + debrief pipeline, so a user can fly a scenario
in a desktop sim and get scored / debriefed in the browser.

Why:
Out of scope for the MVP -- this is a separate product (different
distribution, different integration surface, different supply chain
posture). The replay tape format is the right abstraction for that
future bridge: any truth-state stream that fits `ReplayFrame` plays
back through the same debrief UI.

Trigger to revisit:
When the user signal "I already fly MSFS / X-Plane and want airboss
grading on top" appears in user research, OR when a course needs higher
visual fidelity than the Phase 7 horizon can provide.

Implementation pattern when triggered:
Open a new WP (`flight-dynamics-sim-desktop-bridge` or similar). The
contract is producing a `ReplayTape` (compatible with
`libs/bc/sim/src/replay/types.ts`) from a desktop sim's telemetry. The
debrief route and rep-scheduler integration already shipped in this WP
take it from there with no changes.

References:

- [spec.md](./spec.md) "Out of scope" item: "MSFS / X-Plane grading bridges"
- [design.md](./design.md) replay-tape data model

## Multiplayer / async debrief

Status: Deferred

What was deferred / rejected / postponed:
Watching another user's recorded tape, side-by-side debrief comparisons
between two users on the same scenario, real-time multi-user flying.

Why:
MVP focuses on solo rehearsal-loop value (fly, debrief, rep-schedule,
re-fly). Multiplayer adds auth-scoped sharing, presence, and a new debrief
UI mode. None of those advance the MVP success criteria.

Trigger to revisit:
When a community / instructor-debrief feature becomes a product goal
(e.g., "CFI watches a student's tape and annotates it"), or when sharing
tapes for forum discussion becomes a user-requested behavior.

Implementation pattern when triggered:
Replay tape is already serialisable + scenario-hashed. Sharing surface
mirrors any future content-sharing system (auth scoping, signed-blob
storage, recipient-list UX). Debrief route adds an "imported tape" mode
that runs the same scrubber against someone else's tape.

References:

- [spec.md](./spec.md) "Out of scope" item: "Multiplayer / async debrief"
- [design.md](./design.md) replay-tape shape

## HID yoke / rudder pedals / throttle quadrant

Status: Deferred

What was deferred / rejected / postponed:
External flight controls via WebHID / Gamepad API. MVP is keyboard +
mouse only (decision #3 in `spec.md`).

Why:
Decision #3 in `spec.md`: "Keyboard + mouse only. Gamepad + HID yoke
deferred post-MVP." The Phase 0.8 spring-centered stick + hold-ramp
throttle already adapts kbd+mouse to teach the maneuvers in the MVP
scenario set. HID adds calibration UX, per-device profiles, and a
mapping surface that aren't justified until kbd+mouse fails for a
specific scenario.

Trigger to revisit:
A specific scenario where user-zero or another pilot reports that
kbd+mouse can't teach the discrimination the scenario is trying to
build (e.g., fine rudder discipline in crosswind landing,
constant-speed-prop coordination).

Implementation pattern when triggered:
Input layer at `apps/sim/src/lib/input.ts` already abstracts axes; add
a `WebHIDInputSource` and `GamepadInputSource` behind the same
interface. Calibration UX in a new dev route, then promoted to settings.

References:

- [spec.md](./spec.md) Decision #3 (control input scope)

## Real terrain / moving map / navigation database

Status: Rejected

What was deferred / rejected / postponed:
Real terrain elevation, real airport / VOR / waypoint database, moving
map display.

Why:
The sim is a short-scenario rehearsal tool, not a flight simulator in
the MSFS sense. Scenarios carry their own world state (start condition,
wind, faults, ideal path). Real terrain / nav data would invert that:
scenarios would reference world coordinates, terrain ridges, real
airport elevations -- which is a different product entirely (MSFS /
X-Plane / FlightGear). The "world is the scenario" framing is
load-bearing for short-format rehearsal value.

A re-decision would require evidence that scenario-local world state
fundamentally can't teach a load-bearing maneuver (canyon work, real
go-around at a real airport, etc.). MSFS / X-Plane bridge (see above
follow-on WP) is the right answer there, not building a nav database
inside airboss.

References:

- [spec.md](./spec.md) "Out of scope" item: "Real terrain / moving map / navigation database"

## FAA-approved ATD status

Status: Rejected

What was deferred / rejected / postponed:
Pursuit of FAA approval as an Aviation Training Device (ATD / BATD /
AATD). Logged sim time, instructor sign-off in a logbook, the whole
regulatory artifact.

Why:
The sim is a training tool, not a logged-time device. The regulatory
burden (FAA submission, periodic re-evaluation, fixed hardware
requirements at some certification levels) directly contradicts the
"browser-native, distribution-free" thesis. Per-platform certified
hardware sims (Frasca / Redbird / CPT) already occupy that space and
cost what they cost.

A re-decision would require a business case where logged time is the
product value, not a side benefit -- and at that point the product is a
different product, sold and certified differently.

References:

- [spec.md](./spec.md) "Out of scope" item: "FAA-approved ATD status"

## Authoring UI for scenarios

Status: Follow-on WP

What was deferred / rejected / postponed:
A UI for authoring scenarios. MVP authors edit TS modules in
`libs/bc/sim/src/scenarios/*.ts` directly.

Why:
Decision #7 in `spec.md`: "TypeScript modules. Authors write typed
scenario defs." This gives type safety, IDE support, and refactor ease
during the MVP authoring burst (8-10 scenarios). A visual authoring UI
adds non-trivial scope and is the hangar surface's responsibility.

Trigger to revisit:
When the hangar surface picks up scenario authoring (post-MVP, after
the sim engine + scenario format is stable and a non-developer needs to
author scenarios).

Implementation pattern when triggered:
Open a new WP under `apps/hangar/` / `docs/work-packages/`. The
existing `ScenarioDefinition` type is the schema; the authoring UI is
a form + preview surface on top of it. Reference the hangar source-ingest
pattern (already shipped) for the schema-validated form pattern.

References:

- [spec.md](./spec.md) Decision #7 (scenario format)
- [spec.md](./spec.md) "Out of scope" item: "Authoring UI for scenarios"

## Aircraft configs beyond C172 + PA28 in Phase 6

Status: Deferred

What was deferred / rejected / postponed:
SR22, J3 Cub, gliders, anything that isn't C172 (Phase 0.5) or PA28
(Phase 6).

Why:
Phase 6 caps the MVP fleet at two aircraft. Each new airframe is a
config file, an aircraft picker entry, and at least one scenario that
exercises its distinctive handling. Without a course needing the new
airframe, the work doesn't earn its scope.

Trigger to revisit:
When a course or scenario set requires the new airframe (commercial
endorsements, glider rating, taildragger transition). Pair with the
multi-engine / complex deferral above.

Implementation pattern when triggered:
Mirror the C172 -> PA28 pattern. New file at `libs/bc/sim/src/fdm/<aircraft>.ts`,
JSBSim upstream aircraft def pinned + re-bound, ID added to `SIM_AIRCRAFT_IDS`,
scenarios pin the aircraft via `ScenarioDefinition.aircraft`.

References:

- [spec.md](./spec.md) "Out of scope" item: "Post-MVP aircraft configs inside Phase 6 scope"
- [spec.md](./spec.md) Phase 6 section

## Procedural WASM engine sound synth

Status: Rejected

What was deferred / rejected / postponed:
A more sophisticated procedural engine sound model (Antonio-R1-style
WASM synth, full mechanical modelling, valve-train harmonics, etc.).

Why:
The Phase 0.6 two-oscillator additive synth plus band-passed noise
already passes the "sounds like a piston single" bar in user-zero
testing. Sound is a teaching aid (RPM cues, stall horn, gear warning),
not a product-defining feature. A procedural WASM synth adds a build
dependency, a worker, and significant audio complexity for marginal
pedagogy gain.

A re-decision would require evidence that engine sound fidelity is
load-bearing for a teaching outcome the current synth misses (e.g.,
detonation cue, induction-icing pitch drop, mag-drop check feel).

References:

- [spec.md](./spec.md) "Out of scope" item: "Engine sound upgrade to a procedural WASM synth"
- [spec.md](./spec.md) Phase 0.6 prior art section

## Configurable keybindings UI

Status: Deferred

What was deferred / rejected / postponed:
A settings UI for rebinding keyboard controls. MVP keybindings are
fixed and surfaced in the always-visible cheatsheet + keybindings help.

Why:
Tasks.md polish item P.3: "Deferred from Phase 0.6; revisit after Phase 4."
The cheatsheet already accommodates user-zero's hands and the W/S
stick-forward swap in Phase 0.6 closed the only ergonomic complaint to
date.

Trigger to revisit:
After Phase 4 ships and a user (Joshua or another tester) reports a
specific mapping that's hard to learn or fights muscle memory from
another sim.

Implementation pattern when triggered:
New settings page under `apps/sim/src/routes/settings/`. Persistence via
`SIM_STORAGE_KEYS` mirrors the existing mute toggle pattern. Bindings
list rendered from a constant in `libs/constants/` so the cheatsheet
re-renders from the same source.

References:

- [tasks.md](./tasks.md) standing polish item P.3

## InfoTip / PageHelp on the cockpit route

Status: Deferred

What was deferred / rejected / postponed:
Adding InfoTip / PageHelp surfaces on the cockpit route to explain
gauges, control strip, V-speeds sidebar.

Why:
Tasks.md polish item P.4: "Use the help system after Phase 4." The
always-visible keyboard cheatsheet (shipped Phase 0.6) covers the
"what does this key do" gap. Per-gauge help waits for Phase 4 because
the gauge set finalises only at Phase 3.

Trigger to revisit:
After Phase 4 ships and the gauge set is stable. Surface help entries
on instruments that user-zero or other pilots ask about during scenario
debriefs.

Implementation pattern when triggered:
Use the existing `libs/help/` PageHelp drawer pattern. Register cockpit
help IDs in the help-ids manifest. Mirror the study surface's per-route
help registration.

References:

- [tasks.md](./tasks.md) standing polish item P.4
- [libs/help/](../../../libs/help/) PageHelp drawer subsystem
