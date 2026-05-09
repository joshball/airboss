---
id: wx-chart-symbology-library
title: 'Tasks: Weather Chart Symbology Library'
product: platform
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-09
owner: agent
depends_on:
  - course-reader-and-editor
unblocks: []
tags:
  - weather
  - charts
  - library
  - tasks
legacy_fields:
  feature: wx-chart-symbology-library
  type: tasks
---

# Tasks: Weather Chart Symbology Library

Phased plan for [spec.md](./spec.md). Order is dependency-driven: substrate + the first end-to-end chart (Phase A), then the raster + polygon cluster (Phase B), then the point-glyph cluster (Phase C), then the forecast cluster (Phase D), then CVA (Phase E). Each phase ships its own PR titled `feat(wx-charts): <phase> -- <chart list>`.

Depends on: [course-reader-and-editor](../course-reader-and-editor/) (in flight; the consumer of `<CourseStepChart slug="..." />`). The library can land before the consumer ships, since outputs are static SVGs at canonical paths.

## Pre-flight

- [ ] Read [spec.md](./spec.md), [design.md](./design.md), [test-plan.md](./test-plan.md), [user-stories.md](./user-stories.md), [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md) end-to-end.
- [ ] Read [spike 01 -- surface analysis notes](../../../spikes/wx-charts/01-surface-analysis/spike-notes.md) end-to-end. The Phase A renderer is an extraction of this spike's working code.
- [ ] Read [spike 02 -- radar mosaic notes](../../../spikes/wx-charts/02-radar-mosaic/spike-notes.md) end-to-end, especially the "Layer-band contract" section. The substrate's z-order rule is from this spike.
- [ ] Read [spike 03 -- METAR plot grid notes](../../../spikes/wx-charts/03-metar-plot-grid/spike-notes.md) end-to-end, especially the final "Suggested library shape (refined from Spike 2)" section. The library's module layout derives from this recommendation.
- [ ] Read [docs/work-packages/course-reader-and-editor/spec.md](../course-reader-and-editor/spec.md) -- the consumer; understand how `<CourseStepChart slug="..." />` mounts SVGs from `/charts/wx/<slug>/chart.svg`.
- [ ] Read [docs/decisions/018-source-artifact-storage-policy/decision.md](../../decisions/018-source-artifact-storage-policy/decision.md) and [docs/platform/STORAGE.md](../../platform/STORAGE.md). Substrate data lives in repo; raw weather bytes in `~/Documents/airboss-handbook-cache/wx/`.
- [ ] Read [docs/agents/reference-sveltekit-patterns.md](../../agents/reference-sveltekit-patterns.md) for the constants + dispatcher-script conventions. `scripts/charts.ts` mirrors `scripts/db.ts` / `scripts/sources.ts`.
- [ ] Read `libs/constants/src/source-cache.ts` -- the canonical lazy-load pattern for browser-bundled libs that need Node built-ins. The sharp bridge uses the same pattern.
- [ ] Read `libs/bc/study/src/index.ts` and `libs/bc/study/src/server.ts` -- the runtime/server barrel split. `libs/wx-charts/` follows the same shape.
- [ ] Verify the dev cache directory exists: `ls ~/Documents/airboss-handbook-cache/wx/` (create if missing). Phase A copies the spike's surface-analysis JSON inputs into `~/Documents/airboss-handbook-cache/wx/sfc-bulletin/`.
- [ ] Run `bun run check` -- 0 errors before starting.

## Implementation

### Phase A: substrate + surface-analysis (foundation)

Foundational; blocks Phases B/C/D/E. Ships the substrate (`projection`, `basemap`, `graticule`, `chrome`, `layers`, point/collision, the runtime + server barrels), the `scripts/charts.ts` dispatcher, the constants in `libs/constants/src/wx-charts.ts`, the substrate basemaps in `data/references/basemaps/`, and the first end-to-end chart (`surface-analysis`) authored as `data/charts/wx/wx-surface-analysis-2024-12-23-12z/`.

