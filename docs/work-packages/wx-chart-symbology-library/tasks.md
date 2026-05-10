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

Phased plan for [spec.md](./spec.md). Order is dependency-driven: substrate + the first end-to-end chart (Phase A), then the raster + polygon cluster (Phase B), then the point-glyph + wx-parser cluster (Phase C), then the forecast cluster including CVA (Phase D), then the icing + turbulence cluster (Phase E), then the satellite cluster (Phase F), then the TAF timeline (Phase G). Each phase ships its own PR titled `feat(wx-charts): <phase> -- <chart list>`.

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

- [ ] Create `libs/constants/src/wx-charts.ts` with `CHART_TYPES`, `CHART_TYPE_VALUES`, `ChartType`, `CHART_TYPE_LABELS`, `LAYER_BANDS`, `LAYER_BAND_VALUES`, `LayerBand`, `FAA_FLIGHT_CATEGORIES`, `FAA_FLIGHT_CATEGORY_VALUES`, `FaaFlightCategory` per spec.md "Constants" section. The `CHART_TYPES` enum carries all 20 chart-type slug literals (the 14 chart families, with satellite expanded into IR / VIS / WV and the icing+turbulence cluster expanded into G-AIRMET icing, CIP, FIP, freezing-level, G-AIRMET turbulence, GTG). Phases B-G renderers wire their slugs into the registry as they ship; Phase A only references `CHART_TYPES.SURFACE_ANALYSIS`.
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

### Phase D: prog-chart + gfa + convective-outlook + cva (forecast cluster)

Four forecast charts. Prog re-uses surface-analysis structurally. GFA composes existing AIRMET/SIGMET polygons with TAF text panels. Convective outlook is risk-tier polygon styling. CVA is a polygon-tier chart (flight categories) -- promoted from the original Phase E to cluster all "forecast / categorical-overlay" products into one PR. Charts parallelize within the phase (split by file, per `feedback_parallel_agents_scope_by_file.md`).

PR title: `feat(wx-charts): Phase D -- prog + gfa + convective-outlook + cva forecast cluster`.

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

#### D.4 CVA renderer (promoted from original Phase E)

- [ ] Choose between (a) polygon overlay from MADIS-style precomputed polygons, or (b) per-station shaded rectangles from METAR-derived flight category. Decision criterion: (b) is lighter and re-uses Phase C's flight-category rule; pick (b) unless authoring needs the polygon-overlay shape for a specific course.
- [ ] If (a): create `~/Documents/airboss-handbook-cache/wx/madis/<date>-<time>z.polygons.json` capture pipeline notes; if (b): re-use the METAR bulk CSV cache from Phase C.
- [ ] Create `libs/wx-charts/src/charts/cva.ts` exporting `renderCva(input)` + `CvaSpec` Zod schema. Substrate + flight-category polygons (or shaded station rectangles) + tier-legend chrome (re-uses convective-outlook's legend pattern).
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Author `data/charts/wx/wx-cva-<date>-<time>z/spec.yaml` + build + commit outputs.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/cva.test.ts`.
- [ ] Commit (`feat(wx-charts): cva renderer + first chart`).

#### D.5 Phase D close

- [ ] Run `bun run check all` -- 0 errors, all tests pass.
- [ ] Open Phase D PR. Title: `feat(wx-charts): Phase D -- prog + gfa + convective-outlook + cva forecast cluster`.

### Phase E: icing + turbulence forecasts (gridded scalar + polygon cluster)

Six sub-products that share rendering infrastructure. Polygon-overlay charts (G-AIRMET icing, G-AIRMET turbulence) re-use Phase B's `advisory-polygons.ts` patterns with new symbology modules. Gridded-scalar charts (CIP, FIP, freezing-level, GTG) re-use Phase A's contour primitive plus a new `raster/scalar-field.ts` module that renders gridded float arrays as filled scalar fields. The six sub-products parallelize within the phase (split by file). Phase E is parallelizable with Phase D after B+C land -- it does not depend on Phase D's outputs.

PR title: `feat(wx-charts): Phase E -- icing + turbulence forecast cluster`.

#### E.1 Gridded scalar field substrate

- [ ] Create `libs/wx-charts/src/raster/scalar-field.ts` -- `renderScalarField(grid, opts)` takes a 2D float array + georeference + palette + threshold list, emits an SVG `<g>` filled per cell. Reuses Phase A's `symbology/contours.ts` for the iso-line variant.
- [ ] Extend `libs/wx-charts/src/raster/palettes.ts` with icing-probability + icing-severity + GTG-intensity + freezing-level-altitude palettes. Add palette JSONs at `data/references/palettes/`.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(wx-charts): scalar-field substrate + icing/turb palettes`).

