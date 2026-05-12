---
id: xc-viewer-v1
title: 'Test Plan: XC Viewer v1 -- Universal Pre-Flight Stage (First Slice)'
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
  - test-plan
legacy_fields:
  feature: xc-viewer-v1
  type: test-plan
---

# Test Plan: XC Viewer v1 -- Universal Pre-Flight Stage (First Slice)

Manual acceptance tests for [spec.md](./spec.md). Prefix `XC-`. Scenarios grouped by phase (substrate, sectional renderer, route renderer, weather overlay, performance, integration) plus CLI / validate / check-pipeline coverage at the bottom.

## Setup

- `bun install` clean.
- `bun run check all` passes on the branch.
- Dev cache exists at `~/Documents/airboss-handbook-cache/sectionals/memphis/` with the dCS source archive present (the developer must download the FAA dCS Memphis sectional archive to this path before Phase A.9).
- wx-engine Phase A + B outputs are committed: `data/wx-scenarios/frontal-xc-march/truth.json` and `data/wx-scenarios/frontal-xc-march/products/*.json` exist.
- A modern browser is available for visually inspecting the rendered viewer.

## v1 fixtures (referenced across phases)

| Item                      | Value / shape                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| Region                    | `memphis`                                                                                  |
| Airports rendered         | KMEM (Memphis Intl), KOLV (Olive Branch), KMKL (McKellar-Sipes) + ~20 surrounding from dCS |
| Route                     | `kmem-kmkl-kolv` -- 5 waypoints, 4 legs                                                    |
| Aircraft                  | `c172n-skyhawk` -- C172N from POH                                                          |
| Wx scenario               | `frontal-xc-march` (re-used from wx-engine spike)                                          |
| Scenario                  | `kmem-kmkl-kolv-frontal-march`                                                             |
| Expected leg count        | 4                                                                                          |
| Expected waypoint count   | 5                                                                                          |
| Expected AIRMET count     | 3 (carried over from wx-engine)                                                            |
| Expected METAR chip count | 3 (one per route airport)                                                                  |
| Expected hand-calc fuel   | Approximately 17-19 gal total for the round trip; reserve ~21-23 gal of 40-gal capacity    |

---

## Substrate (Phase A: scaffold + types + Memphis sectional ingest)

### XC-1: scaffold creates apps/spatial and libs/spatial-{engine,ui}

1. Run `bun install` after Phase A lands.
2. **Expected:** `apps/spatial/`, `libs/spatial-engine/`, `libs/spatial-ui/` directories exist; `@ab/spatial-engine`, `@ab/spatial-engine/server`, `@ab/spatial-ui` path aliases resolve; `bun run check` passes.

### XC-2: regional Lambert projection helper

1. Import `regionalLambertProjection` from `@ab/spatial-engine/server`. Call with `'memphis'`.
2. **Expected:** returns a `GeoProjection` instance; project `[lon=-90.0, lat=35.0]` (KMEM area) returns a pixel inside the SVG viewport bounds; project `[lon=-85.0, lat=35.0]` returns a pixel offset eastward; bounding-box projection covers the Memphis sectional region.

### XC-3: Memphis sectional ingest produces expected outputs

1. Run `bun run sectionals ingest memphis`.
2. **Expected:** writes `course/sectionals/memphis/{manifest.yaml, basemap.geojson, airspace.geojson, navaids.geojson, airports.json}` and three per-airport directories under `airports/{KMEM,KOLV,KMKL}/`. Each carries `airport.json` + `CITATION.md`.
3. Validate the GeoJSON files: `basemap.geojson` carries state outlines + roads + cities; `airspace.geojson` carries KMEM Class B + KOLV Class D + KMKL Class D; every polygon is closed.
4. **Expected:** all schemas validate via `loadGeography('memphis')` -- no Zod errors thrown.

### XC-4: geography schema rejects malformed inputs

1. Synthesize an `AirspacePolygon` with an open ring (first point != last point); pass through `airspacePolygonSchema.parse`.
2. **Expected:** throws with `polygon` path.
3. Synthesize an `AirportRecord` with `lon: 5` (outside CONUS); pass through `airportSchema.parse`.
4. **Expected:** throws with `lon` path.
5. Synthesize an `AirportRecord` with a runway heading of 400 deg.
6. **Expected:** throws with `runways[0].heading` path.

### XC-5: flight schema rejects inverted CG envelope

1. Synthesize an `AircraftSpec` with a CG envelope where forward CG > aft CG.
2. **Expected:** `aircraftSpecSchema.parse` throws with the offending envelope vertex.
3. Synthesize a `RouteSpec` with duplicate waypoint ids.
4. **Expected:** `routeSpecSchema.parse` throws with the duplicate id.