PR title: `feat(wx-charts): Phase A -- substrate + surface-analysis`.

#### A.1 Constants

- [ ] Create `libs/constants/src/wx-charts.ts` with `CHART_TYPES`, `CHART_TYPE_VALUES`, `ChartType`, `CHART_TYPE_LABELS`, `LAYER_BANDS`, `LAYER_BAND_VALUES`, `LayerBand`, `FAA_FLIGHT_CATEGORIES`, `FAA_FLIGHT_CATEGORY_VALUES`, `FaaFlightCategory` per spec.md "Constants" section.
- [ ] Re-export from `libs/constants/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(constants): wx-charts chart-type and layer-band constants`).

#### A.2 Substrate data

- [ ] Create `data/references/basemaps/` directory. Add `us-states-10m.json` and `us-nation-10m.json` (us-atlas package, 10m resolution) -- copy from spike 01's working files or fetch via `bun add us-atlas` and copy the bundled JSONs.
- [ ] Create `data/references/palettes/` directory. Add `nws-reflectivity.json` and `flight-category.json` (placeholder palettes for Phases B/C; Phase A only needs the basemap).
- [ ] Run `bun run check` -- 0 errors. Commit (`data(references): commit basemap topojson and palette stubs for wx-charts`).

#### A.3 Library scaffold

- [ ] Create `libs/wx-charts/` with `package.json` (deps: `d3-geo`, `topojson-client`, `zod`, `js-yaml`; sharp added in Phase B), `tsconfig.json` (extend the repo's lib tsconfig), `src/`.
- [ ] Add `@ab/wx-charts` and `@ab/wx-charts/server` path aliases to the root `tsconfig.base.json` (or wherever the existing `@ab/*` aliases live -- mirror `@ab/bc-study`).
- [ ] Add the lib to the workspace root config (root `package.json` workspaces or `bun.lock`); run `bun install`.
- [ ] Create `libs/wx-charts/src/index.ts` (runtime barrel; empty pending the substrate exports below).
- [ ] Create `libs/wx-charts/src/server.ts` (server-only barrel; empty pending the chart renderers below). Tag with `// @browser-globals: server-only -- never imported by client .svelte` at the top.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(wx-charts): scaffold lib + workspace alias + barrels`).

#### A.4 Substrate primitives

- [ ] Create `libs/wx-charts/src/projection.ts` -- `lambertProjection(opts)`, `fitExtent(projection, geometry, [width, height], [padding])`. Lift from spike 01.
- [ ] Create `libs/wx-charts/src/basemap.ts` -- `loadConusBasemap(path)` (sync read of `data/references/basemaps/us-states-10m.json`), `conusStateMesh(topology)`, `conusBorderMesh(topology)`. Lift from spike 01.
- [ ] Create `libs/wx-charts/src/graticule.ts` -- `renderGraticule(projection, opts)` returns SVG string for dashed lat/lon lines.
- [ ] Create `libs/wx-charts/src/chrome.ts` -- `buildChrome(input: ChromeInput): ChromeOutput` returns `{ titleBand, footerBand }` SVG strings. Title band carries `title` + `subtitle`; footer carries source attribution + library version.
- [ ] Create `libs/wx-charts/src/layers.ts` -- `composeChart(bands: Record<LayerBand, string>): string` emits a full SVG document with the bands stacked in canonical z-order. Re-export `LAYER_BANDS`, `LAYER_BAND_VALUES`, `LayerBand`, `LayerBandMap` types.
- [ ] Create `libs/wx-charts/src/point/collision.ts` -- `resolveCollisions(input: CollisionInput): CollisionResult` runs pairwise repulsion (40 iterations, 36 px min-distance default) per spike 03.
- [ ] Create `libs/wx-charts/src/point/leader-lines.ts` -- `renderLeaderLines(displaced)` emits dashed lines for points moved by the collision pass.
- [ ] Create `libs/wx-charts/src/types.ts` -- `ChartSpec`, `ChartRenderInput<TSpec>`, `ChartRenderResult`, `ChartRenderMeta`, `ChartRenderer<TSpec>` per spec.md "Chart-type renderer contract".
- [ ] Re-export every primitive above from `libs/wx-charts/src/index.ts` per design.md "Public exports (runtime barrel)".
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(wx-charts): substrate -- projection, basemap, graticule, chrome, layers, point primitives`).

