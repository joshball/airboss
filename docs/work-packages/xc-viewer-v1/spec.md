---
id: xc-viewer-v1
title: 'Spec: XC Viewer v1 -- Universal Pre-Flight Stage (First Slice)'
product: sim
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-11
owner: agent
depends_on:
  - wx-engine
unblocks: []
tags:
  - xc-viewer
  - spatial
  - sectional
  - composition
  - infrastructure
  - first-slice
legacy_fields:
  feature: xc-viewer-v1
  type: spec
---

# Spec: XC Viewer v1 -- Universal Pre-Flight Stage (First Slice)

The first composable slice of the XC viewer surface: one sectional region (Memphis), three airports (KMEM / KOLV / KMKL), one hand-authored route, one hand-authored aircraft (C172N), one wx-engine scenario (`frontal-xc-march`, re-used from the wx-engine spike), and zero scenario-perturbation events. Renders at `/spatial/xc/<scenario-slug>` in a new SvelteKit app `apps/spatial/`. Mounts in one weather-course step via `:::xc-viewer slug="kmem-kmkl-kolv-frontal-march"` to prove the lesson-mounting contract.

This is the v1 cap. It must fit on a sticky note. Everything that does not fit is in [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Why this WP exists

The XC viewer ([VISION.md](../../vision/products/pre-flight/xc-viewer/VISION.md)) is the universal pre-flight stage -- the surface every pre-flight lesson, drill, and rehearsal mounts. v1 is the smallest meaningful slice that proves the architecture: the four layers (geography, flight, weather, scenario) compose into a `ScenarioBundle` that the renderer consumes; the wx-engine output flows in by slug reference; the substrate is real enough to build follow-on slices on top of without rebuilding the foundation.

Proving the architecture means: (1) a sectional renders cleanly with airports + airspace + route overlay, (2) the wx-engine bundle for `frontal-xc-march` mounts at every waypoint as METAR/TAF chips + AIRMET polygons, (3) the C172N aircraft spec drives leg labels (distance / true course / fuel-burn estimate per leg), (4) the entire composition mounts in a course step via a markdown directive. Once that's shipped, the v2+ slices (scenario events, editor UI, multi-region sectional, real POH ingest) are mechanical extensions against a stable contract.

## Killer-feature framing

See [VISION.md](../../vision/products/pre-flight/xc-viewer/VISION.md). The killer feature is **layered truth-awareness**: the wx-engine knows the atmospheric truth, the route knows the geometry, the aircraft knows the performance, and composition produces verifiably consistent claims. v1 demonstrates this with one concrete claim per leg: "leg 2 (KMKL -> KOLV) covers 91 nm at 110 kt true; with 8 gph at 4500 ft and a projected wind of 270/15, planned fuel is 7.2 gal; 49 minutes en route; arrival fuel reserve 14.6 gal" -- every number in that sentence is a derived value that traces back to a layer.

## Scope

### In

- One new SvelteKit app at `apps/spatial/`, scaffolded mirroring `apps/study/` patterns (port assigned in `libs/constants/src/ports.ts`, route via `ROUTES.SPATIAL_XC_SCENARIO(slug)` in `libs/constants/src/routes.ts`, auth + theme + UI inherits from `libs/auth/`, `libs/themes/`, `libs/ui/`).
- One server-only library at `libs/spatial-engine/` exporting the four-layer composition pipeline: `loadGeography(regionSlug)`, `loadFlight(scenarioId)`, `loadWeather(wxScenarioSlug)`, `composeBundle({ regionSlug, flightScenarioId, wxScenarioSlug, eventsScenarioId? })`. Tagged `// @browser-globals: server-only -- never imported by client .svelte`.
- One browser-safe library at `libs/spatial-ui/` exporting the `<XcViewer bundle={...} />` component family: `<SectionalCanvas>`, `<RouteOverlay>`, `<WaypointWxChip>`, `<AirmetPolygon>`, `<LegLabel>`, `<PerformanceBand>`. Pure rendering against a `ScenarioBundle` value; no DB or filesystem access.
- One sectional region authored under `course/sectionals/memphis/`: vector-only ingest (state outlines, roads, cities, airspace boundaries for KMEM Class B + KMKL Class D + KOLV Class D, terrain shading, navaid positions). Source: FAA digital sectional vector data (TPP / dCS); ingester at `scripts/sectionals.ts ingest <region>` writes vector geometry as GeoJSON under `course/sectionals/<region>/{airspace.geojson, basemap.geojson, navaids.geojson, airports.json}`.
- Three hand-authored airports under `course/sectionals/memphis/airports/`: KMEM (Memphis International -- Class B, parallel runways, ILS-equipped), KOLV (Olive Branch -- Class D, single runway, RNAV), KMKL (McKellar-Sipes Regional -- Class D, two runways). Each carries metadata (lon/lat, elevation, runway list with headings/lengths/surface, frequencies, declared FBOs).
- One hand-authored route at `libs/spatial-engine/src/flight/routes/kmem-kmkl-kolv.ts` exporting a `RouteSpec` literal: 5 waypoints (KMEM departure, KMEM-departure-fix, KMKL touch-and-go, KOLV-arrival-fix, KOLV destination), VFR cruise at 4500 ft / 110 kt TAS.
- One hand-authored aircraft at `libs/spatial-engine/src/flight/aircraft/c172n-skyhawk.ts` exporting an `AircraftSpec` literal: simplified performance polar (climb 700 fpm at 75 kt, cruise 110 kt at 75% / 8 gph at 4500 ft, descent 500 fpm), W&B envelope (max gross 2300 lb, fwd CG 35.0, aft CG 47.3 -- C172N POH-derived), equipment list (VOR / GPS / Mode C transponder).
- One scenario composition at `libs/spatial-engine/src/scenario/scenarios/kmem-kmkl-kolv-frontal-march.ts` exporting a `ScenarioSpec` literal that ties the route + aircraft + the existing wx-engine slug `frontal-xc-march` + `events: []` (zero events in v1).
- One scenario CLI dispatcher at `scripts/xc-scenario.ts` (`bun run xc-scenario build <slug>`, `bun run xc-scenario list`, `bun run xc-scenario validate <slug>`). The build step produces `data/xc-scenarios/<slug>/{bundle.json, route.geojson, performance.json}` from the layer-1/2/3 sources.
- A reader UX at `apps/spatial/src/routes/spatial/xc/[slug]/+page.svelte` (rendered server-first via `+page.server.ts`): static SvelteKit page that reads `data/xc-scenarios/<slug>/bundle.json`, renders `<XcViewer>`. Pan / zoom on the sectional, click waypoint -> open weather + plate-stub side panel, click leg -> show distance / true course / fuel calculation (no editor in v1).
- One mounted course step in `course/courses/weather-comprehensive/sections/<existing-section>.yaml`: a markdown body containing `:::xc-viewer slug="kmem-kmkl-kolv-frontal-march"` -- the proof that lessons can mount the substrate.
- `:::xc-viewer slug="..."` directive contract documented at `docs/work-packages/xc-viewer-v1/CONSUMER-CONTRACT.md`. The directive resolver lives in the course-reader-and-editor consumer (separate WP); this WP defines the data contract and ships the bundle the resolver reads. Same shape as the wx-engine `:::scenario` directive contract.
- Constants: `XC_REGIONS`, `XC_REGION_VALUES`, `XcRegion`, `XC_REGION_LABELS`, `XC_AIRCRAFT`, `XC_ROUTES`, `XC_SCENARIOS` in `libs/constants/src/xc-viewer.ts`. Routes: `ROUTES.SPATIAL_XC_INDEX`, `ROUTES.SPATIAL_XC_SCENARIO(slug)` in `libs/constants/src/routes.ts`. Port: `PORTS.SPATIAL` in `libs/constants/src/ports.ts`.
- Browser-safety: `libs/spatial-engine/` is server-only (filesystem I/O, large vector geometry literals, scenario literals). Runtime barrel `@ab/spatial-engine` re-exports types only; server barrel `@ab/spatial-engine/server` carries every value. `libs/spatial-ui/` is browser-safe (pure SVG rendering of bundle data); runtime barrel exports components + types.
- Validator: every `RouteSpec` validates against a Zod schema (waypoints in CONUS bounds, monotonic ordering, altitude profile non-negative, declared alternate exists in the airports table). Every `AircraftSpec` validates (perf polar non-negative, W&B envelope is a valid polygon, fuel-burn curve monotone in power setting). Every `ScenarioSpec` resolves its `routeId`, `aircraftId`, `wxScenarioSlug` to existing entries; resolution failure errors loud at scenario-load time.
- `bun run check` step: `bun run xc-scenario validate --all` runs against every registered scenario; fails the pipeline on any validation failure. Wired into the existing parallel-step harness.
- Phasing: six phases (A through F), each ships its own PR.

### Out

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Anchor docs

- [VISION.md](../../vision/products/pre-flight/xc-viewer/VISION.md) -- the why; the killer-feature thesis; the four-layer architecture
- [weather-scenario-engine/VISION.md](../../vision/products/pre-flight/weather-scenario-engine/VISION.md) -- the truth-aware wx engine this viewer composes with
- [weather-scenario-engine/DESIGN.md](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md) -- the engine's truth-model + per-layer derivation contracts; pattern source for `libs/spatial-engine/`
- [wx-engine spec](../wx-engine/spec.md) -- the production lib that emits the wx scenario bundle this viewer reads
- [route-walkthrough PRD](../../vision/products/pre-flight/route-walkthrough/PRD.md) -- pedagogy this WP makes deliverable at scale
- [MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- `apps/spatial/` placement
- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md) -- discovery-first pedagogy
- [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md) -- where source bytes live (sectional cache subdirectory)
- [ADR 025](../../decisions/025-wp-frontmatter-contract/decision.md) -- WP frontmatter contract
- [libs/wx-charts/src/projection.ts](../../../libs/wx-charts/src/projection.ts) -- Lambert projection helper; pattern source for `libs/spatial-engine/src/projection.ts`

### FAA documentation set (substrate inventory)

The viewer composes data from real FAA digital products. Authors writing layer-1 sectional ingesters and layer-2 aircraft specs reference these documents for source-format realism:

- **FAA Aeronautical Chart User's Guide** -- canonical sectional symbology + airspace conventions (drives the renderer's symbol library and per-class airspace colors)
- **FAA Digital Sectional Charts (dCS)** -- the source of vector geometry the layer-1 ingester reads; KMEM is in the Memphis sectional region
- **FAA NASR (National Airspace System Resource)** -- airport / runway / frequency / navaid records; v1 hand-authors three airports rather than full ingest, but the field set matches NASR shape so S2 substitution is mechanical
- **AC 91-21.1B** -- portable electronic devices on aircraft; provides background for the equipment list shape on `AircraftSpec`
- **C172N POH** (1977 / 1978) -- Cessna 172N pilot operating handbook; v1 hand-authors the perf polar + W&B envelope from the POH numbers (transcription, not ingest); the `course/aircraft/c172n/` directory carries a CITATION.md noting which POH section each parameter came from
- **AIM 4-1-2 / 4-1-3** -- pilot-controller responsibilities + flight planning; provides framing for the route-spec field set