### XC-6: composeBundle stub returns Phase A shape

1. After Phase A, run `composeBundle({ scenarioId: 'kmem-kmkl-kolv-frontal-march', regionSlug: 'memphis', flightScenarioId: 'kmem-kmkl-kolv', wxScenarioSlug: 'frontal-xc-march', validAt: '<wx scenario validAt>' })`.
2. **Expected:** returns a `ScenarioBundle` with `geography` populated (full Memphis), `flight` populated (route + aircraft loaded), `weather` populated (waypoint views), `events: []`, `performance: { legs: [], totalFuelGal: 0, reserveGal: 0 }` (Phase A stub).

---

## Phase B -- sectional renderer

### XC-10: SectionalCanvas renders Memphis basemap

1. After Phase B, load `<XcViewer bundle={memphisOnlyBundle} />` against the v1 geography in a Playwright test.
2. **Expected:** the SVG contains a `<g class="basemap">` group with state outlines + roads + cities; no hydration errors logged.

### XC-11: AirspaceLayer renders per-class polygons

1. Inspect the rendered SVG.
2. **Expected:** `<g class="airspace-b">` carries KMEM Class B polygons (blue solid stroke); `<g class="airspace-d">` carries KOLV + KMKL Class D polygons (blue dashed stroke); per-class strokes match the spatial theme tokens.

### XC-12: AirportLayer renders symbol per airport

1. Inspect the rendered SVG.
2. **Expected:** `<g class="airports">` carries one `<circle>` (or symbol element) per airport in the region; KMEM is filled (hard surface, attended); KOLV + KMKL are filled (hard surface).

### XC-13: NavaidLayer renders VOR + NDB symbols

1. Inspect the rendered SVG.
2. **Expected:** `<g class="navaids">` carries VOR stars + NDB dotted circles per the Memphis dCS navaid set.

### XC-14: pan + zoom controls work

1. Manually pan + zoom in a browser using the on-screen controls.
2. **Expected:** the SVG transforms smoothly; reset returns to the initial view; fit-to-route (after Phase C) centers the route in the viewport.
3. Run a Chrome devtools performance trace while panning.
4. **Expected:** >= 30 fps on a modern laptop; no layout thrash.

### XC-15: LayerToggle hides + shows individual layers

1. Toggle "Airspace" off in the UI.
2. **Expected:** the airspace `<g>` element receives `display: none` (or is unmounted); the rest of the canvas re-renders without it.
3. Toggle back on.
4. **Expected:** airspace returns.

---

## Phase C -- route + waypoint renderer

### XC-20: v1 RouteSpec literal validates

1. Import `KMEM_KMKL_KOLV` from `@ab/spatial-engine/server`. Pass through `routeSpecSchema.parse`.
2. **Expected:** validates without errors. `KMEM_KMKL_KOLV.waypoints.length === 5`. First waypoint within 0.01 deg of KMEM airport coord.

### XC-21: RouteOverlay renders the route line + waypoints

1. After Phase C, load `<XcViewer bundle={routeBundle} />`.
2. **Expected:** SVG contains a `<path class="route-line">` element; 5 `<circle class="route-waypoint">` elements; the route line passes through every waypoint within 1 px tolerance.

### XC-22: LegLabel renders distance + course (placeholder values)

1. Hover over the leg between KMEM and the KMEM-DEP-FIX waypoint.
2. **Expected:** a callout appears showing `<distance>` nm + `<course>` deg.
3. Click the leg.
4. **Expected:** emits `'leg-click'` event with the leg payload (Phase C: distance + course only; Phase E adds fuel + ETE).

### XC-23: waypoint click emits the right payload

1. Click on a waypoint.
2. **Expected:** the `'waypoint-click'` event carries the waypoint object including its id + coords + altitude.

### XC-24: leg count matches route waypoints

1. Inspect the rendered SVG.
2. **Expected:** `<g class="leg-labels">` carries 4 `<g class="leg-label">` elements (one per leg = N waypoints - 1).

---

## Phase D -- weather overlay

### XC-30: loadWeatherForScenario returns expected view

1. Call `loadWeatherForScenario('frontal-xc-march', validAt)` against the v1 wx-engine bundle.
2. **Expected:** returns a `WxBundleView` with `byWaypoint` keyed by every route waypoint id; per-waypoint view carries METAR text + parsed flight category + nearest-TAF (when applicable) + the AIRMETs the waypoint sits inside.

### XC-31: WaypointWxChip renders flight-category-colored chip

1. After Phase D, load the full bundle.
2. **Expected:** SVG contains 3 chips (one per route airport with weather data). KMEM chip color matches its METAR flight category from the wx scenario; KOLV + KMKL chips match theirs.

### XC-32: AirmetPolygon renders per-family stroke