#### A.5 Surface-analysis renderer + symbology helpers

- [ ] Create `libs/wx-charts/src/symbology/polyline-pips.ts` -- `renderPolylinePips(line, pipDef)` per spike 01.
- [ ] Create `libs/wx-charts/src/symbology/contours.ts` -- `renderScalarContours(grid, opts)` wrapping `d3-contour`.
- [ ] Create `libs/wx-charts/src/symbology/station-model.ts` -- `renderStationModel(parsedMetar, opts)` per spike 01 (Phase A ships the substrate; Phase C hardens the dense-grid options).
- [ ] Create `libs/wx-charts/src/symbology/fronts.ts` -- `renderFront(line, kind: FrontKind)` per spike 01.
- [ ] Create `libs/wx-charts/src/symbology/pressure-centers.ts` -- `renderPressureCenter(center)` (H/L markers).
- [ ] Create `libs/wx-charts/src/symbology/airports.ts` -- `renderAirport(point, label)` (used by Phase D/E).
- [ ] Create `libs/wx-charts/src/symbology/legend.ts` -- `renderLegend(legendDef: LegendDef)` for ramp / scale / category legends.
- [ ] Create `libs/wx-charts/src/charts/surface-analysis.ts` exporting `renderSurfaceAnalysis(input: ChartRenderInput<SurfaceAnalysisSpec>): Promise<ChartRenderResult>` and the `SurfaceAnalysisSpec` Zod schema. Composes substrate + symbology helpers via `composeChart`.
- [ ] Create `libs/wx-charts/src/charts/registry.ts` exporting `CHART_RENDERERS: Record<ChartType, ChartRenderer>` per design.md "API Surface".
- [ ] Re-export the symbology helpers from the runtime barrel; re-export `renderSurfaceAnalysis` and `CHART_RENDERERS` from the server barrel.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(wx-charts): surface-analysis renderer + symbology primitives`).

#### A.6 CLI dispatcher

- [ ] Create `scripts/charts.ts` mirroring `scripts/db.ts` shape. Reads `process.argv.slice(2)`, switches on the first arg, prints help when called with no args / `help` / `-h` / `--help`.
- [ ] Create `scripts/charts/build.ts` -- `bun run charts build <slug>` and `bun run charts build --all`. Reads `data/charts/wx/<slug>/spec.yaml`, validates via the per-type Zod schema from the registry, resolves sources from `~/Documents/airboss-handbook-cache/wx/` (override via `AIRBOSS_HANDBOOK_CACHE`), computes content hash per spec.md, calls `CHART_RENDERERS[spec.type]`, writes `chart.svg` and `meta.json`.
- [ ] Create `scripts/charts/validate.ts` -- `bun run charts validate <slug>` and `bun run charts validate --all`. Spec shape + sources resolvable check; no renderer invocation.
- [ ] Create `scripts/charts/list.ts` -- `bun run charts list` (flat) and `bun run charts list --by-type` (grouped).
- [ ] Add `charts` to `package.json` `scripts`: `"charts": "bun scripts/charts.ts"`.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(wx-charts): scripts/charts.ts dispatcher (build / validate / list)`).

#### A.7 First end-to-end chart authored

