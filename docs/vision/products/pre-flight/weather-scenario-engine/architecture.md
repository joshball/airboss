---
name: Weather Scenario Engine -- architecture
parent: VISION.md
status: vision
captured: 2026-04-30
---

# Weather Scenario Engine -- architecture

The 4-layer × 3-stage architecture, lib decomposition, and rendering decisions for the Weather Scenario Engine.

## Two orthogonal axes

It's important to keep these straight, because conflating them was a near-miss in the design session:

- **Architecture layers** describe what the system *contains*. All four are required from v0.
- **Data-anchoring stages** describe how *realistic* the truth model is. They ship progressively.

A v0 system has all 4 layers at S1. A v1 system has all 4 layers at S2. Etc.

## The four architecture layers

### Layer 1: Truth model

The world. Internally consistent atmospheric state as a function of (location, altitude, time).

State includes:

- Pressure systems (highs, lows, with center coordinates, central pressure, movement vector)
- Fronts (cold, warm, stationary, occluded; with line geometry and movement)
- Air masses (mT, mP, cT, cP, cA with characteristic temp/dewpoint/stability)
- Lapse rates (environmental, dry-adiabatic, moist-adiabatic; conditional instability)
- Terrain interaction (orographic lift, lee-side subsidence, mountain wave patterns, marine layer trapping)
- Diurnal cycle (heating, mixing height, nocturnal inversions, fog formation/dissipation)
- Convection (CAPE, CIN, lifted index, dryline position, outflow boundaries)

The truth model is **parameterized**. A narrative ("classic dryline severe-weather day in May") sets parameter values. The model produces a self-consistent atmospheric state from those parameters.

Validators reject internally inconsistent states (e.g. a TAF that doesn't match the surface pressure pattern, winds aloft that contradict the surface analysis, METAR/TAF disagreement that can't be explained by recent change).

### Layer 2: Products

Text products derived from the truth. Each product is a pure function of the truth at the relevant (location, time):

- METAR / SPECI (per airport, per cycle)
- TAF (per airport, per cycle)
- AIRMET (Sierra/Tango/Zulu) and G-AIRMET
- SIGMET, Convective SIGMET, CWA
- Winds & temps aloft (FB)
- Area Forecast / GFA
- PIREPs (with synthetic reporter callsigns and timestamps)

Each product knows the truth at the time/location it represents. Each product also models the *uncertainty* the real-world author would have had -- a TAF doesn't get to know what the surface obs reports two hours later.

### Layer 3: Charts

Visual products rendered from the truth. Each renders to SVG with a token-based stylesheet:

- Surface analysis (isobars, fronts, pressure centers, station plots)
- Prog charts (12, 24, 48 hour forecasts -- each is the truth model evolved forward)
- Radar mosaic (reflectivity from convection model)
- Satellite (visible + IR from cloud field)
- Icing forecast (FIP / CIP equivalent, gridded)
- Turbulence forecast (GTG equivalent, gridded)
- Freezing level chart

