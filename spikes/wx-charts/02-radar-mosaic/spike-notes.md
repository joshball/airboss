# Spike 02: Radar Mosaic Chart -- Notes

Throwaway prototype. Goal: render a recognizable NWS-style composite-
reflectivity radar mosaic for CONUS at 2024-05-21 22Z, using SVG
+ d3-geo + a re-projected raster PNG, from real archived data, in a
way a returning CFI can teach a PPL student from.

The output is `spike-output.svg`; open `spike-output.html` to view.

## What the spike was testing

The brief called out three distinct things vs Spike 1:

1. Raster compositing on top of an SVG basemap (Spike 1 was pure vector)
2. Color ramp fidelity (do we render the NWS palette ourselves or
   ingest pre-rendered)
3. Native-projection-vs-reprojection handling (NEXRAD products ship in
   different projections; our basemap is Lambert)

Short answers, expanded below:

1. SVG `<image>` inside the basemap composes cleanly. No need for a
   separate canvas overlay.
2. We use the IEM-supplied palette as-is. Re-coloring ourselves was an
   acceptable scope cut and the right call -- IEM already applies the
   NWS conventional ramp.
3. The IEM PNG ships in Plate Carree (EPSG:4326). We re-project it
   pixel-by-pixel into the basemap's Lambert canvas via inverse
   projection in headless chromium. Result: zero edge misalignment.

## Data path chosen

IEM NEXRAD Composite Archive, n0r product:

- URL: `https://mesonet.agron.iastate.edu/archive/data/2024/05/21/GIS/uscomp/n0r_202405212200.png`
- Companion `.wld` (ESRI world file): `0.01 0 0 -0.01 -126.0 50.0`
  meaning 0.01 deg/pixel, top-left at lon -126 / lat 50, Y-axis flipped
- Format: 6000x2600 px, 8-bit indexed PLTE (256 entries, no tRNS chunk).
  Indices 0..6 and 22..255 are opaque black ("no data"). Indices 7..21
  are the NWS reflectivity ramp (cyan -> blue -> green -> yellow ->
  red -> magenta -> white) at ~5 dBZ steps from -10 to +75 dBZ.
- The .wld + the IEM archive page imply EPSG:4326 (geographic /
  Plate Carree) over the CONUS extent. Verified by matching pixel
  positions of known features (the I-35 squall line on this date
  lands where it should after re-projection).

The n0q super-resolution variant (12000x5200, 3.3 MB) is also
available at the same URL pattern. n0r at 6000x2600 / 461 KB is plenty
for CONUS-scale rendering and warps faster.

## Architecture

Three steps:

1. **Warp** (`src/warp-radar.ts`). The IEM PNG is in Plate Carree.
   Our basemap is Lambert Conformal Conic 33/45 fitted to a 1200x780
   canvas. For each output pixel (px, py), invert the Lambert
   projection to (lon, lat), look up the source PNG sample at that
   lon/lat, copy the color (or alpha=0 if the source pixel was a
   no-data black). Bun has no built-in image decoder and we didn't
   want to add `sharp` / `jimp` for a spike, so the pixel loop runs
   in headless chromium: Node computes the inverse-projection lookup
   table once, base64-encodes it, sends it to a page that has the
   source PNG also as a data URI; the page draws to a canvas, walks
   the lookup, exports the warped PNG via `toDataURL`.
2. **Render** (`src/render.ts`). Compose SVG: background -> graticule
   -> state fills -> interior borders -> outer coastline -> warped
   radar via `<image>` at alpha 0.78 -> re-stroked borders ABOVE the
   raster at low opacity (so cells inside high-DBZ echoes still show
   state outlines) -> 12 major airports -> title + legend.
3. **Screenshot** (`src/screenshot.ts`). Headless chromium captures
   the SVG at native size for the PNG preview.

Everything is a single SVG at view time. The warp produces a small
(118 KB) PNG that gets embedded as a base64 data URI inside `<image>`,
so `spike-output.svg` is one file -- no external assets, no network
calls when opened.