- [ ] Copy spike 01's surface-analysis JSON inputs into `~/Documents/airboss-handbook-cache/wx/sfc-bulletin/2024-12-23-12z.json` and `~/Documents/airboss-handbook-cache/wx/sfc-bulletin/2024-12-23-12z.slp.grid.json`.
- [ ] Author `data/charts/wx/wx-surface-analysis-2024-12-23-12z/spec.yaml` per the spec.md example.
- [ ] Run `bun run charts build wx-surface-analysis-2024-12-23-12z` -- expect `built` and `chart.svg` + `meta.json` written.
- [ ] Re-run -- expect `unchanged` (idempotency).
- [ ] Open `chart.svg` in a browser; visually confirm the chart matches spike 01's reference output.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(wx-charts): first chart -- wx-surface-analysis-2024-12-23-12z`).

#### A.8 Tests + Phase A close

- [ ] Add unit tests in `libs/wx-charts/src/__tests__/`:
  - `layers.test.ts` -- `composeChart` emits bands in canonical order; missing bands render as empty `<g>`; unknown bands rejected.
  - `projection.test.ts` -- `lambertProjection` projects known lon/lat pairs to expected pixel coords.
  - `collision.test.ts` -- pairwise repulsion terminates within 40 iterations; all pairs >= min-distance after; un-resolved pairs marked.
  - `chrome.test.ts` -- title + subtitle render in the title band; footer carries library_version.
  - `surface-analysis.test.ts` -- snapshot-compare the rendered SVG against a fixture.
- [ ] Run `bun run check all` -- 0 errors, all tests pass. Commit (`test(wx-charts): Phase A unit + snapshot tests`).
- [ ] Open Phase A PR. Title: `feat(wx-charts): Phase A -- substrate + surface-analysis`.

### Phase B: radar-mosaic + advisory-overlay (raster + polygon styling)

Adds raster compositing (sharp) and polygon styling primitives. Two charts on top of Phase A's substrate; different contracts so the work parallelizes within the phase.

PR title: `feat(wx-charts): Phase B -- radar-mosaic + advisory-overlay`.

#### B.1 Sharp bridge + raster primitives

- [ ] Add `sharp` to `libs/wx-charts/package.json` dependencies. Run `bun install`. Verify the prebuilt binary installs cleanly on the dev machine.
- [ ] Create `libs/wx-charts/src/raster/sharp-bridge.ts`. Top-of-file: `// @browser-globals: server-only -- never imported by client .svelte`. Lazy-loads sharp via `const sharp = (await import('sharp')).default` inside the warp function body.
- [ ] Create `libs/wx-charts/src/raster/worldfile.ts` -- ESRI world file parser (6 numeric lines -> affine transform).
- [ ] Create `libs/wx-charts/src/raster/palettes.ts` -- NWS reflectivity ramp + IR satellite ramp + flight-category palette as parameterized functions (consume `data/references/palettes/nws-reflectivity.json`).
- [ ] Create `libs/wx-charts/src/raster/warp.ts` exporting `warpRaster(input: WarpInput): Promise<WarpResult>`. Inverse-projection algorithm per design.md "Sharp replaces headless chromium". Uses `sharp(input).raw().toBuffer({ resolveWithObject: true })` for source pixel access.
- [ ] Re-export `warpRaster` from the server barrel only (NOT the runtime barrel; type-only re-export of `WarpInput` / `WarpResult` is fine in the runtime barrel).
- [ ] Run `bun run check` -- the browser-globals checker must pass (no `sharp` reachable from any client-eligible file).
- [ ] Commit (`feat(wx-charts): raster substrate -- sharp-bridge, warp, worldfile, palettes`).

#### B.2 Sharp-vs-chromium pixel-diff calibration

Per design.md risk-register: confirm sharp output matches spike 02's chromium output before merging Phase B.

