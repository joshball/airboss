---
id: wx-chart-symbology-library
title: 'Design: Weather Chart Symbology Library'
product: cross-product
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-09
owner: agent
tags:
  - design
  - weather
  - charts
legacy_fields:
  feature: wx-chart-symbology-library
  type: design
---

# Design: Weather Chart Symbology Library

Technical design choices and architecture rationale. The spec defines the contract; this doc explains how the substrate is shaped, why phasing is what it is, and how the library composes ten chart types from a small set of primitives.

## Library shape derives from Spike 3, not from a clean-sheet design

Spike 3's "Suggested library shape (refined from Spike 2)" section is the structural starting point. The spike code already clusters into the modules the library will export: `projection.ts`, `basemap.ts`, `chrome.ts`, `point/collision.ts`, `wx/metar/parser.ts`, `symbology/station-model.ts`. The work in this WP is **extraction + hardening + ten-chart composition**, not invention.

The reasons this matters:

- The spike code shipped working SVGs against real archived data. Re-deriving the shape risks reintroducing bugs the spikes already solved (wind-barb perpendicular sign, IEM rate-limit fixed-pattern, cloud-cover wedge angle convention, projection inverse for raster warp).
- The layer-band contract (Spike 2) is already proven to compose Spike 1 + Spike 2 + Spike 3 without modification. Charts 4-10 either follow the same composition rule or surface a real reason to extend it -- both outcomes are useful.
- The CLI / cache / output convention is the only piece the spikes did not produce. That's the genuinely new design surface in this WP.

If a renderer reaches for a primitive Spike 3's shape did not anticipate, that primitive earns a place in `libs/wx-charts/src/`. The shape evolves; it does not get rewritten.

## Five-phase plan: e2e first, parallel mid, cleanup last

Phasing is the interesting design decision. The user wants:

1. End-to-end proof as fast as possible (substrate + one chart shipped, mountable into a course)
2. Parallel work on the remaining nine charts wherever the substrate is shared
3. The CVA chart last because it is the smallest and depends on the convective-outlook polygon styling pattern

Five phases shape that intent into shippable PRs:

| Phase | Charts                                           | Why this grouping                                                                                                               |
| ----- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| A     | substrate + surface-analysis                     | The substrate cannot be partially shipped. Surface analysis is the simplest pure-vector chart and proves the renderer contract. |
| B     | radar-mosaic, advisory-overlay                   | Both add raster + polygon styling on top of the substrate. Different contracts (raster warp vs polygon styling) so parallel.    |
| C     | metar-plot-grid, pirep-plot-grid, winds-aloft-fb | Point-glyph cluster. METAR + PIREP share the collision primitive; winds-aloft is a text grid that uses no collision.            |
| D     | prog-chart, gfa, convective-outlook              | Forecast cluster. Prog re-uses surface-analysis. GFA + convective outlook are polygon-overlay variants of advisory-overlay.     |
| E     | cva                                              | Smallest chart; depends on convective-outlook's polygon-shading pattern.                                                        |

Each phase opens its own PR titled `feat(wx-charts): <phase> -- <chart list>`. Each PR includes:

- Code changes for that phase's charts
- One real chart authored under `data/charts/wx/` per chart type in the phase, demonstrating the renderer end-to-end
- Test additions per the test-plan.md scenarios for that phase
- `bun run check` clean

Phase A blocks B/C/D/E. B, C, D run in parallel (different agents in different worktrees). E waits on D.

## Strict separation: code in libs/, data in data/

The spec mandates `libs/wx-charts/` is pure code; substrate data lives at `data/references/`, raw source bytes in the dev cache. The reasons:

- **Browser-bundle hygiene**: `libs/wx-charts/` is consumable from any app. Importing a 5 MB topojson file relatively from inside the lib would inject it into the browser bundle. Accepting the path as a config option (default resolved by the caller) keeps the lib's bundle small.
- **Bytes don't belong in code review**: a basemap update is a `data/` PR, not a `libs/` PR. Reviewers don't have to scroll past binary diffs to see code changes.
- **Cache vs commit**: substrate basemaps and palettes are committed (small, stable, shared across every chart). Source weather bytes (radar PNGs, METAR archives, GFA polygon files) live in the dev cache because they're large, per-chart-instance, and not load-bearing for anyone who isn't authoring a new chart.

