# Spike 03: METAR Plot Grid -- Notes

Throwaway prototype. Goal: render a recognizable FAA-style station-model
plot for ~50 CONUS ASOS stations at 2024-01-13 12Z, using SVG + d3-geo,
from real archived METAR data, in a way a returning CFI can teach a PPL
student from.

The output is `spike-output.svg`; open `spike-output.html` to view.

## What the spike was testing (vs Spikes 1+2)

The brief called out three distinct things vs the prior spikes:

1. **Dense, structured small glyphs.** Spike 1 had ~12 station-model
   glyphs as an overlay on a synoptic chart. Spike 3 makes those glyphs
   the primary content, ~50 of them, each composed of ~8 sub-elements
   (cloud-cover circle + temp + dewpoint + altimeter + visibility +
   weather + station ID + wind shaft + barbs + optional category ring).
   Question: does SVG read well at this density and is the station-model
   component genuinely reusable from Spike 1's approach?
2. **Real METAR text parsing.** Spikes 1+2 ingested pre-formatted data
   (hand-traced JSON, palettized PNG). Spike 3 ingests raw METAR strings
   from the IEM ASOS archive and parses them. Question: do existing JS
   METAR parsers cover what the station model needs, or roll our own?
3. **Glyph collision avoidance at lat/lon density.** ~50 stations across
   CONUS, with the Northeast cluster intentionally tight to test
   displacement.

Short answers, expanded below:

1. SVG composes a station model cleanly. The glyph is genuinely reusable;
   Spike 1's overlay version and Spike 3's primary-content version
   share the same conceptual layout but Spike 3 surfaced enough new
   detail (collision avoidance, category ring, single-source-of-truth
   layout constants) that the production primitive should be designed
   from Spike 3, not Spike 1.
2. We rolled our own ~250-line parser. `metar-taf-parser` from npm would
   work for a production lib but the spike's field set is small enough
   that the cost of a new dep wasn't justified. Coverage gaps documented
   below feed into the library WP.
3. Pairwise repulsion (40 iterations, min-distance 36 px) cleanly
   resolved the Northeast cluster without dropping any stations.
   18/49 stations were displaced from true position; max displacement
   visible in the Mid-Atlantic. Leader lines from displaced glyphs back
   to true position are drawn but mostly invisible at this scale because
   most displacements are <5 px.

## Data path chosen

**Iowa Environmental Mesonet ASOS Archive**, bulk request endpoint:

- URL pattern: `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?...`
- Multiple `station=` params per request -> one bulk CSV response
- `data=metar` returns the raw METAR string per observation
- `report_type=3&report_type=4` filters to scheduled METAR + SPECI only
  (excludes the 5-minute MADIS reports that don't have real wind sensor
  data on this date for some stations -- KSEA returns "/////KT" in
  every 5-minute MADIS report on 2024-01-13, but the on-the-:53 METARs
  have a real wind reading)
- Output format: `format=onlycomma` (CSV with comma separators only,
  no extra IEM diagnostic fields)

For each station we request a 2-hour window (11Z-13Z) and pick the
observation whose timestamp is closest to 12:00:00Z. ASOS routine
observations land at ~:53 of every hour; the 12:53Z observation from
2024-01-13 is the canonical "12Z observation" in operational use.

The pick logic is per-station -- some report at :51, some at :53, some
at :54, and the dataset includes a few SPECI reports at off-cycle times
(KMKE has a SPECI at 11:50Z that beats the 11:53Z routine). Tracking
which observation we picked + its delta from 12:00Z is captured in the
JSON output for traceability.

49/49 stations returned data. Initial run failed (21/49) because of
two foot-guns:

1. `URLSearchParams.set('report_type', '3'); .set('report_type', '4')`
   silently overwrites -- only the second value persists. **Use
   `.append()` for repeating params.** With only `report_type=4`
   selected, several stations returned no data because they had no
   SPECI in the window. Switching to `.append('report_type', '3');
   .append('report_type', '4')` got both.
2. Per-station fetches got HTTP 429 rate-limited around station 5-10.
   Bulk fetch with all stations in one request is the right shape -- 5
   chunked requests of 12 stations each cleared the rate limit and
   returned all observations.

## Architecture