#### E.2 G-AIRMET icing renderer

- [ ] Create `libs/wx-charts/src/wx/g-airmet/parser.ts` -- `parseGAirmet(text, polygons)` for icing + turbulence variants. Captures hazard kind, severity, top/bottom altitudes, valid period, polygon geometry.
- [ ] Create `libs/wx-charts/src/wx/g-airmet/types.ts` -- `ParsedGAirmet`, `GAirmetHazardKind` enum (`'icing-light' | 'icing-mod' | 'icing-severe' | 'turb-light' | 'turb-mod' | 'turb-severe'`).
- [ ] Create `libs/wx-charts/src/symbology/icing-polygons.ts` -- `renderIcingPolygon(polygon, severity)` styled per severity per AC 00-45H.
- [ ] Create `libs/wx-charts/src/charts/g-airmet-icing.ts` exporting `renderGAirmetIcing(input)` + `GAirmetIcingSpec` Zod schema. Composes substrate + icing polygons + chrome legend (severity tiers + top/bottom altitudes).
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Capture a representative G-AIRMET icing bulletin into `~/Documents/airboss-handbook-cache/wx/g-airmet/<date>-<time>z-icing/`. Author chart spec + build + commit outputs.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/g-airmet-icing.test.ts`.
- [ ] Commit (`feat(wx-charts): g-airmet icing renderer + first chart`).

#### E.3 CIP renderer (Current Icing Product)

- [ ] Create `libs/wx-charts/src/wx/icing/cip.ts` -- `parseCip(grid)` parses gridded icing-probability + severity at standard FLs.
- [ ] Create `libs/wx-charts/src/charts/cip.ts` exporting `renderCip(input)` + `CipSpec` Zod schema. Composes substrate + scalar field (icing probability, palette per E.1) + chrome legend (FL selector + probability ramp).
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Capture a CIP grid into `~/Documents/airboss-handbook-cache/wx/cip/<date>-<time>z-fl<ALT>.json`. Author chart spec + build + commit outputs.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/cip.test.ts`.
- [ ] Commit (`feat(wx-charts): cip renderer + first chart`).

#### E.4 FIP renderer (Forecast Icing Product)

- [ ] Create `libs/wx-charts/src/wx/icing/fip.ts` -- `parseFip(grid)` parses forecast gridded icing-probability + severity at standard FLs and forecast offsets.
- [ ] Create `libs/wx-charts/src/charts/fip.ts` exporting `renderFip(input)` + `FipSpec` Zod schema. Same composition as CIP with forecast metadata in chrome.
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Capture a FIP grid into `~/Documents/airboss-handbook-cache/wx/fip/<date>-<time>z-fl<ALT>-f<OFFSET>.json`. Author chart spec + build + commit outputs.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/fip.test.ts`.
- [ ] Commit (`feat(wx-charts): fip renderer + first chart`).

#### E.5 Freezing-level renderer

- [ ] Create `libs/wx-charts/src/wx/icing/freezing-level.ts` -- `parseFreezingLevel(grid)` parses gridded freezing-level altitude (0 degC isotherm height in feet AGL).
- [ ] Create `libs/wx-charts/src/charts/freezing-level.ts` exporting `renderFreezingLevel(input)` + `FreezingLevelSpec` Zod schema. Composes substrate + iso-altitude contours (re-uses Phase A's `symbology/contours.ts`) + scalar fill + chrome legend.
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Capture a freezing-level grid into `~/Documents/airboss-handbook-cache/wx/freezing-level/<date>-<time>z.json`. Author chart spec + build + commit outputs.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/freezing-level.test.ts`.
- [ ] Commit (`feat(wx-charts): freezing-level renderer + first chart`).

#### E.6 G-AIRMET turbulence renderer

