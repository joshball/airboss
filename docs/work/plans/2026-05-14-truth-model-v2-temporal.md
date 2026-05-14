---
title: TruthModel v2 — temporal weather scenarios
date: 2026-05-14
status: draft — design only, not implementing yet
owner: jball
related:
  - 2026-05-14-metar-taf-coverage-catalog.md
  - 2026-05-14-wx-drill-and-practice.md
  - docs/work-packages/wx-engine/
  - libs/wx-engine/src/truth/types.ts
---

# TruthModel v2 — temporal scenarios

## Goal

Let scenarios describe **how the weather evolves over time** so the wx-engine
can synthesize:

- Hourly METAR sequences at each station, showing a front arriving and passing
- TAFs issued at the start of the period that turn out to be partially wrong
  by the end (so we can write "TAF-vs-actuals" drills)
- PIREPs filed at specific times as conditions encounter aircraft
- AIRMETs/SIGMETs that issue, extend, and cancel as hazards build and decay
- Charts/maps for any timestamp inside the scenario window

User scenario that motivated this plan:

> A pilot is under pressure to get to a destination, sees a front moving at a
> reported speed, that then turns out to be increasing and produces storms ahead
> of the front. We want to specify the wx over time — describe the situation
> hour by hour (or 15 min) — and have the engine produce all initial and future
> METARs and TAFs across stations, plus charts and maps consistent with that
> evolution.

## Current shape (v1)

[`libs/wx-engine/src/truth/types.ts`](../../../libs/wx-engine/src/truth/types.ts)
defines `TruthModel` as a **single-snapshot** structure:

- `validAt: ISO8601` — one timestamp
- `stations: { ICAO: { lon, lat, elevationFt } }` — positional only
- `synoptic.fronts: { kind, points, intensity }[]` — static polylines
- `airMasses[]` — static polygons with surface wind/temp/dew/cloud
- `convection.cells[]` — static cell positions
- `convection.frontalBand` — static precipitation band
- `hazardZones[]` — static IFR / mountain-obscuration / etc. polygons

Every derivation function (`deriveMetar`, `deriveTaf`, etc.) is **pure over the
snapshot** and takes an optional observation-time override but does not evolve
the truth model itself. The observation time only changes the DDHHMMZ stamp in
the output, not the underlying weather.

## v2 shape

Two minimal extensions, neither destructive to v1 callers.

### Shape A — `evolution` block (the additive path)

Add a sibling `evolution` block alongside the v1 snapshot fields. v1 callers
ignore it; v2-aware derivations consult it.

```typescript
interface TruthModel {
  // v1 fields unchanged
  validAt: ISO8601;
  stations: Record<string, Station>;
  synoptic: Synoptic;
  airMasses: AirMass[];
  convection: Convection;
  hazardZones: HazardZone[];

  // NEW in v2 (optional)
  evolution?: TemporalEvolution;
}

interface TemporalEvolution {
  /** Start of the scenario window. */
  start: ISO8601;
  /** End of the scenario window. */
  end: ISO8601;
  /** Native step size for derivation; ≥ 5 min, default 60. */
  stepMinutes: number;

  /** Static analysis at `start`; evolution describes how it changes. */
  fronts: TemporalFront[];
  cells: TemporalCell[];
  airMassMotion: AirMassMotion[];
  hazardLifecycle: HazardLifecycle[];
}

interface TemporalFront {
  id: string;
  /** Initial points at `start`. */
  pointsAtStart: [number, number][];
  /** Translation vector (true heading + speed). May vary over time. */
  motion:
    | { kind: 'constant'; bearingDeg: number; speedKt: number }
    | { kind: 'piecewise'; segments: { until: ISO8601; bearingDeg: number; speedKt: number }[] };
  /** Intensity may evolve. Each entry overrides from `at` forward. */
  intensitySchedule?: { at: ISO8601; intensity: 'weak' | 'moderate' | 'strong' }[];
  /** Convection ahead of the front (gust-front signature). */
  prefrontalConvection?: {
    /** Distance ahead of the boundary (nm). */
    leadDistanceNm: number;
    /** When pre-frontal convection becomes active. */
    onsetAt: ISO8601;
    /** Cell shapes spawned ahead of the front. */
    cellTemplate: CellTemplate;
  };
}

interface TemporalCell {
  id: string;
  /** Cell genesis location. */
  initialLon: number;
  initialLat: number;
  genesisAt: ISO8601;
  dissipatesAt: ISO8601;
  motion: { bearingDeg: number; speedKt: number };
  /** Intensity curve over the cell lifetime. */
  intensityCurve: 'building' | 'mature' | 'decaying' | InlineIntensityCurve;
  /** Reach (radius) grows + shrinks over life. */
  radiusKmCurve?: 'linear-grow-shrink' | { peak: number; peakAt: ISO8601 };
}

interface AirMassMotion {
  airMassId: string;
  /** A polygon translates with this motion vector. */
  motion: { bearingDeg: number; speedKt: number };
  /** Wind/temp can also drift over time. */
  surfaceWindShift?: { perHour: { dirDeg: number; speedKt: number } };
  temperatureDriftCPerHour?: number;
}

interface HazardLifecycle {
  hazardZoneId: string;
  /** When the hazard first appears. */
  onsetAt: ISO8601;
  /** When it dissipates. */
  endAt: ISO8601;
  /** Severity changes over time. */
  severitySchedule?: { at: ISO8601; severity: 'light' | 'moderate' | 'severe' }[];
}
```

