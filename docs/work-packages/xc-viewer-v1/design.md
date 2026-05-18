---
id: xc-viewer-v1
title: 'Design: XC Viewer v1 -- Universal Pre-Flight Stage (First Slice)'
product: sim
category: feature
status: draft
agent_review_status: done
human_review_status: pending
created: 2026-05-11
owner: agent
depends_on:
  - wx-engine
unblocks: []
tags:
  - xc-viewer
  - spatial
  - design
  - architecture
legacy_fields:
  feature: xc-viewer-v1
  type: design
---

# Design: XC Viewer v1 -- Universal Pre-Flight Stage (First Slice)

WP-specific design notes. **Source of truth for the architecture, four-layer framing, and killer-feature thesis is** [docs/vision/products/pre-flight/xc-viewer/VISION.md](../../vision/products/pre-flight/xc-viewer/VISION.md). Read that first; this doc only adds the production-WP shape on top of it (library decomposition, browser-safety contract, test seams, parallel-phase wiring, the C172N spec authoring discipline, and the sectional-ingest design).

## Library shape derives from the wx-engine pattern, not from a clean-sheet design

The wx-engine WP ([spec.md](../wx-engine/spec.md)) shipped the truth-aware substrate pattern: server-only library writing pure-code-derived artifacts under `data/` from layered TS literals + a Zod-validated schema + a CLI dispatcher + a `:::directive` contract for course-step mounting. The xc-viewer is the **same shape applied to spatial composition**.

The reasons this matters:

- **Browser-safety discipline is proven.** `libs/wx-engine/` ships values via `@ab/wx-engine/server` and types via `@ab/wx-engine`. `check-browser-globals.ts` walks the runtime barrel and rejects value leaks. `libs/spatial-engine/` follows the same split exactly. No invention.
- **Output-as-filesystem-contract is proven.** Course-step directives read `data/wx-scenarios/<slug>/*.json` at server-load time without a cross-lib code dependency. The xc-viewer's `:::xc-viewer slug="..."` directive reads `data/xc-scenarios/<slug>/bundle.json` the same way. The course-reader-and-editor consumer adds one directive resolver; everything else is already shaped.
- **CLI dispatcher pattern is proven.** `scripts/wx-scenario.ts` builds / validates / lists / runs the round-trip check. `scripts/xc-scenario.ts` mirrors that shape; `scripts/sectionals.ts` adds region ingest.
- **Per-phase shipping is proven.** wx-engine's six-phase plan (A: scaffold, B/C: parallel layers, D: cross-cutting, E: scenario expansion, F: CLI + check wire-in) ships PRs that are reviewable. xc-viewer v1 uses the same six-phase shape with the layer boundary that fits this surface.

If a composition function reaches for a primitive the wx-engine shape did not anticipate, that primitive earns a place in `libs/spatial-engine/src/geography/` or `libs/spatial-engine/src/flight/`. The shape evolves; it does not get rewritten.

## Six-phase plan: scaffold first, parallel mid, integration last

Phasing is the load-bearing design decision. The v1 cap requires:

1. End-to-end proof as fast as possible (one scenario shipped, mountable into a course step)
2. Parallel work on geography ingest + flight specs wherever possible (different agents in different worktrees once the scaffold lands)
3. Real aircraft + real sectional authored only after the contract is stable
4. CLI hardening + the validate-all check wired into `bun run check` last
5. The mounted course step lands last so the directive contract has a stable bundle to mount

Six phases shape that intent into shippable PRs:

| Phase | Deliverable                                                                                       | Why this grouping                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| A     | `libs/spatial-engine/` scaffold + Region/Route/Aircraft/Scenario types + Memphis sectional ingest | Substrate cannot be partially shipped. The Memphis vector ingest is the regression baseline for B/C/D/E/F                             |
| B     | Sectional renderer (vector basemap with roads / cities / airspace boundaries)                     | Pure browser-safe rendering against layer-1 data. Parallelizable with Phase C internally (one agent on renderer, one on flight specs) |
| C     | Route + waypoint renderer + leg labels (distance, course, fuel placeholder)                       | Layer-2 composition; depends on Phase A types, parallel with Phase B renderer                                                         |
| D     | Weather overlay (mount existing wx-engine scenario `frontal-xc-march`; chips + AIRMETs)           | Layer-3 composition; sequential after B+C because waypoint chips render at route waypoint positions                                   |
| E     | Aircraft performance projection (per-leg fuel / time / W&B) + the C172N spec                      | Layer-2 hardening; final performance numbers replace Phase C placeholders                                                             |
| F     | SvelteKit page + `:::xc-viewer` directive contract + course-step mount + check-wire-in            | Integration + the `bun run check` wire-in + the directive contract doc                                                                |

Each phase opens its own PR titled `feat(xc-viewer): <phase> -- <summary>`. Each PR includes:

- Code changes for that phase
- Per-phase regression baseline (Phase A: Memphis ingest passes Zod; Phase B: sectional renders cleanly in a Playwright smoke; Phase C: route overlay matches the literal's waypoint count; Phase D: every waypoint's METAR chip resolves to a real wx-engine product field; Phase E: total-fuel + reserve match a hand-calculated expected value; Phase F: `bun run check` includes the validate step and runs green)
- Test additions per the test-plan.md scenarios for that phase
- `bun run check` clean

A blocks everything. B and C can ship in parallel (different files; one agent on `libs/spatial-ui/SectionalCanvas.svelte`, one agent on `libs/spatial-engine/src/flight/`). D follows B+C because chips render at route waypoint positions. E follows D because the performance derivation needs winds-aloft from layer 3. F runs last.

## Strict separation: code in libs/spatial-engine/, data in data/, source bytes in cache

The spec mandates the library is pure code; outputs land at `data/xc-scenarios/<slug>/`; vector geography lives under `course/sectionals/<region>/` (committed); FAA dCS source archives live in the developer-local cache. The reasons:

- **Browser-bundle hygiene**: `libs/spatial-engine/` is server-only because it touches the filesystem (ingest + bundle write), holds large vector literals (Memphis sectional vector geometry is ~5-10 MB of GeoJSON; even compiled-out TS literals would bloat the bundle), and imports the FAA dCS ingester pipeline.
- **Bytes don't belong in code review**: a scenario authoring change should diff cleanly as one TS file (the `ScenarioSpec` literal); the generated bundle (`data/xc-scenarios/<slug>/`) is a derived artifact. The bundle is committed (small, deterministic) so course steps can reference it without a build dependency, but reviewers focus on the literal -- the bundle is verified by spot-checking the rendered output.
- **Cache vs commit**: scenario `bundle.json` + `route.geojson` + `performance.json` are committed (small, stable, load-bearing for course content). Sectional vector geometry under `course/sectionals/<region>/` is committed because it changes only on FAA cycle bumps. FAA dCS source archives are NOT committed -- they live in the cache per ADR 018.

The CLI is the bridge. It loads layer-1/2/3 sources, calls `composeBundle` + `writeScenarioBundle`, lands files at the canonical paths the consumer expects. The consumer (course-reader-and-editor) reads the files at runtime via the `:::xc-viewer` directive resolver -- no cross-lib import.

## Browser-safety contract

Read [CLAUDE.md "Critical Rules"](../../../CLAUDE.md) and [docs/agents/debug-playbooks/browser-hydration.md](../../agents/debug-playbooks/browser-hydration.md) before authoring any code in these libs.

