---
id: wx-chart-symbology-library
title: 'Spec: Weather Chart Symbology Library'
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
  - spike-derived
  - infrastructure
legacy_fields:
  feature: wx-chart-symbology-library
  type: spec
---

# Spec: Weather Chart Symbology Library

A pure-code TypeScript library at `libs/wx-charts/` that renders fourteen FAA-style aviation weather chart types as static SVG (and, for TAF, as a static timeline visualization). Outputs go to `data/charts/wx/<slug>/chart.svg` and are mounted into courses via the `<CourseStepChart slug="..." />` component shipped by the [course-reader-and-editor WP](../course-reader-and-editor/spec.md).

## Why this WP exists

Three throwaway spikes ([01-surface-analysis](../../../spikes/wx-charts/01-surface-analysis/spike-notes.md), [02-radar-mosaic](../../../spikes/wx-charts/02-radar-mosaic/spike-notes.md), [03-metar-plot-grid](../../../spikes/wx-charts/03-metar-plot-grid/spike-notes.md)) proved three orthogonal patterns: pure-vector polyline+symbol charts (Spike 1), raster compositing under vector basemaps (Spike 2), and dense glyph grids over CONUS with collision-avoidance (Spike 3). Each spike confirmed the same projection / basemap / chrome substrate is reusable. Spike 3 produced the canonical library shape recommendation; this WP captures and refines it, then ships fourteen chart types organized into seven phases (A through G).

The pedagogical opportunity is the reason: the live NWS / WPC / IEM / SPC / AWC charts already exist on the public web. The product value is **teaching-annotated** charts -- the same operational symbology with overlays a CFI would draw on a whiteboard (flight-category rings, frontal interpretation cues, hail-core annotations, TAF/METAR delta panels, icing-vs-freezing-level overlays). The library substrate must support those overlays as first-class layers, not afterthoughts. This WP ships the substrate plus the bare fourteen charts; per-overlay micro-WPs follow as course content needs them.

The fourteen charts cover the full FAA aviation weather product set a pilot reads in a typical preflight: surface analysis, radar, METAR/PIREP/winds-aloft observations, TAF terminal forecasts, AIRMET/SIGMET/Convective SIGMET advisories, GFA + prog + convective outlook + CVA forecasts, satellite (IR/VIS/WV) imagery, and the icing + turbulence forecast cluster (G-AIRMET icing/turbulence, CIP, FIP, freezing level, GTG). Two product families are deliberately left to separate WPs: low/high IFR enroute charts (navigation, not weather -- separate WP `nav-chart-symbology-library`), and the radar-loop / time-scrubber playback UI (its own WP / phase, gated on real-use signal).

## Scope

In:

- One new lib at `libs/wx-charts/` exporting projection / basemap / chrome / chart / timeline primitives
- Fourteen chart-type renderers covering the full FAA aviation weather product set a pilot reads pre-flight (PPL ACS Task C K2 cluster + the icing + satellite + TAF + turbulence + freezing-level products that surface in the Aviation Weather Handbook and AC 00-45H -- see "Chart inventory" below)
- One `data/charts/wx/<slug>/` output convention (`spec.yaml` + `chart.svg` + `meta.json` per chart)
- One authoring CLI dispatcher at `scripts/charts.ts` (`bun run charts build <slug>`, `bun run charts list`, `bun run charts validate`)
- Constants: `CHART_TYPES`, `CHART_TYPE_VALUES`, `CHART_TYPE_LABELS`, `LAYER_BANDS`, `LAYER_BAND_VALUES`, `FAA_FLIGHT_CATEGORIES`, `FAA_FLIGHT_CATEGORY_VALUES`
- Routes: none directly (the consumer WP's `CourseStepChart` mounts SVGs as static assets)
- Storage policy: chart `spec.yaml` and `meta.json` are committed; `chart.svg` is committed (small, deterministic, deduplicates on content hash); raw source bytes (PNG radar tiles, TAF/METAR archives, satellite GeoTIFF / PNG bands, gridded icing/turb scalar fields) live in the dev cache per [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md) (`~/Documents/airboss-handbook-cache/wx/`)
- Raster warp via `sharp` (npm, native) -- replaces the headless-chromium approach the spikes used. Two projection branches in v1: Lambert Conformal (CONUS map products) and Geostationary (GOES satellite products, Phase F)
- Timeline visualization branch (Phase G) for the TAF chart -- 1D-plus-categorical-band rendering of FM/BECMG/TEMPO/PROB blocks against the TAF valid period (no map; same SVG / chrome substrate, different `extent` and absent projection / basemap bands)
- Manual data-prep workflow: each chart's source data is captured into the cache (METAR strings, radar PNG + worldfile, GFA polygons, satellite imagery, gridded icing/turb fields, TAF strings, etc.) before `bun run charts build <slug>` runs
- Validator: chart slug shape, spec.yaml shape per chart-type, sources resolvable, output deterministic (re-run on unchanged spec produces zero writes)
- Phasing: seven phases (A through G), each ships its own PR
- Type signatures and module layout per Spike 3's "Suggested library shape (refined from Spike 2)" recommendation

Out (deferred items captured per the WP discipline):

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Anchor docs

- [Spike 1 -- surface analysis notes](../../../spikes/wx-charts/01-surface-analysis/spike-notes.md)
- [Spike 2 -- radar mosaic notes](../../../spikes/wx-charts/02-radar-mosaic/spike-notes.md)
- [Spike 3 -- METAR plot grid notes](../../../spikes/wx-charts/03-metar-plot-grid/spike-notes.md) (the structural baseline)
- [course-reader-and-editor/spec.md](../course-reader-and-editor/spec.md) -- the consumer; defines the `<CourseStepChart slug="..." />` contract
- [ADR 018 -- source-artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md)
- [docs/platform/STORAGE.md](../../platform/STORAGE.md)
- PPL ACS Task C (Weather Information): K2a (METAR/PIREP), K2b (surface analysis / CVA), K2d (GFA), K2e (winds aloft FB), K2f (convective outlook), K2g (AIRMET/SIGMET)

### FAA documentation set (canonical reference inventory)

The fourteen chart types map to FAA primary sources. Authors write spec.yaml + capture data from real archived bulletins; renderers reproduce the official symbology as documented in:

- **AC 00-45H** -- Aviation Weather Services. The canonical handbook for the products themselves: which agency issues each chart, what valid period each covers, what symbology each uses, and how a pilot reads them. Drives every chart-type renderer's symbology choices.
- **AC 00-6B** -- Aviation Weather. Background atmospheric science (fronts, pressure systems, icing types, turbulence types, convective development). The "why" behind the symbology AC 00-45H standardizes.
- **FMH-1** -- Federal Meteorological Handbook No. 1 (Surface Weather Observations and Reports). The METAR / SPECI standard that drives `parseMetar` and the station-model glyph (cloud-cover wedges, wind-barb conventions, weather codes, pressure tendency).
- **AIM 7-1-6** -- Categorical Outlooks for Pilots (VFR / MVFR / IFR / LIFR thresholds). Drives `computeFlightCategory` rule and the FAA flight-category palette used by METAR plot, CVA, and GFA.
- **SPC product description** -- NWS Storm Prediction Center's documentation of the convective outlook tier definitions (TSTM / MRGL / SLGT / ENH / MDT / HIGH) and the polygon ordering convention. Drives the convective-outlook renderer.
- **Aeronautical Chart User's Guide** -- FAA's chart-symbology reference for navigation products (sectionals, low/high IFR enroute, terminal area). Referenced as out-of-scope context for the IFR enroute follow-on WP `nav-chart-symbology-library`.
- **Aviation Weather Handbook (FAA-H-8083-28)** -- the consolidating handbook that covers the broader product set including satellite (Chapter 14), G-AIRMET / CIP / FIP icing forecasts (Chapter 19), and GTG turbulence (Chapter 20). Drives the Phase E icing/turbulence and Phase F satellite renderers.

The library does not consume these PDFs at build time. They are author-side references; the renderers' visual conventions match the specifications in these documents.

## Architecture overview

```text
data/charts/wx/<slug>/                   <-- per-chart output directory
  spec.yaml      chart definition (type, sources, options, time, slug)
  chart.svg      generated output (committed, deterministic)
  meta.json      generation metadata (timestamp, library version,
                 source data hashes, layer order, drawn pixel counts)

scripts/charts.ts                        <-- CLI dispatcher
  bun run charts build <slug>            read spec.yaml -> render -> write
  bun run charts build --all             walk every spec.yaml, build dirty
  bun run charts validate <slug>         spec shape + source resolvability
  bun run charts list                    enumerate all chart slugs

libs/wx-charts/src/                      <-- pure code only
  index.ts                               public exports
  projection.ts                          Lambert helper, geostationary helper (Phase F), fitExtent
  basemap.ts                             us-atlas loader, CONUS filter, mesh builders
  graticule.ts                           lat/lon graticule renderer
  chrome.ts                              title band + optional footer band
  layers.ts                              z-band contract, layer ordering
  timeline/                              <-- Phase G: 1D + categorical-band visualization
    axis.ts                              time-axis renderer (UTC ticks, labels, valid-period bracket)
    band.ts                              categorical band stacking (one band per output element: ceiling, vis, wind)
    block.ts                             FM/BECMG/TEMPO/PROB block rendering (boundaries, hatch styles)
  raster/
    warp.ts                              raster warp via sharp (Lambert + geostationary variants)
    palettes.ts                          NWS reflectivity, IR satellite, water-vapor, visible, icing-prob, GTG, flight-category, etc.
    worldfile.ts                         ESRI world file parser (Lambert / Plate Carree sources)
    geostationary.ts                     GOES projection helpers (Phase F)
    scalar-field.ts                      gridded scalar field renderer (Phase E icing/turb gridded products + Phase A contour reuse)
    sharp-bridge.ts                      thin server-only sharp wrapper (lazy-loaded)
  point/
    collision.ts                         pairwise repulsion + leader metadata
    leader-lines.ts                      dashed-line renderer for displaced points
  wx/
    metar/
      parser.ts                          METAR string -> ParsedMetar
      types.ts                           ParsedMetar, WindGroup, CloudLayer
    pirep/
      parser.ts                          PIREP string -> ParsedPirep
      types.ts                           ParsedPirep
    taf/
      parser.ts                          TAF string -> ParsedTaf (used by Phase G timeline + future overlays)
      types.ts                           ParsedTaf, TafBlock, TafChangeKind
    sigmet/
      parser.ts                          AIRMET/SIGMET text -> ParsedAdvisory
    gfa/
      parser.ts                          GFA TAC text + FA polygons -> ParsedGfa
    winds-aloft/
      parser.ts                          FB grid -> ParsedFbGrid
    g-airmet/
      parser.ts                          G-AIRMET icing / turbulence polygon parser (Phase E)
      types.ts                           ParsedGAirmet, GAirmetHazardKind
    icing/
      cip.ts                             Current Icing Product (CIP) gridded scalar parser (Phase E)
      fip.ts                             Forecast Icing Product (FIP) gridded scalar parser (Phase E)
      freezing-level.ts                  Freezing-level forecast scalar parser (Phase E)
    turbulence/
      gtg.ts                             Graphical Turbulence Guidance (GTG) gridded scalar parser (Phase E)
    satellite/
      ir.ts                              GOES IR brightness-temperature parser (Phase F)
      visible.ts                         GOES visible reflectance parser (Phase F)
      water-vapor.ts                     GOES water-vapor brightness-temperature parser (Phase F)
    rules.ts                             flight-category, ceiling-from-clouds, derived rules
  symbology/
    polyline-pips.ts                     generic pip-along-polyline (fronts, jets, troughs)
    contours.ts                          d3-contour wrapper for scalar fields
    station-model.ts                     FAA station model renderer
    pirep-glyph.ts                       PIREP plot glyph (turbulence, icing, sky cover)
    fronts.ts                            cold/warm/occluded/stationary frontal shapes
    pressure-centers.ts                  H/L markers
    advisory-polygons.ts                 AIRMET/SIGMET polygon styling per type
    convective-outlook.ts                SPC outlook polygon styling per risk tier
    airports.ts                          airport markers + label halos
    legend.ts                            ramp / scale / category legends
    icing-polygons.ts                    G-AIRMET icing polygon styling (Phase E)
    turbulence-polygons.ts               G-AIRMET turbulence polygon styling (Phase E)
    taf-block.ts                         TAF FM/BECMG/TEMPO/PROB block visual conventions (Phase G)
  charts/
    surface-analysis.ts                  composes substrate -> Spike 1 chart
    radar-mosaic.ts                      composes substrate -> Spike 2 chart (single-frame; playback OOS)
    metar-plot-grid.ts                   composes substrate -> Spike 3 chart
    pirep-plot-grid.ts                   composes substrate -> PIREP chart
    advisory-overlay.ts                  AIRMET/SIGMET/Convective SIGMET chart
    prog-chart.ts                        forecast surface analysis
    gfa.ts                               Graphical Forecasts for Aviation
    winds-aloft-fb.ts                    FB grid renderer
    convective-outlook.ts                SPC outlook chart
    cva.ts                               Ceiling and Visibility Analysis
    g-airmet-icing.ts                    G-AIRMET icing polygons (Phase E)
    g-airmet-turbulence.ts               G-AIRMET turbulence polygons (Phase E)
    cip.ts                               Current Icing Product gridded scalar (Phase E)
    fip.ts                               Forecast Icing Product gridded scalar (Phase E)
    freezing-level.ts                    Freezing-level forecast (Phase E)
    gtg.ts                               Graphical Turbulence Guidance gridded scalar (Phase E)
    satellite-ir.ts                      GOES IR satellite (Phase F)
    satellite-visible.ts                 GOES visible satellite (Phase F)
    satellite-water-vapor.ts             GOES water-vapor satellite (Phase F)
    taf-timeline.ts                      TAF timeline visualization (Phase G; uses timeline/, not projection/basemap)
  types.ts                               public types (ChartSpec, ChartType, RenderResult)

data/references/basemaps/                <-- substrate data inputs (committed)
  us-states-10m.json
  us-nation-10m.json

data/references/palettes/                <-- substrate data inputs (committed)
  nws-reflectivity.json
  flight-category.json

~/Documents/airboss-handbook-cache/wx/   <-- raw source bytes (per ADR 018)
  metar/2024-01-13-12z.bulk.csv
  radar/n0r-202405212200.png
  radar/n0r-202405212200.wld
  ...
```

The library accepts data shapes as inputs; it does not import from `data/` relatively. Callers (the CLI, tests, future overlays) load the data and pass it in. Substrate data files (basemaps, palettes) live at `data/references/` because they are stable, small, and load-bearing for every chart -- they are committed and the library accepts the path as a config option (default points to `data/references/basemaps/us-states-10m.json` resolved via `process.cwd()` at CLI time).

## Chart inventory (v1: fourteen types)

The fourteen chart types ship across seven phases (A through G). Phase A ships first; B/C ship in parallel; D follows B+C; E parallels D after B+C land; F parallels E after B+C land; G parallels after the wx-parser substrate (Phase C) lands.

| Slug suffix           | Chart type                       | ACS hook  | Substrate                                           | Phase |
| --------------------- | -------------------------------- | --------- | --------------------------------------------------- | ----- |
| surface-analysis      | NWS surface analysis             | C K2b     | vector polylines + isobars + stations               | A     |
| radar-mosaic          | NEXRAD reflectivity mosaic       | implicit  | raster warp + state border re-stroke (single-frame) | B     |
| advisory-overlay      | AIRMET / SIGMET / Conv SIGMET    | C K2g     | polygon styling + advisory text panel               | B     |
| metar-plot-grid       | METAR station-model plot         | C K2a     | dense point glyphs + collision                      | C     |
| pirep-plot-grid       | PIREP station plot               | C K2a-2nd | dense point glyphs + collision                      | C     |
| winds-aloft-fb        | Winds / Temps Aloft FB grid      | C K2e     | text grid table over basemap                        | C     |
| prog-chart            | Forecast surface analysis        | derived   | same substrate as surface-analysis                  | D     |
| gfa                   | Graphical Forecasts for Aviation | C K2d     | layered polygon overlay (FA, AIRMET)                | D     |
| convective-outlook    | SPC convective outlook           | C K2f     | risk-tier polygons (MRGL/SLGT/ENH/MDT/HIGH)         | D     |
| cva                   | Ceiling and Visibility Analysis  | C K2b-2nd | gridded ceiling/vis polygon shading                 | D     |
| g-airmet-icing        | G-AIRMET icing                   | derived   | polygon overlay + chrome legend (icing severity)    | E     |
| cip                   | Current Icing Product            | derived   | gridded scalar field (icing probability + severity) | E     |
| fip                   | Forecast Icing Product           | derived   | gridded scalar field (icing probability + severity) | E     |
| freezing-level        | Freezing-level forecast          | derived   | gridded scalar contour (height of 0 degC isotherm)  | E     |
| g-airmet-turbulence   | G-AIRMET turbulence              | derived   | polygon overlay + chrome legend (turb severity)     | E     |
| gtg                   | Graphical Turbulence Guidance    | derived   | gridded scalar field (turb intensity at FL)         | E     |
| satellite-ir          | GOES IR (infrared)               | derived   | geostationary raster + IR brightness-temp palette   | F     |
| satellite-visible     | GOES visible                     | derived   | geostationary raster + reflectance grayscale        | F     |
| satellite-water-vapor | GOES water vapor                 | derived   | geostationary raster + WV brightness-temp palette   | F     |
| taf-timeline          | TAF timeline                     | C K2a     | 1D time axis + categorical change-blocks (no map)   | G     |

Note: rows are grouped by phase. Phase E ships six sub-products (icing + turbulence forecasts); they share rendering infrastructure (gridded scalar fields plus polygon overlays) and parallelize within the phase. Phase F ships three satellite bands (IR, VIS, WV) sharing the GOES geostationary projection branch but each its own renderer + palette. Phase G ships one chart whose paradigm differs from every other (1D timeline, no map projection / basemap).

Slug shape: `wx-<chart-type>-<isodate>[-<frame>]`. Examples: `wx-surface-analysis-2024-12-23-12z`, `wx-radar-mosaic-2024-05-21-22z`, `wx-metar-plot-grid-2024-01-13-12z`, `wx-satellite-ir-2024-08-12-18z`, `wx-taf-timeline-kbos-2024-01-13-1720z`. The slug is unique across all `data/charts/wx/<slug>/` directories.

### Phase ordering and dependencies

| Phase | Charts                                                             | Depends on | Why this grouping                                                                                                                                                       |
| ----- | ------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | substrate + surface-analysis                                       | (none)     | Substrate cannot be partially shipped; surface-analysis proves the renderer contract end-to-end                                                                         |
| B     | radar-mosaic, advisory-overlay                                     | A          | Adds raster + polygon styling on the substrate                                                                                                                          |
| C     | metar-plot-grid, pirep-plot-grid, winds-aloft-fb                   | A          | Point-glyph cluster + the wx-parser substrate (METAR / PIREP / FB / TAF parsers land here)                                                                              |
| D     | prog-chart, gfa, convective-outlook, cva                           | B + C      | Forecast cluster -- prog re-uses surface-analysis; gfa composes Phase B advisory polygons; convective-outlook + cva share polygon-tier shading                          |
| E     | g-airmet-icing, cip, fip, freezing-level, g-airmet-turbulence, gtg | B + C      | Icing + turbulence forecasts -- gridded scalar fields (Phase A contour primitive reused) + polygon overlays (Phase B advisory primitives reused). Parallelizable with D |
| F     | satellite-ir, satellite-visible, satellite-water-vapor             | B          | Satellite imagery -- new geostationary raster pipeline branch; uses Phase B's sharp warp infrastructure with a different projection. Parallelizable with D / E          |
| G     | taf-timeline                                                       | C          | TAF timeline -- new 1D timeline visualization paradigm, no map. Depends on Phase C's TAF parser. Parallelizable with D / E / F                                          |

### Author-priority order (pedagogical sequencing)

Phasing above is a dependency / parallelization plan -- "what can ship together without merge conflicts." This section is the **pedagogical** priority: when multiple charts are unblocked at the same time, which one should an author build next? The order below maximizes the value of each new chart to a learner walking the weather-comprehensive course, not the order of substrate dependencies.

The first ten charts, in author priority:

1. **METAR plot grid** -- the answer to "what is happening right now?" Every preflight starts here. Without it, no other observation chart has a referent.
2. **TAF timeline** -- the answer to "what is forecast for my destination over my arrival window?" The METAR/TAF pair is the first real pilot-weather loop.
3. **Radar mosaic** (single-frame) -- the answer to "what is moving, and where?" Radar is the most-glanced chart in actual preflight; learners need to read it before they can read the products that explain it.
4. **Surface analysis** -- the answer to "what system is causing all this?" The synoptic frame that makes METAR + TAF + radar stop being three independent readings and start being one story.
5. **Satellite IR** -- the answer to "what clouds and structure are hiding the hazards?" IR is the cleanest synoptic context layer and the easiest satellite product for a learner to interpret first (before VIS, before WV).
6. **AIRMET / SIGMET overlay** -- the answer to "what hazards have forecasters explicitly named?" Closes the first preflight loop: observations + forecast + motion + system + named hazards.
7. **GFA** -- the answer to "show me the picture for the next 18 hours." Once the learner can read each of the above products individually, GFA is the composite they reach for in real briefings.
8. **Winds aloft FB** -- the answer to "what altitude and what fuel burn?" Routing decisions belong after hazards are understood, not before.
9. **Convective outlook** -- the answer to "is tomorrow / day-after-tomorrow a thunderstorm day?" Multi-day planning slots in after single-day briefing is solid.
10. **CVA (ceiling and visibility analysis)** -- the answer to "where is it actually flyable right now?" The pilot-relevant projection of the surface analysis; valuable, but the learner has to read the surface analysis first.

The remaining ten charts (PIREP plot, prog chart, G-AIRMET icing, CIP, FIP, freezing-level, G-AIRMET turbulence, GTG, satellite visible, satellite water-vapor) ship as their phases land. Their pedagogical value depends on the first ten being readable, so author order inside each later phase is less load-bearing -- ship by whatever is fastest to wire up.

This order is advisory for *authoring* (which chart instance to build into `data/charts/wx/` next, and which renderer to land first inside a phase). It does **not** override the phase-dependency contract above: a Phase D chart still cannot ship before its Phase A + B + C substrate. When phase dependencies and pedagogical priority conflict, dependencies win.

## Behavior

### Chart authoring flow

1. Author captures source data into the dev cache (`~/Documents/airboss-handbook-cache/wx/...`). Capture is manual for v1; the CLI does not pull from live IEM/NCEI/NOAA endpoints (deferred -- see OUT-OF-SCOPE.md).
2. Author writes `data/charts/wx/<slug>/spec.yaml` describing the chart type, source data references (cache paths), and per-type options.
3. Author runs `bun run charts build <slug>`. The CLI:
   - Reads `spec.yaml`
   - Validates the spec shape against the chart-type Zod schema
   - Resolves source data paths against the cache + repo basemaps
   - Computes a content hash of `(spec.yaml + every source byte + library version)`
   - If the hash matches the existing `meta.json.content_hash`, exits with "no changes" (idempotent)
   - Otherwise calls the chart-type renderer to produce SVG bytes
   - Writes `chart.svg` and `meta.json` to the chart directory
4. Author runs `bun run check` to confirm zero errors.
5. Author commits all three files (`spec.yaml`, `chart.svg`, `meta.json`).

`bun run charts build --all` walks every `data/charts/wx/<slug>/spec.yaml`, runs the build for each, and reports per-chart status (skipped / built / failed). Idempotent in aggregate.

### Slug resolution into courses

The consumer (`course-reader-and-editor`) ships `<CourseStepChart slug="..." />` and a `:::chart slug="..."` markdown directive. At render time the component constructs the static asset URL `/charts/wx/<slug>/chart.svg` and renders it as an `<img>` (or inlines the SVG if size warrants). This library does **not** know about slugs at the URL layer -- it only writes SVGs at the canonical path the consumer expects. The consumer WP handles serving and any markdown directive parsing.

### Chart-type renderer contract

Every chart in `libs/wx-charts/src/charts/*.ts` exports one function with the same shape:

```typescript
export interface ChartRenderInput<TSpec extends ChartSpec> {
  spec: TSpec;
  sources: Record<string, Uint8Array | string>;  // resolved cache bytes, keyed by spec source name
  basemapPath: string;                            // default: data/references/basemaps/us-states-10m.json
  libraryVersion: string;                         // for meta.json provenance
}

export interface ChartRenderResult {
  svg: string;                                    // full SVG document
  meta: ChartRenderMeta;                          // layer-band counts, drawn-pixel totals, source hashes
}

export type ChartRenderer<TSpec extends ChartSpec = ChartSpec> = (
  input: ChartRenderInput<TSpec>,
) => Promise<ChartRenderResult>;
```

The CLI looks up the renderer by `spec.type`, calls it with the resolved inputs, and writes the result. No I/O happens inside renderers -- they accept bytes and emit strings. Tests pass synthetic inputs and assert on SVG structure.

### Layer band contract (substrate)

Every chart-type renderer composes its output by stacking SVG groups in a fixed z-order. Two charts that follow the contract compose by stacking layer-by-layer at the same band:

```text
band                       | example consumer
---------------------------|-------------------------------------------
background                 | fill rect (every chart)
graticule                  | dashed lat/lon lines
basemap-fill               | state polygons
basemap-borders            | interior + outer borders
raster-overlay             | radar, satellite, model fields
basemap-re-stroke          | borders re-drawn over raster at low opacity
vector-symbology           | fronts, isobars, advisory polygons, GFA areas
point-symbology            | airports, METARs, PIREPs, advisory centroids
chrome                     | title band, footer band, attribution
```

`libs/wx-charts/src/layers.ts` exports `LAYER_BANDS` (constant array), `LAYER_BAND_VALUES` (string-literal union type), and a helper `composeChart(bands: Record<LayerBand, string>): string` that emits an SVG document with the bands in canonical z-order.

### Raster warp implementation

Spikes 1-3 used headless chromium for raster warping (PNG decode + canvas inverse-projection redraw). Production swaps in `sharp`:

- `libs/wx-charts/src/raster/sharp-bridge.ts` is a server-only file (top-of-file `// @browser-globals: server-only -- never imported by client .svelte`) that lazy-loads `sharp` via `await import('sharp')` inside the warp function body
- `sharp` is a `dependencies` entry in the lib's package.json; the lib re-exports the warp function as a `type`-only export from the runtime barrel and a value export from `libs/wx-charts/server.ts`
- The CLI imports from `@ab/wx-charts/server`; the consumer Svelte component imports types only

Pre-warp uses inverse projection: for each output pixel, compute the source lat/lon, project to source pixel space, sample. `sharp` does not do this directly -- the warp module computes a displacement map (output px -> source px), feeds it through `sharp.composite` with a mapping kernel, or falls back to a manual loop using `sharp.raw()` pixel access. Decision deferred to design.md; the contract from the lib's perspective is `(source PNG bytes, source georeference, target projection, target dims) -> warped PNG bytes`.

## Data model

No DB schema changes. The library is pure code; outputs live on the filesystem. Chart provenance lives in per-chart `meta.json`.

`spec.yaml` shape (per chart, validated by Zod):

```yaml
slug: wx-surface-analysis-2024-12-23-12z
type: surface-analysis
title: Surface Analysis -- 2024-12-23 12Z
subtitle: WPC Coded Surface Bulletin
sources:
  fronts: cache://wx/sfc-bulletin/2024-12-23-12z.json
  pressure_grid: cache://wx/sfc-bulletin/2024-12-23-12z.slp.grid.json
  metar_observations: cache://wx/metar/2024-12-23-12z.bulk.csv
options:
  station_density: hubs   # hubs | full | none
  isobar_interval_mb: 4
  emphasize_every_mb: 8
  show_h_l_markers: true
projection:
  kind: lambert
  parallels: [33, 45]
  rotate: [-96, -39]
extent: conus
```

Each chart type defines its own `options`, `sources`, and `extent` shape; all share `slug`, `type`, `title`, `subtitle`, `projection` keys. The Zod schemas live at `libs/wx-charts/src/charts/<chart>.schema.ts` and are exported for the CLI validator.

`meta.json` shape (written by the CLI after each build):

```json
{
  "slug": "wx-surface-analysis-2024-12-23-12z",
  "type": "surface-analysis",
  "library_version": "wx-charts@0.1.0",
  "built_at": "2026-05-09T14:32:00Z",
  "content_hash": "sha256:abc123...",
  "source_hashes": {
    "fronts": "sha256:def456...",
    "pressure_grid": "sha256:789abc...",
    "metar_observations": "sha256:xyz789..."
  },
  "layer_counts": {
    "vector-symbology": 4,
    "point-symbology": 12
  },
  "drawn_pixels": 0
}
```

`drawn_pixels` is meaningful only for raster-bearing charts (radar mosaic, satellite). For pure-vector charts it is always 0.

### Constants (in `libs/constants/src/wx-charts.ts`)

```typescript
export const CHART_TYPES = {
  SURFACE_ANALYSIS: 'surface-analysis',
  RADAR_MOSAIC: 'radar-mosaic',
  ADVISORY_OVERLAY: 'advisory-overlay',
  METAR_PLOT_GRID: 'metar-plot-grid',
  PIREP_PLOT_GRID: 'pirep-plot-grid',
  WINDS_ALOFT_FB: 'winds-aloft-fb',
  PROG_CHART: 'prog-chart',
  GFA: 'gfa',
  CONVECTIVE_OUTLOOK: 'convective-outlook',
  CVA: 'cva',
  G_AIRMET_ICING: 'g-airmet-icing',
  CIP: 'cip',
  FIP: 'fip',
  FREEZING_LEVEL: 'freezing-level',
  G_AIRMET_TURBULENCE: 'g-airmet-turbulence',
  GTG: 'gtg',
  SATELLITE_IR: 'satellite-ir',
  SATELLITE_VISIBLE: 'satellite-visible',
  SATELLITE_WATER_VAPOR: 'satellite-water-vapor',
  TAF_TIMELINE: 'taf-timeline',
} as const;

export const CHART_TYPE_VALUES = Object.values(CHART_TYPES);
export type ChartType = (typeof CHART_TYPE_VALUES)[number];

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  'surface-analysis': 'Surface Analysis',
  'radar-mosaic': 'Radar Mosaic',
  'advisory-overlay': 'AIRMET / SIGMET',
  'metar-plot-grid': 'METAR Plot',
  'pirep-plot-grid': 'PIREP Plot',
  'winds-aloft-fb': 'Winds Aloft FB',
  'prog-chart': 'Prog Chart',
  gfa: 'Graphical Forecasts for Aviation',
  'convective-outlook': 'Convective Outlook',
  cva: 'Ceiling and Visibility Analysis',
  'g-airmet-icing': 'G-AIRMET Icing',
  cip: 'Current Icing Product',
  fip: 'Forecast Icing Product',
  'freezing-level': 'Freezing Level Forecast',
  'g-airmet-turbulence': 'G-AIRMET Turbulence',
  gtg: 'Graphical Turbulence Guidance',
  'satellite-ir': 'Satellite IR',
  'satellite-visible': 'Satellite Visible',
  'satellite-water-vapor': 'Satellite Water Vapor',
  'taf-timeline': 'TAF Timeline',
};

export const LAYER_BANDS = {
  BACKGROUND: 'background',
  GRATICULE: 'graticule',
  BASEMAP_FILL: 'basemap-fill',
  BASEMAP_BORDERS: 'basemap-borders',
  RASTER_OVERLAY: 'raster-overlay',
  BASEMAP_RE_STROKE: 'basemap-re-stroke',
  VECTOR_SYMBOLOGY: 'vector-symbology',
  POINT_SYMBOLOGY: 'point-symbology',
  CHROME: 'chrome',
} as const;

export const LAYER_BAND_VALUES = Object.values(LAYER_BANDS);
export type LayerBand = (typeof LAYER_BAND_VALUES)[number];

export const FAA_FLIGHT_CATEGORIES = {
  VFR: 'VFR',
  MVFR: 'MVFR',
  IFR: 'IFR',
  LIFR: 'LIFR',
} as const;

export const FAA_FLIGHT_CATEGORY_VALUES = Object.values(FAA_FLIGHT_CATEGORIES);
export type FaaFlightCategory = (typeof FAA_FLIGHT_CATEGORY_VALUES)[number];
```

## Validation

| Field                       | Rule                                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spec.slug`                 | `^wx-[a-z0-9][a-z0-9-]{1,80}[a-z0-9]$`, must equal the directory name under `data/charts/wx/`                                                                                                                             |
| `spec.type`                 | One of `CHART_TYPE_VALUES`                                                                                                                                                                                                |
| `spec.title`                | Non-empty                                                                                                                                                                                                                 |
| `spec.subtitle`             | Optional string                                                                                                                                                                                                           |
| `spec.sources`              | Object; every value parseable as `cache://<relative path>` or a relative repo path; resolved file must exist at validate time                                                                                             |
| `spec.options`              | Per-chart Zod schema; unknown keys rejected                                                                                                                                                                               |
| `spec.projection`           | One of the supported projection variants. v1 ships Lambert (Phases A-E, all CONUS map products) and Geostationary (Phase F satellite). Phase G `taf-timeline` charts omit `projection` -- they use a 1D time axis instead |
| `spec.extent`               | One of `conus` / `alaska` / `hawaii` / `goes-east` / `goes-west` (Phase F) / `time` (Phase G; carries the TAF valid-from / valid-to ISO timestamps) / a custom `{lon_min, lat_min, lon_max, lat_max}` object              |
| METAR string                | Parser rejects unparseable wind tokens (sets `wind: null` and emits a parser warning to meta.json)                                                                                                                        |
| Visibility format           | `M1/4SM` -> 0.125, `1 1/2SM` -> 1.5, `1/8SM` -> 0.125; unparseable tokens -> `visibility: null` + warning                                                                                                                 |
| Sharp warp source           | Source PNG must decode; world file numeric fields must parse; output canvas dims must be positive integers                                                                                                                |
| Layer band ordering         | `composeChart` rejects bands outside `LAYER_BAND_VALUES`; missing bands render as empty `<g>`                                                                                                                             |
| Color palette               | Reflectivity ramp values must be in [-32, 95] dBZ; flight-category palette accepts only `FAA_FLIGHT_CATEGORY_VALUES` keys                                                                                                 |
| `meta.json.library_version` | Semver string read from `libs/wx-charts/package.json`                                                                                                                                                                     |
| `meta.json.content_hash`    | SHA-256 of `(canonical(spec.yaml) + sorted source bytes + library_version)`                                                                                                                                               |

## Edge cases

- **Source data missing from cache**: validator surfaces `source 'X' not found at <resolved path>`; build aborts with non-zero exit. The author re-runs the manual capture and retries.
- **Idempotent re-run**: if `meta.json.content_hash` equals the freshly computed hash, the build skips the renderer and exits 0 with `unchanged`. Guarantees `git diff` after `bun run charts build --all` is empty when no specs/sources changed.
- **Library version bump invalidates cache**: every build embeds `library_version` in the content hash. Bumping the lib's version (a new release that changes rendering) re-runs every chart on next `--all` invocation.
- **Slug collision with non-WX chart directory**: future non-WX chart families (e.g., `data/charts/perf/`) live under their own subdirectory. The `wx-` slug prefix prevents accidental collisions inside `data/charts/wx/`.
- **Unparseable METAR token**: the parser emits `wind: null` (or `visibility: null`, etc.), records the unparseable string in `meta.json.parser_warnings`, and continues. The station model renderer treats null fields per Spike 3's notes (no shaft + no calm ring for null wind, with a "wind unknown" tooltip in the SVG `data-*` attributes).
- **Glyph collision in dense METAR / PIREP grids**: `point/collision.ts` runs pairwise repulsion (40 iterations, 36 px min-distance per Spike 3). Stations the algorithm fails to place are emitted with their true coords (no displacement) and a `data-collision="unresolved"` attribute -- visible to a CSS selector for diagnostic purposes.
- **Sharp not installed at chart-build time**: the sharp lazy-load throws; the CLI catches and surfaces `sharp not installed -- run 'bun install'`. The lib's package.json keeps `sharp` in `dependencies` so this should not happen on a clean install.
- **Chart spec yaml has trailing whitespace / inconsistent indentation**: the canonicalization step (`canonical(spec.yaml)` for hashing) parses to JS, sorts keys, and re-emits as canonical YAML. The committed `spec.yaml` does not need to be canonical -- the hash is always computed from the canonical form -- but the validator emits a "consider re-formatting" warning if the on-disk form differs.
- **Two chart specs reference the same source data file**: legal. Each computes its own content hash including the shared bytes. If the source changes, both rebuild on the next `--all` pass.
- **Output SVG exceeds size budget**: the validator emits a warning at >500 KB (consider raster-overlay PNG re-compression) and a hard error at >5 MB (something is wrong; abort). Spike 2's 548 KB warped-radar chart is the realistic upper end; pure-vector charts are typically <200 KB.
- **Empty source for a chart that requires it**: e.g., a METAR plot spec with zero observations in the bulk CSV. Renderer emits the basemap + chrome with an empty point-symbology band, and embeds a chrome notice "no observations in window." Not an error; useful as a "what does the chart look like with no data?" placeholder.
- **Unsupported projection combination**: v1 supports Lambert Conformal (every CONUS chart, Phases A-E) and Geostationary (every Phase F satellite chart). Phase G `taf-timeline` omits `projection` entirely (1D time axis). The validator rejects other projections (Web Mercator, Plate Carree as a chart projection, Mollweide, etc.) with `projection 'X' not yet supported in v1; see OUT-OF-SCOPE.md`.
- **TAF timeline missing valid period**: a `taf-timeline` spec.yaml whose parsed TAF has no valid-from / valid-to fails validation with `taf-timeline requires extent.from and extent.to ISO timestamps`. The author re-captures a complete TAF.
- **Satellite source missing georeference metadata**: GOES PNG / GeoTIFF captures must carry the satellite sub-point lon + scan-area extent. If absent, validator surfaces `satellite source 'X' missing georeference; expected sub_point_lon and scan_extent in spec.yaml or sidecar`.
- **Gridded scalar field outside spec range**: CIP / FIP / GTG / freezing-level inputs are gridded scalars. Values outside the documented FAA range (e.g., GTG intensity > 10) are clamped at render time; `meta.json.parser_warnings` records the clamp count.
- **Future overlay registers a new layer band**: the constant `LAYER_BANDS` is closed in v1. Adding a new band (e.g., `motion-vectors-overlay`) requires bumping `library_version`, adding the constant, updating `composeChart`, and re-running `--all` to regenerate every chart -- which is the right gate for a substrate change.
- **Author edits chart.svg by hand**: the next `bun run charts build` overwrites it. There is no protection; the spec.yaml is the source of truth. The validator does not detect hand-edits (the meta.json.content_hash check only catches spec / source drift, not output-file tampering).

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
