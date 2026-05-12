---
id: wx-chart-symbology-library
title: 'Test Plan: Weather Chart Symbology Library'
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
  - test-plan
legacy_fields:
  feature: wx-chart-symbology-library
  type: test-plan
---

# Test Plan: Weather Chart Symbology Library

Manual acceptance tests for [spec.md](./spec.md). Prefix `WXC-`. Scenarios are grouped by phase (substrate, then per-chart) plus CLI / idempotency / validator coverage at the bottom.

## Setup

- `bun install` clean (`sharp` prebuilt binary installed, no compile errors).
- `bun run check all` passes on the branch.
- The dev cache exists at `~/Documents/airboss-handbook-cache/wx/` (override via `AIRBOSS_HANDBOOK_CACHE`). The per-chart input fixtures listed below are present at the expected paths.
- Substrate basemaps committed under `data/references/basemaps/`; substrate palettes committed under `data/references/palettes/`.
- The first chart per phase has been built and its `chart.svg` + `meta.json` are committed under `data/charts/wx/<slug>/`.
- A modern browser is available for visually inspecting the SVG outputs (the library produces files; viewing happens in a browser).
- The consumer WP (`course-reader-and-editor`) does not need to be live for any WXC-* scenario; the library is testable on its own.

## Per-chart input fixtures (referenced by phase scenarios)

| Slug                                 | Cache inputs                                                                                                                | Phase |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----- |
| `wx-surface-analysis-2024-12-23-12z` | `wx/sfc-bulletin/2024-12-23-12z.json`, `wx/sfc-bulletin/2024-12-23-12z.slp.grid.json`, `wx/metar/2024-12-23-12z.bulk.csv`   | A     |
| `wx-radar-mosaic-2024-05-21-22z`     | `wx/radar/n0r-202405212200.png`, `wx/radar/n0r-202405212200.wld`                                                            | B     |
| `wx-advisory-overlay-<date>-<time>z` | `wx/sigmet/<date>-<time>z.txt` (full bulletin) + `wx/sigmet/<date>-<time>z.geom.json` (polygon geometry)                    | B     |
| `wx-metar-plot-grid-2024-01-13-12z`  | `wx/metar/2024-01-13-12z.bulk.csv`                                                                                          | C     |
| `wx-pirep-plot-grid-<date>-<time>z`  | `wx/pirep/<date>-<time>z.txt`                                                                                               | C     |
| `wx-winds-aloft-fb-<date>-<time>z`   | `wx/winds-aloft/<date>-<time>z.txt`                                                                                         | C     |
| `wx-prog-chart-<date>-<time>z`       | `wx/prog/<date>-<time>z.json` (forecast surface bulletin)                                                                   | D     |
| `wx-gfa-<date>-<time>z`              | `wx/gfa/<date>-<time>z/tac.txt`, `wx/gfa/<date>-<time>z/fa-polygons.json`, plus relevant TAFs from `wx/taf/<date>-<time>z/` | D     |
| `wx-convective-outlook-<date>-day1`  | `wx/spc/<date>-day1.json`                                                                                                   | D     |
| `wx-cva-<date>-<time>z`              | (Phase E decision -- either MADIS polygon JSON or the Phase C METAR bulk CSV)                                               | E     |

---

## Substrate

### WXC-1: composeChart emits bands in canonical z-order

1. Call `composeChart({ background: '<rect/>', graticule: '<g class="grat"/>', 'basemap-fill': '<g class="states"/>' })` with only those three bands populated.
2. **Expected:** the returned SVG document contains nine `<g>` groups in the canonical order from spec.md "Layer band contract"; the populated bands carry the supplied content; the unpopulated bands render as empty `<g>` placeholders. The `background` group precedes the `graticule` group precedes the `basemap-fill` group, etc.

### WXC-2: composeChart rejects unknown band