- [ ] Copy spike 02's input PNG + worldfile to `~/Documents/airboss-handbook-cache/wx/radar/n0r-202405212200.png` + `.wld`.
- [ ] Run `warpRaster` against the same target projection / dims as spike 02.
- [ ] Pixel-diff the sharp output vs spike 02's reference output (`spikes/wx-charts/02-radar-mosaic/output/`). Tolerance: average per-pixel RGB delta < 4 (8-bit), max delta < 16 outside antialiased edges.
- [ ] Capture the diff result in the Phase B PR description. If outside tolerance, surface a BLOCKER with the proposed adjustment (warp algorithm tuning, palette tweak, or chromium-fallback decision).
- [ ] Commit the diff harness as `libs/wx-charts/src/raster/__tests__/warp-vs-chromium.test.ts` (skipped by default; runs on request).

#### B.3 Radar-mosaic renderer

- [ ] Create `libs/wx-charts/src/charts/radar-mosaic.ts` exporting `renderRadarMosaic(input: ChartRenderInput<RadarMosaicSpec>): Promise<ChartRenderResult>` and the `RadarMosaicSpec` Zod schema.
- [ ] Composes substrate + warped raster (raster-overlay band) + re-stroked borders (basemap-re-stroke band) + chrome.
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Author `data/charts/wx/wx-radar-mosaic-2024-05-21-22z/spec.yaml` + run build + commit `chart.svg` + `meta.json`. Visually confirm against spike 02.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/radar-mosaic.test.ts`.
- [ ] Commit (`feat(wx-charts): radar-mosaic renderer + first chart`).

#### B.4 Advisory polygon symbology + advisory-overlay renderer

- [ ] Create `libs/wx-charts/src/wx/sigmet/parser.ts` -- AIRMET / SIGMET / Convective SIGMET text parser -> `ParsedAdvisory`.
- [ ] Create `libs/wx-charts/src/wx/sigmet/types.ts` -- `ParsedAdvisory`, advisory-kind enum.
- [ ] Create `libs/wx-charts/src/symbology/advisory-polygons.ts` -- `renderAdvisoryPolygon(polygon, advisory)` styled per advisory type (yellow fill / orange dashed / blue dashed / solid red / red-with-thunderstorm-glyph per design.md "advisory-overlay (Phase B)").
- [ ] Create `libs/wx-charts/src/charts/advisory-overlay.ts` exporting `renderAdvisoryOverlay(input)` + `AdvisoryOverlaySpec` Zod schema. Composes substrate + advisory polygons + chrome legend strip listing active advisories.
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Author `data/charts/wx/wx-advisory-overlay-<date>-<time>z/spec.yaml` from a captured AIRMET / SIGMET bulletin + run build + commit outputs.
- [ ] Unit test `parseAdvisory` against canonical AIRMET / SIGMET strings (including all three AIRMET subtypes Sierra/Tango/Zulu, a SIGMET, and a Convective SIGMET).
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/advisory-overlay.test.ts`.
- [ ] Commit (`feat(wx-charts): advisory-overlay renderer + sigmet parser + first chart`).

#### B.5 Phase B close

- [ ] Run `bun run check all` -- 0 errors, all tests pass.
- [ ] Open Phase B PR. Title: `feat(wx-charts): Phase B -- radar-mosaic + advisory-overlay`.

### Phase C: metar-plot-grid + pirep-plot-grid + winds-aloft-fb (point-glyph cluster)

Three charts that share the dense-glyph pattern. METAR + PIREP share the collision primitive; winds-aloft is a text grid that uses no collision. Within Phase C the three charts parallelize.

PR title: `feat(wx-charts): Phase C -- metar + pirep + winds-aloft point-glyph cluster`.

#### C.1 METAR parser + station-model hardening

