---
name: Canonical events corpus -- research stub
parent: ../VISION.md
status: research stub
captured: 2026-04-30
---

# Canonical events corpus -- research stub

A planning placeholder for the curated set of historical wx events that will serve as `libs/wx-canonical/`. Three purposes (per [VISION.md](../VISION.md)):

1. Compelling content. Real named events have gravity that synthetic situations don't.
2. Validation harness. Engine output for "midwestern dryline severe-weather day in May" gets compared against the canonical day's truth model.
3. Bridge. Hand-tuned truth models sit between pure-synthetic (fast, unanchored) and pure-replay (anchored, rigid).

## Selection criteria

A canonical event qualifies if:

- It has a recognizable name or context (named storm, famous dryline day, textbook fog morning, etc.)
- It exhibits a clear teachable hazard or product behavior (icing, embedded TS, lake-effect, mountain wave, etc.)
- Real archived data exists (METARs, TAFs, charts, radar) for validation
- It's representative of a class of similar events the engine should be able to generate

## Initial target list (placeholder, ~10 events)

Sized for representative coverage across hazards and seasons. Each entry will get its own subdirectory in `libs/wx-canonical/events/` once the engine ships.

- **Textbook radiation fog morning** -- autumn, central plains. Teaches: fog formation/dissipation, METAR sky/vis evolution, the "looks fine at 10 AM" decision.
- **Classic dryline severe-weather day** -- spring, southern plains. Teaches: dryline as a discontinuity, rapid TS development, Convective SIGMET decision.
- **Lake-effect snow event** -- winter, Great Lakes. Teaches: how fetch + lapse rate make narrow bands of intense snow, why the airfield 30 miles away is fine and yours is closed.
- **Named hurricane approach** -- tropical, gulf or east coast. Teaches: TFR creation, evacuation patterns, how forecast cone uncertainty translates to TAF amendments.
- **Derecho event** -- summer, midwest. Teaches: bow echo, outflow, ground-speed gusts, why the SIGMET trails the actual hazard.
- **Mountain wave / rotor day** -- winter, lee of the Rockies. Teaches: wave forecasts, AIRMET Tango interpretation, the chart that "looks fine" but the PIREPs scream.
- **Marine layer / coastal stratus morning** -- summer, west coast. Teaches: marine layer mechanics, predictable burnoff, IFR-to-VFR transition planning.
- **Freezing rain event** -- winter, mid-Atlantic. Teaches: warm nose aloft, supercooled liquid water, why a warm-layer-over-cold-surface is the worst icing scenario.
- **Convective squall line** -- spring or summer, midwest. Teaches: line vs cell decision making, gap penetration, the "wait an hour" call.
- **High-pressure CAVU day** -- any season, any region. The "boring" baseline. Teaches: what a clean briefing looks like, what to verify when nothing is alarming.

## Research tasks (deferred until engine work begins)

For each event, when the engine is being built:

- Pull historical artifacts from NCEI / AWC / Iowa State Mesonet
- Identify the truth-model parameters that capture the event
- Hand-tune the truth model to reproduce the event's signature products
- Author the lesson framing: what does this event teach, what should the learner notice
- Select the validation comparison: which real artifacts (METARs at specific times, the AWC surface analysis, the radar mosaic at peak) are the ground truth the engine output must match

## Status

Stub. Real research and authoring deferred until the Weather Scenario Engine is greenlit and `libs/wx-canonical/` exists.