The CLI is the bridge. It reads `data/charts/wx/<slug>/spec.yaml`, resolves `cache://` URIs against `~/Documents/airboss-handbook-cache/wx/`, resolves repo-relative source paths against `process.cwd()`, and passes resolved bytes to the renderer.

## Sharp replaces headless chromium

Spike 2 used headless chromium to warp radar PNGs (decode -> canvas inverse-projection redraw -> re-encode). The spike notes flag the swap to `sharp` as straightforward; this WP makes the swap.

The reasons:

- **No browser dep at chart-build time**: chromium is heavy. Sharp is ~5 MB, native, no display server required, runs identically on macOS and Linux CI.
- **Importable from anywhere**: chromium-as-a-warp-tool means the warp module needs to start a browser, navigate to a page, run JS in it, and screenshot. Sharp is a function call.
- **Fits the "scripts call libs, libs are pure" pattern**: chromium-via-playwright is itself a sub-process; layering that under `libs/wx-charts/` would require shelling out, which is awkward in Bun and breaks the rule that lib code does not spawn processes.

The sharp wrapper lives at `libs/wx-charts/src/raster/sharp-bridge.ts`. The file:

- Tags `// @browser-globals: server-only -- never imported by client .svelte` at the top
- Exports an async `warpRaster(input: WarpInput): Promise<WarpResult>` function
- Inside the function body, lazy-loads sharp via `const sharp = (await import('sharp')).default`
- Implements the inverse-projection warp using sharp's raw pixel access (`sharp(input).raw().toBuffer({ resolveWithObject: true })`)

The warp algorithm: build a target canvas of `(targetWidth, targetHeight)` pixels; for each output pixel `(x, y)` compute the geographic coords via `targetProjection.invert([x, y])`; project to source pixel coords via the source world file's affine transform; sample the source RGB; if `noDataFilter(rgb)` returns true, write transparent; otherwise write the sampled RGB. Output is an RGBA PNG.

This is O(W * H) per chart, no GPU. Spike 2's chromium warp ran 1200x780 in ~600ms; sharp on the same data should be comparable or faster.

## Chart-renderer contract: pure functions, bytes in, strings out

Every renderer in `libs/wx-charts/src/charts/` exports one function with the signature defined in spec.md ("Chart-type renderer contract"). The shape is enforced because:

- **Tests can render without I/O**: pass synthetic bytes, assert on the output SVG. No filesystem, no network, no chromium.
- **The CLI is the only I/O path**: `scripts/charts.ts` reads spec.yaml, resolves sources, calls the renderer, writes the result. The renderer never opens a file.
- **Renderers compose**: a hypothetical "radar + surface analysis combined" chart is a renderer that calls two other renderers and stitches their layer bands via `composeChart`. No new infrastructure needed -- the layer-band contract makes this work.

Renderer authors do not invent the chart structure. They consume the substrate (`projection`, `basemap`, `graticule`, `chrome`, `composeChart`) plus chart-type-specific symbology helpers (`symbology/fronts`, `symbology/station-model`, `symbology/advisory-polygons`, etc.) and produce a `LayerBandMap` that `composeChart` flattens into the final SVG.

## Layer band contract is closed in v1

`LAYER_BANDS` is a fixed enum of nine values. Adding a band (e.g., `motion-vectors-overlay` for a future radar overlay) is a substrate change -- it bumps `library_version`, regenerates every chart, and goes through one PR. The reasoning:

- **Predictable composition**: a chart-author looking at any output SVG knows exactly nine `<g>` groups exist in a known order. Two charts compose by stacking band-by-band; no question of "which one wins."
- **Library-version invalidation is the right gate**: if the substrate changes, every consumer regenerates. The content_hash mechanism ensures this is automatic on the next `--all` pass.
- **Open-ended bands invite drift**: the temptation to add `my-overlay-1`, `my-overlay-2`, etc. would produce charts that don't compose cleanly. Forcing every overlay into one of nine bands is the discipline that makes the substrate scale.

When a real overlay needs a band that doesn't fit, the answer is a substrate PR (justify the new band, add it, regenerate). That has not surfaced in any of the three spikes.