1. Inspect the rendered SVG.
2. **Expected:** 3 `<path class="airmet">` elements (one per AIRMET in the wx bundle). Sierra family = orange dashed; Tango = yellow dashed; Zulu = cyan dashed. Polygon outlines visible.

### XC-33: AIRMET click opens detail

1. Click an AIRMET polygon.
2. **Expected:** the `'airmet-click'` event fires with the AirmetView; a side panel or tooltip surfaces the AIRMET id + family + valid window + hazard description.

### XC-34: WaypointDetailDrawer opens with full data

1. Click a route waypoint.
2. **Expected:** the drawer slides in from the right showing: airport metadata (name, elevation, runways, frequencies), the latest METAR text + parsed flight category, the latest TAF text (if a TAF station), the AIRMETs the waypoint sits inside, a "view in flightbag" stub.
3. Press Esc.
4. **Expected:** drawer closes.

---

## Phase E -- aircraft performance projection

### XC-40: C172N AircraftSpec literal validates

1. Import `C172N_SKYHAWK` from `@ab/spatial-engine/server`. Pass through `aircraftSpecSchema.parse`.
2. **Expected:** validates without errors. CG envelope has fwd < aft at every weight. Perf polar is monotonic in pressure altitude. `course/aircraft/c172n-skyhawk/CITATION.md` exists and maps every field to a POH page.

### XC-41: derivePerformance produces expected leg table

1. Run `composeBundle` for the v1 scenario.
2. **Expected:** `bundle.performance.legs.length === 4`; each leg carries `distanceNm`, `trueCourse`, `magneticHeading`, `altitudeFtMsl`, `groundSpeedKt`, `eteMin`, `fuelGal`, `windFromDeg`, `windKt`.

### XC-42: total fuel matches hand-calculated expected

1. Hand-calculate the expected total fuel: for each leg, use the route's authored coords + `greatCircleNm` for distance + 110 kt TAS at 4500 ft from the polar + the wx scenario's winds aloft at the leg midpoint + 8 gph cruise burn. Sum the per-leg fuel.
2. Compare to `bundle.performance.totalFuelGal`.
3. **Expected:** within 1 gal of the hand-calculated value.

### XC-43: reserve is non-negative

1. Check `bundle.performance.reserveGal`.
2. **Expected:** non-negative (the v1 route is short enough that a fully-fueled C172N has plenty of reserve).

### XC-44: pathological long route is rejected by validate

1. Synthesize a `RouteSpec` with waypoints extending the route to 400 nm; register temporarily.
2. Run `bun run xc-scenario validate <pathological-slug>`.
3. **Expected:** exits non-zero with a per-leg breakdown and the "reserve < 0" rejection.
4. Revert the synthetic scenario.

### XC-45: LegLabel shows full payload

1. Hover a leg label.
2. **Expected:** `<dist nm> @ <course> deg | <fuel gal> @ <ETE min> | <wind dir>/<wind kt>`.

### XC-46: PerformanceBand renders sticky footer

1. Inspect the rendered viewer.
2. **Expected:** a sticky strip at the bottom shows: total fuel + reserve + total ETE + a CG envelope graph with the current CG plotted. Token colors green for safe reserve.

### XC-47: LegDetailDrawer opens on leg click

1. Click a leg in the canvas.
2. **Expected:** the drawer shows full leg payload, cumulative fuel up to that leg, wind triangle, from/to waypoint summaries.

---

## Phase F -- SvelteKit page + directive + check-wire-in

### XC-50: viewer page renders end-to-end

1. Run `bun run dev` for `apps/spatial/`. Navigate to `/spatial/xc/kmem-kmkl-kolv-frontal-march`.
2. **Expected:** the full viewer renders: sectional + airspace + airports + route + waypoints + leg labels + METAR chips + AIRMET polygons + performance band. No console errors. No hydration errors.

### XC-51: scenario picker lists v1 scenario

1. Navigate to `/spatial/xc`.
2. **Expected:** the index page shows one entry for `kmem-kmkl-kolv-frontal-march` with its human label; clicking it navigates to the viewer.

### XC-52: `bun run xc-scenario list` enumerates 1 scenario

1. Run `bun run xc-scenario list`.
2. **Expected:** prints 1 line `kmem-kmkl-kolv-frontal-march -- KMEM -> KMKL -> KOLV -- Cold Front Passage (March)`.

### XC-53: `bun run xc-scenario build` is idempotent

1. Run `bun run xc-scenario build kmem-kmkl-kolv-frontal-march`.
2. Re-run.
3. **Expected:** second invocation produces no `git diff` change in `data/xc-scenarios/kmem-kmkl-kolv-frontal-march/`.

### XC-54: `bun run xc-scenario validate --all` runs without writing

