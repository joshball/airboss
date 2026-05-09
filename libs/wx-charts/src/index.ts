/**
 * `@ab/wx-charts` -- runtime / browser-safe barrel.
 *
 * Source of truth: [docs/work-packages/wx-chart-symbology-library/spec.md](
 *   ../../../docs/work-packages/wx-chart-symbology-library/spec.md
 * ) "API Surface".
 *
 * # Browser safety
 *
 * Every value re-export below MUST resolve to a module that:
 * 1. Does NOT statically import `node:*` -- use the lazy
 *    `process.getBuiltinModule(...)` pattern from
 *    `libs/constants/src/source-cache.ts` if a Node built-in is needed.
 * 2. Does NOT reference `Buffer` / `process` at module top level.
 * 3. Does NOT pull in `sharp` or any native binding.
 *
 * Server-only value exports (the chart renderers, `warpRaster`, the CLI
 * registry) live in `./server.ts`, exposed at `@ab/wx-charts/server`.
 * `.svelte` files and any client-bundled `.ts` import from this barrel.
 * Server code (`scripts/charts.ts`, `+page.server.ts`) imports from
 * `@ab/wx-charts/server`.
 *
 * Type re-exports of server-only modules are safe here -- TypeScript
 * erases them at compile time, so `import type { ... }` lines never
 * pull the source module's value graph into the consumer's bundle.
 */

// ----------------------------------------------------------------------
// Substrate primitives (browser-safe)
// ----------------------------------------------------------------------
export {
	buildConusProjection,
	CHART_MARGIN,
	CONUS_CENTRAL_MERIDIAN,
	CONUS_REFERENCE_LAT,
	CONUS_STD_PARALLELS,
	type FitTarget,
	lambertProjection,
	type LambertProjectionOptions,
	SVG_HEIGHT,
	SVG_WIDTH,
	TITLE_BAND_HEIGHT,
} from './projection';
export {
	type BasemapData,
	conusBorderMesh,
	conusStateMesh,
	loadConusBasemap,
	loadConusBasemapFromString,
	NON_CONUS_FIPS,
} from './basemap';
export { renderGraticule, type GraticuleOptions } from './graticule';
export { buildChrome, type ChromeInput, type ChromeOutput } from './chrome';
export {
	composeChart,
	emptyLayerBands,
	type LayerBandMap,
	LayerBandError,
} from './layers';
export {
	type CollisionInput,
	type CollisionPoint,
	type CollisionResult,
	resolveCollisions,
} from './point/collision';
export { renderLeaderLines } from './point/leader-lines';

// ----------------------------------------------------------------------
// Symbology helpers (pure SVG-string emitters)
// ----------------------------------------------------------------------
export {
	renderColdFront,
	renderFront,
	renderOccludedFront,
	renderStationaryFront,
	renderWarmFront,
} from './symbology/fronts';
export type { FrontDef, FrontKind, PipSide } from './symbology/fronts';
export { renderPolylinePips, type PipDef, type PipShape, type ScreenVec } from './symbology/polyline-pips';
export { renderScalarContours, type ScalarContourOptions } from './symbology/contours';
export { renderPressureCenter, type PressureCenter } from './symbology/pressure-centers';
export { renderAirport, type AirportMarker } from './symbology/airports';
export { renderLegend, type LegendDef, type LegendEntry } from './symbology/legend';
export { renderStationModel, type StationModelOptions, type StationOb } from './symbology/station-model';

// ----------------------------------------------------------------------
// Chart-renderer contract types (browser-safe)
// ----------------------------------------------------------------------
export type {
	ChartProjectionSpec,
	ChartRenderInput,
	ChartRenderMeta,
	ChartRenderResult,
	ChartRenderer,
	ChartSpec,
} from './types';

// ----------------------------------------------------------------------
// Type-only re-exports of server-only chart renderers + their spec types.
// Apps and components import the spec types via `import type` without
// dragging the renderer's runtime imports (sharp, fs) into the bundle.
// ----------------------------------------------------------------------
export type { SurfaceAnalysisSpec } from './charts/surface-analysis';

// ----------------------------------------------------------------------
// Re-exports of constants for ergonomic single-import consumers.
// ----------------------------------------------------------------------
export {
	CHART_TYPE_LABELS,
	CHART_TYPE_VALUES,
	CHART_TYPES,
	type ChartType,
	FAA_FLIGHT_CATEGORIES,
	FAA_FLIGHT_CATEGORY_VALUES,
	type FaaFlightCategory,
	LAYER_BAND_VALUES,
	LAYER_BANDS,
	type LayerBand,
	WX_CHART_SLUG_REGEX,
	WX_CHART_SVG_HARD_LIMIT_BYTES,
	WX_CHART_SVG_WARN_BYTES,
} from '@ab/constants';