Six modules, ~700 lines of TS total:

```text
projection.ts       -- 41 lines  Lambert helper (third reuse, unchanged)
basemap.ts          -- 51 lines  topojson loader (third reuse, unchanged)
metar.ts            -- 270 lines Minimal METAR parser (station-model fields)
stations-conus.ts   -- 90 lines  49 ICAO/lat/lon table
ingest.ts           -- 175 lines IEM bulk fetch, batched, picks closest-to-12Z
station-model.ts    -- 320 lines Glyph composer (FMH-1 layout, NH wind-barb)
collision.ts        -- 95 lines  Pairwise repulsion + leader-line metadata
render.ts           -- 250 lines SVG composer + footer legends
```

The render pipeline:

1. **Load basemap** (us-atlas CONUS states + interior + outer borders)
2. **Build projection** (Lambert 33/45 fitted to CONUS-only states)
3. **Load + parse observations** (49 records from JSON; parser already
   ran at ingest time -- both raw METAR string and parsed shape stored)
4. **Project lat/lon to chart coords** for each station
5. **Resolve collisions** -- pairwise repulsion, 40 iterations max,
   min-distance 36 px between glyph centers
6. **Render leader lines** for displaced glyphs (true position -> draw
   position, dashed)
7. **Render station-model glyphs** (one `<g>` per station, ~10 child
   elements)
8. **Render chrome** (title band, footer legend strip with both
   STATION MODEL and FLIGHT CATEGORY legends side-by-side)

Spike 2's layer-band contract:

```text
layer band                     | spike 3 use
-------------------------------|--------------------------------------
background-fill                | <rect>
graticule                      | dashed lat/lon lines
basemap-fill                   | state polygons
basemap-borders                | interior + outer state borders
raster-overlay                 | (empty -- no raster in this spike)
basemap-re-stroke              | (empty -- no raster to re-stroke over)
vector-symbology               | (empty -- no fronts/isobars in this chart)
point-symbology                | leader lines + 49 station-model glyphs
chrome                         | title band + footer legend strip
```

Composing Spike 3 with Spike 2's radar would just stack the radar at
the `raster-overlay` band (no other change needed).

## What worked

- **Station model as a `<g>` template per station.** The glyph composer
  takes one parsed METAR + a center coordinate and emits a self-
  contained `<g>` with all sub-elements. No interaction between glyphs
  at the SVG level; collision avoidance happens upstream in JS by
  modifying the center coords. This separation is clean and matches
  Spike 1's "render one symbol at a time" pattern, just with a more
  involved symbol.
- **Cloud-cover quarter wedges via `<path>`.** FEW = top-right quadrant,
  SCT = right half, BKN = 3/4 (270deg sweep), OVC = solid fill, VV = X
  through the circle. One `pieWedge(r, startDeg, endDeg)` helper
  handles all four cover percentages. Reads correctly at 12-px glyph
  size.
- **Wind barb encoding.** Speed rounded to nearest 5 KT, then decomposed
  into pennants (50) + full barbs (10) + half barbs (5). Each barb
  drawn as a single `<line>` perpendicular to the shaft on the LEFT
  side (Northern Hemisphere convention). Pennants drawn as filled
  `<path>` triangles. Looks correct end-to-end across the 49-station
  test set including the 38-KT gust at KDTW (3 full barbs + 1 half on
  the SW shaft) and the 28-KT gust at KFAR (2 full barbs + 1 half on
  the NW shaft).
- **Wind direction-from convention encoded explicitly in the math.**
  The trickiest part of station-model rendering. The shaft starts at
  the cloud circle edge and points OUTWARD in the direction the wind
  is FROM. For wind from 270 (west), shaft extends to the WEST. The
  unit-vector math is `ux = sin(dirRad), uy = -cos(dirRad)` where
  dirRad is the meteorological FROM direction in radians.
  - First pass had the perpendicular for barb-side computed wrong
    (`px = -uy, py = ux` instead of the correct CW-in-screen-coords
    `px = uy, py = -ux`). The 65-KT-east test case (shaft pointing
    right, barbs should go UP for NH convention) caught it instantly.
    See the in-code sanity-check comments in `station-model.ts` --
    each cardinal direction has an annotated expected result.