- [ ] Create `libs/wx-charts/src/wx/metar/parser.ts` exporting `parseMetar(text: string): ParsedMetar`. Lift from spike 03; harden the unparseable-token handling (set field to null, record warning).
- [ ] Create `libs/wx-charts/src/wx/metar/types.ts` -- `ParsedMetar`, `WindGroup`, `CloudLayer`.
- [ ] Create `libs/wx-charts/src/wx/rules.ts` -- `computeFlightCategory(parsedMetar): FaaFlightCategory`, `ceilingFtAgl(cloudLayers): number | null`.
- [ ] Harden `libs/wx-charts/src/symbology/station-model.ts` (Phase A shipped the substrate) with the dense-grid options from spike 03 (compact mode, no-shaft for null wind, calm ring threshold).
- [ ] Re-export `parseMetar`, `ParsedMetar`, `WindGroup`, `CloudLayer`, `computeFlightCategory`, `ceilingFtAgl`, `renderStationModel` from the runtime barrel.
- [ ] Unit test `parseMetar` against the spike 03 fixture set (including `M1/4SM`, `1 1/2SM`, calm wind, missing wind, multi-layer clouds).
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(wx-charts): metar parser + flight-category rules + station-model hardening`).

#### C.2 METAR plot grid renderer

- [ ] Create `libs/wx-charts/src/charts/metar-plot-grid.ts` exporting `renderMetarPlotGrid(input)` + `MetarPlotGridSpec` Zod schema.
- [ ] Composes substrate + collision-resolved station glyphs (point-symbology band, with leader lines for displaced stations) + footer chrome.
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Copy spike 03's METAR bulk CSV to `~/Documents/airboss-handbook-cache/wx/metar/2024-01-13-12z.bulk.csv`.
- [ ] Author `data/charts/wx/wx-metar-plot-grid-2024-01-13-12z/spec.yaml` + run build + commit outputs. Visually confirm against spike 03.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/metar-plot-grid.test.ts`.
- [ ] Commit (`feat(wx-charts): metar-plot-grid renderer + first chart`).

#### C.3 PIREP parser + plot grid renderer

- [ ] Create `libs/wx-charts/src/wx/pirep/parser.ts` -- `parsePirep(text): ParsedPirep`. Captures position, altitude, turbulence, icing, sky cover, remarks.
- [ ] Create `libs/wx-charts/src/wx/pirep/types.ts` -- `ParsedPirep`.
- [ ] Create `libs/wx-charts/src/symbology/pirep-glyph.ts` -- `renderPirepGlyph(parsed)` per design.md "pirep-plot-grid (Phase C)" symbol set.
- [ ] Create `libs/wx-charts/src/charts/pirep-plot-grid.ts` exporting `renderPirepPlotGrid(input)` + `PirepPlotGridSpec` Zod schema. Re-uses `point/collision.ts`.
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Capture a representative PIREP set into `~/Documents/airboss-handbook-cache/wx/pirep/<date>.txt`. Author the chart spec + build + commit outputs.
- [ ] Unit test `parsePirep` against canonical UA / UUA strings (all three turbulence intensities, all three icing types, varied altitudes).
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/pirep-plot-grid.test.ts`.
- [ ] Commit (`feat(wx-charts): pirep parser + plot-grid renderer + first chart`).

#### C.4 Winds-aloft FB renderer

- [ ] Create `libs/wx-charts/src/wx/winds-aloft/parser.ts` -- `parseFbGrid(text): ParsedFbGrid`. Parses the FAA FB text product (station, altitudes 3000-39000, dir/speed/temp per row).
- [ ] Create `libs/wx-charts/src/wx/winds-aloft/types.ts` -- `ParsedFbGrid`.
- [ ] Create `libs/wx-charts/src/charts/winds-aloft-fb.ts` exporting `renderWindsAloftFb(input)` + `WindsAloftFbSpec` Zod schema. Renders text-block-per-station over CONUS basemap; no collision (stations pre-selected at non-conflicting hubs).
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Capture an FB bulletin into `~/Documents/airboss-handbook-cache/wx/winds-aloft/<date>.txt`. Author the chart spec + build + commit outputs.
- [ ] Unit test `parseFbGrid` against a representative FB bulletin (multiple altitude rows, missing-temp at low altitudes, sign convention for negative temps).
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/winds-aloft-fb.test.ts`.
- [ ] Commit (`feat(wx-charts): winds-aloft FB parser + renderer + first chart`).