1. Call `composeChart({ 'not-a-band': '<g/>' })`.
2. **Expected:** throws with a clear message naming the unknown band and listing the legal `LAYER_BAND_VALUES`.

### WXC-3: lambertProjection projects known points

1. Build a Lambert projection with `parallels: [33, 45]`, `rotate: [-96, 0]`, and a CONUS-fitting extent.
2. Project Houston KIAH (29.984N, -95.342W) and confirm the resulting `[x, y]` is in the expected pixel region (lower-right quadrant for a 1200x780 canvas).
3. Project Seattle KSEA (47.450N, -122.309W) and confirm it's in the upper-left quadrant.
4. **Expected:** both projections succeed; pixel coords are stable across runs (deterministic).

### WXC-4: collision algorithm terminates and respects min-distance

1. Build 80 candidate stations clustered in a 200x200 px region.
2. Call `resolveCollisions({ points, minDistance: 36, maxIterations: 40 })`.
3. **Expected:** function returns within 40 iterations; for every pair in `result.placed`, the Euclidean distance >= 36 OR the pair is flagged in `result.unresolved`. `result.leaders` carries the original-vs-displaced metadata for any moved point.

### WXC-5: chrome renders title and footer bands

1. Call `buildChrome({ title: 'Surface Analysis', subtitle: 'WPC -- 2024-12-23 12Z', libraryVersion: 'wx-charts@0.1.0', sourceAttribution: 'WPC Coded Surface Bulletin' })`.
2. **Expected:** `result.titleBand` SVG contains both strings; `result.footerBand` contains the source attribution and library version.

### WXC-6: graticule renders dashed lat/lon lines

1. Build a Lambert projection (per WXC-3). Call `renderGraticule(projection, { lonStep: 10, latStep: 10 })`.
2. **Expected:** the returned SVG fragment contains `<path>` elements with `stroke-dasharray` set; visually correct in a browser when wrapped in an SVG with the projection's extent.

---

## Phase A -- surface-analysis

### WXC-10: surface-analysis renders for the 2024-12-23 12Z fixture

1. With `wx/sfc-bulletin/2024-12-23-12z.json` and the SLP grid in the cache, run `bun run charts build wx-surface-analysis-2024-12-23-12z`.
2. **Expected:** exits 0 with `built` (or `unchanged` on a re-run); `data/charts/wx/wx-surface-analysis-2024-12-23-12z/chart.svg` exists.
3. Open `chart.svg` in a browser. **Expected:** visible CONUS basemap with state borders; isobars; H/L pressure markers; cold/warm/occluded fronts with the correct pip shapes (triangles for cold, semicircles for warm, alternating for occluded); title band reads "Surface Analysis" with the date/time subtitle.
4. Visually compare against the spike 01 reference output. **Expected:** the chart is recognizable as the same render (allowing for chrome / palette tuning).

### WXC-11: surface-analysis renderer is pure (no I/O)

1. Import `renderSurfaceAnalysis` directly from `@ab/wx-charts/server` in a unit test.
2. Pass synthetic spec + sources (Uint8Arrays of the cache files) directly.
3. **Expected:** returns `{ svg, meta }`; performs no filesystem reads inside the renderer; `meta.layer_counts` totals match the rendered band populations.

---

## Phase B -- radar-mosaic + advisory-overlay

### WXC-20: radar-mosaic renders for the 2024-05-21 22Z fixture

1. With the radar PNG + worldfile in the cache, run `bun run charts build wx-radar-mosaic-2024-05-21-22z`.
2. **Expected:** exits 0; `chart.svg` exists; opening in a browser shows the warped radar reflectivity over the CONUS basemap with state borders re-stroked above the raster (per the layer-band contract); reflectivity colors match the NWS ramp; title band reads "Radar Mosaic" with the date/time subtitle.
3. Visually compare against the spike 02 reference. **Expected:** chart is recognizable as the same render; storm cells appear in the same locations.

### WXC-21: sharp warp matches chromium reference within tolerance

