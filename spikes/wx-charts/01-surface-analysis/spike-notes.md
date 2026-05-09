# Spike 01: Surface Analysis Chart -- Notes

Throwaway prototype. Goal: render a recognizable FAA-style surface
analysis for CONUS at 2024-12-23 12Z, using SVG + d3-geo, from real
archived data, in a way a returning CFI can teach a PPL student from.

The output is `spike-output.svg`; open `spike-output.html` to view.

## Data path chosen

I went with **Fallback B (hand-traced from the WPC archive PNG)**
plus a small set of representative ASOS-style station obs.

Why not the WPC machine-readable underlying data:

- The WPC Surface Analysis archive at
  https://www.wpc.ncep.noaa.gov/archives/web_pages/sfc/sfc_archive.php
  exposes only the rasterized PNGs and the CONUS GIF/PDF. There is no
  archived NetCDF, GRIB2, or JSON of the analyst-drawn fronts /
  isobars. The same applies to the live (non-archive) page; OPC and
  WPC both publish bulletins as text/PNG, not as machine-readable
  geometries.
- NDFD / RAP / HRRR have **gridded MSLP** and could yield isobars via
  contouring, but they would not give analyst-drawn fronts. Fronts in
  operational charts are a human-curated product. The closest
  programmatic source is the WPC "Coded Surface Bulletin" -- a
  compact text bulletin of front coordinates -- which **is** archived
  for several years but is undocumented and inconsistent in format.
  Worth investigating in a follow-up spike, but too much friction for
  this one.

So for the spike I traced front polylines and pressure-center
positions by eye from the WPC archive PNG for 2024-12-23 12Z, encoded
them in `data/sfc-2024-12-23-12z.json` with comments documenting the
source. The pressure field for isobar contouring is synthesized by
placing Gaussian bumps around each marked H/L center, then contouring
that field at 4 mb intervals (`isobars.ts`). This gives a chart that
**looks** right at a glance and conveys the correct synoptic story,
but the isobar shapes between systems are not the WPC analyst's
shapes -- they're a smooth interpolation through the centers.

A production version would need to ingest a real gridded SLP product
(RAP analysis, ERA5, or similar) and overlay the analyst's fronts
from the Coded Surface Bulletin. Roughly 80% of the work in this
spike is reusable for that path; the data layer would change.

## What worked

- **`d3-geo.geoConicConformal()` with `.parallels([33, 45])` is the
  right call.** The Lambert math in d3-geo is correct out of the box;
  the FAA-convention standard parallels just need to be passed in.
  No need for a custom projection.
- **Fitting the projection** with `.fitExtent([[m, m], [W-m, H-m]],
  conusStatesFeatureCollection)` works perfectly **as long as you
  pass CONUS-only geometry**. Using us-atlas's `nation` feature
  silently includes Alaska/Hawaii/PR and stretches the projection
  into a tall, skinny band that puts the entire continent into ~120
  px of vertical canvas. **Use the CONUS-only union (or the filtered
  states FeatureCollection) as the fitTarget.**
- **us-atlas** (`states-10m.json`, `nation-10m.json`) is the
  fastest-to-good basemap source for CONUS. Filtering to CONUS = drop
  FIPS 02, 15, 60, 66, 69, 72, 78. Interior state borders via
  `topojson.mesh(topo, geom, (a,b) => a !== b)`. Outer coastline +
  Canada/Mexico borders via `topojson.mesh(topo, geom, (a,b) =>
  a === b)`.
- **`d3-contour`** does the isobar work from a regular grid. Works
  in image-coordinate space (Y down), so when projecting back to lon/
  lat from grid indices you have to invert Y.
- **Frontal pip placement** is the trickiest visual primitive. The
  pattern that ended up working:
  1. Walk the projected polyline at fixed pixel spacing.
  2. At each glyph position, compute both perpendicular unit vectors.
  3. Pick the one that aligns with a **cardinal-direction target**
     in screen space (N=up=-y, S=down=+y, etc.) -- that target is
     stored per-front in the data.
  4. For semicircles, set the SVG arc sweep flag from the cross
     product of segment-tangent and chosen-perpendicular.
  
  This handles curved fronts correctly (pips stay on the same global
  side even when the polyline bends). Side-as-cardinal is the right
  abstraction; a `+1/-1` "left/right of motion" parameter is easy to
  flip wrong.