#### C.5 Phase C close

- [ ] Run `bun run check all` -- 0 errors, all tests pass.
- [ ] Open Phase C PR. Title: `feat(wx-charts): Phase C -- metar + pirep + winds-aloft point-glyph cluster`.

### Phase D: prog-chart + gfa + convective-outlook (forecast cluster)

Three forecast charts. Prog re-uses surface-analysis structurally. GFA composes existing AIRMET/SIGMET polygons with TAF text panels. Convective outlook is risk-tier polygon styling. Charts parallelize within the phase.

PR title: `feat(wx-charts): Phase D -- prog + gfa + convective-outlook forecast cluster`.

#### D.1 Prog-chart renderer

- [ ] Create `libs/wx-charts/src/charts/prog-chart.ts` exporting `renderProgChart(input)` + `ProgChartSpec` Zod schema. Structurally identical to surface-analysis; chrome title defaults differ ("FORECAST 12HR" vs "ANALYSIS").
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Capture a forecast bulletin (prog) into the cache. Author chart spec + build + commit outputs.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/prog-chart.test.ts`.
- [ ] Commit (`feat(wx-charts): prog-chart renderer + first chart`).

#### D.2 TAF parser + GFA renderer

- [ ] Create `libs/wx-charts/src/wx/taf/parser.ts` -- `parseTaf(text): ParsedTaf`. Captures station, valid-from / valid-to, period blocks (FM, BECMG, TEMPO).
- [ ] Create `libs/wx-charts/src/wx/gfa/parser.ts` -- `parseGfa(taccText, faPolygons): ParsedGfa`. Combines GFA TAC text + Forecast Area polygons.
- [ ] Create `libs/wx-charts/src/wx/gfa/types.ts` -- `ParsedGfa`, `ParsedTaf`.
- [ ] Create `libs/wx-charts/src/charts/gfa.ts` exporting `renderGfa(input)` + `GfaSpec` Zod schema. Composes substrate + AIRMET/SIGMET polygons (re-uses Phase B's `advisory-polygons.ts`) + TAF text panels at terminal airports + cloud / surface visibility legend chrome.
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Capture a GFA snapshot (TAC text + FA polygon bundle) into `~/Documents/airboss-handbook-cache/wx/gfa/<date>-<time>z/`. Author chart spec + build + commit outputs.
- [ ] Unit test `parseTaf` against canonical TAFs (FM block, BECMG, TEMPO, multi-line). Unit test `parseGfa` against a representative TAC text.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/gfa.test.ts`.
- [ ] Commit (`feat(wx-charts): taf + gfa parsers, gfa renderer + first chart`).

#### D.3 Convective-outlook renderer