- **Pairwise repulsion at 36 px min-distance** cleanly resolves the
  Northeast cluster in <40 iterations. No stations had to be dropped
  or thinned. The displacement is small enough (most <5 px, max ~12 px
  in the JFK/LGA pair) that the leader lines aren't strictly needed
  for legibility, but they're cheap and match the convention used by
  WPC + NWS surface plots.
- **Footer legend strip below the chart.** First pass had legends in
  the bottom-left and bottom-right corners; both collided with stations
  (Florida MIA/MCO/TPA covered by the FLIGHT CATEGORY legend, MSY
  shaved by the STATION MODEL legend). Solution: extend the SVG height
  by 110 px below the projected chart area and put both legends in a
  dedicated footer band. The chart-only crop (1200x780) matches Spikes
  1+2 dims; the full chart with footer is 1200x890. Composing with
  Spike 2's radar would drop the footer (legends move into the radar
  chart's existing chrome).
- **Flight-category teaching ring.** Each station's cloud-cover circle
  gets an outer ring colored by FAA flight category: VFR = none,
  MVFR = blue, IFR = red, LIFR = purple. This is NOT in the FAA standard
  station model but is the spike's minimum-viable pedagogical
  annotation -- it makes the chart instantly readable as "where is it
  IFR?" without parsing every glyph in detail. The 2024-01-13 12Z
  data set has 25 VFR / 12 MVFR / 10 IFR / 2 LIFR, with the storm
  system clearly visible as a band of red rings across the Midwest +
  Great Lakes + Mid-Atlantic.
- **Per-glyph data-* attributes** (`data-station="KORD" data-cat="IFR"`).
  Free at SVG generation time; would let a future pass attach hover
  tooltips, click-to-fly-to handlers, or audit-style "show me all the
  IFR stations" queries with a single CSS selector. Not used in this
  spike but worth keeping in the library design.

## What was hard / what surprised me

- **`URLSearchParams.set` overwrites repeated params silently.** Spent
  20 minutes debugging why exactly 21/49 stations were missing on the
  first ingest pass. The fix was one character (`set` -> `append`).
  Worth a comment in the library WP: any client that sets
  `report_type` multiple times needs to use `.append`, otherwise only
  the last value sticks.
- **IEM rate limit is per-IP-per-endpoint, not per-account.** Per-station
  fetches got 429ed around station 6. The bulk-fetch endpoint accepts
  up to ~12 stations per request comfortably; with 5 chunked batches
  of 12 we never tripped the limit. Production: use the bulk endpoint,
  cache responses per timestamp, retry with exponential backoff on 429.
- **`/////KT` = sensor outage on the 5-minute MADIS reports.** KSEA on
  2024-01-13 had no real wind data on its 5-min reports. The :53 routine
  METARs had real readings. Filtering to `report_type=3,4` (METAR +
  SPECI) excludes the MADIS rows. If you DON'T filter and the MADIS
  rows come back first, the parser barfs on `/////KT` (or worse,
  silently parses it as variable-with-zero-speed). The spike parser
  rejects unparseable wind tokens silently and sets `wind: null`,
  which would render as no shaft + no calm ring -- ambiguous.
  Production needs to surface "wind unknown" distinctly from "wind
  calm."
- **Wind barb perpendicular sign in screen coords.** Screen y is flipped
  from math y, so a CCW rotation visually requires a CW rotation
  mathematically. Easy to get wrong. The spike parser has explicit
  cardinal-direction sanity checks in comments next to the
  perpendicular calculation -- worth keeping that pattern in the
  production lib.