## What worked

- **SVG `<image>` element with a base64 data URI is the right embedding
  pattern.** No need for canvas overlays, no need to fight CSS layering,
  no JS at view time. The `<image>` element accepts opacity and
  preserveAspectRatio just like any other SVG element. The basemap and
  the radar live in the same coordinate space; layering with z-order
  is just SVG render order.
- **Pre-warping the raster to match the basemap projection eliminates
  edge misalignment entirely.** Before warping, a Plate Carree PNG
  placed in a Lambert canvas would show the radar shifted noticeably
  near the canvas corners (the projections diverge at ~1-2% near 30N
  and 50N). After warping, state borders line up perfectly with radar
  cells at every part of the canvas.
- **Inverse-projection-then-sample is the standard, and d3-geo
  supports it.** `geoConicConformal().invert([px, py]) -> [lon, lat]`
  is the only thing we needed. Walk the output canvas, invert each
  pixel, sample the source. Cost: ~5-15 s in headless chromium for
  936,000 output pixels (on an M-series Mac). One-shot at build time;
  the warped PNG is cached in `data/`.
- **The NWS reflectivity palette is IEM-supplied.** PLTE indices 7..21
  decode to the canonical NWS ramp colors without any work on our end.
  We don't need to know the dBZ -> RGB mapping at warp time -- the
  source pixels already have the right RGB values; we just copy them.
  The legend swatches in `render.ts` are hardcoded to the same hex
  values so the on-chart legend matches the embedded raster exactly.
- **Re-stroking the basemap above the raster at low opacity** is the
  cheap fix for "the radar layer hides state borders inside dense
  cells." Stroke once at full color under the raster (basemap
  reading), once again above the raster at 35% opacity (border still
  reads even where a 50+ dBZ cell sits on top). Costs almost nothing,
  reads as an intentional design choice.
- **Using the same projection + canvas as Spike 1** means a future
  composite chart (radar + surface analysis on one frame) is essentially
  free: stack the SVG bodies, no re-warping needed.
- **Dropping no-data pixels at warp time** (alpha=0 wherever the
  source decoded to (0,0,0)) means the basemap shows through the
  radar layer everywhere there's no echo -- no need for chroma-key
  tricks or CSS blend modes at render time.

## What was hard / what surprised me

- **The IEM PNG has no tRNS chunk.** I was hoping to use the source
  PNG directly via `<image href="...">` and let the browser handle
  transparency, but every "no data" pixel is opaque black (RGB
  0,0,0). Loading it directly would cover the basemap entirely. The
  warp step solves this anyway (we drop those pixels by alpha), but
  noting it for the production version: if we ever want to skip the
  warp on a non-Lambert chart, we'll need to either patch in a tRNS
  chunk on ingest or run the depalettize pass.
- **Bun has no built-in image decoder.** I expected `Bun.file().arrayBuffer()`
  + some PNG library to be one-line, but the existing deps don't
  include sharp / jimp / pngjs / upng. Headless chromium turned out
  to be the cleanest fallback -- it's already installed (playwright)
  and gives us PNG decoding + canvas pixel ops + PNG re-encoding for
  free. A production version probably wants `sharp` for the warp
  pass (faster, no browser dep), but for a spike the chromium path
  works fine.
- **Float32Array transport between Node and the browser is awkward.**
  `page.evaluate(fn, arg)` JSON-stringifies the argument, so a
  Float32Array becomes a `{0: 1.23, 1: 4.56, ...}` plain object that
  takes forever to serialize and de-serialize at million-element scale.
  Worked around by encoding the buffer as base64 in Node and decoding
  via `atob` + a small loop in the browser. Two orders of magnitude
  faster.
- **CONUS extent + projection fit is a Spike-1-inherited gotcha.**
  Same lesson as Spike 1: pass CONUS-only state geometry to
  `fitExtent`, never the us-atlas nation outline. Re-noted here so
  the symbology library WP captures it as a primitive contract.