- `libs/spatial-engine/src/index.ts` (the runtime barrel) is `import type` only. Every value re-export is rejected by `check-browser-globals.ts`.
- `libs/spatial-engine/src/server.ts` (the server-only barrel) carries `composeBundle`, `writeScenarioBundle`, `loadGeography`, `loadFlight`, `loadWeatherForScenario`, `derivePerformance`, the registry, every Zod schema as a value (acceptable here -- the runtime barrel can re-export Zod schemas as values because Zod itself is browser-safe; we still prefer the server barrel for cleanliness). Tagged with `// @browser-globals: server-only -- never imported by client .svelte` at the top.
- `libs/spatial-ui/` is browser-safe. Components import `type ScenarioBundle` from `@ab/spatial-engine`; never values from the server barrel. The bundle is loaded server-side in `apps/spatial/src/routes/spatial/xc/[slug]/+page.server.ts` and passed to the page component as data.
- The bundle writer (`writeScenarioBundle` in `libs/spatial-engine/src/bundle.ts`) lazy-loads `node:fs`, `node:path`, `node:os` via `process.getBuiltinModule(...)` inside the function body, gated behind a `typeof process !== 'undefined'` check. Canonical pattern: `libs/constants/src/source-cache.ts`.
- The sectional ingester (`libs/spatial-engine/src/geography/ingest.ts`) is server-only and imports `node:fs` + unzip helpers via the same lazy-load pattern.
- The course-step `:::xc-viewer` directive consumer reads the bundle file at runtime via SvelteKit's `+page.server.ts` data load (the same pattern the wx-engine `:::scenario` directive uses) -- the consumer never imports `@ab/spatial-engine` from a `.svelte` file.

`check-browser-globals.ts` walks every value re-export from `libs/spatial-engine/src/index.ts` and confirms the transitive import chain stays browser-safe.

## Why vector sectional for v1 (not raster)

The decision matters because it shapes Phase A + Phase B.

| Aspect                | Vector (v1 choice)                                                                    | Raster (deferred)                                                        |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Source                | FAA digital sectional vector data (dCS) + Natural Earth basemap                       | FAA digital sectional raster tiles                                       |
| Storage               | GeoJSON in repo (~5-10 MB committed) per region                                       | TMS/XYZ tile pyramid in cache (~100 MB) per region                       |
| Styling               | Design tokens; matches airboss theme; recolorable for dark mode + colorblind variants | Fixed FAA palette; cannot recolor                                        |
| Render performance    | SVG path rendering; good at modest zoom, slows at high node counts                    | Image tile rendering; fast at every zoom; standard tile server pattern   |
| Accessibility         | Each feature is a DOM element with a stable id -> screen reader + keyboard navigation | Image only; alt-text or overlay aria layer required                      |
| Pedagogy              | Highlight + isolate features programmatically ("show me only Class D airspace")       | Cannot isolate features without an overlay layer                         |
| Build complexity (v1) | One ingest script per region; vector pipeline already exists in wx-charts (`d3-geo`)  | Requires a tile server or a static tile mount; new infrastructure for v1 |
| Visual realism        | Schematic / styled -- looks like an airboss product, not like a FAA chart photo       | Pixel-identical to the FAA chart                                         |

The pedagogical case for vector: when a learner clicks "show me only Class D airspace", the renderer can hide every other feature. When the system says "the IFR alternate at KMKL is inside the airport's airspace", the renderer can highlight the airspace polygon. Raster tiles cannot do this without an overlay vector layer anyway -- so v1 ships the vector layer and defers the raster to a follow-on WP that adds the photographic accuracy on top of the vector substrate.

The build-complexity case: v1 ships in one ingest pass. Raster would need a separate WP for tile server setup, cache eviction policy, FAA cycle update workflow. Out of scope.

The cost: visually less recognizable as "an FAA sectional". v1 accepts this -- the airboss visual identity is its own design language.

## Per-layer module layout (`libs/spatial-engine/src/`)

