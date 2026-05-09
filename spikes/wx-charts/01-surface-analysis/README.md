# Spike 01: Surface Analysis Chart

Throwaway prototype. NOT production code.

## Goal

Render a recognizable FAA-style surface analysis chart for CONUS at
2024-12-23 12Z, using SVG + d3-geo, from real archived data.

Success: open `spike-output.html` in a browser; a returning CFI sees
"yes that's a surface analysis chart, I can teach from it."

## Files

- `spike-output.svg` -- final chart
- `spike-output.html` -- HTML wrapper, double-click to view
- `spike-notes.md` -- learnings, what was hard, recommendation
- `data/` -- archived data sample
- `src/` -- generation code

## Run

```bash
bun spikes/wx-charts/01-surface-analysis/src/render.ts
open spikes/wx-charts/01-surface-analysis/spike-output.html
```