## Output discoverability: data/charts/wx/<slug>/

Every chart is one directory under `data/charts/wx/`. The reasons:

- **Co-located spec + output + meta**: a single `cd data/charts/wx/<slug>` shows everything about that chart. No hunting across directories.
- **Slug = directory name = URL path component**: the consumer mounts charts from `/charts/wx/<slug>/chart.svg`. The directory layout matches the URL exactly. No translation layer.
- **Add a chart = add a directory**: no central registry to update. The CLI walks `data/charts/wx/*/spec.yaml` and finds every chart automatically.
- **Future non-WX charts get sibling directories**: `data/charts/perf/`, `data/charts/route/`, etc. The `wx-` slug prefix prevents accidents inside the WX subtree.

The committed-vs-cached split:

| File         | Committed?                                                                                   | Why                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `spec.yaml`  | Yes                                                                                          | Chart definition; small, human-readable, the source of truth.                                             |
| `chart.svg`  | Yes                                                                                          | Output; small (typically <500 KB), deterministic, deduplicates on content_hash, mounts as a static asset. |
| `meta.json`  | Yes                                                                                          | Provenance and idempotency check; tiny.                                                                   |
| Source bytes | No (dev cache per [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md)) | Per-chart raw weather data; large, not load-bearing for non-authors.                                      |

Committing `chart.svg` is non-trivial. The alternatives considered:

- **Build at deploy time**: the consumer would not need committed SVGs; CI builds them. Rejected because there is no CI, and building on the dev machine is fast enough that committing is the simpler model.
- **Build on first request**: the SvelteKit endpoint would build on demand and cache. Rejected because chart authoring is a deliberate, deterministic act, and surfacing build errors at runtime is worse UX than surfacing them at `bun run charts build` time.
- **Don't commit, regenerate per dev**: every developer would have to run `bun run charts build --all` to see charts in their local app. Rejected for the same reason -- charts are content, content is committed.

Committing the SVG also sidesteps a class of "why isn't my chart showing up" debugging. The committed file IS what the user sees.

## CLI lives at scripts/charts.ts

Mirrors the existing `scripts/db.ts`, `scripts/sources.ts`, `scripts/wp.ts` dispatcher pattern. The dispatcher reads `process.argv.slice(2)`, switches on the first arg:

- `bun run charts build <slug>` -- read spec, build, write
- `bun run charts build --all` -- walk every spec, build dirty
- `bun run charts validate <slug>` -- spec shape + sources resolvable
- `bun run charts validate --all` -- validate every spec
- `bun run charts list` -- enumerate all chart slugs
- `bun run charts list --by-type` -- group by chart type
- `bun run charts` (no args) -- print help

The dispatcher imports from `@ab/wx-charts/server` (the value-export entry point that includes the sharp bridge). The runtime barrel `@ab/wx-charts` exports types only -- no value re-exports of the sharp module path.

## API Surface

### Public exports (runtime barrel: `@ab/wx-charts`)

```typescript
// Pure helpers (browser-safe)
export { lambertProjection, fitExtent } from './projection';
export { loadConusBasemap, conusStateMesh, conusBorderMesh } from './basemap';
export { renderGraticule } from './graticule';
export { buildChrome, type ChromeInput, type ChromeOutput } from './chrome';
export { composeChart, LAYER_BANDS, LAYER_BAND_VALUES, type LayerBand, type LayerBandMap } from './layers';
export { resolveCollisions, type CollisionInput, type CollisionResult } from './point/collision';
export { renderLeaderLines } from './point/leader-lines';

// Parsers (pure, browser-safe)
export { parseMetar, type ParsedMetar, type WindGroup, type CloudLayer } from './wx/metar';
export { parsePirep, type ParsedPirep } from './wx/pirep';
export { parseTaf, type ParsedTaf } from './wx/taf';
export { parseAdvisory, type ParsedAdvisory } from './wx/sigmet';
export { parseGfa, type ParsedGfa } from './wx/gfa';
export { parseFbGrid, type ParsedFbGrid } from './wx/winds-aloft';
export { computeFlightCategory, ceilingFtAgl } from './wx/rules';

// Symbology renderers (pure, return SVG strings)
export { renderStationModel, type StationModelOptions } from './symbology/station-model';
export { renderPirepGlyph } from './symbology/pirep-glyph';
export { renderFront, type FrontKind } from './symbology/fronts';
export { renderPressureCenter } from './symbology/pressure-centers';
export { renderAdvisoryPolygon } from './symbology/advisory-polygons';
export { renderConvectiveOutlookPolygon } from './symbology/convective-outlook';
export { renderAirport } from './symbology/airports';
export { renderLegend, type LegendDef } from './symbology/legend';
export { renderPolylinePips, type PipDef } from './symbology/polyline-pips';
export { renderScalarContours } from './symbology/contours';

// Type-only re-exports of server-only renderers (so apps can import the type without dragging sharp in)
export type { ChartRenderer, ChartRenderInput, ChartRenderResult, ChartRenderMeta } from './types';
export type { SurfaceAnalysisSpec } from './charts/surface-analysis';
export type { RadarMosaicSpec } from './charts/radar-mosaic';
// ... type-only export per chart
```