The library does not consume these PDFs at build time. They are author-side references; v1 hand-authors three airports + one aircraft from them.

## Architecture overview

```text
data/xc-scenarios/<slug>/                                   <-- per-scenario output directory
  bundle.json         serialized ScenarioBundle (composed from layers 1-4)
  route.geojson       layer-2 route geometry as GeoJSON LineString + Point (waypoints)
  performance.json    derived per-leg performance (distance, course, fuel, ETE, ETA)
  cited-by.json       reverse index: which course steps mount this scenario

course/sectionals/<region>/                                  <-- layer-1 geography (committed)
  airspace.geojson    per-region airspace polygons (Class B/C/D/E plus SUA)
  basemap.geojson     state outlines, water, roads, cities (vector subset)
  navaids.geojson     VOR / NDB / fix positions + identifiers
  airports.json       airport metadata index for the region (lon/lat, elev, runways, freqs)
  manifest.yaml       region metadata: bounds, projection parallels, source ref

course/sectionals/<region>/airports/<icao>/                  <-- per-airport detail (v1: KMEM/KOLV/KMKL)
  airport.json        full record (lon/lat, elev, runways, frequencies, FBOs, fuel)
  CITATION.md         which FAA NASR record + which sectional cycle it came from

course/aircraft/<slug>/                                      <-- layer-2 aircraft specs (v1: c172n)
  spec.ts             AircraftSpec literal (TS, hand-authored)
  CITATION.md         which POH section each parameter came from

libs/spatial-engine/src/                                     <-- pure code only (server-only)
  index.ts                                          runtime barrel: type-only re-exports
  server.ts                                         server-only barrel; carries every value
  projection.ts                                     Lambert helper (re-uses wx-charts pattern)
  geography/
    types.ts                                        Region, Airspace, Airport, Navaid, Basemap
    schema.ts                                       Zod schemas
    loader.ts                                       loadGeography(regionSlug): Geography
  flight/
    types.ts                                        RouteSpec, AircraftSpec, Waypoint, ...
    schema.ts                                       Zod schemas
    routes/
      kmem-kmkl-kolv.ts                             v1 RouteSpec literal
    aircraft/
      c172n-skyhawk.ts                              v1 AircraftSpec literal
    loader.ts                                       loadFlight(scenarioId): Flight
    performance.ts                                  derivePerformance(route, aircraft, weather): PerformanceTable
  scenario/
    types.ts                                        ScenarioSpec, TimedEvent (v2+), ScenarioBundle
    schema.ts                                       Zod schemas
    scenarios/
      kmem-kmkl-kolv-frontal-march.ts               v1 ScenarioSpec literal
    registry.ts                                     loadScenario(slug): ScenarioSpec
    compose.ts                                      composeBundle({...}): ScenarioBundle
  bundle.ts                                         writeScenarioBundle(bundle, opts): Promise<void>
  validate/
    consistency.ts                                  cross-layer invariants (route waypoints in airport set, etc.)

libs/spatial-ui/src/                                          <-- browser-safe rendering
  index.ts                                          runtime barrel: components + types
  XcViewer.svelte                                   top-level composition
  SectionalCanvas.svelte                            renders the sectional layer (basemap + airspace + airports)
  RouteOverlay.svelte                               renders the route layer (line + waypoints + leg labels)
  WaypointWxChip.svelte                             METAR/TAF flight-category chip per waypoint
  AirmetPolygon.svelte                              AIRMET ring overlay (consumed from wx-engine output)
  LegLabel.svelte                                   per-leg distance / course / fuel callout
  PerformanceBand.svelte                            sticky footer with W&B + fuel + ETA summary
  PlateStub.svelte                                  airport-detail side panel (frequencies + runways; full plate viewer is OOS)

apps/spatial/src/                                             <-- new SvelteKit app
  routes/
    spatial/xc/[slug]/+page.server.ts               loads bundle.json from data/xc-scenarios/<slug>/
    spatial/xc/[slug]/+page.svelte                  mounts <XcViewer bundle={data.bundle} />
    spatial/xc/+page.server.ts                      loads scenario index from xc-scenario list
    spatial/xc/+page.svelte                         scenario picker (v1: 1 scenario; v2+: more)

scripts/xc-scenario.ts                                        <-- CLI dispatcher
  bun run xc-scenario build <slug>                  compose bundle + write to data/xc-scenarios/<slug>/
  bun run xc-scenario list                          enumerate registered scenarios
  bun run xc-scenario validate <slug>               run schema + consistency checks
  bun run xc-scenario validate --all                wired into bun run check

scripts/sectionals.ts                                         <-- CLI dispatcher (v1: ingest)
  bun run sectionals ingest <region>                vector ingest from FAA dCS source under cache
  bun run sectionals list                           enumerate ingested regions

~/Documents/airboss-handbook-cache/sectionals/<region>/       <-- source bytes (per ADR 018)
  source.zip                                        FAA dCS source archive
  source-manifest.json                              ingest provenance (cycle, fetch date)
```

