---
title: Sim Vision
product: sim
type: vision
status: current
date: 2026-04-26
supersedes: ../../.archive/products/sim/VISION.md
---

# Sim Vision

Browser-native, instruments-first flight simulator for short training scenarios. Hand-rolled FDM. Replayable. Debriefable. Spaced-rep integrated.

## What it is

`apps/sim/` runs the airplane. A real flight dynamics model drives the six-pack, engine gauges, annunciator strip, and -- when scenarios call for it -- gauges that *lie*. Scenarios run 30 seconds to 3 minutes: takeoff stalls, EFATO, vacuum failures, partial panel, unusual attitudes, VMC-into-IMC. Each run records a tick-by-tick truth-vs-display tape so the debrief can show *what really happened* alongside *what the panel showed*.

This is **not** the FIRC course player from the pre-pivot architecture. That product is archived to [.archive/products/sim/VISION.md](../../.archive/products/sim/VISION.md) and may someday return as `apps/firc/`. The sim that actually runs in airboss today is a flight-dynamics trainer.

## Who it's for

- **Pilots wanting rehearsable practice** on emergencies and loss-of-control scenarios that are unsafe or impractical to fly often (stalls at low altitude, instrument failures, unusual attitudes).
- **Returning pilots** rebuilding instrument scan and emergency reflexes.
- **Students** between flights -- "chair flying" with feedback.
- **CFIs** demonstrating an emergency to a student before flying it.

## What makes it different

- **Instruments can lie.** A vacuum failure tilts the AI silently while gauges still read green. A blocked static port freezes the altimeter and reverses the airspeed trend. Truth and display are tracked separately tick-by-tick.
- **30-second to 3-minute scenarios.** Designed for *practice*, not immersion. You can run an EFATO in two minutes and rerun it five times in fifteen.
- **Truth tape replay.** The debrief is scrubbable. Pause at any tick, see truth side-by-side with what the pilot saw.
- **Hand-rolled FDM.** Not flight-sim quality. Aerodynamic-model quality. The lift curve, drag polar, thrust map, and ground effect are tuned per aircraft profile, not licensed from a sim vendor.
- **Spaced-rep integrated.** Recent sim weakness lifts the study cards / reps tied to the knowledge each scenario exercises. See [docs/products/study/STUDY_BC_SIM_BRIDGE.md](../study/STUDY_BC_SIM_BRIDGE.md).

## Core loop

```text
Pre-brief    →  Aircraft, weight, weather, what to watch for
Fly          →  30 sec to 3 min scenario; control inputs; outcome
Debrief      →  Scrubbable tape; truth vs display; what you saw; what you missed
Replay       →  Same conditions or new conditions; build the reflex
```

## Aircraft today

- **C172** -- canonical training aircraft. Default for most scenarios.
- **PA-28** -- second profile (added during Phase 4-6).

## Scenarios shipped (selected)

EFATO, vacuum failure, pitot/static failure, partial panel, unusual attitudes, aft-CG stall, nose-low recovery, VMC-into-IMC, departure stall, base-to-final stall.

## Surface architecture

`apps/sim/` follows [ADR 015 -- Sim surface loose coupling](../../decisions/015-sim-surface-loose-coupling.md). Components are pure-prop and surface-agnostic; pages compose components and own the FDM-worker host. Three pages exist today (cockpit, horizon, dual). Adding a fourth surface (e.g. `/avionics`) is additive: one route constant, one nav branch, one page. No edits to existing pages.

## What sim is NOT

- **Not Microsoft Flight Simulator.** No 3D scenery (yet -- Phase 7 horizon view is minimal). No AI traffic. No ATC.
- **Not a logbook.** Runs are recorded for debrief and study-pressure feedback, not for FAA logging.
- **Not a hardware trainer replacement.** A Frasca / Redbird simulates a *cockpit*. Sim simulates a *training scenario*. Different use case.
- **Not a course.** Scenarios stand alone. They're not chapters in a curriculum.

## References

- [PRD.md](PRD.md) -- shipped + queued features
- [ROADMAP.md](ROADMAP.md) -- per-phase roadmap
- [docs/work-packages/flight-dynamics-sim/spec.md](../../work-packages/flight-dynamics-sim/spec.md) -- canonical spec
- [ADR 015 -- Sim surface loose coupling](../../decisions/015-sim-surface-loose-coupling.md)
- [docs/products/study/STUDY_BC_SIM_BRIDGE.md](../study/STUDY_BC_SIM_BRIDGE.md) -- sim weakness → study scheduler bridge
- [.archive/products/sim/VISION.md](../../.archive/products/sim/VISION.md) -- prior FIRC-era sim vision