- **Stationary fronts**: rendered as two dashed segments offset by
  one pip-width (one blue, one red), with triangles on one side and
  semicircles on the opposite. Looks clean, costs almost nothing.
- **Title in a reserved band** at the top of the SVG with the
  projection fitted into the area below avoids label/feature
  collisions and makes the chart frame readable.

## What was hard / what surprised me

- **The us-atlas `nation` outline includes AK/HI.** Took me a minute
  to figure out why the projection looked broken. Easy fix once I saw
  it: build the outer coastline from the filtered CONUS states' outer
  mesh instead of using the prebaked nation feature.
- **Pip orientation reasoning is fragile.** "Cold front pips face the
  direction of motion" is true but ambiguous in code: which screen
  direction is "motion direction" if the polyline bends 90 degrees in
  the middle? The cardinal-target approach (encode per front "pips
  face NORTH") is correct because the conventional reading of a
  surface chart is in geographic coords, not in polyline-local coords.
- **Isobar label placement** wants real layout logic. The naive
  "midpoint of the outer ring" puts most labels at the grid edge
  (outside the chart) for closed contours around H/L. The fix that
  worked: walk the ring with k candidates evenly spaced, accept the
  first one that's inside the chart drawing area AND >= 80px from
  any already-placed label, allow up to 2 labels per contour. A
  production version would orient labels along the contour tangent
  (rotated text), with masked underlines so the contour line doesn't
  visually pass through the digits.
- **Synthesized pressure field via Gaussian bumps** gives plausible
  isobars near each H/L but produces visible artifacts in the gaps
  between systems (the contours bend smoothly through low-pressure
  troughs that real WPC analysts would draw as a sharp trough line).
  Acceptable for a spike, not for production.
- **Station model wind barbs** have direction-from-vs-direction-toward
  conventions to keep straight. FAA: shaft points in the direction
  the wind is FROM (i.e. originates at the station, points "upwind").
  Barbs on the LEFT side of the shaft direction. Half barbs = 5 kt,
  full = 10 kt, pennant = 50 kt. The tricky part is the barbs sit on
  the side that's perpendicular-rotated based on hemisphere
  convention -- in practice everyone uses Northern Hemisphere
  convention (left of shaft pointing upwind), so it's fine.

## What was cut

- **Coastlines other than CONUS / Canada / Mexico borders.** No Great
  Lakes shoreline detail beyond the state borders that incidentally
  trace them. No interior rivers, no tonal land/water shading.
- **Real gridded SLP product.** Used Gaussian-bump synthesis instead.
- **Programmatic ingest of front geometries.** Hand-traced from the
  WPC PNG, encoded as JSON.
- **Production-grade isobar label rotation.** Labels are horizontal
  with a small white background rect to mask the contour line behind
  them. Real charts rotate labels along the contour tangent.
- **Higher-density station model overlay.** Used 12 representative
  hubs; a full surface chart has ~150-300 stations.
- **Special geographic features.** No reservoir/lake fills, no
  airspace overlay, no terrain shading.
- **Animation, interactivity, tooltips.** Static SVG only.

## Recommendation for the symbology library WP

Strong recommendation to **author the WP** for a shared aviation-chart
symbology library. The components below cleanly split into "reusable
across chart types" vs "chart-type specific":

### Reusable across chart types (basemap + projection + chrome)

- **Lambert Conformal projection helper** (parameterized parallels +
  rotate + center, with a fitExtent for any GeoJSON target). Reusable
  for: surface analysis, prog charts, METAR/TAF map, SIGMET map,
  PIREP map, terminal area chart bases, cross-country planning maps.
- **us-atlas-derived basemap loader** (CONUS state polygons, interior
  state borders, outer coastline). Reusable for: any map-based chart.
- **Graticule renderer** (lat/lon dashed lines). Reusable.
- **Title band + chart-frame chrome** (top band reservation, fitted
  projection inside, separator rule). Reusable for any chart type.
- **Pip-along-polyline primitive** (walk a polyline at fixed pixel
  spacing, place glyphs perpendicular, choose side via screen-space
  cardinal target). Reusable for: any chart type that decorates a
  polyline (frontal symbols, jet streams with double arrowheads,
  trough lines with chevrons, dryline scallops, ridge-line markers).

### Chart-type-specific

- **Frontal symbology renderers** (cold/warm/occluded/stationary).
  These are surface-analysis specific. The pip primitive is reusable
  but the four shape definitions live in this layer.
- **Pressure center markers (H/L)**. Surface-analysis specific.
- **Isobar contouring + labeling**. The contour primitive
  (`d3-contour` over a regular grid) is reusable for any scalar field
  (heights on a 500 mb chart, isotachs on jet-stream chart, isotherms
  on temperature chart). Wrap as `renderScalarContours(field,
  levels, projection, options)`. The styling (4 mb spacing,
  emphasized every 8 mb, label format) is type-specific.
- **Station model**. The station-model layer is reusable across
  charts that show point obs (METAR, surface analysis, PIREP). Wrap
  as `renderStationModel(stationObs, projection, options)` with a
  flag set indicating which fields to render.

### Suggested library shape

```text
libs/wx-charts/
  src/
    projection.ts        // Lambert helper, fitExtent helper
    basemap.ts           // us-atlas loader, CONUS filter, mesh builders
    graticule.ts         // lat/lon graticule renderer
    chrome.ts            // title band, separator, attribution
    polyline-pips.ts     // generic pip-along-polyline primitive
    contours.ts          // d3-contour wrapper for scalar fields
    station-model.ts     // FAA station model renderer
    fronts.ts            // surface-analysis frontal shapes
    pressure-centers.ts  // H/L markers
    types.ts             // ChartConfig, FrontDef, StationOb, etc.
  data/
    us-states-10m.json   // CONUS basemap
  examples/
    surface-analysis/    // example consumer (this spike, cleaned up)
```

Symbol set should also be exposed as **standalone SVG defs** so a
future authoring tool can paste them into custom charts.

### Production scope estimate

Given what I learned, the production version of the surface-analysis
chart, **assuming the symbology library is built first**, is:

- Library extraction + cleanup of spike code: ~1 day
- Real SLP data ingest pipeline (RAP analysis -> regular grid ->
  contour input): ~1-2 days
- Coded Surface Bulletin parser (frontal positions): ~1-2 days, more
  if the format is undocumented (it is, last I checked)
- Integration + first end-to-end live chart: ~0.5-1 day
- Production polish (label rotation, masked contour-line breaks at
  labels, station model density tier control, legend, datetime
  watermark): ~1-2 days

That's ~5-8 days of focused work for a working live surface-analysis
chart, ~2-3 days for each subsequent chart type that reuses the
library (prog chart, jet-stream, isentropic, etc.).

The spike result also makes me think the **right pedagogical use** is
not "render the live WPC chart inside our app" -- the WPC chart
already exists -- but rather **render a teaching-annotated version**:
the same chart with isobar interpretation aids, pressure-gradient
arrows, vorticity advection cues, frontogenesis markers, etc. The
symbology library should support those teaching overlays as
first-class layers, not as afterthoughts.

## Files

- `spike-output.svg` -- final chart
- `spike-output.html` -- standalone HTML wrapper
- `spike-preview.png` -- PNG screenshot for embedding
- `data/sfc-2024-12-23-12z.json` -- hand-traced data
- `data/us-states-10m.json` -- us-atlas CONUS states
- `data/us-nation-10m.json` -- us-atlas nation outline (kept but unused)
- `src/projection.ts` -- Lambert helper
- `src/basemap.ts` -- topojson loader + CONUS filter
- `src/data-load.ts` -- synoptic JSON schema + loader
- `src/isobars.ts` -- pressure-field synthesis + contouring + labels
- `src/symbology.ts` -- pip primitive + frontal renderers + centers
- `src/stations.ts` -- station model renderer
- `src/render.ts` -- composer / SVG writer
- `src/screenshot.ts` -- internal headless-chromium screenshot helper

## Time spent

Approximately 90 minutes from blank to final commit. Tools used:
d3-geo (projection), d3-contour (isobars), topojson-client (basemap
loader), playwright via @playwright/test (screenshot capture).