See [Rendering decisions](#rendering-decisions) below.

### Layer 4: Commentary

Authored Socratic walkthroughs and glance-callouts. Each commentary item is generated *from the truth*, with the lesson goal as a parameter:

- **Glance-callout**: a single-sentence cue tied to a product field. "Notice the TEMPO BKN015 between 18-21Z -- that's the load-bearing forecast for arrival."
- **Socratic walkthrough**: a multi-step Q&A that walks the learner through the product. "What does TEMPO mean? When does it apply? Why is BKN015 the threshold? What's your alternate plan if you arrive during the TEMPO window?"
- **Cross-product narration**: ties two or more products together. "Compare chart 1 at T=0 to chart 2 at T=6. What's the same? What's new? Watch this pressure reading drop."

Commentary depth is layered: glance-callouts on first read, Socratic mode on click. Both are authored by the engine because the engine knows the truth.

## The three data-anchoring stages

### S1: Parameterized physics (ships first)

Truth model is hand-coded with parameterized physics. Distributions are reasonable but not calibrated against real climatology.

- Sufficient for course content authoring on its own
- Sufficient for validation that the engine doesn't violate basic physics
- Insufficient for "this looks like a real spring KORD day" -- the recognition value is low

Ships first because it's the smallest viable system that produces all 4 layers.

### S2: Real-world distribution calibration (ships second)

Truth model parameters are sampled from real conditional distributions (region × season × time-of-day × narrative-tag) built from historical archives.

Ingestion pipeline (`libs/wx-data/`) processes:

- NCEI archived METAR / TAF / upper-air data
- AWC archived AIRMETs / SIGMETs / surface analysis
- Iowa State Mesonet bulk archives
- Reanalysis datasets (ERA5, NARR) for spatial/temporal climatology

Calibration distributions are then sampled by the truth model. Output is internally consistent (S1 still applies) AND climatologically realistic (S2 adds).

S2 is when pilots stop saying "this doesn't feel like real weather."

### S3: Replay-with-perturbation (ships third / on demand)

Seed from a real historical day at a real location, modify one variable, let the truth model regenerate downstream products consistently.

- "Take the morning of [some real date], make the cloud bases 1000 ft lower, regenerate"
- "Take this real briefing, add embedded TS to the otherwise-clear afternoon"

Useful for instructor-side scenario authoring against historical templates. Power-user feature, not pilot-facing.

## Lib decomposition

Three libs because they have different consumers and different release cadences:

### `libs/wx-engine/`

Pure functions, types, generators. No DB, no jobs, no I/O beyond reading from `libs/wx-canonical/`. Importable from any app.

```text
libs/wx-engine/
  src/
    truth/                  Layer 1: pressure, fronts, air masses, terrain, diurnal
    products/               Layer 2: metar, taf, airmet, sigmet, fb, pirep, ...
    charts/                 Layer 3: surface-analysis, prog, radar, sat, icing, turb
    commentary/             Layer 4: callout, socratic, narration
    narrative/              Narrative tags → truth parameters
    pack.ts                 Compose all four into a BriefingPack
    validate.ts             Internal-consistency validators
    index.ts                Public API
```

### `libs/wx-data/`

DB-backed, jobs, ingest. Only the engine, the hangar UI, and `scripts/wx/*` care about it.

```text
libs/wx-data/
  src/
    ingest/                 NCEI / AWC / Mesonet / reanalysis ingesters
    schema.ts               Drizzle tables: archived obs, calibration distributions
    calibration/            Build conditional distributions from archives
    query.ts                "Sample a truth parameter set for region × season × narrative"
```

### `libs/wx-canonical/`

The curated event corpus. Code-consumed (validation harness, drill engine), not just human-read.

```text
libs/wx-canonical/
  events/
    radiation-fog-textbook/
    dryline-classic-may/
    lake-effect-buffalo/
    derecho-iowa-2024/
    ... etc
  src/
    registry.ts             Typed event index
    validate.ts             Compare engine output to canonical truth
```

Each event has: a name, a hand-tuned truth-model parameter set, an authored "what this event teaches" lesson framing, and reference real-world artifacts (sample real METARs/TAFs, real chart screenshots) for validation comparison.

## Rendering decisions

### SVG with a token-based stylesheet

Charts render to SVG, not Canvas. Reasons:

- Stylable via tokens (front symbol colors, isobar weights, radar color ramp) -- looks-pro is one stylesheet swap away
- Text-friendly (station model labels, isobar values, chart title metadata)
- Accessible (screen-reader compatible, can be made keyboard-navigable per chart element)
- Inspectable (instructors can hover/click any chart element and the engine knows what it is)
- Lesson-authoring friendly (commentary can target specific SVG elements by id for highlighting)

Canvas would be slightly faster for radar mosaics with many cells, but the trade-offs above dominate.

### Looks-pro from v0, no real terrain

Visual conventions follow real AWC/NWS:

- Front symbols (filled triangles for cold, half-circles for warm, alternating for stationary)
- Iconic blue/red front color palette
- Isobar conventions (4mb spacing, labeled values, dashed for forecast)
- Station model layout (cloud cover circle, wind barb, temp/dewpoint/altimeter at canonical positions)
- NWS radar color ramp (the standard green-yellow-red-purple progression)

We stop short of "indistinguishable from real":

- No real terrain elevation
- No real coastlines beyond a simplified state-outline TopoJSON
- No real station network density (we generate stations as needed for a scenario)

The marginal cost from ugly-correct to looks-pro is small (per-chart-type, one-time). The reuse value (every course inherits it) is high.

## Open architectural questions

These need decisions before promotion to a work package. Captured here so they don't get lost.

- **TopoJSON source for state outlines**: which dataset, what license, what storage policy ([ADR 018](../../../../docs/decisions/018-source-artifact-storage-policy/decision.md))? Likely Natural Earth at low resolution, in `libs/wx-engine/assets/`.
- **Truth-model time evolution**: how is "T=0 vs T=6" handled? Single truth model with a `t` parameter, or N successive truth models? Probably the former, but the integration with prog charts needs design.
- **Validator severity**: when a generated pack fails internal consistency, do we drop it and regenerate, or surface the inconsistency to the author? Drop+regenerate for runtime; surface for authoring. Implementation detail.
- **Commentary authoring**: hand-authored templates per product type, or LLM-generated against the truth? Probably both -- templates as the floor, LLM as enrichment. Decide before building Layer 4.
- **PIREP timing**: PIREPs in the briefing pack must be self-consistent with the truth at *report time* (not current truth, since PIREPs are observations of the past). Engine must track multiple time slices.