1. With a clean working tree, run `bun run xc-scenario validate --all`.
2. **Expected:** exits 0; prints per-scenario pass status; no files modified.

### XC-55: validate-all wired into `bun run check`

1. Run `bun run check all`.
2. **Expected:** the `xc-scenario-validate` step appears in the per-step output at `.cache/check/xc-scenario-validate.{stdout,stderr,exit}`; exits 0.

### XC-56: check fails loud on a regression

1. Edit `libs/spatial-engine/src/flight/routes/kmem-kmkl-kolv.ts` to add a waypoint outside the Memphis region bounds.
2. Run `bun run check all`.
3. **Expected:** the `xc-scenario-validate` step fails; the error message names the offending waypoint id + the region bounds.
4. Revert.

### XC-57: check fails loud on an inconsistent scenario

1. Edit the `kmem-kmkl-kolv-frontal-march.ts` scenario's `validAt` to a time outside the wx scenario's truth.validAt window.
2. Run `bun run check all`.
3. **Expected:** the validate step fails with a "wx scenario does not cover the flight window" message.
4. Revert.

### XC-58: `:::xc-viewer` directive contract documented

1. Open `docs/work-packages/xc-viewer-v1/CONSUMER-CONTRACT.md`.
2. **Expected:** the doc enumerates the data sources the directive resolver reads (bundle.json, performance.json, route.geojson optional); the resolver invokes `<XcViewer bundle={...} />` from `@ab/spatial-ui`; failure modes are specified (missing slug, missing fields, render error).

### XC-59: course-step example references the v1 scenario

1. Open the course-step file Phase F.4 modified under `course/courses/weather-comprehensive/sections/`.
2. **Expected:** the markdown body contains `:::xc-viewer slug="kmem-kmkl-kolv-frontal-march"`; the file passes the existing course-step lint.

### XC-60: end-to-end render in the consumer (manual, post-Phase-F)

(Requires the consumer-WP `:::xc-viewer` directive resolver to be implemented; this scenario is informational until that ships.)

1. Visit the course step in the study app's reader.
2. **Expected:** the panel shows the v1 viewer mounted inline; the sectional + route + weather chips + performance band visible at the course step's natural width; clicking a waypoint opens the detail drawer at the course-step level.

---

## Cross-cutting

### XC-70: bundle JSON is valid + matches schema

1. After Phase F, open `data/xc-scenarios/kmem-kmkl-kolv-frontal-march/bundle.json`.
2. **Expected:** valid JSON; passes `scenarioBundleSchema.parse`; contains every field declared in the type.

### XC-71: route.geojson matches the route literal

1. Open `data/xc-scenarios/kmem-kmkl-kolv-frontal-march/route.geojson`.
2. **Expected:** valid GeoJSON FeatureCollection with one LineString (the route) + 5 Point features (the waypoints). Coordinates match the literal.

### XC-72: performance.json matches the bundle

1. Open `data/xc-scenarios/kmem-kmkl-kolv-frontal-march/performance.json`.
2. **Expected:** carries 4 legs with full per-leg breakdown; totals match the bundle's `performance.totalFuelGal` + `reserveGal`.

### XC-73: no value re-exports leak through the runtime barrel

1. Run `bun run check` (the browser-globals step).
2. **Expected:** `check-browser-globals.ts` reports `libs/spatial-engine/src/index.ts` has 0 value re-exports; all values flow through `libs/spatial-engine/src/server.ts`.

### XC-74: `libs/spatial-ui` is browser-safe

1. Inspect `libs/spatial-ui/src/index.ts` and every component.
2. **Expected:** no static imports of `node:*`; no references to `Buffer` / `process`; the lib bundles cleanly into `apps/spatial/` without browser-hydration errors.

### XC-75: Memphis ingest has provenance

1. Open `course/sectionals/memphis/manifest.yaml`.
2. **Expected:** records the FAA dCS cycle + the fetch date + the URL of the source archive + the ingest tool version.

### XC-76: C172N spec has citations

1. Open `course/aircraft/c172n-skyhawk/CITATION.md`.
2. **Expected:** maps every `AircraftSpec` field (perfPolar, fuelBurnCurve, wbEnvelope, equipment, fuelCapacityGal, serviceCeilingFtMsl) to a POH section + page number.

### XC-77: viewer renders cleanly in dark mode

1. Switch theme to dark.
2. **Expected:** every spatial token resolves to its dark-theme value; the sectional remains legible; no light-on-light or dark-on-dark; AIRMET colors remain distinguishable per family.

### XC-78: viewer is keyboard-navigable

1. Tab through the viewer.
2. **Expected:** focus moves through waypoints + legs + AIRMETs + controls in a logical order; Enter/Space activates the focused element; Esc closes any open drawer.