```text
libs/spatial-engine/src/
  index.ts                                     runtime barrel: TYPE-only re-exports
  server.ts                                    server-only barrel: every value
  projection.ts                                Lambert helper (per-region parallels)

  geography/
    types.ts                                   Region, Airspace, Airport, Navaid, Basemap
    schema.ts                                  Zod schemas (region, airport, airspace polygon)
    loader.ts                                  loadGeography(regionSlug): Geography
    ingest.ts                                  FAA dCS ingester (server-only; lazy-loads node:*)
    cache.ts                                   per-region cache key + invalidation rules

  flight/
    types.ts                                   RouteSpec, AircraftSpec, Waypoint, Leg, ...
    schema.ts                                  Zod schemas
    routes/
      kmem-kmkl-kolv.ts                        v1 RouteSpec literal
    aircraft/
      c172n-skyhawk.ts                         v1 AircraftSpec literal
    loader.ts                                  loadFlight(scenarioId): Flight
    geometry.ts                                greatCircleNm, greatCircleBearing, midpoint
    performance.ts                             derivePerformance(route, aircraft, weather): PerformanceTable
    wind.ts                                    interpolateWind, applyWind (true-course/TAS/wind -> heading/GS)

  scenario/
    types.ts                                   ScenarioSpec, TimedEvent (v2+), ScenarioBundle
    schema.ts                                  Zod schemas
    scenarios/
      kmem-kmkl-kolv-frontal-march.ts          v1 ScenarioSpec literal
    registry.ts                                loadScenario(slug): ScenarioSpec
    compose.ts                                 composeBundle({...}): ScenarioBundle

  weather/
    view.ts                                    loadWeatherForScenario(slug, validAt): WxBundleView
                                               projects wx-engine output to waypoint queries
    types.ts                                   WxBundleView, WaypointWxView, AirmetView, ChartRef

  bundle.ts                                    writeScenarioBundle(bundle, opts): Promise<void>

  validate/
    consistency.ts                             cross-layer invariants
    schema-check.ts                            schema-level validation entrypoint

  __tests__/                                   Vitest specs (per phase)
```

## Per-layer module layout (`libs/spatial-ui/src/`)

```text
libs/spatial-ui/src/
  index.ts                                     runtime barrel (browser-safe)
  XcViewer.svelte                              top-level composition; props: { bundle }
  SectionalCanvas.svelte                       layer-1 renderer (basemap + airspace + airports + navaids)
  RouteOverlay.svelte                          layer-2 renderer (route line + waypoints + leg labels)
  WaypointWxChip.svelte                        layer-3 renderer (METAR/TAF flight-category chip per waypoint)
  AirmetPolygon.svelte                         layer-3 renderer (AIRMET ring overlay; family-colored)
  LegLabel.svelte                              per-leg distance / course / fuel callout
  PerformanceBand.svelte                       sticky footer: total fuel / reserve / ETA / W&B indicator
  PlateStub.svelte                             airport-detail side panel (frequencies + runways; full plate is OOS)
  WaypointDetailDrawer.svelte                  side panel on waypoint click
  LegDetailDrawer.svelte                       side panel on leg click
  controls/
    ZoomPanControls.svelte                     pan / zoom UI
    LayerToggle.svelte                         airspace / terrain / weather layer toggles
  styles/
    tokens.ts                                  per-feature theme tokens (Class B color, Class D color, ...)
```

