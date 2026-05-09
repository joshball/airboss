# Spike 03 -- METAR Plot Grid

Throwaway prototype rendering ~50 ASOS station observations as an FAA
station-model plot for CONUS at 2024-01-13 12Z. Built on the projection
+ basemap pattern from Spikes 1+2.

## Run it

```bash
# (Re-)ingest 49 METARs from IEM ASOS archive (one bulk fetch in batches)
bun spikes/wx-charts/03-metar-plot-grid/src/ingest.ts

# Render the chart (writes spike-output.svg + spike-output.html)
bun spikes/wx-charts/03-metar-plot-grid/src/render.ts

# Capture preview PNGs (full + 1200x780 crop matching Spikes 1+2)
bun spikes/wx-charts/03-metar-plot-grid/src/screenshot.ts

# Capture zoom regions for inspection
bun spikes/wx-charts/03-metar-plot-grid/src/screenshot-region.ts

# Render the single-station preview (sanity check on glyph composition)
bun spikes/wx-charts/03-metar-plot-grid/src/preview-station.ts
bun spikes/wx-charts/03-metar-plot-grid/src/screenshot.ts preview-station
```

## What's in here

| Path                                        | Role                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `spike-output.svg`                          | Final chart, single self-contained SVG                                           |
| `spike-output.html`                         | Standalone HTML wrapper                                                          |
| `spike-preview.png`                         | Full screenshot (1200x890 -- chart + footer with legends)                        |
| `spike-preview-1200x780.png`                | Chart-only crop matching Spikes 1+2 dimensions                                   |
| `spike-zoom-northeast.png`                  | Northeast cluster (BOS/JFK/LGA/EWR/PHL/IAD/DCA) zoom for dense-glyph inspection  |
| `spike-zoom-florida.png`                    | Florida cluster zoom                                                             |
| `spike-zoom-full.png`                       | Higher-density full-chart screenshot                                             |
| `preview-station.svg`                       | Single-station glyph validator -- 8 cells exercising geometry                    |
| `preview-station-preview.png`               | PNG of the glyph validator                                                       |
| `data/metars-2024-01-13-12z.json`           | Ingested + parsed observations for 49 stations                                   |
| `data/us-states-10m.json`                   | us-atlas CONUS basemap (copied from Spike 2)                                     |
| `src/projection.ts`                         | Lambert helper (third reuse from Spike 1+2)                                      |
| `src/basemap.ts`                            | Topojson loader + CONUS filter (third reuse)                                     |
| `src/metar.ts`                              | Minimal METAR parser (~250 lines) -- station-model fields only                   |
| `src/stations-conus.ts`                     | 49 ASOS station ICAO/lat/lon table                                               |
| `src/ingest.ts`                             | IEM ASOS bulk fetch in batches, picks observation closest to 12:00Z              |
| `src/station-model.ts`                      | Station-model glyph composer (FMH-1 layout, NH wind-barb convention)             |
| `src/collision.ts`                          | Pairwise repulsion glyph displacement + leader lines                             |
| `src/render.ts`                             | SVG composer (basemap + collision pass + glyphs + legends in footer)             |
| `src/screenshot.ts`                         | Headless chromium PNG capture                                                    |
| `src/screenshot-region.ts`                  | Zoom-region screenshots for dense-glyph inspection                               |
| `src/preview-station.ts`                    | Single-station glyph validator (8 sample METARs)                                 |
| `spike-notes.md`                            | What worked, what was hard, recommendation for the symbology library WP          |

See [spike-notes.md](./spike-notes.md) for retrospective + library-WP
recommendation.