- [ ] Reuse `parseGAirmet` from E.2 with a turbulence-hazard discriminator.
- [ ] Create `libs/wx-charts/src/symbology/turbulence-polygons.ts` -- `renderTurbulencePolygon(polygon, severity)` styled per AC 00-45H turbulence convention (hatched fill per severity).
- [ ] Create `libs/wx-charts/src/charts/g-airmet-turbulence.ts` exporting `renderGAirmetTurbulence(input)` + `GAirmetTurbulenceSpec` Zod schema. Composes substrate + turbulence polygons + chrome legend.
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Capture a representative G-AIRMET turbulence bulletin into `~/Documents/airboss-handbook-cache/wx/g-airmet/<date>-<time>z-turb/`. Author chart spec + build + commit outputs.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/g-airmet-turbulence.test.ts`.
- [ ] Commit (`feat(wx-charts): g-airmet turbulence renderer + first chart`).

#### E.7 GTG renderer (Graphical Turbulence Guidance)

- [ ] Create `libs/wx-charts/src/wx/turbulence/gtg.ts` -- `parseGtg(grid)` parses gridded turbulence intensity (EDR or NWS turbulence index) at standard FLs.
- [ ] Create `libs/wx-charts/src/charts/gtg.ts` exporting `renderGtg(input)` + `GtgSpec` Zod schema. Composes substrate + scalar field (turbulence intensity, palette per E.1) + chrome legend (FL selector + intensity ramp).
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Capture a GTG grid into `~/Documents/airboss-handbook-cache/wx/gtg/<date>-<time>z-fl<ALT>.json`. Author chart spec + build + commit outputs.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/gtg.test.ts`.
- [ ] Commit (`feat(wx-charts): gtg renderer + first chart`).

#### E.8 Phase E close

- [ ] Run `bun run check all` -- 0 errors, all tests pass.
- [ ] Open Phase E PR. Title: `feat(wx-charts): Phase E -- icing + turbulence forecast cluster`.

### Phase F: satellite (geostationary projection branch)

Three satellite bands sharing the GOES geostationary projection branch. IR is shipped first (highest pedagogical priority); VIS and WV follow within the same phase. New raster pipeline branch (different from Phase B's Lambert-target Plate-Carree-source warp -- satellite sources are GOES geostationary projection on the source side and target a Lambert CONUS for visualization). Phase F is parallelizable with D / E after B lands (depends on Phase B's `sharp-bridge.ts` + `raster/warp.ts`).

PR title: `feat(wx-charts): Phase F -- satellite IR + visible + water vapor`.

#### F.1 Geostationary projection helper

- [ ] Create `libs/wx-charts/src/raster/geostationary.ts` -- GOES-East / GOES-West geostationary projection forward + inverse functions (per the GOES-R series projection definition; sub-satellite longitude + scan angles).
- [ ] Extend `libs/wx-charts/src/projection.ts` exports to include `geostationaryProjection(opts)` (returns a projection object compatible with `fitExtent`).
- [ ] Extend `libs/wx-charts/src/raster/warp.ts` to accept either a Lambert source or a Geostationary source (branch on `source.projection.kind`); the inverse-projection algorithm is the same shape, only the source-pixel-coords mapping differs.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(wx-charts): geostationary projection + satellite-source warp branch`).

#### F.2 Satellite IR renderer (priority 1)

- [ ] Create `libs/wx-charts/src/wx/satellite/ir.ts` -- `parseSatelliteIr(png, georef)` decodes a GOES IR PNG / GeoTIFF + georeference into brightness-temperature pixels.
- [ ] Extend `libs/wx-charts/src/raster/palettes.ts` with the IR brightness-temperature palette (FAA / NWS canonical IR ramp -- cold cloud tops white through yellow-orange-red for hot surface; cold-temp emphasis).
- [ ] Create `libs/wx-charts/src/charts/satellite-ir.ts` exporting `renderSatelliteIr(input)` + `SatelliteIrSpec` Zod schema. Composes substrate (basemap-fill + raster-overlay warped from geostationary -> Lambert + basemap-re-stroke + chrome).
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Capture a GOES IR snapshot into `~/Documents/airboss-handbook-cache/wx/satellite/ir-<date>-<time>z.png` + sidecar `.json` with sub-point lon + scan extent. Author chart spec + build + commit outputs.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/satellite-ir.test.ts`.
- [ ] Commit (`feat(wx-charts): satellite-ir renderer + first chart`).

#### F.3 Satellite visible renderer (priority 2)