- **Cloud-cover wedge starting angle.** SVG arc paths use 0deg = +x
  (3 o'clock), so "top" is 270deg, not 0. The `polar(r, deg)` helper
  accepts that convention but takes one mental switch to write
  correctly. FEW = `pieWedge(R, 270, 360)` -- "from top to right."
- **Visibility format edge cases.** `M1/4SM` (less than 1/4) is parsed
  as 0.125 (half of 1/4) so the flight-category math treats it as
  LIFR. `1 1/2SM` requires looking at two adjacent tokens (the `1` and
  the `1/2SM`). `1/8SM FG` is valid and parses correctly. The spike
  parser handles all three forms; the test set exercises 1/8 (KJFK)
  and 1 1/2 (KMSP) and confirms.
- **Two `KMIA` rows in the data.** Ingested KMIA returns its 11:53Z
  routine METAR; my preview-station test happens to also include KMIA
  with a different (synthetic) METAR. Easy to confuse if not
  separated. The library should namespace previews vs production data
  by directory.
- **Display-width mismatch between glyph elements.** At small sizes,
  the altimeter "027" and the wind shaft barbs can compete for the
  same pixels when wind is from the NE/E (shaft points up-right
  through the altimeter position). The spike accepts this -- it's
  legible enough for teaching at the chart's print size -- but a
  production lib should either offset the altimeter further from the
  cloud circle or detect the conflict and render the altimeter on a
  small white background.
- **The X-glyph for VV (vertical visibility / obscured)** is a
  diagonal cross inside the circle. KJFK with VV002 renders as the
  X plus the LIFR purple ring. Visually strong enough that the reader
  immediately reads "JFK is socked in." This is one of the strongest
  pedagogical signals in the chart.
- **No "calm" sub-3-KT wind glyph in the spike.** FAA convention is to
  draw nothing for sub-3-KT wind speeds (the ring around the cloud
  circle indicates calm = 0). The spike treats 3-KT as the threshold
  for shaft rendering and uses the calm ring for any 0-KT report.
  1-2 KT reports render as no shaft + no calm ring -- ambiguous, same
  as wind:null. Worth a tighter spec in the library.

## What was cut

- **Cloud layers stacked separately.** FAA convention shows each
  reported layer as a separate symbol stacked vertically inside the
  circle. The spike summarizes multiple layers into a single highest-
  cover wedge. For the spike scale (12-px glyph, 50 stations) this
  reads better; the production lib should support both modes with a
  prop.
- **Pressure tendency / 3-hour trend.** Bottom-right of the FAA model.
  This data lives in the RMK section of the METAR (not parsed) and
  also in synoptic SHEF/BUFR feeds. Omitted entirely.
- **Sea-level pressure (SLP).** Available in the RMK section as
  "SLP191" etc. Omitted -- the altimeter setting in the body is the
  pilot-relevant value and is rendered.
- **6-hour temperature extremes.** RMK section "10128 20094" (max/min
  6-hr in tenths of degC). Omitted.
- **Precipitation totals (P0000, 60094, 70108).** RMK section. Omitted.
- **Recent weather (RE prefix).** Parser ignores; not rendered.
- **Wind shear / runway visual range.** Parser ignores RVR (`R04/P6000FT`).
  Wind shear group `WS RWY...` not parsed.
- **TAF / forecast comparison.** A teaching overlay would show "what
  was the TAF for this hour, what actually happened?" Not in the
  spike; called out in the pedagogical overlay surface section below.
- **Station thinning / density tiers.** No code for "drop secondary
  stations at low zoom." Could be added by sorting on importance
  (hub > regional > local) and dropping any whose post-collision
  position is still within X px of a higher-priority neighbor.
- **Halos / underlines on text.** The 3-letter station ID below each
  glyph would be more readable with a white-stroke halo (like Spike
  2's airport labels). Spike 3 omits this; readable enough at 1200 px.
- **Smart leader lines.** Currently a straight dashed line from true
  to drawn position. A production version would elbow around adjacent
  glyphs.
- **Special weather glyphs (lightning, snowflake, fog bars, etc.).**
  Per the spike scope cuts, present weather renders as the literal
  3-letter group ("RA", "+SN", "BR", "FG"). This is FAA-compatible
  reading -- pilots read METAR text natively -- but a polished chart
  would use the FMH-1 glyph font.
- **Color palette on temperature/dewpoint reads.** Used red for temp,
  green for dewpoint, magenta for weather. Standard FAA practice
  varies; some publications use black for everything and rely on
  position. The colored variant reads faster for the spike test.
- **Higher-density station set.** 50 stations is sparse enough that
  collisions are tractable. A real CONUS surface plot has 200-400
  stations; that's a different collision-avoidance problem (force-
  directed layout, density-tiered drops, multi-zoom-level rendering).

## Comparison to Spikes 1 and 2

What's the same:

- **Projection helper, basemap loader, chrome pattern, title band.**
  Third reuse, unchanged. These are now confirmed as stable primitives
  ready for the symbology library extraction.
- **Headless chromium for screenshots.** Same pattern.
- **Single self-contained SVG output.** Same shipping format.
- **Layer-band contract** (Spike 2). Spike 3 uses the
  `point-symbology` band for stations + leader lines; the contract
  composes cleanly with Spike 2's radar-bearing chart by stacking at
  the `raster-overlay` band.

What's different:

- **Spike 1 had ~12 station-model glyphs as a sparse overlay.** Spike 3
  has 49 as the primary content. Density forced collision avoidance
  and a teaching-ring annotation that Spike 1 didn't need.
- **Spike 2 introduced raster handling.** Spike 3 has zero raster --
  pure vector SVG, even denser than Spike 1 because of the per-glyph
  sub-element count. The two together prove the layer-band contract:
  Spike 2 is "raster-heavy with thin point overlays," Spike 3 is
  "point-heavy with no raster," and the same projection + basemap +
  chrome stack supports both.
- **Spike 1 stored synoptic JSON.** Spike 2 stored raster + sidecar
  metadata. **Spike 3 stores parsed METAR observations as JSON.** The
  ingest -> parse step is new for Spike 3 (Spikes 1+2 had no real
  text-parsing step).
- **Spike 3 needs a layout/collision pass.** Spikes 1+2 placed elements
  at projected geographic positions with no per-element layout logic.
  The collision-avoidance step is the new architecture piece this
  spike revealed.
- **Spike 3 added a footer legend strip.** Spikes 1+2 fit their legends
  inside the chart area without overlap because their content (fronts +
  isobars, radar mosaic) was sparse near the corners. Dense point
  symbology over CONUS leaves no clear corner; the footer is the right
  fix.
- **Spike 3 added a teaching annotation (flight-category ring).**
  Spikes 1+2 rendered the operational chart as-is. Spike 3 demonstrates
  the pedagogical-overlay pattern from Spikes 1+2 in concrete form:
  it's a thin ring around the standard symbol, not a layer change. The
  library should support this kind of annotation as first-class.

What this implies for the symbology library WP:

- **METAR parser is a first-class library primitive.** Either roll our
  own (Spike 3's path -- ~250 lines) or adopt `metar-taf-parser` from
  npm. Either way, the output type (a `ParsedMetar` shape) is what the
  station-model renderer consumes, and that interface should be the
  library's contract.
- **Station-model renderer is a first-class primitive.** Inputs:
  parsed METAR + center coord + render options. Output: SVG `<g>`
  fragment. The "options" set (which fields to render, color palette,
  glyph radius, what to do with multiple cloud layers) needs a tight
  spec.
- **Collision-avoidance / displacement is a separate primitive.** Not
  station-specific -- any chart with point glyphs at projected lat/lon
  may need it (PIREPs, SIGMETs, lightning strikes). Should accept
  generic `{key, x, y}[]` and return `{key, drawX, drawY, displaced}[]`
  plus optional leader-line metadata.
- **Footer-legend chrome is a chrome-module variant.** The Spike 1+2
  pattern was "title band on top + chart fills below." Spike 3 adds
  "title band on top + chart in middle + legend band on bottom."
  Library should expose both as chrome-module configurations.

## Recommendation for the symbology library WP

Carrying forward Spikes 1+2's recommendation -- the library is worth
authoring -- and refining the proposed shape with what Spike 3 added:

### New primitives Spike 3 revealed

- **METAR parser**. Output type is the load-bearing contract. The
  station-model renderer + the flight-category function + future
  CFI-teaching tools all consume the same `ParsedMetar` shape. Parser
  implementation can be ours or `metar-taf-parser`'s; the contract is
  the same. Field set:

  ```text
  station, day/hour/min, wind {dir, speed, gust, variable, calm},
  visibilitySM, weather[], clouds[{cover, heightFtAgl}], tempC,
  dewpointC, altimeterInHg, cavok, raw
  ```

  Coverage gaps in the spike parser, all candidates for the production
  parser if we roll our own:
  - RMK section (sea-level pressure, 6-hr temp extremes, precip totals)
  - Runway visual range (RVR) groups (`R04/P6000FT`)
  - Wind shear (`WS RWY...`)
  - Recent weather (`RE` prefix)
  - Trend forecast (`BECMG`, `TEMPO`)
  - Variable wind directions (`310V040`)
  - Vertical visibility heights (parsed but not exposed in the spike's
    rendered glyph beyond the X-marker)

- **Station-model renderer**. Inputs:

  ```text
  renderStationModel({
    parsed: ParsedMetar,
    cx: number, cy: number,
    options?: {
      glyphRadius?: number,           // default 6
      shaftLength?: number,           // default 22
      tempUnit?: 'F' | 'C',           // default 'F'
      colors?: ColorPalette,          // default FAA-ish
      categoryRing?: 'show' | 'hide', // default 'hide' (off-FAA)
      multiLayer?: 'stack' | 'summary', // default 'summary'
    }
  }) -> string  // SVG <g> fragment
  ```

  Defaults match the spike behavior.

- **Glyph collision-avoidance helper**. Inputs:

  ```text
  resolveCollisions(
    inputs: { stationKey: string, x: number, y: number }[],
    config?: {
      minDistance?: number,    // default 36 px
      maxIterations?: number,  // default 40
    }
  ) -> { stationKey, trueX, trueY, drawX, drawY, displaced }[]
  ```

  Generic over point type (not METAR-specific). Used by station models,
  PIREP markers, SIGMET centroids, anything point-symbology in dense
  layouts.

- **Leader-line renderer**. Given `displaced` results from above,
  emit dashed lines + true-position dots. Couples to the collision
  helper but is a separate render concern.

- **Footer legend strip chrome variant**. Spike 1+2's chrome pattern
  was top-band-only. Spike 3 added a bottom-band variant. Library
  should expose both as chrome-module configurations:

  ```text
  buildChrome({
    title: { text, subtitle? },
    footer?: { legends: LegendDef[] }, // 0..2 legends side-by-side
  }) -> { topBandSvg, footerBandSvg, projectionFitArea }
  ```

  The `projectionFitArea` is the rectangle the chart-body projection
  should fit into; with a footer it shrinks vertically.

- **Flight-category derivation**. Pure function from
  `(ceilingFtAgl, visibilitySM) -> 'VFR' | 'MVFR' | 'IFR' | 'LIFR'`.
  Belongs in a `wx-rules` module separate from the chart renderer.
  Used by the station-model's optional teaching ring + by any other
  product that needs to color-code surface conditions.

- **`ceilingFtAgl(clouds: CloudLayer[])` helper**. Lowest BKN/OVC/VV
  layer. Belongs alongside flight-category in `wx-rules`.

### Reusable primitives confirmed by Spike 3

Spikes 1+2's list still stands. Spike 3 confirmed (third reuse):

- Lambert Conformal projection helper -- used unchanged
- us-atlas basemap loader with CONUS filter -- used unchanged
- Graticule renderer -- used unchanged
- Title band chrome -- used unchanged

### Suggested library shape (refined from Spike 2)

```text
libs/wx-charts/
  src/
    projection.ts             // Lambert helper, fitExtent helper
    basemap.ts                // us-atlas loader, CONUS filter, mesh builders
    graticule.ts              // lat/lon graticule
    chrome.ts                 // title band + optional footer band
    layers.ts                 // z-band contract, layer ordering
    raster/
      warp.ts                 // raster compositor (sharp or chromium)
      palettes.ts             // NWS reflectivity, IR satellite, etc.
      worldfile.ts            // ESRI world file parser
    point/
      collision.ts            // pairwise repulsion + leader metadata
      leader-lines.ts         // dashed-line renderer for displaced points
    wx/
      metar/
        parser.ts             // METAR string -> ParsedMetar
        types.ts              // ParsedMetar, WindGroup, CloudLayer, etc.
      taf/
        parser.ts             // future
      rules.ts                // flight-category, ceiling-from-clouds, etc.
    symbology/
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
    surface-analysis/         // Spike 1, cleaned up
    radar-mosaic/             // Spike 2, cleaned up
    metar-plot-grid/          // Spike 3, cleaned up
```

`src/wx/` and `src/point/` are new sub-modules that Spike 3 surfaced.

### Pedagogical overlay surface

The pedagogical reframing from Spikes 1+2 carries forward. A station-
model plot has its own set of teaching overlays distinct from
surface-analysis or radar overlays:

| Overlay                             | Lives in        | Notes                                                       |
| ----------------------------------- | --------------- | ----------------------------------------------------------- |
| Flight-category ring                | symbology       | already in this spike (off-FAA but pedagogically essential) |
| TAF delta panel                     | per-station     | "TAF said 5SM RA, METAR shows 1/8SM FG -- forecast bust"    |
| Trend arrows since last hour        | symbology       | green/red arrows showing improving/deteriorating cells      |
| Ceiling/vis call-out                | text overlay    | "MVFR triggered at 11:53Z" timestamps                       |
| Pressure-tendency interpretation    | per-station     | "1.5 mb fall in 3 hours -- approaching low"                 |
| LIFR-only filter                    | client JS       | toggle to show only LIFR/IFR stations                       |
| Hovering glyph -> raw METAR         | client JS       | tooltip with the original METAR string                      |
| TAF/AIRMET/SIGMET layer composite   | imported        | overlay area-based products on top of the point layer       |
| Surface-analysis composite          | imported        | the Spike 1 chart stacks above as a vector-symbology layer  |
| Radar composite                     | imported        | the Spike 2 chart stacks below as a raster-overlay layer    |
| Cross-section through wind field    | client JS       | click two stations -> draw the shaft+barbs along the line   |

The composition rule: stations are ONE LAYER in the SVG. Anything that
wants to annotate them inserts at the chrome / point-symbology bands.
No layer needs to know about the others.

### Production scope estimate

Given the spike result, the production version of the METAR plot grid,
**assuming the symbology library is built first**, scopes to:

- METAR parser hardening (full RMK coverage, edge cases, fuzz testing
  against IEM archive sample): 1-2 days
- Real-time IEM ingest pipeline (current observation, fallback to
  recent archive on miss, file-system cache, station-list
  configuration UI): 1-2 days
- Multi-zoom-level rendering (~50 hubs at low zoom, ~200 stations at
  mid zoom, all 1500+ ASOS at high zoom -- with density-tiered drops):
  2-3 days
- Force-directed layout for high-density mode (current spike's pairwise
  repulsion converges fine for 50 stations but won't for 1500): 1-2 days
- Animation between observation cycles (5-min loop, smooth wind-shaft
  rotation): 1-2 days
- First teaching overlay (TAF delta panel, hover-to-see-forecast):
  2-3 days
- Production polish (FAA glyph font for weather symbols, smart leader
  lines, white-halo text, click-through to flightbag METAR reader,
  attribution): 2-3 days

That's ~10-17 days for a working live METAR plot chart with one
teaching overlay, ~1-2 days for each subsequent overlay.

The cumulative estimate across the three spikes (Spike 1: 5-8d for
surface analysis, Spike 2: 6-10d for radar, Spike 3: 10-17d for METAR
plot) totals ~21-35 days for all three charts, **assuming the library
is built first**. Without the library, all three estimates roughly
double. The library investment itself is ~5-7 days (extracting + cleaning
the spike code into the directory layout above + tests + docs).

## Files

See [README.md](./README.md) for the inventory.

## Time spent

Approximately 95 minutes from blank to PR. Tools used: d3-geo
(projection + invert), topojson-client (basemap loader), playwright
via @playwright/test (screenshot capture), bun (everything else), the
IEM ASOS archive endpoint (METAR data).

The biggest time sink was the IEM ingest debugging
(`URLSearchParams.set` overwrite + rate-limit loop). The biggest time
save was Spike 1+2's projection + basemap modules being unchanged --
genuinely third-time reuse with zero edits, confirming they're library
candidates.

The station-model glyph composer was the single longest module to
write (320 lines including comments + sanity-check annotations) but
came together in roughly one pass after the wind-barb perpendicular
sign was corrected. The single-station preview validator
(`preview-station.ts`) was the right scaffolding -- catching the barb-
side bug at the 8-cell preview stage saved time vs catching it on the
49-station chart.
