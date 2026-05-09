---
id: wx-chart-symbology-library
title: 'Spec: Weather Chart Symbology Library'
product: cross-product
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

A pure-code TypeScript library at `libs/wx-charts/` that renders ten FAA-style aviation weather chart types as static SVG. Outputs go to `data/charts/wx/<slug>/chart.svg` and are mounted into courses via the `<CourseStepChart slug="..." />` component shipped by the [course-reader-and-editor WP](../course-reader-and-editor/spec.md).

## Why this WP exists

Three throwaway spikes ([01-surface-analysis](../../../spikes/wx-charts/01-surface-analysis/spike-notes.md), [02-radar-mosaic](../../../spikes/wx-charts/02-radar-mosaic/spike-notes.md), [03-metar-plot-grid](../../../spikes/wx-charts/03-metar-plot-grid/spike-notes.md)) proved three orthogonal patterns: pure-vector polyline+symbol charts (Spike 1), raster compositing under vector basemaps (Spike 2), and dense glyph grids over CONUS with collision-avoidance (Spike 3). Each spike confirmed the same projection / basemap / chrome substrate is reusable. Spike 3 produced the canonical library shape recommendation; this WP captures and refines it, then ships ten chart types organized into five phases.

The pedagogical opportunity is the reason: the live NWS / WPC / IEM charts already exist on the public web. The product value is **teaching-annotated** charts -- the same operational symbology with overlays a CFI would draw on a whiteboard (flight-category rings, frontal interpretation cues, hail-core annotations, TAF/METAR delta panels). The library substrate must support those overlays as first-class layers, not afterthoughts. This WP ships the substrate plus the bare ten charts; per-overlay micro-WPs follow as course content needs them.

## Scope

In:

- One new lib at `libs/wx-charts/` exporting projection / basemap / chrome / chart primitives
- Ten chart-type renderers (one per FAA chart in the PPL ACS Task C K2 cluster, see "Chart inventory" below)
- One `data/charts/wx/<slug>/` output convention (`spec.yaml` + `chart.svg` + `meta.json` per chart)
- One authoring CLI dispatcher at `scripts/charts.ts` (`bun run charts build <slug>`, `bun run charts list`, `bun run charts validate`)
- Constants: `CHART_TYPES`, `CHART_TYPE_VALUES`, `CHART_TYPE_LABELS`, `LAYER_BANDS`, `LAYER_BAND_VALUES`, `FAA_FLIGHT_CATEGORIES`, `FAA_FLIGHT_CATEGORY_VALUES`
- Routes: none directly (the consumer WP's `CourseStepChart` mounts SVGs as static assets)
- Storage policy: chart `spec.yaml` and `meta.json` are committed; `chart.svg` is committed (small, deterministic, deduplicates on content hash); raw source bytes (PNG radar tiles, TAF/METAR archives) live in the dev cache per [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md) (`~/Documents/airboss-handbook-cache/wx/`)
- Raster warp via `sharp` (npm, native) -- replaces the headless-chromium approach the spikes used
- Manual data-prep workflow: each chart's source data is captured into the cache (METAR strings, radar PNG + worldfile, GFA polygons, etc.) before `bun run charts build <slug>` runs
- Validator: chart slug shape, spec.yaml shape per chart-type, sources resolvable, output deterministic (re-run on unchanged spec produces zero writes)
- Phasing: five phases (A through E), each ships its own PR
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
  projection.ts                          Lambert helper, fitExtent
  basemap.ts                             us-atlas loader, CONUS filter, mesh builders
  graticule.ts                           lat/lon graticule renderer
  chrome.ts                              title band + optional footer band
  layers.ts                              z-band contract, layer ordering
  raster/
    warp.ts                              raster warp via sharp
    palettes.ts                          NWS reflectivity, IR satellite, flight-category, etc.
    worldfile.ts                         ESRI world file parser
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
      parser.ts                          TAF string -> ParsedTaf (used by future overlays)
    sigmet/
      parser.ts                          AIRMET/SIGMET text -> ParsedAdvisory
    gfa/
      parser.ts                          GFA TAC text + FA polygons -> ParsedGfa
    winds-aloft/
      parser.ts                          FB grid -> ParsedFbGrid
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
  charts/
    surface-analysis.ts                  composes substrate -> Spike 1 chart
    radar-mosaic.ts                      composes substrate -> Spike 2 chart
    metar-plot-grid.ts                   composes substrate -> Spike 3 chart
    pirep-plot-grid.ts                   composes substrate -> PIREP chart
    advisory-overlay.ts                  AIRMET/SIGMET/Convective SIGMET chart
    prog-chart.ts                        forecast surface analysis
    gfa.ts                               Graphical Forecasts for Aviation
    winds-aloft-fb.ts                    FB grid renderer
    convective-outlook.ts                SPC outlook chart
    cva.ts                               Ceiling and Visibility Analysis
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

## Chart inventory (v1: ten types)

| Slug suffix        | Chart type                       | ACS hook  | Substrate                              | Phase |
| ------------------ | -------------------------------- | --------- | -------------------------------------- | ----- |
| surface-analysis   | NWS surface analysis             | C K2b     | vector polylines + isobars + stations  | A     |
| radar-mosaic       | NEXRAD reflectivity mosaic       | implicit  | raster warp + state border re-stroke   | B     |
| advisory-overlay   | AIRMET / SIGMET / Conv SIGMET    | C K2g     | polygon styling + advisory text panel  | B     |
| metar-plot-grid    | METAR station-model plot         | C K2a     | dense point glyphs + collision         | C     |
| pirep-plot-grid    | PIREP station plot               | C K2a-2nd | dense point glyphs + collision         | C     |
| winds-aloft-fb     | Winds / Temps Aloft FB grid      | C K2e     | text grid table over basemap           | C     |
| prog-chart         | Forecast surface analysis        | derived   | same substrate as surface-analysis     | D     |
| gfa                | Graphical Forecasts for Aviation | C K2d     | layered polygon overlay (FA, AIRMET)   | D     |
| convective-outlook | SPC convective outlook           | C K2f     | risk-tier polygons (MRGL/SLGT/ENH/MDT) | D     |
| cva                | Ceiling and Visibility Analysis  | C K2b-2nd | gridded ceiling/vis polygon shading    | E     |

Slug shape: `wx-<chart-type>-<isodate>[-<frame>]`. Examples: `wx-surface-analysis-2024-12-23-12z`, `wx-radar-mosaic-2024-05-21-22z`, `wx-metar-plot-grid-2024-01-13-12z`. The slug is unique across all `data/charts/wx/<slug>/` directories.

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

| Field                       | Rule                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `spec.slug`                 | `^wx-[a-z0-9][a-z0-9-]{1,80}[a-z0-9]$`, must equal the directory name under `data/charts/wx/`                                      |
| `spec.type`                 | One of `CHART_TYPE_VALUES`                                                                                                         |
| `spec.title`                | Non-empty                                                                                                                          |
| `spec.subtitle`             | Optional string                                                                                                                    |
| `spec.sources`              | Object; every value parseable as `cache://<relative path>` or a relative repo path; resolved file must exist at validate time      |
| `spec.options`              | Per-chart Zod schema; unknown keys rejected                                                                                        |
| `spec.projection`           | One of the supported projection variants (Lambert with parallels/rotate; Plate Carree; Web Mercator -- only Lambert needed for v1) |
| `spec.extent`               | One of `conus` / `alaska` / `hawaii` / a custom `{lon_min, lat_min, lon_max, lat_max}` object                                      |
| METAR string                | Parser rejects unparseable wind tokens (sets `wind: null` and emits a parser warning to meta.json)                                 |
| Visibility format           | `M1/4SM` -> 0.125, `1 1/2SM` -> 1.5, `1/8SM` -> 0.125; unparseable tokens -> `visibility: null` + warning                          |
| Sharp warp source           | Source PNG must decode; world file numeric fields must parse; output canvas dims must be positive integers                         |
| Layer band ordering         | `composeChart` rejects bands outside `LAYER_BAND_VALUES`; missing bands render as empty `<g>`                                      |
| Color palette               | Reflectivity ramp values must be in [-32, 95] dBZ; flight-category palette accepts only `FAA_FLIGHT_CATEGORY_VALUES` keys          |
| `meta.json.library_version` | Semver string read from `libs/wx-charts/package.json`                                                                              |
| `meta.json.content_hash`    | SHA-256 of `(canonical(spec.yaml) + sorted source bytes + library_version)`                                                        |

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
- **Unsupported projection combination**: only Lambert Conformal is required for v1 (every CONUS chart uses it). The validator rejects other projections with `projection 'X' not yet supported in v1; see OUT-OF-SCOPE.md`.
- **Future overlay registers a new layer band**: the constant `LAYER_BANDS` is closed in v1. Adding a new band (e.g., `motion-vectors-overlay`) requires bumping `library_version`, adding the constant, updating `composeChart`, and re-running `--all` to regenerate every chart -- which is the right gate for a substrate change.
- **Author edits chart.svg by hand**: the next `bun run charts build` overwrites it. There is no protection; the spec.yaml is the source of truth. The validator does not detect hand-edits (the meta.json.content_hash check only catches spec / source drift, not output-file tampering).

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