- [ ] Create `libs/wx-charts/src/wx/satellite/visible.ts` -- `parseSatelliteVisible(png, georef)` decodes a GOES visible-band PNG into reflectance pixels (grayscale).
- [ ] Extend `palettes.ts` with the visible reflectance grayscale palette (linear 0-1 to white).
- [ ] Create `libs/wx-charts/src/charts/satellite-visible.ts` exporting `renderSatelliteVisible(input)` + `SatelliteVisibleSpec` Zod schema. Same composition as IR with the visible palette.
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Capture + author + commit per F.2 pattern.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/satellite-visible.test.ts`.
- [ ] Commit (`feat(wx-charts): satellite-visible renderer + first chart`).

#### F.4 Satellite water-vapor renderer (priority 3)

- [ ] Create `libs/wx-charts/src/wx/satellite/water-vapor.ts` -- `parseSatelliteWaterVapor(png, georef)` decodes a GOES WV-band PNG into brightness-temperature pixels.
- [ ] Extend `palettes.ts` with the WV brightness-temperature palette (FAA / NWS canonical WV ramp -- moisture banding emphasis).
- [ ] Create `libs/wx-charts/src/charts/satellite-water-vapor.ts` exporting `renderSatelliteWaterVapor(input)` + `SatelliteWaterVaporSpec` Zod schema. Same composition as IR / VIS with the WV palette.
- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] Capture + author + commit per F.2 pattern.
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/satellite-water-vapor.test.ts`.
- [ ] Commit (`feat(wx-charts): satellite-water-vapor renderer + first chart`).

#### F.5 Phase F close

- [ ] Run `bun run check all` -- 0 errors, all tests pass.
- [ ] Open Phase F PR. Title: `feat(wx-charts): Phase F -- satellite IR + visible + water vapor`.

### Phase G: TAF timeline (1D visualization branch)

One chart that introduces a new rendering paradigm. The TAF timeline is not a map -- it's a 1D time axis with categorical change-blocks (FM / BECMG / TEMPO / PROB) plotted along the axis, plus per-element bands (ceiling, visibility, wind) showing the forecast value across the period. New `timeline/` substrate cluster (`axis.ts`, `band.ts`, `block.ts`); the TAF parser substrate lands in Phase D (D.2) so Phase G depends only on Phase D's `parseTaf`. Phase G is parallelizable with D / E / F after Phase D's TAF parser lands -- but if Phase D is in flight, Phase G can also vendor a temporary parser stub and unblock itself; the substrate decision deferred to phase-start.

PR title: `feat(wx-charts): Phase G -- taf-timeline`.

#### G.1 Timeline substrate