- [ ] Create `libs/wx-charts/src/symbology/convective-outlook.ts` -- `renderConvectiveOutlookPolygon(polygon, riskTier)` per design.md "convective-outlook (Phase D)" tier set (TSTM / MRGL / SLGT / ENH / MDT / HIGH).
- [ ] Create `libs/wx-charts/src/charts/convective-outlook.ts` exporting `renderConvectiveOutlook(input)` + `ConvectiveOutlookSpec` Zod schema. Substrate + tier polygons (drawn outermost first so layered tiers stack correctly) + tier-legend chrome.
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Capture an SPC outlook (Day 1 categorical) into `~/Documents/airboss-handbook-cache/wx/spc/<date>-day1.json`. Author chart spec + build + commit outputs.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/convective-outlook.test.ts`.
- [ ] Commit (`feat(wx-charts): convective-outlook renderer + first chart`).

#### D.4 Phase D close

- [ ] Run `bun run check all` -- 0 errors, all tests pass.
- [ ] Open Phase D PR. Title: `feat(wx-charts): Phase D -- prog + gfa + convective-outlook forecast cluster`.

### Phase E: cva (final chart)

Smallest chart; depends on convective-outlook's polygon-shading pattern from Phase D.

PR title: `feat(wx-charts): Phase E -- cva`.

#### E.1 CVA rendering decision

- [ ] Choose between (a) polygon overlay from MADIS-style precomputed polygons, or (b) per-station shaded rectangles from METAR-derived flight category. Decision criterion: (b) is lighter and re-uses Phase C's flight-category rule; pick (b) unless authoring needs the polygon-overlay shape for a specific course.
- [ ] If (a): create `~/Documents/airboss-handbook-cache/wx/madis/<date>-<time>z.polygons.json` capture pipeline notes; if (b): re-use the METAR bulk CSV cache from Phase C.

#### E.2 CVA renderer

- [ ] Create `libs/wx-charts/src/charts/cva.ts` exporting `renderCva(input)` + `CvaSpec` Zod schema. Substrate + flight-category polygons (or shaded station rectangles) + tier-legend chrome (re-uses convective-outlook's legend pattern).
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Author `data/charts/wx/wx-cva-<date>-<time>z/spec.yaml` + build + commit outputs.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/cva.test.ts`.
- [ ] Commit (`feat(wx-charts): cva renderer + first chart`).

#### E.3 Phase E close + WP closeout

- [ ] Update [docs/work/NOW.md](../../work/NOW.md) with this WP's shipped status.
- [ ] Add per-PR log entries via `bun run track log <number>` for each merged Phase A-E PR.
- [ ] Update [docs/products/study/PRD.md](../../products/study/PRD.md) and [docs/products/hangar/PRD.md](../../products/hangar/PRD.md) with the chart-library shipped status (the consumer is course-reader-and-editor; this lib unblocks chart embedding).
- [ ] If the consumer course-reader-and-editor WP shipped Phase 8's chart stub, surface that the stub now resolves to a real `<CourseStepChart slug="..." />` mount.
- [ ] Run `bun run check all` -- 0 errors, 0 warnings.
- [ ] Open Phase E PR. Title: `feat(wx-charts): Phase E -- cva + WP closeout`.

## Post-implementation

- [ ] Full manual test per [test-plan.md](./test-plan.md). Joshua walks through every WXC-NN scenario.
- [ ] Author the first cross-reference from a real course step to a wx chart slug (likely from the in-flight weather course). This is OUT OF SCOPE for this WP per the OOS doc; mention it here as the natural follow-on.
- [ ] Request implementation review (`/ball-review-full`).
- [ ] Address every finding (per CLAUDE.md "ALWAYS FIX EVERYTHING from a review").
- [ ] Mark WP `human_review_status: signed-off` after Joshua's walkthrough.

## Parallelization plan

Phases sequence A -> {B, C, D in parallel} -> E. Within each parallel phase, charts further parallelize where they don't share a primitive contract.

- Wave 1 (sequential): Phase A. Substrate + first chart end-to-end. Blocks every later phase.
- Wave 2 (parallel across worktrees): Phase B (radar + advisory) || Phase C (metar + pirep + winds-aloft) || Phase D (prog + gfa + convective-outlook). Each phase ships its own PR.
- Wave 3 (sequential after D): Phase E. CVA depends on Phase D's convective-outlook polygon-shading pattern.

Within Phase B: radar-mosaic and advisory-overlay split by chart (different contracts, parallelizable). Within Phase C: METAR / PIREP / winds-aloft split by chart. Within Phase D: prog / gfa / convective-outlook split by chart. The split is by file, not by concern, per project memory `feedback_parallel_agents_scope_by_file.md`.

Sub-agent dispatch at each wave uses the standard sub-agent contract -- each agent ends with a PR URL or a BLOCKER (per [docs/agents/sub-agent-contract.md](../../agents/sub-agent-contract.md)).

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