### Shape B — `sampleAt(t)` helper

A new pure helper in `libs/wx-engine/src/truth/time.ts`:

```typescript
/**
 * Given a v2 TruthModel and a timestamp inside [start, end], return a v1
 * snapshot representing the world at that moment. Existing derivations
 * (deriveMetar, deriveTaf, etc.) call this first and then run unchanged.
 */
export function sampleTruthAt(truth: TruthModel, t: ISO8601): TruthModel /* v1 shape */;
```

`sampleTruthAt` applies the evolution rules:

- Translates each `TemporalFront`'s `pointsAtStart` by `motion × elapsedTime`
- Activates `prefrontalConvection` cells at `onsetAt`
- Moves each `TemporalCell` by its motion, scales its radius by its curve
- Translates each air-mass polygon and shifts its wind/temp by the drift rate
- Activates/deactivates hazard zones per their lifecycle
- Returns a fresh v1 snapshot with `validAt = t`

The crucial property: **every existing derivation function works unchanged**.
The temporal extension is upstream of derivation; downstream is identical.

### Derivation surface — what changes

Pure additions, no breaking changes:

```typescript
// Existing: still works on snapshot truth models
deriveMetar(truth, station, observationTime?) -> DerivedMetar

// NEW: convenience that samples + derives in one call
deriveMetarAt(truth, station, t) -> DerivedMetar
  // === deriveMetar(sampleTruthAt(truth, t), station, t)

// NEW: sequence helpers
deriveMetarSequence(truth, station, { stepMinutes? }) -> DerivedMetar[]
deriveTafSequence(truth, station, { issueTimes }) -> DerivedTaf[]
deriveAirmetTimeline(truth) -> { advisory: AirmetAdvisory; events: AirmetEvent[] }[]
```

## Scenario authoring with v2

A scenario file gets richer but stays the same shape.

```typescript
// libs/wx-engine/src/truth/scenarios/frontal-pressure-march.ts
export const frontalPressureMarch: ScenarioDef = {
  slug: 'frontal-pressure-march',
  label: 'Frontal cold front under pilot time pressure',
  validAt: '2026-03-14T12:00:00Z',
  stations: { /* KICT, KMHK, KTOP, KJLN, KFOE, KDDC */ },
  synoptic: { fronts: [coldFrontInitial] },
  airMasses: [warmSector, coldSector],
  convection: { cells: [], frontalBand: null },
  hazardZones: [],

  // NEW
  evolution: {
    start: '2026-03-14T12:00:00Z',
    end: '2026-03-14T20:00:00Z',
    stepMinutes: 60,
    fronts: [
      {
        id: 'cf-1',
        pointsAtStart: coldFrontInitial.points,
        motion: {
          kind: 'piecewise',
          segments: [
            { until: '2026-03-14T15:00:00Z', bearingDeg: 110, speedKt: 15 },
            { until: '2026-03-14T18:00:00Z', bearingDeg: 110, speedKt: 22 }, // accelerates
            { until: '2026-03-14T20:00:00Z', bearingDeg: 110, speedKt: 28 },
          ],
        },
        intensitySchedule: [
          { at: '2026-03-14T12:00:00Z', intensity: 'moderate' },
          { at: '2026-03-14T16:00:00Z', intensity: 'strong' },
        ],
        prefrontalConvection: {
          leadDistanceNm: 60,
          onsetAt: '2026-03-14T15:00:00Z',
          cellTemplate: { radiusKm: 12, motionMatchesFront: true },
        },
      },
    ],
    cells: [],
    airMassMotion: [
      { airMassId: 'warm', motion: { bearingDeg: 90, speedKt: 8 } },
      { airMassId: 'cold', motion: { bearingDeg: 110, speedKt: 18 } },
    ],
    hazardLifecycle: [],
  },
};
```

The "front accelerates, pre-frontal storms appear" story is now declarative.
The engine consumes it and:

- Produces an hourly METAR at each station from 1200Z through 2000Z
- Issues TAFs at standard issue times (1120Z covers 1212/1318) which **forecast
  the front arriving at the slower initial speed**, so the actual METARs at
  1700Z and beyond show the front arrived earlier than the TAF predicted