- [ ] Create `libs/wx-charts/src/timeline/axis.ts` -- `renderTimeAxis(opts)` emits the time axis (UTC tick marks, hour / 6-hour / day labels, valid-period bracket).
- [ ] Create `libs/wx-charts/src/timeline/band.ts` -- `renderBand(opts)` emits one categorical or numeric band along the time axis (one per output element: ceiling, visibility, wind speed, wind direction, weather codes).
- [ ] Create `libs/wx-charts/src/timeline/block.ts` -- `renderBlock(opts)` emits a single FM / BECMG / TEMPO / PROB block boundary with the AC 00-45H hatch convention (TEMPO = dashed; BECMG = ramped boundary; PROB = stippled).
- [ ] Re-export from runtime barrel (timeline primitives are pure -- no sharp / no I/O).
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(wx-charts): timeline substrate -- axis, band, block`).

#### G.2 TAF block symbology

- [ ] Create `libs/wx-charts/src/symbology/taf-block.ts` -- per-block visual conventions (FM = solid vertical separator; BECMG = double-tick boundary with valid-period bracket; TEMPO = dashed band-overlay; PROB = stippled band-overlay with prob percentage label).
- [ ] Re-export from runtime barrel.
- [ ] Run `bun run check` -- 0 errors. Commit (`feat(wx-charts): taf-block symbology`).

#### G.3 TAF timeline renderer

- [ ] Create `libs/wx-charts/src/charts/taf-timeline.ts` exporting `renderTafTimeline(input)` + `TafTimelineSpec` Zod schema. Substrate stack:

  - Background fill
  - Time axis (timeline/axis)
  - One band per element (ceiling, visibility, wind, weather codes) -- timeline/band
  - Change blocks (FM / BECMG / TEMPO / PROB) overlaid -- timeline/block + symbology/taf-block
  - Chrome (title = station identifier; subtitle = issued time + valid period)

  No projection, no basemap; the layer-band contract still applies but the basemap-fill / basemap-borders / raster-overlay / basemap-re-stroke bands render as empty `<g>`. Vector-symbology carries the timeline content; chrome carries the title / footer.

- [ ] Add to `CHART_RENDERERS` registry. Re-export from server barrel.
- [ ] If Phase D's `parseTaf` has not landed yet: vendor a temporary inline parser in `libs/wx-charts/src/wx/taf/parser.ts` and surface a TODO to swap once D ships. Otherwise depend on it directly.
- [ ] Capture a representative TAF (with FM, BECMG, TEMPO, PROB blocks) into `~/Documents/airboss-handbook-cache/wx/taf/<station>-<date>-<time>z.txt`. Author chart spec at `data/charts/wx/wx-taf-timeline-<station>-<date>-<time>z/spec.yaml` + build + commit outputs.
- [ ] Unit test the TAF parser against canonical TAFs (per Phase D D.2 unit tests; if vendored locally, port the same fixture set).
- [ ] Snapshot test under `libs/wx-charts/src/__tests__/taf-timeline.test.ts`.
- [ ] Visually confirm the timeline reads cleanly: time runs left-to-right, blocks are unambiguous, ceiling / vis / wind bands are stacked top-to-bottom in conventional order.
- [ ] Commit (`feat(wx-charts): taf-timeline renderer + first chart`).

#### G.4 Phase G close + WP closeout

- [ ] Update [docs/work/NOW.md](../../work/NOW.md) with this WP's shipped status.
- [ ] Add per-PR log entries via `bun run track log <number>` for each merged Phase A-G PR.
- [ ] Update [docs/products/study/PRD.md](../../products/study/PRD.md) and [docs/products/hangar/PRD.md](../../products/hangar/PRD.md) with the chart-library shipped status (the consumer is course-reader-and-editor; this lib unblocks chart embedding).
- [ ] If the consumer course-reader-and-editor WP shipped Phase 8's chart stub, surface that the stub now resolves to a real `<CourseStepChart slug="..." />` mount.
- [ ] Run `bun run check all` -- 0 errors, 0 warnings.
- [ ] Open Phase G PR. Title: `feat(wx-charts): Phase G -- taf-timeline + WP closeout`.

## Post-implementation

- [ ] Full manual test per [test-plan.md](./test-plan.md). Joshua walks through every WXC-NN scenario across all seven phases.
- [ ] Author the first cross-reference from a real course step to a wx chart slug (likely from the in-flight weather course). This is OUT OF SCOPE for this WP per the OOS doc; mention it here as the natural follow-on.
- [ ] Request implementation review (`/ball-review-full`).
- [ ] Address every finding (per CLAUDE.md "ALWAYS FIX EVERYTHING from a review").
- [ ] Mark WP `human_review_status: signed-off` after Joshua's walkthrough.

## Parallelization plan

Phases sequence A -> {B, C in parallel} -> {D, E, F, G in parallel}. Within each parallel phase, charts further parallelize where they don't share a primitive contract.

- Wave 1 (sequential): Phase A. Substrate + first chart end-to-end. Blocks every later phase.
- Wave 2 (parallel across worktrees): Phase B (radar + advisory) || Phase C (metar + pirep + winds-aloft + the wx-parser substrate including TAF parser).
- Wave 3 (parallel across worktrees, after B+C land):

  - Phase D (prog + gfa + convective-outlook + cva forecast cluster) -- depends on B (advisory polygons) + C (TAF parser)
  - Phase E (g-airmet icing/turbulence + cip + fip + freezing-level + gtg) -- depends on B (advisory polygons primitive) + C (none direct, but the wx-parser substrate keeps Phase C as the spine of all parsers)
  - Phase F (satellite IR + visible + water vapor) -- depends on B (sharp-bridge + warp infrastructure)
  - Phase G (taf-timeline) -- depends on C (TAF parser substrate). If Phase D's TAF parser is in flight, Phase G can vendor a temporary parser stub and unblock itself per G.3

Within Phase B: radar-mosaic and advisory-overlay split by chart. Within Phase C: METAR / PIREP / winds-aloft split by chart. Within Phase D: prog / gfa / convective-outlook / cva split by chart. Within Phase E: G-AIRMET icing / G-AIRMET turbulence / CIP / FIP / freezing-level / GTG split by chart. Within Phase F: satellite-ir / satellite-visible / satellite-water-vapor split by chart. Phase G is single-chart. The split is by file, not by concern, per project memory `feedback_parallel_agents_scope_by_file.md`.

Sub-agent dispatch at each wave uses the standard sub-agent contract -- each agent ends with a PR URL or a BLOCKER (per [docs/agents/sub-agent-contract.md](../../agents/sub-agent-contract.md)).

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