## Behavior

### Scenario authoring flow

1. Author defines region geography (one-time per region): runs `bun run sectionals ingest memphis` which reads the dCS source from the cache and writes vector geometry to `course/sectionals/memphis/`. v1 ships the Memphis ingest as part of the WP; subsequent regions are follow-on work.
2. Author hand-edits `course/sectionals/memphis/airports/<icao>/airport.json` for each of the three airports, citing the NASR record + the sectional cycle in `CITATION.md`.
3. Author writes `libs/spatial-engine/src/flight/routes/<slug>.ts` exporting a `RouteSpec` literal -- waypoints by lon/lat or by airport ICAO + lat/lon offsets, altitude profile, speed profile, declared alternate.
4. Author writes `libs/spatial-engine/src/flight/aircraft/<slug>.ts` exporting an `AircraftSpec` literal, citing the POH section per parameter in the `course/aircraft/<slug>/CITATION.md`.
5. Author writes `libs/spatial-engine/src/scenario/scenarios/<slug>.ts` composing a route + aircraft + wx-engine slug into a `ScenarioSpec`. Registers in `libs/spatial-engine/src/scenario/registry.ts`.
6. Author runs `bun run xc-scenario build <slug>`. The CLI:
   - Loads the geography (cached if already loaded for this region)
   - Loads the flight (route + aircraft from the scenario's references)
   - Loads the weather (reads `data/wx-scenarios/<wxScenarioSlug>/` from the wx-engine output)
   - Validates: every reference resolves; layer schemas pass; cross-layer consistency holds (route waypoints inside region bounds, declared alternate is in the airports table, scenario validAt within wx-engine truth.validAt window)
   - Composes the `ScenarioBundle`
   - Derives per-leg performance (distance, true course, magnetic course, fuel, ETE, ETA) using the aircraft polar + the wx-engine winds aloft at each leg's cruise altitude
   - Writes `data/xc-scenarios/<slug>/{bundle.json, route.geojson, performance.json}`
7. Author runs `bun run check` -- 0 errors, 0 warnings (validate-all step is wired in).
8. Author commits the scenario `.ts` file, the per-region geography (one-time), the per-aircraft spec (one-time), and the `data/xc-scenarios/<slug>/` directory.

### `bun run xc-scenario validate --all` (wired into `bun run check`)

Runs schema + consistency validation for every registered scenario without writing to disk. Fails the pipeline on any of:

- A `RouteSpec`, `AircraftSpec`, or `ScenarioSpec` violates its Zod schema
- A `ScenarioSpec` references a `routeId` / `aircraftId` / `wxScenarioSlug` that doesn't resolve
- A route waypoint sits outside the declared region bounds
- A declared alternate is not in the region's airports table
- The composed bundle's per-leg fuel calculation produces a negative reserve at the destination

This is the load-bearing guarantee: the viewer cannot ship a scenario whose composition produces an internally inconsistent bundle.

### Bundle composition (the load-bearing function)

```typescript
import type { Geography, Flight, ScenarioSpec, ScenarioBundle } from '@ab/spatial-engine';

// libs/spatial-engine/src/scenario/compose.ts (server-only)

export function composeBundle(args: ComposeArgs): ScenarioBundle {
  const geography = loadGeography(args.regionSlug);
  const flight = loadFlight(args.flightScenarioId);
  const weather = loadWeatherForScenario(args.wxScenarioSlug, args.validAt);

  // Cross-layer validation
  assertWaypointsInRegion(flight.route, geography);
  assertAlternateKnown(flight.route, geography);
  assertWxBundleCoversFlight(weather, flight, args.validAt);

  // Performance derivation -- the killer-feature payload
  const performance = derivePerformance({
    route: flight.route,
    aircraft: flight.aircraft,
    windsAloftByWaypoint: weather.windsAloftByWaypoint,
    isaDeviationByWaypoint: weather.isaDeviationByWaypoint,
    departureTime: args.validAt,
  });

  return {
    scenarioId: args.scenarioId,
    geography,
    flight,
    weather,
    events: [], // v1 ships zero events
    performance,
    validAt: args.validAt,
  };
}
```

`composeBundle` is a pure function. Layer-1/2/3 are loaded once; the bundle is the composition. v2+'s scenario events layer mutates the bundle as time advances, but v1 produces a static composition.

### Slug resolution into courses

The course-reader-and-editor consumer ships a markdown directive `:::xc-viewer slug="<scenario-id>"`. At render time the directive resolves to a panel that:

- Pulls `data/xc-scenarios/<slug>/bundle.json` for the composed scenario
- Pulls `data/xc-scenarios/<slug>/performance.json` for the per-leg performance table
- Mounts `<XcViewer bundle={...} />` from `@ab/spatial-ui` at a fixed aspect ratio inside the course step
- Inherits the course-step theming + scroll context

This WP defines the data contract (what's at `data/xc-scenarios/<slug>/`); the consumer WP implements the directive resolver. The engine library does not know about routes -- it only writes files at the canonical paths the consumer expects.

### Engine API

One composition entrypoint, one bundle writer.

```typescript
import type { ScenarioBundle, ScenarioSpec, Geography, Flight, WxBundleView } from '@ab/spatial-engine';

export interface ComposeArgs {
  scenarioId: string;
  regionSlug: XcRegion;        // 'memphis' in v1
  flightScenarioId: string;    // route + aircraft tuple id; v1: 'kmem-kmkl-kolv-c172n'
  wxScenarioSlug: WxScenario;  // 'frontal-xc-march' in v1
  validAt: string;             // UTC ISO timestamp (defaults to wx scenario's validAt)
}

export function composeBundle(args: ComposeArgs): ScenarioBundle;
export async function writeScenarioBundle(bundle: ScenarioBundle, opts: WriteOpts): Promise<void>;
```

Adding a new scenario means adding one `ScenarioSpec` literal that points at existing region + flight + wx slugs. New flights, regions, and aircraft are independent units that any new scenario can compose.

### Layer composition contracts

- **Layer 1 (geography)**: `loadGeography(regionSlug)` reads `course/sectionals/<region>/{airspace.geojson, basemap.geojson, navaids.geojson, airports.json}` and returns a typed `Geography`. The reader caches by region slug; subsequent `composeBundle` calls in the same process re-use the cached value
- **Layer 2 (flight)**: `loadFlight(scenarioId)` resolves the scenario's `routeId` + `aircraftId` to literal `RouteSpec` + `AircraftSpec` values from `libs/spatial-engine/src/flight/routes/` and `.../aircraft/`. Per-leg performance is derived inside `composeBundle` because it needs layer-3 winds aloft
- **Layer 3 (weather)**: `loadWeatherForScenario(wxScenarioSlug, validAt)` reads `data/wx-scenarios/<slug>/truth.json` + `products/*.json` from the wx-engine output, projects per-waypoint queries (METAR / TAF / winds aloft / AIRMET intersection), and returns a typed `WxBundleView` keyed by waypoint id
- **Layer 4 (scenario events)**: `events: []` in v1; the type field exists in the spec so v2+ adds events without a schema migration

### Performance derivation (v1 -- straight-leg, simplified ISA)

```typescript
// libs/spatial-engine/src/flight/performance.ts (server-only)

export function derivePerformance(args: PerfArgs): PerformanceTable {
  const legs: LegPerformance[] = [];
  for (let i = 0; i < args.route.waypoints.length - 1; i++) {
    const from = args.route.waypoints[i];
    const to = args.route.waypoints[i + 1];

    // Geometry: great-circle distance + true course (Vincenty)
    const distanceNm = greatCircleNm(from.lon, from.lat, to.lon, to.lat);
    const trueCourse = greatCircleBearing(from.lon, from.lat, to.lon, to.lat);

    // Cruise altitude for this leg (from RouteSpec.altitudeProfile)
    const altitudeFtMsl = args.route.altitudeProfile[i].altitudeFtMsl;

    // Wind from layer 3 (interpolated to leg midpoint + altitude)
    const wind = interpolateWind(args.windsAloftByWaypoint, midpoint(from, to), altitudeFtMsl);

    // True airspeed from layer 2 (aircraft polar at altitude + ISA dev)
    const isaDev = args.isaDeviationByWaypoint[from.id] ?? 0;
    const tas = args.aircraft.perfPolar.cruiseTasKt(altitudeFtMsl, isaDev);

    // Wind-corrected ground speed + heading
    const { groundSpeedKt, magneticHeading } = applyWind({ trueCourse, tas, wind });

    // Fuel burn from layer 2
    const gph = args.aircraft.fuelBurnCurve.gphAtCruise(altitudeFtMsl);
    const eteMin = (distanceNm / groundSpeedKt) * 60;
    const fuelGal = gph * (eteMin / 60);

    legs.push({
      from: from.id,
      to: to.id,
      distanceNm,
      trueCourse,
      magneticHeading,
      altitudeFtMsl,
      groundSpeedKt,
      eteMin,
      fuelGal,
      windFromDeg: wind.directionDeg,
      windKt: wind.speedKt,
    });
  }

  // Cumulative reserve check
  const totalFuel = legs.reduce((sum, leg) => sum + leg.fuelGal, 0);
  const reserveGal = args.aircraft.fuelCapacityGal - totalFuel;

  return { legs, totalFuelGal: totalFuel, reserveGal };
}
```

The function is pure and deterministic. A scenario re-build produces identical `performance.json` output. The cumulative reserve check is the single cross-layer invariant the validator surfaces; if it returns negative, the scenario is rejected at validate time.

## Data model

No DB schema changes in v1. The library is pure code; outputs live on the filesystem under `data/xc-scenarios/<slug>/` and `course/sectionals/<region>/`. Source bytes (FAA dCS archives) live in the developer-local cache per [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md). The cache subdirectory is `~/Documents/airboss-handbook-cache/sectionals/<region>/`.

`ScenarioBundle` is the canonical type. See `libs/spatial-engine/src/scenario/types.ts` for the full TypeScript shape. Highlights:

```typescript
export interface ScenarioBundle {
  scenarioId: string;
  validAt: string;
  geography: Geography;          // layer 1
  flight: Flight;                // layer 2
  weather: WxBundleView;         // layer 3 (projected to waypoints)
  events: TimedEvent[];          // layer 4 (empty in v1)
  performance: PerformanceTable; // derived from layers 2 + 3
}

export interface Geography {
  regionSlug: XcRegion;
  bounds: { minLon: number; minLat: number; maxLon: number; maxLat: number };
  airports: AirportRecord[];
  airspace: AirspacePolygon[];
  navaids: NavaidRecord[];
  basemap: BasemapFeatureCollection;
}

export interface Flight {
  scenarioId: string;
  route: RouteSpec;
  aircraft: AircraftSpec;
  pilot?: PilotProfile;
}

export interface WxBundleView {
  wxScenarioSlug: WxScenario;
  truthValidAt: string;
  byWaypoint: Record<WaypointId, WaypointWxView>;
  airmets: AirmetView[];
  charts: ChartRef[]; // slug references into data/charts/wx/wx-scenario-<slug>-*/
}
```

### Constants (in `libs/constants/src/xc-viewer.ts`)

```typescript
export const XC_REGIONS = {
  MEMPHIS: 'memphis',
} as const;

export const XC_REGION_VALUES = Object.values(XC_REGIONS);
export type XcRegion = (typeof XC_REGION_VALUES)[number];

export const XC_REGION_LABELS: Record<XcRegion, string> = {
  memphis: 'Memphis Sectional',
};

export const XC_AIRCRAFT = {
  C172N_SKYHAWK: 'c172n-skyhawk',
} as const;

export const XC_AIRCRAFT_VALUES = Object.values(XC_AIRCRAFT);
export type XcAircraft = (typeof XC_AIRCRAFT_VALUES)[number];

export const XC_ROUTES = {
  KMEM_KMKL_KOLV: 'kmem-kmkl-kolv',
} as const;

export const XC_ROUTE_VALUES = Object.values(XC_ROUTES);
export type XcRoute = (typeof XC_ROUTE_VALUES)[number];

export const XC_SCENARIOS = {
  KMEM_KMKL_KOLV_FRONTAL_MARCH: 'kmem-kmkl-kolv-frontal-march',
} as const;

export const XC_SCENARIO_VALUES = Object.values(XC_SCENARIOS);
export type XcScenario = (typeof XC_SCENARIO_VALUES)[number];

export const XC_SCENARIO_LABELS: Record<XcScenario, string> = {
  'kmem-kmkl-kolv-frontal-march': 'KMEM -> KMKL -> KOLV -- Cold Front Passage (March)',
};
```

### Routes (in `libs/constants/src/routes.ts`)

```typescript
SPATIAL_XC_INDEX: '/spatial/xc',
SPATIAL_XC_SCENARIO: (slug: XcScenario): string => `/spatial/xc/${slug}`,
```

### Ports (in `libs/constants/src/ports.ts`)

```typescript
SPATIAL: 9610, // study is 9600; sim is 9620; flightbag is 9630
```

The exact port number is set during Phase F per the existing port-allocation pattern. The constant is the contract.

## Validation

| Field / rule                      | Rule                                                                                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RouteSpec`                       | Zod-validated. Waypoints have unique ids; lon/lat in `Geography.bounds`; altitude profile non-negative + monotonic-ish (allow descent for arrival); speed profile > 0 |
| `AircraftSpec`                    | Zod-validated. Perf polar entries non-negative; W&B envelope is a closed polygon; fuel-burn curve monotone in power setting; equipment list values in known enum      |
| `ScenarioSpec`                    | Zod-validated. `routeId` resolves to a registered route; `aircraftId` resolves to a registered aircraft; `wxScenarioSlug` is in `WX_SCENARIO_VALUES`                  |
| `XcScenario` slug                 | One of `XC_SCENARIO_VALUES`                                                                                                                                           |
| Region bounds                     | Every route waypoint sits inside `Geography.bounds`                                                                                                                   |
| Declared alternate                | If `route.alternate` is set, the alternate ICAO is in `Geography.airports`                                                                                            |
| Wx scenario coverage              | The wx-engine truth.validAt window covers the scenario's planned departure + ETA                                                                                      |
| Performance reserve               | After deriving per-leg fuel, `reserveGal >= 0` (negative reserve fails validation -- the route is too long for the aircraft + winds)                                  |
| Bundle filesystem layout          | Output directory matches the spec's "Output layout"; cache mirror exists; chart-mirror exists                                                                         |
| Geography GeoJSON validity        | Every polygon is closed (first point equals last); every LineString has >=2 points; bounding box matches the union of features                                        |
| Sectional source-bytes provenance | Every region under `course/sectionals/<region>/` has a `manifest.yaml` recording the FAA dCS cycle + fetch date the vector data was extracted from                    |
| Aircraft spec POH provenance      | Every aircraft under `course/aircraft/<slug>/` has a `CITATION.md` mapping each `AircraftSpec` field to a POH section reference                                       |

## Edge cases

- **Route waypoint outside region bounds**: validator rejects with the offending waypoint id + the region bounds. Author either expands the region (multi-region routing is OOS for v1) or fixes the waypoint
- **Wind interpolation across leg crossing >1 waypoint zone**: `interpolateWind` uses leg-midpoint; if the leg is >50 nm and crosses a strong gradient, the result is approximate. v1 accepts the approximation -- the killer-feature thesis is "claims are derivable", not "claims are arbitrarily precise". v2+ may add multi-segment integration for long legs (deferred -- see OUT-OF-SCOPE.md)
- **Aircraft polar interpolated above ceiling**: `cruiseTasKt(altitude)` clamps to the polar's max altitude; the validator surfaces a warning if a route's altitude profile exceeds 90% of the aircraft's service ceiling (an authoring smell)
- **Negative fuel reserve at destination**: validation rejects with the per-leg breakdown so the author can either shorten the route, raise the cruise altitude (better TAS at higher altitude with the same gph), or pick a different aircraft
- **Wx scenario validAt outside the route's planned window**: validator rejects -- the wx scenario must cover the flight. Author either picks a different wx scenario or shifts the route's planned departure time
- **Sectional source bytes missing from cache**: the ingester surfaces a clear "FAA dCS archive not found at `<cache path>`; download from `<URL>` and re-run" message. v1 documents the source URL in `course/sectionals/<region>/manifest.yaml` so the developer can re-fetch
- **Sectional ingest schema mismatch (FAA cycle change)**: the ingester surfaces a per-feature parse failure with the offending field. v1 pins to the FAA dCS cycle current at the time of authoring (recorded in `manifest.yaml`); a cycle bump triggers a follow-on ingest pass
- **Airport ICAO collision (two airports with same identifier)**: GeoJSON validator rejects on duplicate id at ingest time
- **Airspace polygon self-intersects**: GeoJSON validator rejects at ingest time. FAA dCS data has been observed to ship occasional self-intersecting polygons; the ingester surfaces these as warnings + the offending feature is dropped from the rendered bundle (with a `WARNINGS` comment in the manifest)
- **Course step references a scenario slug that doesn't exist**: the consumer's `:::xc-viewer` directive renders a placeholder ("scenario not found: <slug>") rather than crashing the page. The course-step lint surfaces unresolved slugs at `bun run check` time
- **Browser-bundle leak risk**: `libs/spatial-engine/` is server-only. The runtime barrel `@ab/spatial-engine` re-exports types only; `check-browser-globals.ts` walks the runtime barrel and fails on any value re-export. The `<XcViewer>` component imports `type ScenarioBundle` from `@ab/spatial-engine`; the value-side server load lives in `+page.server.ts` which uses `@ab/spatial-engine/server`

## Acceptance

V1 ships when:

- The `kmem-kmkl-kolv-frontal-march` scenario builds cleanly via `bun run xc-scenario build kmem-kmkl-kolv-frontal-march` -- 0 validation errors, all consistency checks green
- The viewer page at `/spatial/xc/kmem-kmkl-kolv-frontal-march` renders end-to-end in a browser: sectional with KMEM Class B + airspace + airports visible; route line with 5 waypoints overlaid; weather chips at each waypoint showing METAR flight category from the wx-engine output; per-leg labels showing distance + true course + planned fuel; performance band at the bottom showing total fuel + reserve
- Pan / zoom on the sectional canvas works smoothly (>= 30 fps in Chrome devtools performance trace)
- Click on a waypoint opens a side panel with the waypoint's METAR, TAF (if at an airport), and airport detail (frequencies, runways) -- read-only
- Click on a leg opens a side panel with the leg's full performance breakdown (distance, course, altitude, wind, TAS, GS, ETE, fuel)
- The course step at `course/courses/weather-comprehensive/sections/<existing-section>.yaml` mounts `:::xc-viewer slug="kmem-kmkl-kolv-frontal-march"` and renders the panel inside the course step (requires the course-reader-and-editor `:::xc-viewer` directive resolver to ship; until then, the directive is a documented no-op placeholder per Phase F)
- `bun run xc-scenario validate --all` is wired into `bun run check` and runs green
- `bun run check all` passes -- 0 errors, 0 warnings (svelte-check across the new `apps/spatial/` app, biome clean, browser-globals lint passes for `libs/spatial-engine/` and `libs/spatial-ui/`, frontmatter lint clean, references lint clean)
- `libs/spatial-engine/` has 0 value re-exports in the runtime barrel (types only); server barrel carries every value; `check-browser-globals.ts` passes
- The library's public API (`composeBundle`, `writeScenarioBundle`, `loadGeography`, `loadFlight`, `RouteSpec`, `AircraftSpec`, `ScenarioSpec`, `ScenarioBundle`) is documented in the per-phase PR descriptions and re-exported cleanly from the barrels
- `apps/spatial/` is documented in [MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) as the home for spatial / map-based products (one-line update; no architecture change)
- `docs/products/spatial/` directory exists with at least an INDEX.md / PRD.md stub pointing at the v1 surface (mirror the existing `docs/products/study/` shape)
- All six WP files (spec, tasks, test-plan, design, user-stories, OUT-OF-SCOPE) carry `agent_review_status: done` after the final phase ships and a clean `/ball-review-full` pass