1. Run the (skipped-by-default) test `libs/wx-charts/src/raster/__tests__/warp-vs-chromium.test.ts` against spike 02's chromium reference output.
2. **Expected:** average per-pixel RGB delta < 4 (8-bit); max delta < 16 outside antialiased edges. If outside tolerance, the Phase B PR carries a note explaining the divergence + the decision (tune sharp warp, accept divergence with reasoning, or fall back to chromium for this chart type).

### WXC-22: advisory-overlay renders AIRMET / SIGMET / Convective SIGMET polygons distinctly

1. Build a chart whose `spec.yaml` references a fixture bulletin containing all four advisory variants (AIRMET Sierra/Tango/Zulu, SIGMET, Convective SIGMET).
2. Run `bun run charts build <slug>`.
3. **Expected:** `chart.svg` shows yellow-fill Sierra polygons, orange dashed Tango, blue dashed Zulu, solid red SIGMET, and red-with-thunderstorm-glyph Convective SIGMET; the chrome legend strip lists each active advisory with its identifying code.

### WXC-23: parseAdvisory rejects unparseable bulletin gracefully

1. Pass a malformed AIRMET bulletin (missing the polygon coords block) to `parseAdvisory`.
2. **Expected:** parser returns a `ParsedAdvisory` with `polygon: null` and pushes a warning into the result's `parser_warnings`. Build does not abort -- the chart renders without that advisory's polygon and surfaces the warning in `meta.json.parser_warnings`.

---

## Phase C -- metar-plot-grid + pirep-plot-grid + winds-aloft-fb

### WXC-30: METAR plot grid renders for the 2024-01-13 12Z fixture

1. With the bulk CSV in the cache, run `bun run charts build wx-metar-plot-grid-2024-01-13-12z`.
2. **Expected:** exits 0; `chart.svg` exists; opening in a browser shows the CONUS basemap with station-model glyphs at each METAR station (wind barb, cloud-cover wedge, temperature/dewpoint, visibility, ceiling, pressure tendency); displaced stations have leader lines back to their true coords; flight-category coloring matches the FAA palette.
3. Visually compare against the spike 03 reference. **Expected:** chart is recognizable as the same render.

### WXC-31: parseMetar handles edge tokens

1. For each test METAR string, call `parseMetar`:
   - `KORD 131252Z 00000KT 10SM CLR M02/M07 A3008` -- calm wind (no shaft).
   - `KSFO 131256Z 27015G25KT 1 1/2SM BR FEW003 BKN012 12/11 A2998` -- mixed-fraction visibility, gusts, multi-layer.
   - `KJFK 131251Z 09008KT M1/4SM FG VV001 03/02 A3015` -- M-prefix vis, vertical visibility.
   - `KDEN 131253Z //////KT 10SM SKC 05/M03 A3002` -- unparseable wind.
2. **Expected:** all parse without throwing; calm wind -> `wind: { dir: null, speed: 0 }`; mixed fraction vis -> `1.5`; M-prefix vis -> `0.125`; unparseable wind -> `wind: null` plus a warning in the result.

### WXC-32: PIREP plot grid renders distinct symbology per intensity

1. Build the PIREP chart fixture (containing at minimum: light turbulence, moderate icing rime, severe icing clear).
2. **Expected:** `chart.svg` shows distinct turbulence triangles (light = empty, moderate = filled, severe = stacked); distinct icing zigzags (rime = plain, mixed = with dots, clear = with circles); altitudes labeled below glyphs.

### WXC-33: winds-aloft FB renders text grid over basemap

1. Build the winds-aloft chart for a captured FB bulletin.
2. **Expected:** `chart.svg` shows basemap with a "stack" at each FB station -- one row per altitude (3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000); each row carries direction (3-digit), speed (KT), temperature (degC for non-low altitudes); negative-temp formatting per FAA convention (e.g., `2515-09`).

