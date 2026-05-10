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

export { CHART_RENDERERS } from './charts/registry';
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
export {
	renderSurfaceAnalysis,
	type SurfaceAnalysisSpec,
	surfaceAnalysisSpecSchema,
} from './charts/surface-analysis';
