---
name: Weather Scenario Engine -- design
parent: VISION.md
status: spike-driven (Spike 01)
captured: 2026-05-10
spike: spikes/wx-engine/01-frontal-xc/
---

# Weather Scenario Engine -- design

Concrete implementation shape for the truth-aware engine. Sits between [VISION.md](VISION.md) (the why) and [architecture.md](architecture.md) (the layers + stages) and the eventual `libs/wx-engine/` work package.

This document is the output of Spike 01 (truth-aware engine S1, frontal-XC scenario, end-to-end). It defines the truth-model shape, the per-product derivation contracts, the chart-spec derivation contracts, and the commentary derivation contract. S2 / S3 substitution paths are spelled out so the architecture does not paint itself into a corner.

## Map

- [Engine API](#engine-api) - the entrypoint and the output shape
- [Truth model schema](#truth-model-schema) - layer 1 TypeScript types
- [Layer 2 derivation: products](#layer-2-derivation-products) - truth -> typed products
- [Layer 3 derivation: chart specs](#layer-3-derivation-chart-specs) - truth -> wx-charts spec.yaml
- [Layer 4 derivation: commentary](#layer-4-derivation-commentary) - truth -> Socratic callouts
- [S1 vs S2/S3](#s1-vs-s2s3) - how the layer-1 shape stays substitutable
- [Output layout](#output-layout) - what lands on disk
- [Out of scope](#out-of-scope) - explicit deferrals

## Engine API

One entrypoint. One output bag.

```typescript
import type { TruthModel } from './truth/types';
import type { ParsedMetar, ParsedTaf, ParsedFbGrid, ParsedPirep } from '@ab/wx-charts/types';

export interface ScenarioBundle {
  /** The canonical layer-1 state. Layers 2/3/4 are pure derivations from this. */
  truth: TruthModel;
  /** Layer 2 products, keyed by station + kind. */
  products: {
    metars: ParsedMetar[];
    metarStrings: string[]; // formatted for round-trip parse test
    tafs: ParsedTaf[];
    tafStrings: string[];
    airmets: AirmetAdvisory[];
    fbGrid: ParsedFbGrid;
    fbBulletinText: string;
    pireps: ParsedPirep[];
    pirepStrings: string[];
  };
  /** Layer 3 chart specs (one per chart kind) and the source-data files they reference. */
  charts: ChartArtifact[];
  /** Layer 4 commentary callouts. */
  commentary: CommentaryCallout[];
}

export interface ScenarioRunOptions {
  scenarioId: string;          // e.g. 'frontal-xc-march'
  outputDir: string;           // e.g. data/wx-scenarios/frontal-xc-march
  /** Mirror chart specs into data/charts/wx/<slug>/ for `bun run charts build`. */
  mirrorIntoChartsDir?: boolean;
}

export function generateScenario(seed: ScenarioSeed): ScenarioBundle;

export async function writeScenarioBundle(
  bundle: ScenarioBundle,
  options: ScenarioRunOptions,
): Promise<void>;
```

`ScenarioSeed` is a tagged union of every supported scenario. Spike 01 ships exactly one variant: `{ kind: 'frontal-xc-march' }`. Adding a new scenario means adding a new variant + a new layer-1 hand-coded truth state + (where the existing derivation laws don't cover it) targeted layer-2/3/4 helpers.

## Truth model schema

Layer 1. The atmosphere as a system. Single canonical state every other layer reads.

```typescript
// libs/wx-engine/src/truth/types.ts

export interface TruthModel {
  /** Scenario identifier. Stable across regenerations of the same seed. */
  scenarioId: string;
  /** UTC ISO timestamp the scenario is "now" -- the analysis time. */
  validAt: string;
  /** Local timezone of the primary departure airport (IANA). */
  primaryTimeZone: string;
  /** Per-station coordinate registry the engine queries when deriving products. */
  stations: StationRegistry;
  /** Synoptic-scale features (pressure systems + fronts). */
  synoptic: SynopticState;
  /** Air masses. Each carries a polygon, a temp/dewpoint profile, and a stability tag. */
  airMasses: AirMass[];
  /** Upper-level structure (jet, ridge/trough). Drives FB winds aloft. */
  upperLevel: UpperLevelState;
  /** Convective state: where + how strong. Drives radar + Convective SIGMETs + PIREPs. */
  convection: ConvectionState;
  /** Diurnal cycle handle: heating, mixing height, nocturnal inversion. */
  diurnal: DiurnalCycle;
  /** Hazard zones derived from synoptic + air-mass + convection state. Used by AIRMET layer. */
  hazardZones: HazardZone[];
  /** Coarse terrain handle (mountain ridges, lake-effect zones). Spike 01 leaves this empty. */
  terrain: TerrainState;
}

export interface StationRegistry {
  [icao: string]: {
    icao: string;
    lon: number;
    lat: number;
    elevationFt: number;
    name: string;
  };
}

// ----------------------------------------------------------------
// Synoptic-scale state
// ----------------------------------------------------------------

export interface SynopticState {
  pressureSystems: PressureSystem[];
  fronts: Front[];
}

export interface PressureSystem {
  id: string;
  kind: 'L' | 'H';
  lon: number;
  lat: number;
  centralPressureMb: number;
  /** Storm-motion vector (for time-evolved chart derivation). */
  motionDegTrue: number;
  motionKt: number;
  /** Background SLP for the synthetic isobar field; defaults to 1015 mb. */
  backgroundPressureMb?: number;
}

export interface Front {
  id: string;
  kind: 'cold' | 'warm' | 'occluded' | 'stationary';
  /** Polyline coords lon/lat -- ordered head -> tail. */
  points: [number, number][];
  /** Cardinal that the pip glyphs face. Cold=warm side; warm=cold side. */
  pipSide: 'N' | 'S' | 'E' | 'W';
  /** Front motion vector. Used for prog-chart projection forward. */
  motionDegTrue: number;
  motionKt: number;
  /** Intensity tag drives gust/wind-shift magnitude in the post-frontal sector. */
  intensity: 'weak' | 'moderate' | 'strong';
}

// ----------------------------------------------------------------
// Air-mass state
// ----------------------------------------------------------------

export interface AirMass {
  id: string;
  /** mT / mP / cT / cP / cA per AWC-A 4-1. */
  classification: 'mT' | 'mP' | 'cT' | 'cP' | 'cA';
  /** Polygon enclosing the air mass on a horizontal slice (lon/lat ring). */
  polygon: [number, number][];
  /** Surface temp (deg C). */
  surfaceTempC: number;
  /** Surface dewpoint (deg C). */
  surfaceDewpointC: number;
  /** Lapse-rate tag drives stability + cloud structure derivation. */
  stability: 'stable' | 'conditionally-unstable' | 'unstable';
  /** Surface wind direction (deg true) -- the prevailing wind in the air mass. */
  surfaceWindDirDeg: number;
  /** Surface wind speed (kt) -- the prevailing wind in the air mass. */
  surfaceWindKt: number;
  /** Mean cloud-cover hint: SKC..OVC. Layer 2 chooses cloud-layer specifics. */
  meanCloudCover: 'SKC' | 'FEW' | 'SCT' | 'BKN' | 'OVC';
  /** Mean cloud base AGL (ft). null when SKC. */
  meanCloudBaseFtAgl: number | null;
  /** Mean cloud top AGL (ft). null when SKC. */
  meanCloudTopFtAgl: number | null;
}

// ----------------------------------------------------------------
// Upper-level state
// ----------------------------------------------------------------

export interface UpperLevelState {
  /** Jet-axis polyline (lon/lat) at 250 mb. Used for Tango AIRMET derivation. */
  jetAxis: [number, number][];
  /** Jet max speed (kt). */
  jetMaxKt: number;
  /** Mean wind by altitude band (ft MSL). Used for FB derivation. */
  windByAltitude: WindByAltitudeRow[];
}

export interface WindByAltitudeRow {
  altitudeFt: number;
  /** Polynomial coefficients for direction/speed across the lon/lat domain.
   *  Spike 01 uses constants; production would use a 2-D field. */
  meanDirDeg: number;
  meanSpeedKt: number;
  meanTempC: number;
}

// ----------------------------------------------------------------
// Convection
// ----------------------------------------------------------------

export interface ConvectionState {
  /** Convective cells with center, radius, intensity (dBZ). */
  cells: ConvectiveCell[];
  /** Frontal precipitation band -- a polyline + width with reflectivity gradient. */
  frontalBand: FrontalPrecipBand | null;
  /** Convective potential at each station (used to seed PIREP chop reports). */
  capeJperKgByStation: Record<string, number>;
}

export interface ConvectiveCell {
  id: string;
  lon: number;
  lat: number;
  radiusKm: number;
  /** Composite reflectivity at center, dBZ. Falls off with radius. */
  peakDbz: number;
}

export interface FrontalPrecipBand {
  /** Polyline along the frontal boundary (lon/lat). */
  axis: [number, number][];
  /** Width perpendicular to the axis (km). */
  widthKm: number;
  /** Peak reflectivity in the band (dBZ). */
  peakDbz: number;
}

// ----------------------------------------------------------------
// Diurnal cycle
// ----------------------------------------------------------------

export interface DiurnalCycle {
  /** Hour of solar noon at the scenario centroid (UTC). */
  solarNoonUtcHour: number;
  /** Mixing-height MSL at the scenario time (ft). */
  mixingHeightFtMsl: number;
  /** Whether a nocturnal inversion is present (drives morning fog). */
  nocturnalInversion: boolean;
}

// ----------------------------------------------------------------
// Hazard zones (drives AIRMET derivation)
// ----------------------------------------------------------------

export interface HazardZone {
  id: string;
  kind: 'turbulence' | 'icing' | 'ifr' | 'mountain-obscuration';
  /** Lon/lat polygon. */
  polygon: [number, number][];
  /** Altitude band (ft MSL). null upper = "and above". */
  altitudeBandFtMsl: { min: number; max: number | null };
  /** Source rationale -- which truth-model element produced this zone. */
  source: string;
  /** Severity. Used by layer 4 commentary. */
  severity: 'light' | 'moderate' | 'severe';
}

export interface TerrainState {
  ridges: Array<{ id: string; polyline: [number, number][]; peakElevationFt: number }>;
}
```

### Truth-state evolution (for prog charts)

Prog charts need a forecast-time copy of the synoptic state. The engine evolves the truth state forward using the front-motion + pressure-system motion vectors:

```typescript
export function advanceTruth(state: TruthModel, hours: number): TruthModel;
```

Pure function. Translates each pressure-system center + front polyline by `motion * hours`. Does NOT regenerate hazard zones (those are recomputed from the projected synoptic state). Spike 01 implements 12-hour advance only.

## Layer 2 derivation: products

Five product kinds. Each is a pure function of the truth model + a station/region/time argument.

### METAR

```typescript
export function deriveMetar(
  truth: TruthModel,
  stationIcao: string,
  observationTime: string, // ISO; defaults to truth.validAt
): { parsed: ParsedMetar; raw: string };
```

Algorithm:

1. Look up station coords in `truth.stations`.
2. Find the air mass whose polygon contains the station -> source for wind/temp/dewpoint/cloud cover.
3. Sample the synoptic isobar field at the station -> SLP -> altimeter inHg.
4. If the station is within the post-frontal cold sector AND the front is moderate/strong, add gust = wind +30%.
5. If the station is inside a hazard zone with kind='ifr' AND altitudeBandFtMsl includes the surface, drop visibility + ceiling per intensity.
6. If a convective cell is within 5 nm, add `+TSRA` weather + `BKN` ceiling at 1500 ft.
7. Format the output as a real METAR string. Round-trip via `parseMetar` for sanity.

Output is both the formatted string AND the parsed shape, so the round-trip parse is automatic in the spike.

### TAF

```typescript
export function deriveTaf(
  truth: TruthModel,
  stationIcao: string,
  issueTime: string,        // ISO
  validHours: number,       // typical: 24 or 30
): { parsed: ParsedTaf; raw: string };
```

Algorithm:

1. Compute the per-hour truth state by advancing the truth model in 1-hour steps.
2. Detect when the air mass under the station changes (front passage). That becomes an `FM` group.
3. For PROB30/40 periods, look at the convection state along the front -- if convective cells are near the station, emit `PROB30 <window> ... -TSRA BKN045CB`.
4. For BECMG periods (gradual change), emit when SLP gradient exceeds a threshold within a 3-hr window.
5. Format with the FAA TAF grammar; round-trip via `parseTaf`.

### AIRMET

```typescript
export interface AirmetAdvisory {
  id: string;
  kind: 'airmet-sierra' | 'airmet-tango' | 'airmet-zulu';
  label: string;
  rings: [number, number][][]; // outer ring is rings[0]; first/last point match
  validFrom: string;
  validTo: string;
  /** Reference to the truth-model hazard zone this advisory came from. */
  fromHazardZoneId: string;
}

export function deriveAirmets(truth: TruthModel): AirmetAdvisory[];
```

Algorithm:

1. Enumerate `truth.hazardZones`.
2. Map kind -> AIRMET family: `ifr` and `mountain-obscuration` -> Sierra; `turbulence` -> Tango; `icing` -> Zulu.
3. Use the hazard polygon as the AIRMET ring directly.
4. Label string from the source rationale ("Post-frontal IFR conditions", "Cold-sector turbulence behind front", etc).

### Winds aloft (FB)

```typescript
export function deriveFbGrid(
  truth: TruthModel,
  stationIcaos: string[],
  validAt: string,
): { parsed: ParsedFbGrid; raw: string };
```

Algorithm:

1. For each station, walk `truth.upperLevel.windByAltitude` and emit one row per altitude band the FB bulletin reports (3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000).
2. Apply terrain handle (skip 3000 ft when station elevation > 2000 ft).
3. Format as the canonical FAA FB bulletin (fixed-width columns, header line). Round-trip via `parseFbGrid`.

### PIREP

```typescript
export function derivePireps(
  truth: TruthModel,
  options: { count: number; aircraftTypes: string[] },
): { parsed: ParsedPirep[]; raw: string[] };
```

Algorithm:

1. For each hazard zone with severity >= moderate, emit one PIREP near its centroid with appropriate TB/IC group.
2. For each convective cell, emit a `UUA` PIREP with `+TSRA` and `SEV` turbulence near it.
3. For frontal-zone passages, emit a chop PIREP just behind the front in the cold sector.
4. Pick a station ICAO + radial+distance from the registry that lands the report inside the relevant zone.
5. Format with FAA AIM 7-1-21 grammar; round-trip via `parsePirep`.

## Layer 3 derivation: chart specs

The engine produces wx-charts library-shape `spec.yaml` + the source JSON files those specs reference. The wx-charts library renders. The engine never re-implements rendering.

For each chart kind the spike covers, the engine produces:

- A `spec.yaml` matching the chart's Zod spec schema
- The `cache://...` source files the spec references (under the dev cache root, alongside `~/Documents/airboss-handbook-cache/wx/`)

| Chart kind         | Spec schema                 | Source file shape                                        |
| ------------------ | --------------------------- | -------------------------------------------------------- |
| `surface-analysis` | `surfaceAnalysisSpecSchema` | `{ centers, fronts, stations? }` -- fronts JSON          |
| `prog-chart`       | `progChartSpecSchema`       | `{ centers, fronts, hazards }` -- forecast JSON          |
| `advisory-overlay` | `airmetSigmetSpecSchema`    | `{ issued, valid_until, advisories }` -- AIRMET JSON     |
| `metar-plot-grid`  | `metarPlotGridSpecSchema`   | `{ observations: [{ station, lat, lon, raw, parsed }] }` |
| `taf-timeline`     | `tafTimelineSpecSchema`     | `{ stationIcao, issuedAt, validFrom, validTo, raw }`     |
| `winds-aloft-fb`   | `windsAloftFbSpecSchema`    | `{ validAt, basedOn, stations, raw }`                    |
| `pirep-plot-grid`  | `pirepPlotGridSpecSchema`   | `{ targetTimestamp, reports: [{ raw, lat, lon }] }`      |

Each chart-derivation function is shaped:

```typescript
export interface ChartArtifact {
  /** wx-charts slug, e.g. wx-scenario-frontal-xc-march-surface-analysis */
  slug: string;
  /** spec.yaml content */
  spec: object;
  /** Source files this spec references. Engine writes them to cache and to the scenario output dir. */
  sources: Array<{ cacheRelPath: string; content: string }>;
}

export function deriveSurfaceAnalysisChart(truth: TruthModel): ChartArtifact;
export function deriveProgChart(truth: TruthModel, leadHours: number): ChartArtifact;
export function deriveAirmetChart(truth: TruthModel, airmets: AirmetAdvisory[]): ChartArtifact;
export function deriveMetarPlotChart(truth: TruthModel, metars: { parsed: ParsedMetar; lat: number; lon: number }[]): ChartArtifact;
export function deriveTafTimelineChart(truth: TruthModel, tafRaw: string, station: string, issuedAt: string, validFrom: string, validTo: string): ChartArtifact;
export function deriveWindsAloftChart(truth: TruthModel, fbBulletinText: string, stations: { icao: string; lat: number; lon: number }[]): ChartArtifact;
export function derivePirepPlotChart(truth: TruthModel, pireps: { raw: string; lat: number; lon: number }[]): ChartArtifact;
```

### Why no radar mosaic (Spike 01 deferral)

The wx-charts `radar-mosaic` renderer expects a NEXRAD reflectivity PNG + worldfile (`n0r_*.png`). Synthesizing a real radar PNG from the truth model means generating a colored raster, color-mapping it through the NWS reflectivity ramp, and producing a worldfile -- non-trivial and not the load-bearing test of the killer-feature hypothesis.

The spike substitutes by rendering the convection state through the **prog-chart hazard polygons** (the prog spec accepts `hazards` polygons that get drawn over the front layout) AND through a dedicated `advisory-overlay` SIGMET advisory for the convective band. This proves the truth-aware-derivation chain (truth -> hazard polygon -> chart spec -> rendered chart) without the PNG pipeline.

A production WP would either:

1. Add a synthetic-radar generator to the engine that emits a PNG + worldfile (~150 lines using `sharp`)
2. Add a "radar-polygons" chart variant to wx-charts that accepts polygon reflectivity rings instead of PNG raster

Recommendation: option 2 -- the engine works in geometry, the chart library should accept geometry; staying in PNG-land for synthetic data is gratuitous.

## Layer 4 derivation: commentary

Truth-aware Socratic callouts. Each callout pins to one chart element, points back at the truth model element that produced it, and links a knowledge-graph node from `course/knowledge/weather/`.

```typescript
export interface CommentaryCallout {
  id: string;
  /** What chart / product element this callout pins to. */
  target: {
    kind: 'metar' | 'taf-period' | 'chart-feature' | 'airmet' | 'pirep' | 'fb-row';
    chartSlug?: string;       // when target is a chart feature
    elementId?: string;       // station ICAO, advisory id, etc
  };
  /** Discovery-first prompt: "what do you notice?" or "why is this?". */
  question: string;
  /** Author's "look at" -- the specific cue. */
  observation: string;
  /** Truth-model rationale -- WHY this is the way it is. Cites synoptic / air-mass / hazard. */
  reason: string;
  /** Knowledge-graph node ids to surface as references. */
  knowledgeNodeIds: string[];
  /** Pedagogy mode: socratic prompts the learner; glance is a one-line first-read cue. */
  mode: 'socratic' | 'glance';
}

export function deriveCommentary(
  truth: TruthModel,
  bundle: Pick<ScenarioBundle, 'products' | 'charts'>,
): CommentaryCallout[];
```

Algorithm (Spike 01 implements ~5-10 callouts):

1. **Front-passage callout** at each station crossed: pin to that station's METAR; question "What's the wind doing here vs. KSTL? Why?"; reason cites the synoptic front + air-mass classification.
2. **Pre-frontal warm-sector callout** at the southernmost station: pin to METAR; question "Why is dewpoint elevated here?"; reason cites mT air mass.
3. **Post-frontal gust callout** at the deep cold-sector station: pin to METAR; question "Where do these gusts come from on a clear post-frontal afternoon?"; reason cites pressure gradient + moderate-to-strong front intensity.
4. **TAF transition callout** at the arrival airport: pin to TAF FM period; question "What does this FM group tell you to plan for?"; reason cites the projected front arrival time.
5. **AIRMET-Tango callout**: pin to the chart polygon; question "Why is turbulence forecast here, behind the front?"; reason cites cold advection + ageostrophic flow under jet exit.
6. **AIRMET-Sierra callout** (post-frontal IFR): pin to the chart polygon; question "Why does ceiling drop in the cold air after a front?"; reason cites lifted air-mass moisture + stable-layer trapping.
7. **Surface-analysis isobar gradient callout**: pin to the chart; question "Why are isobars packed so tightly behind the front?"; reason cites the deep low aloft + cold-air pressure rise.

Each callout's `knowledgeNodeIds` references real nodes under `course/knowledge/weather/` (`wx-airmasses-and-fronts`, `wx-wind-systems`, `wx-clouds-and-precipitation`, `wx-stability-and-instability`, `wx-go-nogo-decision`).

## S1 vs S2/S3

The architecture is layered on the truth model so the truth model can be **substituted** without rewriting layers 2/3/4.

**S1 (Spike 01):** layer 1 is a hand-coded TS literal. `frontal-xc-march.ts` exports a `TruthModel` literal.

**S2 substitution path:**

- Replace `frontal-xc-march.ts` with `frontal-xc-march-from-archive.ts`, which reads (region, season, time-of-day, narrative) and samples real ERA5 / NARR / archived METAR distributions to fill in the same `TruthModel` interface.
- Layers 2/3/4 do not change.
- The engine API does not change; the seed grows a `dataAnchor: 's1' | 's2' | 's3'` discriminator, defaulting to `s1`.

**S3 substitution path:**

- Replace the truth source with a real-day reanalysis ingest: `replayRealDay({ date, region, perturbVariable: 'frontTimingHours', delta: -2 })`.
- The replay produces the same `TruthModel` shape with one variable perturbed; everything downstream is identical.

The `TruthModel` interface is the lock-in. As long as it captures everything the four layers need, the data anchor is swappable. Spike 01 verifies this by ensuring derivation functions read ONLY from `TruthModel` -- they never reach back into the scenario seed or the engine internals.

## Output layout

```text
data/wx-scenarios/<scenario-id>/
  truth.json                  # serialized TruthModel (debugging aid)
  products/
    metars.txt                # raw METAR strings, one per line
    metars.json               # array of ParsedMetar
    tafs.txt
    tafs.json
    fb-bulletin.txt
    fb-bulletin.json
    pireps.txt
    pireps.json
    airmets.json
  charts/
    <chart-slug>/
      spec.yaml               # mirrors data/charts/wx/<slug>/spec.yaml
      sources/                # source JSON files this spec references
        <kind>.json
  commentary.md               # human-readable callout list
  commentary.json             # structured callout list

data/charts/wx/wx-scenario-<scenario-id>-<chart-kind>/
  spec.yaml                   # symlink-or-copy of the engine output
  (chart.svg + meta.json after `bun run charts build`)

~/Documents/airboss-handbook-cache/wx/scenarios/<scenario-id>/
  surface-analysis.json
  prog-12hr.json
  advisory-overlay.json
  metar-plot.json
  taf-timeline.json
  winds-aloft.json
  pirep-plot.json
```

The double-write (scenario-local + cache-rooted) lets the wx-charts CLI resolve `cache://scenarios/<scenario-id>/...` URIs while the scenario directory remains the canonical "what the engine produced." The chart-build pipeline already supports `cache://` resolution against the dev cache root -- no library changes needed.

## Out of scope

- **S2 / S3 data anchoring.** Architecture leaves the door open; spike implements only S1.
- **Radar mosaic PNG synthesis.** Spike 01 substitutes via prog-hazard polygons + a SIGMET advisory band. Production WP picks one of the two recommended paths above.
- **Satellite, GFA, icing CIP/FIP, freezing-level, GTG, G-AIRMET chart types.** Architecture supports them (each is one more `derive<X>Chart` function); spike 01 ships the load-bearing five (surface, prog, AIRMET, METAR-plot, TAF-timeline) plus FB and PIREP product layers.
- **Multi-cycle TAF amendments.** Spike emits one TAF per station for one issuance window. AMD/COR cycles are deferred.
- **Convective SIGMET / CWA.** Spike emits AIRMETs only; convective products are deferred.
- **Authoring UI.** All scenario seeds are TS literals in spike. The hangar authoring surface is a separate WP.
- **Engine-as-library (`libs/wx-engine/`).** Spike lives at `spikes/wx-engine/`. The eventual lib lift is the production WP's first task.

## Open questions for the production WP

These are NOT deferred follow-ups -- they need a decision in the WP intake:

1. **Where does the truth-state evolution clock live?** Spike 01 uses front-motion vectors + a fixed advance interval. A production engine likely needs continuous time; that affects whether `TruthModel` is a snapshot or a function.
2. **How does authoring specify a narrative?** Spike uses a literal seed file. Production needs a tagged-narrative vocabulary or a parameter schema; the choice constrains the hangar UI.
3. **Round-trip parsing as a CI check?** Spike runs the round-trip in the runner. Production should add it to `bun run check` so the engine can never ship a product the wx-charts library can't parse.