### Server-only exports (`@ab/wx-charts/server`)

```typescript
// Re-exports every renderer as a value, plus the sharp warp.
// Consumed by scripts/charts.ts; never imported by .svelte files.
export { renderSurfaceAnalysis } from './charts/surface-analysis';
export { renderRadarMosaic } from './charts/radar-mosaic';
export { renderAdvisoryOverlay } from './charts/advisory-overlay';
export { renderMetarPlotGrid } from './charts/metar-plot-grid';
export { renderPirepPlotGrid } from './charts/pirep-plot-grid';
export { renderWindsAloftFb } from './charts/winds-aloft-fb';
export { renderProgChart } from './charts/prog-chart';
export { renderGfa } from './charts/gfa';
export { renderConvectiveOutlook } from './charts/convective-outlook';
export { renderCva } from './charts/cva';
export { warpRaster } from './raster/warp';
export { CHART_RENDERERS } from './charts/registry';  // type -> renderer lookup
```

The `CHART_RENDERERS` registry is the CLI's lookup table:

```typescript
import { CHART_TYPES, type ChartType } from '@ab/constants/wx-charts';
// ... renderer imports

export const CHART_RENDERERS: Record<ChartType, ChartRenderer> = {
  [CHART_TYPES.SURFACE_ANALYSIS]: renderSurfaceAnalysis,
  [CHART_TYPES.RADAR_MOSAIC]: renderRadarMosaic,
  [CHART_TYPES.ADVISORY_OVERLAY]: renderAdvisoryOverlay,
  [CHART_TYPES.METAR_PLOT_GRID]: renderMetarPlotGrid,
  [CHART_TYPES.PIREP_PLOT_GRID]: renderPirepPlotGrid,
  [CHART_TYPES.WINDS_ALOFT_FB]: renderWindsAloftFb,
  [CHART_TYPES.PROG_CHART]: renderProgChart,
  [CHART_TYPES.GFA]: renderGfa,
  [CHART_TYPES.CONVECTIVE_OUTLOOK]: renderConvectiveOutlook,
  [CHART_TYPES.CVA]: renderCva,
};
```

### CLI entry (`scripts/charts.ts`)

Mirrors `scripts/db.ts` shape: argv switch, sub-command modules under `scripts/charts/{build,validate,list}.ts`, help text when called with no args.

## Component Structure

The library exports no Svelte components. The consumer (`course-reader-and-editor`) ships `<CourseStepChart slug="..." />`, which constructs a static asset URL and renders an `<img src="/charts/wx/<slug>/chart.svg" />`. SvelteKit's static-asset serving handles the URL.

The split keeps this WP free of SvelteKit / DOM concerns and lets the consumer evolve mounting strategy independently (inline SVG, `<img>`, lazy-load via `<picture>`, etc.).

## Data Flow