- Spawns pre-frontal cells at 1500Z; their METARs show +TSRA at the stations
  they pass over
- Charts for any timestamp render the front at its evolved position

## What this unlocks

### Drill exercises (Phase 5+ of the drill plan)

- "Here are three METARs from KICT at 1200Z, 1500Z, 1700Z. What happened
  between 1500Z and 1700Z?"
- "Here's the 1120Z TAF for KICT and the actual 1700Z METAR. Where did the TAF
  get it wrong, and why?"
- "Cold front moving 110°/15 kt accelerating. Pick the airport that's behind
  the front at 1800Z."
- "Pre-frontal storms appeared at KMHK at 1530Z. Why ahead of the front, not
  at the front?"

### Scenario packages

A "scenario package" output bundles for one declarative scenario:

```text
data/wx-scenarios/frontal-pressure-march/
  truth.json                  v2 truth model
  timeline.json               every hourly snapshot pre-rendered
  products/
    metar-sequence.json       all stations × all hours
    taf-sequence.json         all stations × all issue times
    pirep-events.json         time-stamped reports
    airmet-timeline.json      advisory issue/extend/cancel events
  charts/
    1200Z/, 1300Z/, ...       per-hour SVG charts
  commentary.md               truth-anchored Socratic commentary tied to time
```

This **is** the "single situation, all the data" output you described — and
once it exists, the drill / practice / catalog tooling consumes it for free
because all the contracts (parsed-product shapes, annotations) stay the same.

### Real-time replay in the study app

A new study-app surface (`/practice/wx/replay`) could let a student step
through a scenario hour by hour, watching the METAR/TAF/chart update and
forcing go/no-go decisions at each step. That's a v3 surface; v2 just gives
us the data to feed it.

## What does NOT change

- `parseMetar` / `parseTaf` are unchanged. Round-trip validation works
  identically; we just round-trip more products.
- Every existing derivation function works unchanged because `sampleTruthAt`
  produces a v1 snapshot.
- The existing 6 scenarios don't need an `evolution` block — v2 is purely
  additive.
- The chart renderers in `libs/wx-charts/` don't know or care whether the
  product came from a v1 or v2 truth; they just render parsed products.

## Migration path

Adopt incrementally. Order chosen so each step ships independently.

1. **Type extensions** — add the optional `evolution` block to
   [types.ts](../../../libs/wx-engine/src/truth/types.ts). Nothing reads it
   yet.
2. **`sampleTruthAt` helper** — implement + unit tests. Verify identity:
   `sampleTruthAt(v1truth, v1truth.validAt) deep-equals v1truth`.
3. **`deriveXAt` + `deriveXSequence` helpers** — thin wrappers calling
   `sampleTruthAt`. Existing derivations untouched.
4. **One pilot scenario** — author `frontal-pressure-march` (the user's
   motivating scenario) and `wx-scenario build frontal-pressure-march` emits
   a timeline bundle.
5. **CLI surface** — `wx-scenario build` learns `--timeline` and emits the
   full timeline bundle described above.
6. **Drill integration** — `wx-scenario drill` learns `--temporal` for
   sequence-based exercises.
7. **Study-app integration** — `/practice/wx/replay` consumes timeline bundles.

Each step is reviewable + shippable on its own. Step 4 is the proof-of-concept
ship. Steps 5-7 are the unlocks.

## Open questions

- **Step size.** 15-min vs 60-min default? 60 matches the METAR cadence
  exactly; 15 supports SPECI-style off-cycle events. Probably support both
  natively in `stepMinutes`, default 60.
- **TAF amendments.** TAFs are normally issued at fixed times. When the actual
  weather diverges enough from the prior TAF, an AMD is issued. Should the
  engine auto-emit `TAF AMD` based on a delta threshold, or is that
  scenario-authored? Leaning auto-emit with a `tafAmendmentPolicy` knob.
- **Cell lifecycle physics.** The intensity curve and radius curve options are
  the minimum useful set; we'll probably need pulsed-storm and supercell
  variants later. Defer until we have the first temporal scenario in hand.
- **Reproducibility.** Any randomness must be seedable from the scenario
  definition. Today the v1 derivations are fully deterministic given the truth
  model. v2 should preserve that — no `Math.random` anywhere; every "noise"
  effect (e.g. eddy direction variability for variable wind groups) takes a
  seed derived from `(scenarioSlug, station, timestamp)`.

## Non-goals

- Real numerical weather prediction. This is a pedagogical engine; truth is
  declared, not computed from atmospheric physics.
- Backwards-incompatible refactors of v1. Every existing v1 scenario and every
  existing v1 caller continues to work without changes.