- **Re-stroked borders need the right opacity.** First pass at 60%
  was too prominent; the borders started competing visually with
  the radar. 35% is the sweet spot -- you can find a state line if
  you look, but it doesn't pull the eye away from the storm structure.
  Mention as a token in the design system: "raster-overlay border
  emphasis" gets its own opacity value so we don't have to re-tune
  per chart type.

## What was cut

- **Color-ramping raw radar data ourselves.** The brief allowed
  ingesting the pre-rendered IEM PNG instead of re-coloring from raw
  NetCDF/GRIB; we took that path. The IEM color ramp is the NWS
  conventional one, so the chart is pedagogically correct as-is. A
  production version that wanted custom palette experiments (e.g. a
  colorblind-friendly variant, or "highlight cells > 50 dBZ in
  contrast") would need to ingest raw data and apply its own LUT.
- **Pedagogical overlays.** No echo-intensity legend hover, no motion
  vectors, no supercell markers, no hail-core annotations, no MESO /
  TVS markers. The pedagogical reframing from Spike 1 (the right
  product is a teaching-annotated radar, not a clone of the NWS live
  feed) still applies; this spike just establishes the base layer the
  overlays will attach to. See "Pedagogical overlay surface" below.
- **Time animation.** Static single-frame.
- **High-resolution USA borders.** Same Natural Earth basemap as
  Spike 1.
- **Bilinear sampling in the warp.** Nearest-neighbor at the down-
  sample ratio we're running (~5x) is fine; bilinear would smooth the
  echo edges slightly but blur the no-data boundary, which we want
  sharp.
- **No legend tick lines or color-stop labels at every value.** Only
  every other dBZ value gets a number under it; cleaner read.

## Comparison to Spike 1

What's the same:

- **Projection helper, basemap loader, chrome pattern, title band**
  carry over essentially unchanged. Same canvas (1200x780), same
  Lambert 33/45 fit, same CONUS-only filter trick, same title-band-
  on-top reservation. Confirms these are reusable primitives, not
  surface-analysis specific.
- **Headless chromium for screenshots** is the same pattern.
- **Single self-contained SVG output** is the same shipping format.

What's different:

- **Spike 1 was pure vector**: every pixel was either a `<path>` or
  a `<text>` or empty. **Spike 2 introduces a raster layer**, which
  means a build-time warp step exists between data and render. The
  symbology library will need to support both: pure-vector layers
  for fronts / isobars / station models, and raster-with-warp layers
  for radar / satellite / model fields.
- **Spike 2 needs an inverse projection** at warp time. d3-geo's
  `.invert` was already available; we just hadn't used it in Spike 1.
- **Spike 1 stored synoptic data as JSON** (frontal polylines, H/L
  positions). **Spike 2 stores raster + sidecar metadata** (PNG +
  world file + a meta.json). Different ingest contracts.
- **Layer ordering is more nuanced in Spike 2** because the radar
  needs to sit between the vector basemap and the airports/legend,
  AND because we re-stroke borders ABOVE the raster. Spike 1's order
  was "basemap, then symbology, then chrome" with no overlap.

What this implies for the symbology library:

- **A "raster layer" primitive belongs in the library**, alongside
  the existing pure-vector primitives. Inputs: source PNG, source
  georeference (world file or projection params), output projection,
  output canvas size, no-data filter (a function or a list of indices
  / colors to drop). Output: a pre-warped PNG + a small render fragment
  (`<image>` tag with the data URI).
- **The render-order contract needs to be explicit.** "Vector
  basemap underneath; raster overlays at this z-band; vector
  re-strokes ABOVE rasters at this opacity; symbology overlays
  above re-strokes; chrome on top." If every chart type uses the
  same z-band for "raster" and "raster re-stroke," composing two
  charts (radar + analysis) on the same canvas just means two
  layers at the raster band, with re-strokes happening once above
  both.

## Recommendation for the symbology library WP

Carrying forward Spike 1's recommendation -- the library is worth
authoring -- and refining the proposed shape with what Spike 2 added:

### New primitives Spike 2 revealed

- **Raster compositor**. Re-projects a source raster (PNG with
  georeference) into a target projection / canvas. Inputs:

  ```text
  warpRaster({
    sourcePngPath: string,
    sourceProjection: 'plate-carree' | 'mercator' | 'hrap' | ProjectionDef,
    sourceWorldFile: string | WorldFileParams,
    targetProjection: GeoProjection,
    targetWidth: number,
    targetHeight: number,
    noDataFilter: (rgb: [number, number, number]) => boolean,
  }) -> { warpedPngBytes: Buffer, drawnPixels: number, transparentPixels: number }
  ```

  Today this runs in headless chromium; production version probably
  swaps in `sharp` (no browser dep, native speed) but keeps the same
  signature.
- **Color-ramp helpers**. Even though Spike 2 used IEM's pre-rendered
  ramp, the library should expose the NWS reflectivity palette as a
  `dBZ -> RGB` function for charts that ingest raw data later
  (satellite, model fields, custom analyses).

  ```text
  nwsReflectivityRamp(dbz: number): [r, g, b] | null
  paletteToImage(values: number[][], ramp: RampFn): PngBytes
  ```

- **Georeferenced `<image>` positioner**. For charts that DON'T pre-
  warp (small-area products where the projection difference is
  negligible), a helper that places a raster at the right SVG
  coordinates given its native bounds + the chart's projection.
- **Projection-mismatch resolver**. A small decision helper: given
  source projection, target projection, target canvas extent, and an
  acceptable error budget (px), recommends "place via `<image>` with
  fitExtent" vs "pre-warp." Spike 2's answer for CONUS Lambert vs
  CONUS Plate Carree was "always pre-warp" because the divergence at
  the corners is visible; for tiny windows it'd be "pass through."
- **Layer band contract**. Documented z-bands for chart composition:

  ```text
  layer band                     | example
  -------------------------------|-----------------------------------
  background                     | fill rect
  graticule                      | lat/lon lines
  basemap-fill                   | state fills
  basemap-borders                | state borders, coastline
  raster-overlay                 | radar, satellite, model fields
  basemap-re-stroke              | borders above raster, low opacity
  vector-symbology               | fronts, isobars, station models
  point-symbology                | airports, METARs, PIREPs
  chrome                         | title, legend, attribution
  ```

  Two charts that follow this contract compose by stacking
  layer-by-layer.

### Reusable primitives confirmed by Spike 2

Spike 1's list still stands. Spike 2 confirmed:

- Lambert Conformal projection helper (parameterized parallels,
  CONUS-fit) -- used unchanged
- us-atlas basemap loader with CONUS filter -- used unchanged
- Graticule renderer -- used unchanged
- Title band + chart-frame chrome -- used unchanged

### Suggested library shape (refined)

```text
libs/wx-charts/
  src/
    projection.ts           // Lambert helper, fitExtent helper
    basemap.ts              // us-atlas loader, CONUS filter, mesh builders
    graticule.ts            // lat/lon graticule
    chrome.ts               // title band, separator, attribution, legend frame
    layers.ts               // z-band contract, layer ordering
    raster/
      warp.ts               // raster compositor (sharp or chromium)
      palettes.ts           // NWS reflectivity, IR satellite, etc.
      worldfile.ts          // ESRI world file parser
    polyline-pips.ts        // generic pip-along-polyline (fronts, jets)
    contours.ts             // d3-contour wrapper for scalar fields
    station-model.ts        // FAA station model renderer
    fronts.ts               // surface-analysis frontal shapes
    pressure-centers.ts     // H/L markers
    airports.ts             // airport markers + label halos
    legend.ts               // ramp / scale / category legends
    types.ts
  data/
    us-states-10m.json
  examples/
    surface-analysis/       // Spike 1, cleaned up
    radar-mosaic/           // Spike 2, cleaned up
```

### Pedagogical overlay surface

The pedagogical reframing from Spike 1 carries forward: the right
product isn't "embed the live NWS radar" (NWS already does that),
it's "render a teaching-annotated radar." The symbology library
should support these overlays as first-class layers, all attaching
at the `vector-symbology` and `point-symbology` bands above the
raster:

| Overlay                   | Lives in       | Notes                                          |
| ------------------------- | -------------- | ---------------------------------------------- |
| Echo-intensity legend     | chrome.ts      | already in this spike, just static             |
| Echo-intensity hover      | client JS      | tooltip on `<image>` with sampled dBZ          |
| Storm-cell markers        | point-symbol   | NSSL SCAN / SCIT centroids, motion vectors     |
| Hail-core annotations     | point-symbol   | MESH / VIL contours, ringed glyphs             |
| Mesocyclone (MESO) icons  | point-symbol   | NSSL SCIT, rotation arrows                     |
| Tornado vortex (TVS)      | point-symbol   | NSSL SCIT, downward triangle                   |
| Storm-relative motion     | vector overlay | velocity gradient layer, separate raster       |
| Reflectivity tracks       | polyline       | last 60 min cell tracks, faded gradient        |
| Watch / warning polygons  | polygon        | NWS WaWa CAP feed, color by event type         |
| Surface-feature overlay   | imported       | the Spike 1 surface analysis stacks on top     |

The composition rule that makes this work: the radar is ONE LAYER
in the SVG, not the basemap. Anything that wants to annotate it
inserts at the vector-symbology band above. No layer needs to know
about the others.

### Production scope estimate

Given the spike result, the production version of the radar mosaic
chart, **assuming the symbology library is built first**, scopes to:

- Library extraction from spike code (warp module, palette helpers,
  layer-band contract, airports primitive, legend renderer): 1-2 days
- Real-time IEM ingest pipeline (current frame, fallback to recent
  archive on miss, file-system cache): 1 day
- Multi-frame animation support (n0r at 5-min intervals, 12-frame
  loop, time-slider chrome): 1-2 days
- Raster swap to `sharp` instead of headless chromium (fewer deps,
  faster, importable from anywhere): 0.5-1 day
- First teaching overlay (storm-cell markers from NSSL SCAN/SCIT):
  2-3 days, mostly the data-feed adapter
- Production polish (legend tooltip with dBZ -> precipitation rate
  + intensity descriptor, attribution, "data N min old" indicator,
  scale ruler): 1-2 days

That's ~6-10 days for a working live radar mosaic chart with one
teaching overlay, ~1-2 days for each subsequent overlay.

The Spike 1 estimate (~5-8 days for surface analysis) plus this one
(~6-10 days for radar) gives a rough total of ~11-18 days for the
two charts together, **assuming the library is built first**. Without
the library, both estimates roughly double.

## Files

- `spike-output.svg` -- final chart (548 KB, embedded warped PNG)
- `spike-output.html` -- standalone HTML wrapper
- `spike-preview.png` -- 1200x780 PNG screenshot
- `data/n0r_202405212200.png` -- raw IEM source (461 KB)
- `data/n0r_202405212200.wld` -- ESRI world file
- `data/n0r_202405212200.meta.json` -- our notes on palette + extent
- `data/n0r_202405212200.warped.png` -- pre-warped to Lambert (118 KB)
- `data/us-states-10m.json` -- us-atlas CONUS basemap
- `src/projection.ts` -- Lambert helper (adapted from Spike 1)
- `src/basemap.ts` -- topojson loader (adapted from Spike 1)
- `src/warp-radar.ts` -- inverse-projection warp via headless chromium
- `src/render.ts` -- SVG composer
- `src/screenshot.ts` -- preview PNG capture

## Time spent

Approximately 75 minutes from blank to PR. Tools used: d3-geo
(projection + invert), topojson-client (basemap loader), playwright
via @playwright/test (PNG decode + canvas warp + screenshot).

The biggest time saves came from Spike 1's patterns being directly
reusable: projection.ts and basemap.ts copied with minor edits,
chrome / title / canvas dimensions identical. Spike-on-spike learning
was the right shape -- the second chart type was meaningfully faster
than the first because the framing was already proven.