```text
                  Author
                    |
                    v
          [data/charts/wx/<slug>/spec.yaml]   <- author writes
                    |
                    v
     bun run charts build <slug>
                    |
                    +---> reads spec.yaml
                    +---> resolves sources from cache (~/Documents/airboss-handbook-cache/wx/...)
                    +---> validates spec shape (Zod)
                    +---> computes content_hash
                    +---> if hash unchanged: exit 0 'unchanged'
                    +---> if hash changed: lookup CHART_RENDERERS[spec.type]
                          |
                          v
                    [renderer: pure function, bytes -> SVG string]
                          |
                          +---> uses substrate (projection, basemap, chrome, layers)
                          +---> uses chart-type symbology (fronts, station-model, etc.)
                          +---> for raster types: warpRaster() via sharp
                          v
                    [returns { svg, meta }]
                          |
                    +---> writes data/charts/wx/<slug>/chart.svg
                    +---> writes data/charts/wx/<slug>/meta.json
                    v
                  exit 0 'built'

                                            (later, in the consumer)

                  Learner
                    |
                    v
       loads /courses/<course-slug>/<step-code>
                    |
                    v
       <CourseStepChart slug="wx-..." />
                    |
                    +---> resolves to /charts/wx/<slug>/chart.svg
                    +---> SvelteKit serves the static asset
                    v
       browser renders the SVG inline as <img>
```

The library has no runtime data flow at consumer time. Charts are pre-built; the consumer is a static asset reader.

## Key Decisions

| Question                     | Options considered                                                                                            | Chosen                          | Why                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Library shape baseline       | Clean-sheet design / refine Spike 1 / refine Spike 2 / **refine Spike 3**                                     | Refine Spike 3                  | Spike 3's shape already absorbed Spikes 1+2 lessons; spikes' working code maps directly into the modules.    |
| Raster warp impl             | Headless chromium (spike) / **sharp** / native canvas binding / WASM                                          | sharp                           | No browser dep, native speed, importable from any Node/Bun script.                                           |
| Output path convention       | Flat (`data/charts/<slug>.svg`) / **per-chart dir** (`data/charts/wx/<slug>/{spec.yaml,chart.svg,meta.json}`) | Per-chart directory             | Co-locates spec + output + meta; matches consumer URL path 1:1; new charts = new dirs.                       |
| Output build trigger         | Build at deploy / build on first request / **commit pre-built SVG**                                           | Commit pre-built SVG            | No CI; chart authoring is deliberate; static-asset serving is the simplest mount path.                       |
| CLI invocation pattern       | Per-chart script (`scripts/charts/build-<slug>.ts`) / **dispatcher** (`scripts/charts.ts <subcmd>`)           | Dispatcher                      | Mirrors `scripts/db.ts` and other dispatchers; one canonical entry point per noun.                           |
| Layer band openness          | Open-ended (renderers can name new bands) / **closed enum**                                                   | Closed enum                     | Predictable composition; substrate changes are deliberate; matches Spike 2's contract.                       |
| Slug prefix                  | Bare slug / **`wx-` prefix**                                                                                  | `wx-` prefix                    | Future non-WX chart families (perf, route, etc.) get sibling subdirs and own prefixes; no accidents.         |
| Source-data location         | Repo (`data/wx/...`) / **dev cache** (`~/Documents/airboss-handbook-cache/wx/...`)                            | Dev cache                       | Per ADR 018 -- raw bytes are large + per-instance + not load-bearing for non-authors.                        |
| Substrate-data location      | Cache / **repo** (`data/references/basemaps/`, `data/references/palettes/`)                                   | Repo                            | Small, stable, shared across every chart, load-bearing for every consumer.                                   |
| Renderer entry-point split   | Single barrel / **runtime + server barrels** (per `libs/bc/study` pattern)                                    | Runtime + server                | Sharp lives in server; runtime barrel exposes types so apps can import without dragging sharp in.            |
| METAR parser                 | Roll our own (Spike 3) / **roll our own (production)** / `metar-taf-parser` from npm                          | Roll our own                    | Spike 3's parser is ~250 lines and fits the field set; npm dep buys little for a small API surface.          |
| Phase A scope                | Substrate alone / **substrate + 1 chart e2e** / substrate + 2 charts                                          | Substrate + 1 chart             | E2E proof of the renderer contract + CLI + commit story; one chart is enough to unblock B/C/D in parallel.   |
| Authoring CLI auto-fetch     | Pull live IEM/NCEI/NOAA at build time / **manual cache capture, build reads from cache**                      | Manual capture                  | Determinism; no network at build time; cache fetch is its own concern (deferred -- see OUT-OF-SCOPE.md).     |
| Chart spec format            | TOML / JSON / **YAML**                                                                                        | YAML                            | Author-friendly; matches existing course YAML authoring; multi-line strings (`subtitle`, `notes`) read well. |
| Chart count in v1            | Charts only as needed / **all 10 PPL ACS Task C K2 charts**                                                   | All 10                          | Fixed scope, fixed phasing, complete coverage of the cert task; subsequent charts ship as micro-WPs.         |
| Pedagogical overlay shipping | Bundled with each chart / **substrate ready, overlays as micro-WPs after**                                    | Substrate ready, overlays later | Per spike notes: overlays are course-content-driven; substrate must support them but doesn't ship them.      |