The component family uses Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`, `$bindable`); snippets (`{#snippet}` + `{@render}`); `$app/state` not `$app/stores`. Imports follow `@ab/*` aliases. No `<slot>`, no Svelte 4 patterns. Per CLAUDE.md.

## CLI dispatcher (`scripts/xc-scenario.ts` + `scripts/sectionals.ts`)

Two dispatchers because they're independent nouns. Each follows the canonical dispatcher pattern (`scripts/wp.ts`, `scripts/bug.ts`, `scripts/track.ts`):

```text
scripts/xc-scenario.ts                                <-- noun: xc-scenario
  bun run xc-scenario list                            enumerate registered scenarios from XC_SCENARIO_VALUES
  bun run xc-scenario build <slug>                    compose + write bundle for one scenario
  bun run xc-scenario build --all                     walk every scenario
  bun run xc-scenario validate <slug>                 run schema + consistency checks (no writes)
  bun run xc-scenario validate --all                  wired into `bun run check`

scripts/sectionals.ts                                 <-- noun: sectionals
  bun run sectionals list                             enumerate ingested regions from XC_REGION_VALUES
  bun run sectionals ingest <region>                  read FAA dCS source from cache, write vectors
                                                      to course/sectionals/<region>/
```

The dispatchers read `process.argv.slice(2)`, switch on the first arg, print help when called with no args / `help` / `-h` / `--help`. No colons in script names per repo discipline. Help output mirrors the existing `bun run wp` / `bun run wx-scenario` shape.

## Aircraft spec authoring discipline

The v1 C172N spec is hand-authored from the 1977/1978 POH. The shape:

```typescript
// libs/spatial-engine/src/flight/aircraft/c172n-skyhawk.ts

import type { AircraftSpec } from '../types';

/**
 * Cessna 172N Skyhawk. POH-derived performance for v1.
 * Source: Cessna 172N Pilot Operating Handbook (1978 reprint).
 * Citations: course/aircraft/c172n-skyhawk/CITATION.md
 */
export const C172N_SKYHAWK: AircraftSpec = {
  id: 'c172n-skyhawk',
  model: 'Cessna 172N Skyhawk',
  // Section 5, POH p. 5-9 (cruise performance, 75% power, std day)
  perfPolar: {
    climb: { rateFpm: 700, kiasIas: 75 },
    cruise: {
      // Pressure altitude -> TAS at 75% power, ISA day
      points: [
        { pressureAltitudeFtMsl: 2000, tasKt: 109, gph: 8.4 },
        { pressureAltitudeFtMsl: 4000, tasKt: 112, gph: 8.2 },
        { pressureAltitudeFtMsl: 6000, tasKt: 114, gph: 8.0 },
        { pressureAltitudeFtMsl: 8000, tasKt: 116, gph: 7.8 },
      ],
    },
    descent: { rateFpm: 500, kiasIas: 110 },
    serviceCeilingFtMsl: 14200,
  },
  fuelBurnCurve: {
    // Standard cruise: 8 gph at 75% power. Linear interp across pressure altitude.
    cruise: { defaultGph: 8.0 },
    climb: { gph: 10.0 },
    taxi: { gph: 1.4 },
  },
  fuelCapacityGal: 40, // standard tanks; long-range tanks (50 gal) deferred
  wbEnvelope: {
    // Section 6, POH p. 6-12 (CG envelope, normal category)
    maxGrossWeightLb: 2300,
    minWeightLb: 1500,
    // CG limits as a function of weight (forward / aft fence)
    envelope: [
      { weightLb: 1500, fwdCgIn: 33.0, aftCgIn: 47.3 },
      { weightLb: 1950, fwdCgIn: 35.5, aftCgIn: 47.3 },
      { weightLb: 2300, fwdCgIn: 38.5, aftCgIn: 47.3 },
    ],
  },
  equipment: {
    nav: ['vor', 'gps-vfr-only'],
    com: ['comm-1', 'comm-2'],
    transponder: 'mode-c',
    adsbOut: false,
    autopilot: false,
    ifrCertified: false,
  },
};
```

The literal carries POH section references in JSDoc comments + a separate CITATION.md that maps each field to its POH page. The Zod schema validates that the envelope is a valid CG polygon (forward and aft fences don't cross), the polar points are monotonic in pressure altitude, and the fuel capacity is reasonable for the model.

POH ingest from PDF is a follow-on WP. v1 transcription is acceptable because (a) one aircraft is enough for the v1 cap, (b) the POH source is stable (the C172N hasn't been published since 1979 -- the POH does not change), (c) the citation makes the transcription auditable.

## Sectional ingest design

Memphis sectional is the v1 ingest. The ingester reads FAA dCS source bytes from the cache and writes vector geometry to `course/sectionals/memphis/`:

```text
~/Documents/airboss-handbook-cache/sectionals/memphis/        <-- source bytes (per ADR 018)
  dcs-memphis-cycle-2026-05.zip                              FAA dCS archive (downloaded once)
  source-manifest.json                                       cycle + fetch date

course/sectionals/memphis/                                    <-- committed vector outputs
  manifest.yaml                                              region metadata: bounds, parallels, source cycle
  basemap.geojson                                            state outlines, water, roads, cities (vector subset)
  airspace.geojson                                           Class B/C/D/E + SUA polygons
  navaids.geojson                                            VOR / NDB / fix positions + identifiers
  airports.json                                              airport metadata index
  airports/
    KMEM/
      airport.json                                           full record
      CITATION.md                                            NASR record + sectional cycle
    KOLV/
      airport.json
      CITATION.md
    KMKL/
      airport.json
      CITATION.md
```

The ingester is a one-shot per FAA dCS cycle. The cycle is recorded in `manifest.yaml`; a cycle bump triggers a re-ingest (subsequent WP). v1 pins to whichever cycle is current at the time of authoring.

The ingester is server-only. Its top-of-file tag is `// @browser-globals: server-only -- never imported by client .svelte`. It lazy-loads `node:fs`, `node:path`, `node:zlib` per the canonical pattern.

The committed output is small (~5-10 MB for one region). Comparable to the wx-engine's committed scenario bundles. Cumulative growth across regions is bounded -- 10 CONUS sectional regions would be ~80 MB committed, well below the LFS threshold per ADR 018.

## Test seams: composition + render parity

Vitest unit tests cover individual derivation functions with synthetic layer data (small literals). Integration tests assert the full bundle (`composeBundle({ scenarioId: 'kmem-kmkl-kolv-frontal-march', ... })`) against a hand-calculated expected per-leg performance table -- the v1 baseline.

The cross-cutting check is **schema + consistency validation**. Every authored literal (`RouteSpec`, `AircraftSpec`, `ScenarioSpec`) validates through its Zod schema at load time. Every composed bundle passes cross-layer consistency (route waypoints in region bounds, alternate in airport table, performance reserve non-negative). The check runs:

- Inside per-literal unit tests (B.x, C.x, E.x)
- Inside the integration composition test (Phase D)
- Inside the Phase F `bun run xc-scenario validate --all` step
- Inside `bun run check` (Phase F wires the step into the pipeline)

The check is what enforces the guarantee "the viewer cannot ship a bundle whose composition produces inconsistent claims."

Cross-layer consistency checks live in `libs/spatial-engine/src/validate/consistency.ts`:

- Every `RouteSpec.waypoints[*]` is inside `Geography.bounds`
- Every `RouteSpec.alternate` (if set) is in `Geography.airports`
- The `wxScenarioSlug` covers the route's planned departure + ETA window
- `PerformanceTable.reserveGal >= 0`
- Every `RouteSpec.altitudeProfile[*]` is below the aircraft's service ceiling
- Every waypoint id is unique within the route

They are not unit tests -- they are scenario-level invariants. Failing one is a bug in the scenario literal OR a bug in the loader / composer; the validator surfaces enough context to triage.

## Per-leg performance accuracy bounds (v1)

v1 uses great-circle distance + leg-midpoint wind interpolation + linear interpolation of aircraft TAS / fuel-burn across pressure altitude. The expected accuracy bounds:

| Quantity                     | v1 accuracy              | Real-flight tolerance       | Verdict for v1                                          |
| ---------------------------- | ------------------------ | --------------------------- | ------------------------------------------------------- |
| Distance per leg             | < 0.5 nm error           | +/- 1 nm                    | Tighter than tolerance                                  |
| True course per leg          | < 0.5 deg error          | +/- 1 deg                   | Tighter than tolerance                                  |
| Magnetic heading (wind-cor)  | < 1 deg error            | +/- 2 deg                   | Tighter than tolerance                                  |
| Ground speed per leg         | < 2 kt error             | +/- 3 kt                    | Tighter than tolerance                                  |
| ETE per leg                  | < 1 min error            | +/- 2 min                   | Tighter than tolerance                                  |
| Fuel per leg                 | < 0.3 gal error          | +/- 0.5 gal                 | Tighter than tolerance                                  |
| Cumulative fuel reserve      | < 1 gal error            | +/- 1.5 gal                 | Tighter than tolerance                                  |
| Variation (true -> magnetic) | flat 4 deg E for Memphis | varies <0.5 deg over region | Acceptable; v2+ may use the NOAA WMM grid for precision |

v1 hand-codes magnetic variation to a single per-region constant (East 4 deg for Memphis as of 2026). The variation grid is a follow-on enhancement when a route crosses regional bounds.

## Mountpoint contract: the `:::xc-viewer` directive

The `:::xc-viewer slug="<scenario-slug>"` directive renders the viewer inline in a course step. The directive resolver lives in the course-reader-and-editor consumer; this WP defines the contract.

```text
Course step markdown:
  :::xc-viewer slug="kmem-kmkl-kolv-frontal-march"

Resolver behavior:
  1. Read data/xc-scenarios/<slug>/bundle.json
  2. Read data/xc-scenarios/<slug>/performance.json
  3. Read data/xc-scenarios/<slug>/route.geojson (optional; bundle.json has the same shape)
  4. Render <XcViewer bundle={data.bundle} performance={data.performance} /> from @ab/spatial-ui
  5. The viewer renders at the course-step's natural width with an aspect-ratio hint (16/9 default)
  6. Click affordances open side panels rendered at the course-step level (drawer, not modal)

Failure modes:
  - slug doesn't exist: render a placeholder "scenario not found: <slug>" + a course-step lint fail at bun run check
  - bundle.json missing fields: schema validation at resolver time; render an error placeholder
  - viewer component throws (e.g. browser SVG limit): error boundary in the course-reader catches and renders a placeholder
```

Same pattern as the wx-engine `:::scenario` directive. Phase F.3 documents the contract at `docs/work-packages/xc-viewer-v1/CONSUMER-CONTRACT.md`; the consumer-WP backlog gets a follow-on item to implement the resolver.

## Open design questions resolved in this WP

1. **Where does `apps/spatial/` live, and what's the port?** Resolved: new SvelteKit app under `apps/spatial/`. Port: `PORTS.SPATIAL = 9650` in `libs/constants/src/ports.ts` (dev-port +10 grid: study 9600, sim 9610, hangar 9620, avionics 9630, flightbag 9640, spatial 9650; E2E port `SPATIAL_E2E = 9653` per the +3 offset). The earlier draft proposed `9610`, which collided with `SIM` -- corrected. Apps doc updated in `docs/products/spatial/INDEX.md` (created in Phase F).
2. **What shape is the aircraft spec for v1?** Resolved: hand-authored TS literal under `libs/spatial-engine/src/flight/aircraft/c172n-skyhawk.ts` plus a citation map under `course/aircraft/c172n-skyhawk/CITATION.md`. POH PDF ingest is a follow-on WP (see OUT-OF-SCOPE).
3. **Vector vs raster sectional?** Resolved: vector. See "Why vector sectional for v1" above. Raster ingest is a follow-on WP.
4. **How does wx flow into the viewer?** Resolved: by slug reference. `ScenarioSpec.wxScenarioSlug` points at a `WxScenario`; `loadWeatherForScenario` reads the wx-engine output at `data/wx-scenarios/<slug>/` and projects to waypoint queries. No cross-lib code coupling.
5. **Does v1 include scenario events?** Resolved: no. `events: []` in v1; the type field exists so v2+ adds events without a schema migration. The event type union is declared in `libs/spatial-engine/src/scenario/types.ts` so the wider design is visible, but no event handler exists in v1.
6. **Does v1 include an editor?** Resolved: no. v1 is read-only. The hangar-app editor is a follow-on WP (`xc-editor-v1`).
7. **What does the mounted course step look like?** Resolved: one course step in `course/courses/weather-comprehensive/sections/<existing-section>.yaml` containing `:::xc-viewer slug="kmem-kmkl-kolv-frontal-march"` as the proof. The exact section is selected during Phase F based on which weather-comprehensive section best fits frontal-passage pedagogy (probably the "wx-airmasses-and-fronts" step or the "wx-go-nogo-decision" step).
8. **Does the renderer use SVG or Canvas?** Resolved: SVG. Reasons: (a) each feature is a DOM element with stable id -> screen reader + keyboard nav; (b) design tokens compose; (c) v1 sectional + route geometry is small enough that SVG performance is fine. Canvas may be revisited if v2+'s larger sectionals + time-stepping show measurable lag.

No new open design questions surface from the production-WP framing.

## Per-scenario chart and feature counts (v1)

For the `kmem-kmkl-kolv-frontal-march` scenario:

| Quantity                 | Count                                                                 |
| ------------------------ | --------------------------------------------------------------------- |
| Waypoints                | 5                                                                     |
| Legs                     | 4                                                                     |
| Region airports rendered | 3 (KMEM, KOLV, KMKL) + ~20 surrounding airports from the FAA dCS data |
| Class B polygons         | 1 (KMEM)                                                              |
| Class D polygons         | 2 (KOLV, KMKL)                                                        |
| METAR chips              | 3 (one per route airport)                                             |
| TAF chips                | 3 (one per route airport that has a TAF in the wx scenario)           |
| AIRMET polygons          | 3 (carried over from the wx-engine scenario)                          |
| Performance band entries | 1 (per-flight summary)                                                |

The v1 surface is bounded. Subsequent scenarios reuse the Memphis region geography + the C172N aircraft + may swap the route + swap the wx scenario.

## What the production lib does NOT do (in scope)

For completeness; cross-reference with [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md) for the full deferral list:

- Does not render airport plates (the `<PlateStub>` component shows frequencies + runways only; full plate viewer is a follow-on WP `xc-viewer-plates`)
- Does not ingest the FAA AeroNav plate library (separate WP gated on AeroNav format research)
- Does not render IFR enroute charts (separate WP `xc-viewer-ifr-enroute`)
- Does not implement scenario perturbation events (separate WP `xc-scenario-events`)
- Does not implement the hangar-app editor (separate WP `xc-editor-v1`)
- Does not consume live wx feeds -- rejected per OUT-OF-SCOPE for the same pedagogical reason as the wx-engine
- Does not include touch / mobile interactions -- desktop pre-flight surface first
- Does not include 3D terrain visualization -- deferred to `spatial-3d` if ever requested

## Relationship to apps/sim/ and apps/flightbag/

The three apps are complementary:

| App               | Role                                | Reads from this WP?                                                              |
| ----------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| `apps/spatial/`   | PLAN / BRIEF surface (this WP)      | n/a -- this app is the surface                                                   |
| `apps/sim/`       | FLY surface (existing scaffold)     | Eventually -- the same `ScenarioBundle` can be loaded into sim for the fly leg   |
| `apps/flightbag/` | LIBRARY surface (existing scaffold) | Eventually -- citation chips from the viewer deep-link into flightbag references |

v1 ships only `apps/spatial/`. Cross-app integration is a follow-on once both sim and flightbag are real consumers. The `ScenarioBundle` shape is designed so sim and flightbag can read it without schema churn.

## Naming + vocabulary

- The product name is **"XC Viewer"** in user-facing copy and in this WP. "XC" abbreviates "cross-country" (FAA + GA standard term).
- The app is `apps/spatial/` per [MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- the surface holds route + airport + airspace + map products; the XC viewer is the first product on this surface.
- The library lib is `libs/spatial-engine/` -- the noun is "spatial" because the lib will hold airport / airspace primitives for future spatial products (airport cards, airspace navigator) alongside the XC composition pipeline.
- The renderer lib is `libs/spatial-ui/` -- mirrors the wx-charts / wx-engine split (engine = pure code, renderer = browser-safe components).
- Per VOCABULARY.md: "Brief" (pre-flight discussion), "Debrief" (post-flight discussion), "Approach", "Pattern", "Procedure", "Profile", "Currency", "Proficiency" are the plain-aviation terms used in viewer copy. No carrier metaphor.