### WXC-34: parseFbGrid handles missing-temp at low altitudes

1. Pass an FB bulletin whose 3000 ft row carries `2515` (no temperature, FAA convention for low altitudes).
2. **Expected:** parser returns `{ direction: 250, speed: 15, temperatureC: null }` for that row; renderer omits the temperature glyph; no warning emitted (this is normal-case behavior, not an error).

---

## Phase D -- prog + gfa + convective-outlook

### WXC-40: prog-chart renders forecast variant

1. Build the prog chart from a captured forecast bulletin.
2. **Expected:** `chart.svg` is structurally identical to surface-analysis (basemap + isobars + fronts + H/L); chrome title band reads "FORECAST 12HR" (or whatever forecast offset the spec.yaml defines) instead of "ANALYSIS"; subtitle carries the issued/valid times.

### WXC-41: GFA composes advisory polygons + TAF panels

1. Build the GFA chart from a captured TAC text + FA polygon bundle + relevant TAFs.
2. **Expected:** `chart.svg` shows basemap + AIRMET/SIGMET polygons (re-using Phase B's symbology) + small TAF text panels at terminal airports with the forecast period and key elements legible at chart scale; legend chrome lists the cloud and surface visibility key.

### WXC-42: parseTaf handles FM / BECMG / TEMPO blocks

1. Pass a TAF containing all three block types to `parseTaf`:

   ```text
   TAF KBOS 131720Z 1318/1424 18012KT P6SM BKN030
        FM132100 22008KT P6SM SCT250
        BECMG 1404/1406 14010KT P6SM SCT020
        TEMPO 1410/1414 4SM -RA BR BKN015
   ```

2. **Expected:** parser returns a `ParsedTaf` with the issuing block + three period blocks (one FM, one BECMG, one TEMPO); each carries the wind, visibility, and cloud groups; valid-from / valid-to set per the issuing line and each block's prefix.

### WXC-43: convective-outlook renders risk tiers stacked correctly

1. Build the SPC outlook chart from a captured Day 1 categorical bundle.
2. **Expected:** `chart.svg` shows MRGL (lightest), then SLGT, then ENH, then MDT, then HIGH polygons stacked outermost-first so each tier is visible inside the next; chrome legend lists each active tier with its color swatch; non-active tiers omitted from the legend.

---

## Phase E -- cva

### WXC-50: cva renders flight-category surface

1. Build the CVA chart per the Phase E rendering decision (polygon overlay or per-station shaded rectangles).
2. **Expected:** `chart.svg` shows CONUS color-coded by flight category (VFR green, MVFR blue, IFR red, LIFR magenta per the FAA palette); legend chrome lists each category with its color swatch; coverage matches the source data.

---

## CLI

### WXC-60: bun run charts build <slug> writes outputs

1. With a clean checkout (delete the existing `chart.svg` + `meta.json` for the surface-analysis fixture), run `bun run charts build wx-surface-analysis-2024-12-23-12z`.
2. **Expected:** exits 0 with output `built`; both `chart.svg` and `meta.json` are written; `meta.json.content_hash` matches a re-computed hash of `(canonical(spec.yaml) + sorted source bytes + library_version)`.

### WXC-61: bun run charts build is idempotent

1. Re-run the build from WXC-60 without modifying any input.
2. **Expected:** exits 0 with output `unchanged`; `chart.svg` and `meta.json` are untouched (verified via `mtime` and a `git diff` showing no changes).

### WXC-62: bun run charts build --all walks every spec

1. Run `bun run charts build --all`.
2. **Expected:** every chart under `data/charts/wx/*/spec.yaml` is processed; per-chart status (`built` / `unchanged` / `failed`) is reported; the command exits 0 if no chart failed.

### WXC-63: bun run charts validate <slug> succeeds without rendering

1. Run `bun run charts validate wx-surface-analysis-2024-12-23-12z`.
2. **Expected:** exits 0; output indicates spec shape valid + sources resolvable; no `chart.svg` write occurred (mtime unchanged).

### WXC-64: bun run charts validate <slug> rejects malformed spec

1. Edit a copy of the surface-analysis spec.yaml to set `type: surface-analysiss` (typo).
2. Run `bun run charts validate <slug-of-copy>`.
3. **Expected:** exits non-zero with the exact Zod-driven message naming the unknown chart type and listing the legal `CHART_TYPE_VALUES`.

### WXC-65: bun run charts validate <slug> rejects missing source

1. Edit a copy of the surface-analysis spec.yaml to add `sources.fronts: cache://wx/does-not-exist.json`.
2. Run `bun run charts validate <slug-of-copy>`.
3. **Expected:** exits non-zero with the exact message `source 'fronts' not found at <resolved path>`.

### WXC-66: bun run charts list enumerates slugs

1. Run `bun run charts list`.
2. **Expected:** prints every `data/charts/wx/<slug>/` directory's slug, one per line; exit 0.
3. Run `bun run charts list --by-type`.
4. **Expected:** output groups slugs by chart type, with each type's `CHART_TYPE_LABELS` value as the group header.

### WXC-67: bun run charts (no args) prints help

1. Run `bun run charts` with no arguments.
2. **Expected:** prints help text listing every subcommand (build, validate, list) with their flags; exit 0.

---

## Edge cases

### WXC-70: library version bump invalidates content hash

1. Note the current `meta.json.content_hash` for `wx-surface-analysis-2024-12-23-12z`.
2. Bump `libs/wx-charts/package.json` `version` to the next patch.
3. Run `bun run charts build wx-surface-analysis-2024-12-23-12z`.
4. **Expected:** exits 0 with output `built` (not `unchanged`); the new `meta.json.content_hash` differs from the noted value; `chart.svg` is rewritten (even if the bytes are identical, the `library_version` field in `meta.json` reflects the bump).

### WXC-71: empty source for METAR plot grid renders placeholder

1. Author a chart spec referencing a bulk CSV with zero observations in the time window.
2. Run `bun run charts build <slug>`.
3. **Expected:** exits 0; `chart.svg` shows the basemap + chrome with a "no observations in window" notice in the chrome footer; the point-symbology band is empty; this is not an error.

### WXC-72: glyph collision with too many stations marks unresolved

1. Author a fixture with 200 stations clustered in a 100x100 px region (more than the collision algorithm can resolve at min-distance 36).
2. Run `bun run charts build <slug>`.
3. **Expected:** exits 0 with output `built`; a subset of stations is rendered at their original coords with `data-collision="unresolved"` SVG attributes (visible to a CSS selector); `meta.json.parser_warnings` notes the count of unresolved stations.

### WXC-73: hand-edited chart.svg overwritten on next build

1. Manually edit `data/charts/wx/wx-surface-analysis-2024-12-23-12z/chart.svg` (e.g., insert a comment).
2. Run `bun run charts build wx-surface-analysis-2024-12-23-12z`.
3. **Expected:** the build does NOT detect the hand-edit (only `meta.json.content_hash` drift is checked); since spec + sources are unchanged, exits 0 with `unchanged`; the hand-edit survives.
4. Modify the spec.yaml's subtitle. Re-run.
5. **Expected:** content hash changes; build re-renders; the hand-edit is overwritten. The contract is "spec.yaml is the source of truth; any hand-edit to chart.svg is ephemeral."

### WXC-74: output SVG size budget warning

1. Author a radar-mosaic spec whose source PNG is large (e.g., 4096x4096 px) and whose warp produces a >500 KB but <5 MB SVG.
2. Run `bun run charts build <slug>`.
3. **Expected:** exits 0 with `built` plus a warning line: `chart.svg exceeds 500 KB; consider raster re-compression`. `meta.json` carries the size in bytes.

### WXC-75: output SVG size budget hard error

1. Author a fixture that produces a >5 MB SVG (synthetic; e.g., extremely high-resolution warp).
2. Run `bun run charts build <slug>`.
3. **Expected:** exits non-zero with the exact message `chart.svg would exceed 5 MB hard limit; aborting`; no write occurs.

### WXC-76: sharp not installed surfaces a clear error

1. (Skipped by default; runs only when verifying the error path manually.) Temporarily move the `sharp` package out of `node_modules`.
2. Run `bun run charts build wx-radar-mosaic-2024-05-21-22z`.
3. **Expected:** exits non-zero with the exact message `sharp not installed -- run 'bun install'`.
4. Restore sharp; re-run; **expected:** build succeeds.

### WXC-77: slug-shape validation rejects bad slugs

1. Author a spec.yaml with `slug: WX_BAD_SLUG` (uppercase + underscores).
2. Run `bun run charts validate <slug>`.
3. **Expected:** exits non-zero with a message naming the slug shape regex `^wx-[a-z0-9][a-z0-9-]{1,80}[a-z0-9]$`.

### WXC-78: slug must equal the directory name

1. Place a spec.yaml at `data/charts/wx/wx-surface-analysis-2024-12-23-12z/spec.yaml` whose `slug:` field is `wx-surface-analysis-2024-12-23-13z` (off by one hour).
2. Run `bun run charts validate wx-surface-analysis-2024-12-23-12z`.
3. **Expected:** exits non-zero with a message naming the directory-vs-slug mismatch.

### WXC-79: two charts referencing the same source rebuild on source change

1. Author two chart specs that both reference the same METAR bulk CSV (e.g., a METAR plot grid and a CVA chart sourced from the same observations).
2. Run `bun run charts build --all` -- both should be `unchanged` after the first pass.
3. Modify the bulk CSV.
4. Re-run `bun run charts build --all`.
5. **Expected:** both charts rebuild (content hash includes the source bytes); both `chart.svg` files are rewritten with the updated input.

### WXC-80: meta.json carries source hashes

1. Inspect `data/charts/wx/wx-surface-analysis-2024-12-23-12z/meta.json`.
2. **Expected:** `source_hashes` object has one SHA-256 entry per spec.sources key; `content_hash` is a SHA-256 over canonical-spec + sorted source bytes + library_version; `built_at` is ISO-8601 UTC; `library_version` matches `libs/wx-charts/package.json` version; `layer_counts` records per-band element counts.

### WXC-81: future overlay registering a new layer band requires substrate change

1. Attempt to call `composeChart({ ..., 'motion-vectors-overlay': '<g/>' })` (a band not in `LAYER_BAND_VALUES`).
2. **Expected:** throws per WXC-2.
3. To register a new band: add to `LAYER_BANDS` in `libs/constants/src/wx-charts.ts`, bump `libs/wx-charts/package.json` version, run `bun run charts build --all` to regenerate every chart's `meta.json`.
4. **Expected:** all `meta.json` files now reflect the new `library_version`; charts that don't populate the new band still render correctly with an empty `<g>` for that band.

---

## Browser-bundle hygiene

### WXC-90: server-only sharp does not leak to client bundle

1. Confirm `bun run check` includes the `check-browser-globals` step pass for `libs/wx-charts/`.
2. Search for `from '@ab/wx-charts/server'` in any `apps/*/src/**/*.svelte` file.
3. **Expected:** zero matches; the runtime barrel `@ab/wx-charts` is the only client-eligible import path; the server barrel is consumed exclusively by `scripts/charts.ts` and unit tests.

### WXC-91: runtime barrel is browser-safe

1. Build the consumer (`apps/study/`) and inspect the resulting client bundle.
2. **Expected:** `sharp`, `node:fs`, and any other Node built-in are not present anywhere in the client bundle. Only the pure helpers from `@ab/wx-charts` (parsers, projection, layer composer, symbology helpers) are reachable from client code.