## Renderer-by-renderer notes

### surface-analysis (Phase A)

Spike 1 is the working baseline. Extraction work:

- Lift `src/projection.ts` -> `libs/wx-charts/src/projection.ts`
- Lift `src/basemap.ts` -> `libs/wx-charts/src/basemap.ts`
- Lift `src/symbology.ts` -> split into `symbology/polyline-pips.ts`, `symbology/fronts.ts`, `symbology/pressure-centers.ts`
- Lift `src/isobars.ts` -> `symbology/contours.ts`
- Lift `src/stations.ts` -> `symbology/station-model.ts` (Phase A ships station-model substrate; Phase C ships the dense METAR-grid renderer that consumes it)
- Compose a `renderSurfaceAnalysis(input)` function that takes the spike's `data/sfc-2024-12-23-12z.json` shape and emits the same SVG via the layer-band contract

### radar-mosaic (Phase B)

Spike 2 is the working baseline. Extraction work:

- Lift `src/warp-radar.ts` -> `libs/wx-charts/src/raster/warp.ts` + `raster/sharp-bridge.ts` (replaces chromium with sharp)
- Add `raster/palettes.ts` with NWS reflectivity ramp as a function (currently the spike uses IEM's pre-rendered ramp; production parameterizes it)
- Add `raster/worldfile.ts` (parses ESRI world file: 6 numeric lines)
- `renderRadarMosaic(input)` composes basemap + warped raster + re-stroked borders + chrome

### advisory-overlay (Phase B)

New renderer (no spike). Inputs: AIRMET/SIGMET/Convective SIGMET text + polygon geometry. Symbology:

- AIRMET Sierra (IFR/MTN OBSCN): yellow-fill polygons
- AIRMET Tango (turbulence): orange dashed polygons
- AIRMET Zulu (icing): blue dashed polygons
- SIGMET (severe wx): solid red polygons
- Convective SIGMET: solid red polygons with thunderstorm glyph

`symbology/advisory-polygons.ts` is the new module. Polygon styling per advisory type, with a chrome legend strip listing active advisories.

### metar-plot-grid (Phase C)

Spike 3 is the working baseline. Extraction work:

- Lift `src/metar.ts` -> `libs/wx-charts/src/wx/metar/parser.ts` + `wx/metar/types.ts`
- Lift `src/station-model.ts` -> `symbology/station-model.ts` (already partially done in Phase A, now hardened with the dense-grid options)
- Lift `src/collision.ts` -> `point/collision.ts`
- Lift `src/ingest.ts` patterns into the CLI (the renderer itself doesn't fetch; the CLI does)
- `renderMetarPlotGrid(input)` composes basemap + collision-resolved station glyphs + footer chrome

### pirep-plot-grid (Phase C)

New renderer (no spike, but pattern mirrors METAR). Inputs: PIREP text strings. Symbology:

- Turbulence reports: triangle (light), filled triangle (mod), open-and-filled triangle stack (severe)
- Icing reports: zigzag (rime), zigzag with dots (mixed), zigzag with circles (clear)
- Sky cover: same cloud-cover wedge as METAR
- Altitude: text label below glyph

`symbology/pirep-glyph.ts` is the new module. The `point/collision.ts` primitive is reused unchanged.

### winds-aloft-fb (Phase C)

New renderer (no spike). Inputs: FB grid text product. Output is a tabular overlay over a CONUS basemap:

- Each FB station gets a small "stack" of altitudes (3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000)
- Each row: wind direction (3-digit), wind speed (KT), temperature (degC), formatted per FAA convention
- Selected stations only (~30 hubs) at the standard "winds aloft" grid

No collision avoidance needed (stations are pre-selected at non-conflicting coords). Substrate stack: basemap + chrome + custom point-symbology (text-block-per-station).

### prog-chart (Phase D)

Same as surface-analysis but with forecast data. The chart type is identical to surface-analysis structurally; only the spec.yaml's source data and the chrome's title/subtitle differ ("FORECAST 12HR" vs "ANALYSIS"). Could share the same renderer with a `forecast: boolean` option, but a separate `renderProgChart` keeps the public-API set clean and lets the chrome title default sensibly.

### gfa (Phase D)

New renderer. GFA is FAA's overlay product combining current observations + advisories + forecasts. Composes:

- Basemap + state borders
- AIRMET/SIGMET polygons (re-uses Phase B's `symbology/advisory-polygons.ts`)
- TAF text panels at terminal airports (small text overlays)
- Cloud and surface visibility legend chrome

### convective-outlook (Phase D)

New renderer. SPC outlook is a polygon-overlay chart with five risk tiers (TSTM, MRGL, SLGT, ENH, MDT, HIGH). Each tier has a defined fill color and label. Substrate stack: basemap + tier polygons (drawn outermost first so MRGL is under SLGT is under ENH, etc.) + tier-legend chrome.

`symbology/convective-outlook.ts` is the new module.

### cva (Phase E)

New renderer. CVA is a CONUS-wide visualization of ceiling and visibility, color-coded by flight category (VFR/MVFR/IFR/LIFR). Either:

- Polygon overlay (FAA's official CVA rendering uses pre-computed polygons from MADIS data), or
- Per-station shaded rectangles (lighter weight, faster to author from METAR data)

Decision deferred to Phase E start; both are tractable. Substrate stack: basemap + flight-category polygons + small station markers + tier-legend chrome (re-uses convective-outlook's legend pattern).

## Test strategy summary

See test-plan.md for the numbered scenarios. Two-tier strategy:

- **Vitest unit tests** for parsers (METAR, PIREP, TAF, SIGMET, GFA, FB), symbology render helpers (return correct SVG fragment), the collision algorithm (terminates within max iterations, all stations >= min distance), the layer-band composer (band ordering, missing bands handled), the CLI dispatcher (subcommand routing).
- **Snapshot tests** for end-to-end chart renders. Each chart-type renderer has a fixture spec + fixture sources; the test runs the renderer and snapshot-compares the SVG. Snapshot updates are PR-reviewable.
- **Manual smoke** for visual quality. Each phase's PR checklist includes "open `chart.svg` in a browser, confirm it reads correctly" against the test-plan scenarios.

The library does not need Playwright tests of its own (it produces SVG files, not pages). The consumer WP's smoke test confirms `<CourseStepChart slug="..." />` mounts successfully.

## Risk register

| Risk                                                               | Mitigation                                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Sharp warp output diverges from chromium (color / antialiasing)    | Phase B starts with a sharp-vs-chromium pixel diff against Spike 2's output; tolerance budget defined before merge.                   |
| Layer-band contract proves insufficient when GFA composes 4 layers | GFA is in Phase D; if a real composition need surfaces a missing band, propose substrate change in a substrate PR before D.           |
| Chart-spec YAML drift across chart types                           | One canonical Zod schema per chart type; CLI rejects unknown keys; shared keys (slug, type, title, projection) live in a base schema. |
| Slug-collision risk (course author picks an existing slug)         | CLI `validate` enumerates existing slugs; future authoring tool can prevent collisions at write time.                                 |
| Live data availability (NCEI archives sometimes return 404)        | Manual capture model means availability problems surface at capture time, not at chart-build time.                                    |
| Sharp install fails on author's machine                            | `bun install` runs sharp's prebuilt binary install; the CLI surfaces a specific error if the lazy-load throws.                        |
| Per-chart-type spec drift across the team                          | Each Zod schema is the contract; changes go through a schema-PR + regenerate-affected-charts pass.                                    |
| Bundle bloat from including sharp in client                        | Server-only barrel + browser-globals check guard prevents accidental client imports.                                                  |
| Visual regression after a substrate change                         | Snapshot tests catch SVG diffs; a substrate PR includes the regen + snapshot updates as part of the same diff.                        |
