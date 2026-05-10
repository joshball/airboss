// @browser-globals: server-only -- never imported by client .svelte
/**
 * `@ab/wx-charts/server` -- server-only chart-renderer barrel.
 *
 * Source of truth: [docs/work-packages/wx-chart-symbology-library/spec.md](
 *   ../../../docs/work-packages/wx-chart-symbology-library/spec.md
 * ) "API Surface" -> "Server-only exports".
 *
 * Every value re-exported here resolves to a module that performs file I/O,
 * loads a Node built-in, or (in Phase B) lazy-loads `sharp`. The runtime
 * barrel `./index.ts` re-exports the *types* of these modules for ergonomic
 * `import type { ... }` consumption from apps; runtime consumers (the CLI
 * dispatcher at `scripts/charts.ts`, server-side tests) import from here.
 *
 * Phase A ships the surface-analysis renderer + the chart-type registry.
 * Phase B adds the radar-mosaic renderer + `warpRaster`. Phase C/D/E add
 * the remaining chart renderers.
 */

export { type AirmetSigmetSpec, airmetSigmetSpecSchema, renderAirmetSigmet } from './charts/airmet-sigmet';
export {
	type MetarPlotGridSpec,
	metarPlotGridSpecSchema,
	renderMetarPlotGrid,
} from './charts/metar-plot-grid';
export {
	type PirepPlotGridSpec,
	pirepPlotGridSpecSchema,
	renderPirepPlotGrid,
} from './charts/pirep-plot-grid';
export { type RadarMosaicSpec, radarMosaicSpecSchema, renderRadarMosaic } from './charts/radar-mosaic';
export { CHART_RENDERERS } from './charts/registry';
export {
	renderSurfaceAnalysis,
	type SurfaceAnalysisSpec,
	surfaceAnalysisSpecSchema,
} from './charts/surface-analysis';
export { renderTafTimeline, type TafTimelineSpec, tafTimelineSpecSchema } from './charts/taf-timeline';
export {
	renderTurbulenceGairmet,
	type TurbulenceGairmetSpec,
	turbulenceGairmetSpecSchema,
} from './charts/turbulence-gairmet';
export { renderTurbulenceGtg, type TurbulenceGtgSpec, turbulenceGtgSpecSchema } from './charts/turbulence-gtg';
export {
	renderWindsAloftFb,
	type WindsAloftFbSpec,
	windsAloftFbSpecSchema,
} from './charts/winds-aloft-fb';
export { warpRaster } from './raster/warp';
