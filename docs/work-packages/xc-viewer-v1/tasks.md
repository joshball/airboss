---
id: xc-viewer-v1
title: 'Tasks: XC Viewer v1 -- Universal Pre-Flight Stage (First Slice)'
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
  - tasks
legacy_fields:
  feature: xc-viewer-v1
  type: tasks
---

# Tasks: XC Viewer v1 -- Universal Pre-Flight Stage (First Slice)

Phased plan for [spec.md](./spec.md). Order is dependency-driven: scaffold + types + Memphis sectional ingest (Phase A), then sectional renderer (B) and route renderer (C) in parallel, then weather overlay (D), then aircraft performance (E), then SvelteKit page + directive + course-step mount + check-wire-in (F). Each phase ships its own PR titled `feat(xc-viewer): <phase> -- <summary>`.

Depends on: [wx-engine](../wx-engine/) (in flight; the wx-engine emits the scenario bundle the viewer's weather layer reads). xc-viewer v1 can land after wx-engine Phase A + B ship -- the Phase A scenario `frontal-xc-march` is the bundle the viewer mounts. wx-engine phases C/D/E/F are not blockers for xc-viewer v1.

## Pre-flight

- [x] Read [spec.md](./spec.md), [design.md](./design.md), [test-plan.md](./test-plan.md), [user-stories.md](./user-stories.md), [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md) end-to-end.
- [x] Read [docs/vision/products/pre-flight/xc-viewer/VISION.md](../../vision/products/pre-flight/xc-viewer/VISION.md) -- the killer-feature thesis + four-layer framing.
- [x] Read [docs/vision/products/pre-flight/weather-scenario-engine/VISION.md](../../vision/products/pre-flight/weather-scenario-engine/VISION.md) and [DESIGN.md](../../vision/products/pre-flight/weather-scenario-engine/DESIGN.md) -- the substrate this viewer composes with.
- [x] Read [docs/work-packages/wx-engine/spec.md](../wx-engine/spec.md) and [design.md](../wx-engine/design.md) -- the production lib that emits the wx bundle this viewer reads. Skim, do not re-implement; this WP consumes the output as a filesystem-backed contract.
- [x] Read [libs/wx-charts/src/projection.ts](../../../libs/wx-charts/src/projection.ts) and [libs/wx-charts/src/server.ts](../../../libs/wx-charts/src/server.ts) -- pattern source for `libs/spatial-engine/src/projection.ts` and the renderer chrome.
- [x] Read [libs/constants/src/source-cache.ts](../../../libs/constants/src/source-cache.ts) -- the canonical lazy-load pattern for browser-bundled libs that need Node built-ins.
- [x] Read `libs/bc/study/src/index.ts` and `libs/bc/study/src/server.ts` -- the runtime / server barrel split. `libs/spatial-engine/` follows the same shape.
- [x] Read [docs/agents/best-practices.md](../../agents/best-practices.md), [docs/agents/reference-engine-patterns.md](../../agents/reference-engine-patterns.md), [docs/agents/reference-sveltekit-patterns.md](../../agents/reference-sveltekit-patterns.md).
- [x] Read [docs/agents/common-pitfalls.md](../../agents/common-pitfalls.md) and [docs/agents/debug-playbooks/browser-hydration.md](../../agents/debug-playbooks/browser-hydration.md).
- [x] Read [docs/decisions/018-source-artifact-storage-policy/decision.md](../../decisions/018-source-artifact-storage-policy/decision.md) -- the cache-vs-repo policy that drives where the FAA dCS source bytes live.
- [x] Read [docs/decisions/025-wp-frontmatter-contract/decision.md](../../decisions/025-wp-frontmatter-contract/decision.md) -- WP frontmatter contract.
- [x] Read [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- `apps/spatial/` placement.
- [x] Verify the dev cache directory exists: `ls ~/Documents/airboss-handbook-cache/sectionals/` (create if missing).
- [x] Verify wx-engine Phase A + B outputs are present: `ls data/wx-scenarios/frontal-xc-march/` (truth.json, products/*.json).
- [x] Run `bun run check` -- 0 errors before starting.

## Implementation

### Phase A: scaffold + types + Memphis sectional ingest (foundation)

Foundational; blocks Phases B/C/D/E/F. Ships the library scaffold (`libs/spatial-engine/` with runtime + server barrels), the constants in `libs/constants/src/xc-viewer.ts`, the projection helper, the layer-1/2/3/4 type definitions + Zod schemas, the Memphis sectional ingester, and the committed Memphis vector geometry under `course/sectionals/memphis/`. Also creates `apps/spatial/` scaffold (empty SvelteKit app) and `libs/spatial-ui/` scaffold so Phases B/C/D have a place to land.

PR title: `feat(xc-viewer): Phase A -- scaffold + types + Memphis sectional ingest`.

#### A.1 Constants

- [x] Create `libs/constants/src/xc-viewer.ts` with `XC_REGIONS`, `XC_REGION_VALUES`, `XcRegion`, `XC_REGION_LABELS`, `XC_AIRCRAFT`, `XC_AIRCRAFT_VALUES`, `XcAircraft`, `XC_ROUTES`, `XC_ROUTE_VALUES`, `XcRoute`, `XC_SCENARIOS`, `XC_SCENARIO_VALUES`, `XcScenario`, `XC_SCENARIO_LABELS` per spec.md "Constants" section. v1 enum values: regions = `['memphis']`, aircraft = `['c172n-skyhawk']`, routes = `['kmem-kmkl-kolv']`, scenarios = `['kmem-kmkl-kolv-frontal-march']`.
- [x] Re-export from `libs/constants/src/index.ts`.
- [x] Add `ROUTES.SPATIAL_XC_INDEX = '/spatial/xc'` and `ROUTES.SPATIAL_XC_SCENARIO = (slug: XcScenario) => \`/spatial/xc/${slug}\`` to `libs/constants/src/routes.ts`.
- [x] `PORTS.SPATIAL = 9650` (+ `SPATIAL_E2E = 9653`) added to `libs/constants/src/ports.ts`. Resolves the prior `9610` collision with `SIM`; follows the dev-port +10 grid and the E2E +3 offset.
- [x] Run `bun run check` -- 0 errors. Commit (`feat(constants): xc-viewer scenario/region/aircraft/route constants + spatial routes + port`).

#### A.2 Library scaffolds

- [x] Create `libs/spatial-engine/` with `package.json` (deps: `zod`, `yaml`, `d3-geo`; peer / dev: `@ab/wx-charts`, `@ab/wx-engine` for type imports), `tsconfig.json` (extend the repo's lib tsconfig), `src/`.
- [x] Add `@ab/spatial-engine` and `@ab/spatial-engine/server` path aliases to root `tsconfig.base.json`. Mirror the `@ab/wx-engine` pattern.
- [x] Add the lib to the workspace root config (root `package.json` workspaces); run `bun install`.
- [x] Create `libs/spatial-engine/src/index.ts` (runtime barrel; type-only re-exports). Pending Phase A primitives below.
- [x] Create `libs/spatial-engine/src/server.ts` (server-only barrel). Tag with `// @browser-globals: server-only -- never imported by client .svelte` at the top.
- [x] Create `libs/spatial-ui/` with `package.json` (deps: `svelte`, `@ab/themes`, `@ab/ui`, `@ab/constants`; type-only: `@ab/spatial-engine`), `tsconfig.json`, `src/`.
- [x] Add `@ab/spatial-ui` path alias to root `tsconfig.base.json`.
- [x] Create `libs/spatial-ui/src/index.ts` (runtime barrel; exports components + types -- browser-safe).
- [x] Run `bun run check` -- 0 errors. Commit (`feat(xc-viewer): scaffold libs/spatial-engine and libs/spatial-ui + workspace aliases`).

#### A.3 SvelteKit app scaffold (`apps/spatial/`)

- [x] Create `apps/spatial/` mirroring `apps/study/` shape: `package.json` (workspace deps: `@ab/auth`, `@ab/constants`, `@ab/db`, `@ab/help`, `@ab/themes`, `@ab/ui`, `@ab/utils`, `@ab/spatial-engine`, `@ab/spatial-ui`, `@ab/wx-engine` type-only), `svelte.config.js`, `vite.config.ts` (port from `PORTS.SPATIAL`), `tsconfig.json`, `src/app.html`, `src/app.d.ts`, `src/hooks.server.ts`, `src/routes/+layout.svelte`, `src/routes/+page.svelte` (index stub).
- [x] Register the app in the root `package.json` workspaces.
- [x] Add a `bun run dev:spatial` script alias to `package.json` if the dev-script registry uses per-app aliases (verify by reading the existing `bun run dev:study` registration).
- [x] Add an entry for `apps/spatial/` in [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) (mark as "active" in the build-order table -- this WP creates the spatial app).
- [x] Create `docs/products/spatial/INDEX.md` stub pointing at the v1 surface (mirror `docs/products/study/INDEX.md` shape, ~20 lines).
- [x] Run `bun run check` -- 0 errors. Commit (`feat(xc-viewer): scaffold apps/spatial SvelteKit app + docs/products/spatial`).

#### A.4 Projection helper

- [x] Create `libs/spatial-engine/src/projection.ts` exporting `regionalLambertProjection(region: XcRegion, opts?)`. Mirrors `libs/wx-charts/src/projection.ts` shape. Per-region standard parallels + central meridian configured from a `REGION_PROJECTIONS` table keyed by `XcRegion`. v1 entry: Memphis = `{ parallels: [33, 38], rotate: [89, 0], center: [0, 35.5] }` (tighter than CONUS default; covers TN / MS / AR / KY).
- [x] Re-export the helper as a value from the server barrel (and as a `type` re-export of `RegionalProjectionOptions` from the runtime barrel).
- [x] Run `bun run check` -- 0 errors. Commit (`feat(spatial-engine): regional Lambert projection helper`).

#### A.5 Layer-1 types + Zod schema (geography)

- [x] Create `libs/spatial-engine/src/geography/types.ts` exporting `Region`, `Geography`, `AirportRecord`, `AirspacePolygon`, `NavaidRecord`, `BasemapFeatureCollection`, `RunwayRecord`, `FrequencyRecord`. Field set matches FAA NASR shape so S2 substitution is mechanical.
- [x] Create `libs/spatial-engine/src/geography/schema.ts` exporting `regionSchema`, `airportSchema`, `airspacePolygonSchema`, `navaidSchema`, `geographySchema` (Zod). Validates: polygon closure, lon/lat in CONUS bounds, runway heading in [0, 360), elevation reasonable.
- [x] Create `libs/spatial-engine/src/geography/loader.ts` exporting `loadGeography(regionSlug: XcRegion): Geography`. Reads `course/sectionals/<region>/*.geojson` + `airports.json` + per-airport `airports/<icao>/airport.json`. Uses lazy-loaded `node:fs` via the canonical pattern. Validates against schemas on load.
- [x] Add unit tests in `libs/spatial-engine/src/__tests__/geography-schema.test.ts`: `geographySchema` accepts a synthetic Memphis-like literal; rejects malformed airspace polygon (open ring); rejects airport with lon outside CONUS.
- [x] Re-export types as `type` from the runtime barrel; loader from the server barrel.
- [x] Run `bun run check` -- 0 errors. Commit (`feat(spatial-engine): geography types + Zod schema + loader`).

#### A.6 Layer-2 types + Zod schema (flight)

- [x] Create `libs/spatial-engine/src/flight/types.ts` exporting `Waypoint`, `RouteSpec`, `AltitudeStep`, `SpeedStep`, `AircraftSpec`, `PerformancePolar`, `FuelBurnCurve`, `WeightBalanceEnvelope`, `EquipmentList`, `PilotProfile`, `Flight`, `LegPerformance`, `PerformanceTable`.
- [x] Create `libs/spatial-engine/src/flight/schema.ts` exporting `routeSpecSchema`, `aircraftSpecSchema`, `flightSchema` (Zod). Validates: monotonic altitude profile (allow descent), CG envelope is a closed polygon with forward < aft, fuel-burn curve monotone in power setting, equipment values in known enums.
- [x] Create `libs/spatial-engine/src/flight/geometry.ts` exporting `greatCircleNm(lon1, lat1, lon2, lat2)`, `greatCircleBearing(lon1, lat1, lon2, lat2)`, `midpoint(a, b)`. Pure functions; browser-safe (re-export from the runtime barrel as values is OK because they're pure math).
- [x] Create `libs/spatial-engine/src/flight/wind.ts` exporting `applyWind({ trueCourse, tas, wind }): { groundSpeedKt, magneticHeading }`. v1 uses a single per-region magnetic variation (East 4 deg for Memphis) wired via a constant; v2+ may use a grid.
- [x] Create `libs/spatial-engine/src/flight/loader.ts` exporting `loadFlight(routeId, aircraftId): Flight`. Resolves route + aircraft literals from the per-noun directories; validates schemas; returns the typed `Flight`.
- [x] Add unit tests in `libs/spatial-engine/src/__tests__/flight-geometry.test.ts`: `greatCircleNm` returns the expected value for known city pairs (KMEM -> KOLV is ~17 nm, KMEM -> KMKL is ~85 nm); `greatCircleBearing` returns expected courses; `applyWind` returns expected heading + ground speed for known inputs.
- [x] Add unit tests in `libs/spatial-engine/src/__tests__/flight-schema.test.ts`: schema accepts a synthetic RouteSpec + AircraftSpec; rejects an inverted CG envelope; rejects a route with duplicate waypoint ids.
- [x] Re-export types as `type` from the runtime barrel; loader from the server barrel; pure-math helpers (`greatCircleNm`, `greatCircleBearing`, `midpoint`, `applyWind`) as values from both barrels.
- [x] Run `bun run check` -- 0 errors. Commit (`feat(spatial-engine): flight types + Zod schema + geometry + wind helpers + loader`).

#### A.7 Layer-3 view types (weather)

- [x] Create `libs/spatial-engine/src/weather/types.ts` exporting `WxBundleView`, `WaypointWxView`, `AirmetView`, `ChartRef`, `WindAtWaypoint`. Types-only; no runtime values.
- [x] Create `libs/spatial-engine/src/weather/view.ts` exporting `loadWeatherForScenario(wxScenarioSlug: WxScenario, validAt: string): WxBundleView`. Reads `data/wx-scenarios/<slug>/truth.json` + `products/*.json` from the wx-engine output. For each route waypoint, projects: nearest METAR + matching TAF + AIRMET membership (point-in-polygon against `truth.hazardZones`) + interpolated wind aloft at the leg cruise altitude. Caches per-process by `(slug, validAt)`.
- [x] Add unit tests in `libs/spatial-engine/src/__tests__/weather-view.test.ts` using a synthetic frontal-xc-march bundle: `loadWeatherForScenario` returns a `WxBundleView` with one waypoint view per declared route waypoint; AIRMET membership matches manual point-in-polygon for at least one waypoint inside the IFR zone.
- [x] Re-export the view function from the server barrel; types as `type` from the runtime barrel.
- [x] Run `bun run check` -- 0 errors. Commit (`feat(spatial-engine): weather view layer + waypoint projection from wx-engine output`).

#### A.8 Layer-4 (scenario) types

- [x] Create `libs/spatial-engine/src/scenario/types.ts` exporting `ScenarioSpec`, `TimedEvent` (union of `WxChangeEvent | AcFailureEvent | AtcChangeEvent | NotamActivationEvent | PirepDropEvent`), `ScenarioBundle`. v1 ships `events: []`; the union is declared so v2+ adds events without a schema migration.
- [x] Create `libs/spatial-engine/src/scenario/schema.ts` exporting `scenarioSpecSchema`, `timedEventSchema` (Zod). v1's schema rejects non-empty `events` (`z.array(timedEventSchema).length(0)`) -- explicit so the v2 unlock is an obvious schema change.
- [x] Create `libs/spatial-engine/src/scenario/registry.ts` exporting `loadScenario(slug: XcScenario): ScenarioSpec`. Lazy imports the scenario module by slug, validates against `scenarioSpecSchema`, returns the validated spec.
- [x] Re-export types as `type` from the runtime barrel; registry from the server barrel.
- [x] Run `bun run check` -- 0 errors. Commit (`feat(spatial-engine): scenario types + schema + registry`).

#### A.9 Memphis sectional ingest

- [x] Document the FAA dCS source URL + cycle in `course/sectionals/memphis/manifest.yaml` (the dCS cycle currently in flight at the time of authoring -- record the exact cycle id).
- [x] Author the source-bytes acquisition flow: the developer downloads the FAA dCS source archive to `~/Documents/airboss-handbook-cache/sectionals/memphis/dcs-memphis-cycle-<id>.zip`. The ingester reads from there.
- [x] Create `libs/spatial-engine/src/geography/ingest.ts` exporting `ingestSectional(regionSlug)`. Server-only; tag `// @browser-globals: server-only`. Reads the cached archive, parses the FAA dCS vector tables (state outlines, airspace, navaids, airports), filters to the region bounds, writes:
  - `course/sectionals/<region>/basemap.geojson` (state outlines, water, roads, cities)
  - `course/sectionals/<region>/airspace.geojson` (Class B/C/D/E polygons + SUA)
  - `course/sectionals/<region>/navaids.geojson` (VOR / NDB / fix positions)
  - `course/sectionals/<region>/airports.json` (full airport index for the region)
  - Per-airport `course/sectionals/<region>/airports/<icao>/airport.json` for the three v1 airports (KMEM, KOLV, KMKL) plus a `CITATION.md` per airport mapping each field to its NASR record + dCS cycle.
- [x] Hand-author KMEM, KOLV, KMKL airport records if the FAA dCS data is missing detail; supplement from NASR data sheets where dCS lacks frequencies/FBOs.
- [x] Validate every emitted GeoJSON file: closure, valid bounds, no self-intersection (drop offending features with a warning logged into the manifest).
- [x] Create `scripts/sectionals.ts` dispatcher (`bun run sectionals list`, `bun run sectionals ingest <region>`). Mirror `scripts/wx-scenario.ts` shape; no colons in script names per repo discipline.
- [x] Add `"sectionals": "bun scripts/sectionals.ts"` to root `package.json` scripts.
- [x] Run `bun run sectionals ingest memphis`. Verify the committed outputs in `course/sectionals/memphis/`. Sanity-check sizes: `basemap.geojson` < 5 MB, `airspace.geojson` < 2 MB, `airports.json` carries the three v1 airports + ~20 surrounding airports the FAA dCS data includes for the region.
- [x] Run `bun run check` -- 0 errors. Commit (`feat(xc-viewer): Memphis sectional vector ingest + KMEM/KOLV/KMKL airport records`).

#### A.10 Composition stub

- [x] Create `libs/spatial-engine/src/scenario/compose.ts` exporting `composeBundle(args: ComposeArgs): ScenarioBundle` and a placeholder `derivePerformance` that returns `{ legs: [], totalFuelGal: 0, reserveGal: 0 }` (Phase E fills the real implementation). Phase A's `composeBundle` returns `{ scenarioId, geography, flight, weather, events: [], performance: emptyPerf, validAt }` -- the integration point so Phases B/C/D/E can land in parallel against a stable surface.
- [x] Create `libs/spatial-engine/src/bundle.ts` exporting `writeScenarioBundle(bundle, opts): Promise<void>`. Writes `data/xc-scenarios/<slug>/{bundle.json, route.geojson, performance.json}`. Lazy-loads `node:fs`, `node:path` per the canonical pattern.
- [x] Re-export `composeBundle`, `writeScenarioBundle`, `ComposeArgs` from the server barrel; types as `type` from the runtime barrel.
- [x] Run `bun run check` -- 0 errors. Commit (`feat(spatial-engine): composeBundle + writeScenarioBundle (stubs for performance; Phases B/C/D/E fill)`).

#### A.11 Phase A close

- [x] Run `bun run check all` -- 0 errors, 0 warnings.
- [x] Open PR `feat(xc-viewer): Phase A -- scaffold + types + Memphis sectional ingest`. Body summarizes the lib scaffolds, the sectional vector outputs (with line counts / file sizes), the schema coverage, and the parallelism the substrate unlocks for Phases B/C.

### Phase B: sectional renderer (browser-safe SVG vector basemap + airspace)

Ships the layer-1 renderer. Pure browser-safe SVG rendering against `Geography` data. Parallelizable with Phase C (different files; different agents in different worktrees if dispatched in parallel).

PR title: `feat(xc-viewer): Phase B -- sectional renderer (vector basemap + airspace)`.

#### B.1 SectionalCanvas component

- [x] Create `libs/spatial-ui/src/SectionalCanvas.svelte`. Props: `{ geography: Geography; projection: GeoProjection; activeLayers?: LayerToggle[] }`. Renders an SVG group containing the basemap features (state outlines, water, roads, cities) via `d3-geo` path emit.
- [x] Theme tokens for each feature: water = `var(--color-spatial-water)`, state outline stroke = `var(--color-spatial-state-outline)`, road = `var(--color-spatial-road)`, city = `var(--color-spatial-city)`. Wire the tokens through `libs/themes/` -- add a `spatial` theme slot mirroring the `wx` slot pattern in wx-charts.
- [x] Use Svelte 5 runes (`$props`, `$derived`) per CLAUDE.md.
- [~] (deferred to Phase F) Playwright smoke at `tests/e2e/xc-viewer-sectional-render.spec.ts` that loads a synthetic geography and asserts the SVG contains the expected basemap classes + zero hydration errors. Mirror the existing `tests/e2e/browser-hydration-smoke.spec.ts` shape.

#### B.2 Airspace layer

- [x] Create `libs/spatial-ui/src/AirspaceLayer.svelte`. Props: `{ airspace: AirspacePolygon[]; activeClasses?: AirspaceClass[] }`. Renders one SVG group per airspace class (B/C/D/E/SUA) with per-class stroke + dasharray + fill per FAA convention.
- [x] Per-class tokens (drive via the spatial theme slot):
  - Class B: blue solid stroke, faint fill
  - Class C: magenta solid stroke, no fill
  - Class D: blue dashed stroke, no fill
  - Class E: dashed magenta (above 1200 ft AGL), faint magenta (above 700 ft AGL)
  - MOA / Restricted: hatched per FAA pattern
- [x] Add unit tests asserting the rendered SVG has the expected per-class group structure for a synthetic 3-polygon input (one each of B, D, MOA).

#### B.3 Airport + navaid layers

- [x] Create `libs/spatial-ui/src/AirportLayer.svelte`. Props: `{ airports: AirportRecord[]; projection }`. Renders open / filled circles per FAA convention (hard-surface filled, soft-surface open, attended / unattended via the airport metadata).
- [x] Create `libs/spatial-ui/src/NavaidLayer.svelte`. Props: `{ navaids: NavaidRecord[]; projection }`. Renders VOR (star), NDB (dotted circle), fix (triangle) per FAA convention.
- [x] Add unit tests with synthetic airport / navaid lists asserting the rendered SVG has the expected symbol count + class names per symbol type.

#### B.4 Pan/zoom controls

- [x] Create `libs/spatial-ui/src/controls/ZoomPanControls.svelte`. Buttons: zoom in, zoom out, reset, fit-to-route. Internal state via `$state`; emits `'transform'` event with the current pan + zoom values.
- [x] Create `libs/spatial-ui/src/controls/LayerToggle.svelte`. Per-layer toggle (basemap, airspace, navaids, airports, route, weather). Internal state via `$state`.
- [~] (manual, Phase F) Verify pan/zoom maintains >= 30 fps in a Chrome devtools performance trace on a 5000-feature Memphis geography (acceptance bar from spec.md).

#### B.5 XcViewer top-level (sectional-only at Phase B)

- [x] Create `libs/spatial-ui/src/XcViewer.svelte`. Props: `{ bundle: ScenarioBundle }`. Phase B renders only the sectional layers (basemap + airspace + airports + navaids); subsequent phases add route, weather, performance.
- [x] Composition: `<SectionalCanvas>` + `<AirspaceLayer>` + `<NavaidLayer>` + `<AirportLayer>` + `<ZoomPanControls>` + `<LayerToggle>` inside a single SVG element.
- [~] (deferred to Phase F) Playwright smoke at `tests/e2e/xc-viewer-phase-b.spec.ts` that loads `<XcViewer bundle={memphisOnlyBundle} />` against a fixture and asserts the rendered SVG contains the expected per-class group structure.

#### B.6 Phase B close

- [x] Run `bun run check all` -- 0 errors, 0 warnings.
- [x] Open PR `feat(xc-viewer): Phase B -- sectional renderer (vector basemap + airspace + airports + navaids)`. Body summarizes the per-feature theme tokens added + the Playwright smoke + the pan/zoom performance trace.

### Phase C: route + waypoint renderer + leg labels (parallel with Phase B)

Ships the layer-2 renderer. Composes onto the Phase B sectional canvas. Parallelizable with Phase B (different files; different agents).

PR title: `feat(xc-viewer): Phase C -- route + waypoint renderer + leg labels`.

#### C.1 v1 RouteSpec literal

- [x] Create `libs/spatial-engine/src/flight/routes/kmem-kmkl-kolv.ts` exporting `KMEM_KMKL_KOLV: RouteSpec`. Waypoints: KMEM departure -> KMEM-DEP-FIX (5 nm northeast of KMEM at 1500 ft for climb-out) -> KMKL waypoint (the airport's center) -> KOLV-ARR-FIX (5 nm south of KOLV at 3000 ft for descent) -> KOLV. Altitude profile: climb to 4500 ft after KMEM-DEP-FIX, cruise at 4500 ft, descent to 2500 ft at KOLV-ARR-FIX, pattern altitude at KOLV. Speed profile: 110 kt TAS at cruise; pattern speeds at the airports.
- [x] Cite KMEM/KMKL/KOLV airport records as the waypoint coord source. The fix waypoints are hand-authored (5 nm offsets from the airport coords, computed via `greatCircleBearing`+`midpoint` or by direct lon/lat arithmetic).
- [x] Register `KMEM_KMKL_KOLV` in `libs/spatial-engine/src/flight/loader.ts:loadRoute(routeId)`.
- [x] Add a unit test in `libs/spatial-engine/src/__tests__/route-literal.test.ts`: `routeSpecSchema.parse(KMEM_KMKL_KOLV)` succeeds; waypoint count is 5; first waypoint matches KMEM airport coord within 0.01 deg.
- [x] Run `bun run check` -- 0 errors. Commit (`feat(spatial-engine): v1 RouteSpec literal -- kmem-kmkl-kolv`).

#### C.2 RouteOverlay component

- [x] Create `libs/spatial-ui/src/RouteOverlay.svelte`. Props: `{ route: RouteSpec; projection }`. Renders the route as an SVG `<path>` using `d3-geo`'s `geoPath` (LineString geometry); renders waypoints as filled diamonds.
- [x] Tokens: route line = `var(--color-spatial-route-line)`, waypoint = `var(--color-spatial-route-waypoint)`, leg label background = `var(--color-spatial-leg-label-bg)`.
- [x] Add interactivity: hover on a waypoint surfaces the waypoint id; click emits `'waypoint-click'` with the waypoint object.

#### C.3 LegLabel component (placeholder values)

- [x] Create `libs/spatial-ui/src/LegLabel.svelte`. Props: `{ leg: LegPerformance | LegPlaceholder; projection }`. Phase C ships a placeholder `LegPlaceholder` type with `{ from, to, distanceNm, trueCourse }` (geometry-derived only -- no fuel / wind yet; Phase E fills the full leg).
- [x] Renders a small callout at the leg midpoint: `<dist nm> / <course> deg`. Anchored to the leg with a leader line.
- [x] Add interactivity: hover surfaces the leg's basic info; click emits `'leg-click'` with the leg object.

#### C.4 XcViewer composes RouteOverlay + LegLabel

- [x] Update `libs/spatial-ui/src/XcViewer.svelte` to mount `<RouteOverlay>` + `<LegLabel>` (one per leg) on top of the Phase B sectional layers. Compute leg placeholders inline from `bundle.flight.route.waypoints` (great-circle distance + bearing); the full performance table replaces these in Phase E.
- [~] (deferred to Phase F) Playwright smoke at `tests/e2e/xc-viewer-phase-c.spec.ts` that loads a route-only bundle and asserts the rendered SVG contains 5 waypoints + 4 leg-label callouts + the route line.

#### C.5 Phase C close

- [x] Run `bun run check all` -- 0 errors, 0 warnings.
- [x] Open PR `feat(xc-viewer): Phase C -- route + waypoint renderer + leg labels (geometry placeholders)`. Body shows the route literal + the rendered route geometry passing the Playwright smoke.

### Phase D: weather overlay (mount existing wx-engine scenario)

Ships the layer-3 renderer. Mounts the existing `frontal-xc-march` wx-engine scenario; renders METAR/TAF chips at route waypoints + AIRMET polygons on the canvas. Sequential after B + C because chips render at route waypoint positions.

PR title: `feat(xc-viewer): Phase D -- weather overlay (wx-engine scenario mount)`.

#### D.1 Weather view tests

- [x] Author the test fixture: `libs/spatial-engine/src/__tests__/fixtures/frontal-xc-march-wx-view.json` -- the expected `WxBundleView` for the v1 route (KMEM, KOLV, KMKL each get one waypoint view; AIRMETs come from the wx-engine bundle).
- [x] Add an integration test asserting `loadWeatherForScenario('frontal-xc-march', validAt)` returns a view matching the fixture for the v1 route's waypoints. Updates the fixture if the wx-engine output drifts.

#### D.2 WaypointWxChip component

- [x] Create `libs/spatial-ui/src/WaypointWxChip.svelte`. Props: `{ waypoint: Waypoint; wxView: WaypointWxView }`. Renders a small chip at the waypoint's projected position carrying the METAR flight category (VFR/MVFR/IFR/LIFR) + the TAF arrival flight category (when present) + a click-to-open affordance.
- [x] Tokens: VFR = green token, MVFR = blue token, IFR = red token, LIFR = magenta token (matches the wx-charts CVA palette).
- [x] Add interactivity: click emits `'wx-chip-click'` with the waypoint + the view.

#### D.3 AirmetPolygon component

- [x] Create `libs/spatial-ui/src/AirmetPolygon.svelte`. Props: `{ airmet: AirmetView; projection }`. Renders the AIRMET polygon as an SVG `<path>` with per-family stroke + dasharray:
  - Sierra (IFR / mountain obscuration): orange dashed
  - Tango (turbulence): yellow dashed
  - Zulu (icing): cyan dashed
- [x] Hover surfaces the AIRMET id + family + valid window; click emits `'airmet-click'` with the AirmetView.

#### D.4 XcViewer composes weather overlay

- [x] Update `libs/spatial-ui/src/XcViewer.svelte` to mount `<WaypointWxChip>` (one per waypoint with an available view) + `<AirmetPolygon>` (one per AIRMET in `bundle.weather.airmets`) above the route overlay.
- [x] Update `composeBundle` to populate `bundle.weather` from `loadWeatherForScenario(scenarioSpec.wxScenarioSlug, scenarioSpec.validAt)`.
- [~] (deferred to Phase F) Playwright smoke at `tests/e2e/xc-viewer-phase-d.spec.ts` that loads the full v1 bundle and asserts: 5 waypoint chips + 3 AIRMET polygons (matching the wx-engine spike scenario count) + per-chip color matches the METAR flight category.

#### D.5 Waypoint detail drawer (read-only)

- [x] Create `libs/spatial-ui/src/WaypointDetailDrawer.svelte`. Slides in from the right on `'waypoint-click'`. Shows: airport metadata (name, elevation, runways, frequencies), the latest METAR text + parsed flight category, the latest TAF text (if a TAF station), the AIRMETs the waypoint sits inside, a "view in flightbag" stub link (deep-link target deferred).
- [x] Wire `<XcViewer>` to open the drawer on waypoint click; close on backdrop click or Esc.

#### D.6 Phase D close

- [x] Run `bun run check all` -- 0 errors, 0 warnings.
- [x] Open PR `feat(xc-viewer): Phase D -- weather overlay (wx-engine scenario mount + airmet polygons + waypoint drawer)`. Body shows the wx-view test fixture + the rendered overlay + the drawer behavior.

### Phase E: aircraft performance projection + the C172N spec

Ships the layer-2 hardening. Author the v1 C172N spec, implement the real `derivePerformance`, render leg labels with full fuel + wind data, render the performance band.

PR title: `feat(xc-viewer): Phase E -- aircraft performance projection (C172N + per-leg fuel + W&B)`.

#### E.1 v1 AircraftSpec literal

- [x] Create `libs/spatial-engine/src/flight/aircraft/c172n-skyhawk.ts` exporting `C172N_SKYHAWK: AircraftSpec` per design.md "Aircraft spec authoring discipline". Cite the POH section for each field in a JSDoc comment.
- [x] Create `course/aircraft/c172n-skyhawk/CITATION.md` mapping each `AircraftSpec` field to a POH page. Reference the 1978 reprint of the C172N POH.
- [x] Register the aircraft in `libs/spatial-engine/src/flight/loader.ts:loadAircraft(aircraftId)`.
- [x] Add a unit test in `libs/spatial-engine/src/__tests__/aircraft-literal.test.ts`: `aircraftSpecSchema.parse(C172N_SKYHAWK)` succeeds; CG envelope passes the "fwd < aft" rule; perf polar is monotonic in pressure altitude.

#### E.2 derivePerformance implementation

- [x] Replace the Phase A stub in `libs/spatial-engine/src/flight/performance.ts` with the real `derivePerformance(args: PerfArgs): PerformanceTable` per spec.md "Performance derivation (v1 -- straight-leg, simplified ISA)".
- [x] Wire `interpolateWind` (from `weather/view.ts`) at leg midpoint + cruise altitude.
- [x] Wire `applyWind` (from `flight/wind.ts`) to compute heading + ground speed.
- [x] Look up `aircraft.perfPolar.cruise` for TAS at the leg's cruise altitude (linear interp between polar points).
- [x] Look up `aircraft.fuelBurnCurve.cruise.defaultGph` for fuel burn (v1 is a flat 8 gph; richer curves are a follow-on).
- [x] Add unit tests in `libs/spatial-engine/src/__tests__/performance.test.ts`:
  - `derivePerformance` for the v1 route + C172N + frontal-xc-march wx returns a table with 4 legs
  - The total fuel is within 1 gal of a hand-calculated expected value (compute by hand from waypoint coords + 110 kt TAS + the wx scenario's winds aloft + 8 gph)
  - `reserveGal` is non-negative for the v1 scenario
  - A pathological test scenario (route extended to 400 nm) produces `reserveGal < 0` and is rejected by `validateScenario`

#### E.3 LegLabel updated with full performance

- [x] Update `libs/spatial-ui/src/LegLabel.svelte` to render the full leg payload: `<dist nm> @ <course> deg | <fuel gal> @ <ETE min> | <wind dir>/<wind kt>`. Keep the placeholder shape acceptable when Phase C output is still in the bundle (graceful degradation).

#### E.4 PerformanceBand component (sticky footer)

- [x] Create `libs/spatial-ui/src/PerformanceBand.svelte`. Props: `{ performance: PerformanceTable; aircraft: AircraftSpec }`. Renders a sticky footer-strip with: total fuel + reserve + total ETE + W&B / CG indicator (a small CG envelope graph with the current CG plotted).
- [x] Tokens: reserve OK = green; reserve <30 min = yellow; reserve <legal-min = red.

#### E.5 LegDetailDrawer

- [x] Create `libs/spatial-ui/src/LegDetailDrawer.svelte`. Slides in from the right on `'leg-click'`. Shows the full leg payload + the cumulative fuel + the per-leg wind triangle visualization + the from/to waypoint summaries.

#### E.6 XcViewer composes performance band + leg drawer

- [x] Update `libs/spatial-ui/src/XcViewer.svelte` to mount `<PerformanceBand>` at the bottom of the viewer + open `<LegDetailDrawer>` on leg click.
- [x] Update `composeBundle` to populate `bundle.performance` via `derivePerformance` after weather is loaded.
- [~] (deferred to Phase F) Playwright smoke at `tests/e2e/xc-viewer-phase-e.spec.ts` that loads the full v1 bundle, asserts the performance band shows non-zero total fuel + non-negative reserve, asserts each leg label shows the four fields (dist, course, fuel, ETE).

#### E.7 Phase E close

- [x] Run `bun run check all` -- 0 errors, 0 warnings.
- [x] Open PR `feat(xc-viewer): Phase E -- aircraft performance projection (C172N + per-leg fuel + W&B band)`. Body shows the hand-calculated expected total fuel vs `derivePerformance` output (within 1 gal), the per-leg breakdown, and the W&B envelope rendering.

### Phase F: SvelteKit page + `:::xc-viewer` directive + course-step mount + check-wire-in

Integrates everything. Ships the SvelteKit `+page.server.ts` + `+page.svelte` for `/spatial/xc/[slug]`, the CLI dispatcher, the `:::xc-viewer` directive contract doc, the course-step mount, and the `validate --all` wire-in.

PR title: `feat(xc-viewer): Phase F -- SvelteKit page + directive contract + course-step mount + check-wire-in`.

#### F.1 SvelteKit page

- [x] Create `apps/spatial/src/routes/spatial/xc/[slug]/+page.server.ts`. Loads `data/xc-scenarios/<slug>/bundle.json` + `performance.json`. Returns `{ bundle, performance, scenarioId: slug }` to the page. Uses `@ab/spatial-engine/server` for the load (server-only barrel).
- [x] Create `apps/spatial/src/routes/spatial/xc/[slug]/+page.svelte`. Imports `<XcViewer>` from `@ab/spatial-ui`. Renders `<XcViewer bundle={data.bundle} />` at the app's natural full-width.
- [x] Create `apps/spatial/src/routes/spatial/xc/+page.server.ts` + `+page.svelte` for the scenario picker (v1 lists one scenario; v2+ lists more). Mirrors `apps/study/src/routes/study/+page.server.ts` shape.
- [x] Wire the page route through `ROUTES.SPATIAL_XC_SCENARIO(slug)` constant. Never inline path strings (per CLAUDE.md).
- [x] Add a Playwright smoke at `tests/e2e/xc-viewer-page.spec.ts` that visits `/spatial/xc/kmem-kmkl-kolv-frontal-march` on the new spatial app and asserts the full viewer renders end-to-end with all four layers visible.

#### F.2 CLI dispatcher

- [x] Create `scripts/xc-scenario.ts` mirroring `scripts/wx-scenario.ts` shape. Reads `process.argv.slice(2)`, switches on the first arg, prints help when called with no args / `help` / `-h` / `--help`.
- [x] Create `scripts/xc-scenario/build.ts` -- `bun run xc-scenario build <slug>` and `bun run xc-scenario build --all`. Calls `composeBundle` + `writeScenarioBundle` per scenario.
- [x] Create `scripts/xc-scenario/list.ts` -- enumerates `XC_SCENARIO_VALUES` with their human labels.
- [x] Create `scripts/xc-scenario/validate.ts` -- `bun run xc-scenario validate <slug>` and `--all`. Runs schema + consistency validation without writing to disk. Returns non-zero on any failure.
- [x] Add `"xc-scenario": "bun scripts/xc-scenario.ts"` to root `package.json` scripts.
- [x] Run `bun run xc-scenario build kmem-kmkl-kolv-frontal-march`. Verify `data/xc-scenarios/kmem-kmkl-kolv-frontal-march/{bundle.json, route.geojson, performance.json}` exists and validates.
- [x] Run `bun run xc-scenario validate --all`. Expected: exits 0; all checks pass.
- [x] Commit (`feat(xc-viewer): scripts/xc-scenario.ts dispatcher (build / list / validate)`).

#### F.3 Wire validate --all into `bun run check`

- [x] Add a step to `scripts/check.ts` that invokes `bun run xc-scenario validate --all` and reports per-scenario pass/fail to `.cache/check/xc-scenario-validate.{stdout,stderr,exit}`. Mirror the existing wx-scenario round-trip step + the broader graph-validator step shape.
- [x] Verify the new step runs in dirty / branch / quick / types / all profiles per spec. The validate step always runs full regardless of scope (per the existing graph-validator pattern).
- [x] Run `bun run check all` -- 0 errors, 0 warnings. Commit (`chore(check): wire xc-scenario validate-all into the pipeline`).

#### F.4 `:::xc-viewer` directive contract

- [x] Create `docs/work-packages/xc-viewer-v1/CONSUMER-CONTRACT.md` documenting the data contract the `:::xc-viewer slug="..."` directive consumes per design.md "Mountpoint contract".
- [x] File a follow-on issue or backlog entry in the course-reader-and-editor consumer WP noting that the `:::xc-viewer` directive resolver should be added per the contract. (This WP does not implement the directive; the consumer WP does.)
- [x] Author one course-step example demonstrating the directive at `course/courses/weather-comprehensive/sections/<existing-section>.yaml` (the section best fitting frontal-passage pedagogy -- candidates: `wx-airmasses-and-fronts`, `wx-go-nogo-decision`, `wx-briefing-execution`). The example is a markdown body containing `:::xc-viewer slug="kmem-kmkl-kolv-frontal-march"`. Until the consumer renderer ships, the directive is a no-op placeholder; the example documents intent.
- [x] Commit (`docs(xc-viewer): :::xc-viewer directive contract + course-step example`).

#### F.5 Documentation surface

- [x] Update `docs/products/spatial/INDEX.md` (created in Phase A.3) with the v1 scope summary + a link to the WP.
- [x] Create `docs/products/spatial/VISION.md` mirroring the platform-product VISION shape -- one paragraph linking to the xc-viewer VISION + naming the next products on the surface (route walkthrough, airport cards).
- [x] Update [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) build-order table to mark `apps/spatial/` as built (was "Future"). Update the surface inventory if the order has changed.

#### F.6 Phase F close

- [x] Run `bun run xc-scenario build --all` -- the one v1 scenario generates cleanly.
- [x] Run `bun run check all` -- 0 errors, 0 warnings.
- [x] Open PR `feat(xc-viewer): Phase F -- SvelteKit page + directive contract + course-step mount + check-wire-in`. Body summarizes the page route, the dispatcher subcommands, the new `bun run check` step, the consumer-contract doc, and the course-step mount.

## Final close

- [x] All six phases shipped. `bun run xc-scenario list` shows 1 scenario (v1's `kmem-kmkl-kolv-frontal-march`). `data/xc-scenarios/` carries the v1 directory. `course/sectionals/memphis/` carries the v1 vector geometry.
- [x] `apps/spatial/` runs locally on `PORTS.SPATIAL`. Visiting `/spatial/xc/kmem-kmkl-kolv-frontal-march` renders the full v1 viewer with all four layers visible.
- [x] The course step at `course/courses/weather-comprehensive/sections/<section>.yaml` contains the `:::xc-viewer slug="..."` directive; the directive is a no-op placeholder until the consumer resolver ships in its own WP.
- [ ] Run `/ball-review-full` against the entire `libs/spatial-engine/` + `libs/spatial-ui/` + `apps/spatial/` + `scripts/xc-scenario*` + `scripts/sectionals*` + `course/sectionals/memphis/` + `data/xc-scenarios/` surface. Fix every finding (per CLAUDE.md: always fix everything from a review). Re-run `bun run check all` -- 0 errors, 0 warnings.
- [ ] Set `agent_review_status: done` on every WP file in this directory.
- [ ] Update `docs/work/NOW.md` to flag the WP as ready for human walk-through.
- [ ] Hand off to user for `human_review_status: walked` -> `signed-off`.
