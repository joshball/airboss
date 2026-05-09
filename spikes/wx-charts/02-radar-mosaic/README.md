# Spike 02: Radar Mosaic Chart

Throwaway prototype. NOT production code.

## Goal

Render a recognizable NWS-style composite-reflectivity radar mosaic for
CONUS at 2024-05-21 22Z, using SVG + d3-geo + a re-projected raster
PNG, from real archived data.

Success: open `spike-output.html` in a browser; a returning CFI sees
"yes that's a radar mosaic, the squall line through the central US is
where it should be, I can teach from this."

## Files

- `spike-output.svg` -- final chart (single self-contained file, the
  warped radar PNG is embedded as a base64 data URI inside `<image>`)
- `spike-output.html` -- HTML wrapper, double-click to view
- `spike-preview.png` -- 1200x780 PNG screenshot
- `spike-notes.md` -- learnings, what was hard, recommendation
- `data/n0r_202405212200.png` -- raw IEM source PNG (Plate Carree)
- `data/n0r_202405212200.wld` -- ESRI world file (georeference)
- `data/n0r_202405212200.meta.json` -- our notes on palette + extent
- `data/n0r_202405212200.warped.png` -- re-projected to Lambert for
  the chart canvas; what gets embedded in the SVG
- `data/us-states-10m.json` -- us-atlas basemap (copied from Spike 1)
- `src/projection.ts` -- Lambert helper (adapted from Spike 1)
- `src/basemap.ts` -- topojson loader (adapted from Spike 1)
- `src/warp-radar.ts` -- inverse-projection warp via headless chromium
- `src/render.ts` -- final SVG composer
- `src/screenshot.ts` -- preview PNG capture

## Run

```bash
bun spikes/wx-charts/02-radar-mosaic/src/warp-radar.ts   # produces data/*.warped.png
bun spikes/wx-charts/02-radar-mosaic/src/render.ts       # produces spike-output.svg + .html
bun spikes/wx-charts/02-radar-mosaic/src/screenshot.ts   # produces spike-preview.png
open spikes/wx-charts/02-radar-mosaic/spike-output.html
```

The warp step is the slow one (~5-15 s for the chromium pixel loop).
Cache the warped PNG in `data/`; render and screenshot are sub-second.
