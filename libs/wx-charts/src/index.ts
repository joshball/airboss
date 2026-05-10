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
export {
	type BasemapData,
	conusBorderMesh,
	conusStateMesh,
	loadConusBasemap,
	loadConusBasemapFromString,
	NON_CONUS_FIPS,
} from './basemap';
// ----------------------------------------------------------------------
// Type-only re-exports of server-only chart renderers + their spec types.
// Apps and components import the spec types via `import type` without
// dragging the renderer's runtime imports (sharp, fs) into the bundle.
// ----------------------------------------------------------------------
export type { AirmetSigmetSpec } from './charts/airmet-sigmet';
export type { ConvectiveOutlookSpec } from './charts/convective-outlook';
export type { CvaSpec } from './charts/cva';
export type { FreezingLevelSpec } from './charts/freezing-level';
export type { GfaSpec } from './charts/gfa';
export type { IcingCipSpec } from './charts/icing-cip';
export type { IcingFipSpec } from './charts/icing-fip';
export type { IcingGairmetSpec } from './charts/icing-gairmet';
export type { MetarPlotGridSpec } from './charts/metar-plot-grid';
export type { PirepPlotGridSpec } from './charts/pirep-plot-grid';
export type { ProgChartSpec } from './charts/prog-chart';
export type { RadarMosaicSpec } from './charts/radar-mosaic';
export type { SatelliteIrSpec } from './charts/satellite-ir';
export type { SatelliteVisSpec } from './charts/satellite-vis';
export type { SatelliteWvSpec } from './charts/satellite-wv';
export type { SurfaceAnalysisSpec } from './charts/surface-analysis';
export type { TafTimelineSpec } from './charts/taf-timeline';
export type { TurbulenceGairmetSpec } from './charts/turbulence-gairmet';
export type { TurbulenceGtgSpec } from './charts/turbulence-gtg';
export type { WindsAloftFbSpec } from './charts/winds-aloft-fb';
export { buildChrome, type ChromeInput, type ChromeOutput } from './chrome';
export { type GraticuleOptions, renderGraticule } from './graticule';
export {
	composeChart,
	emptyLayerBands,
	LayerBandError,
	type LayerBandMap,
} from './layers';
export {
	type CollisionInput,
	type CollisionPoint,
	type CollisionResult,
	resolveCollisions,
} from './point/collision';
export { renderLeaderLines } from './point/leader-lines';
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
	type LambertProjectionOptions,
	lambertProjection,
	SVG_HEIGHT,
	SVG_WIDTH,
	TITLE_BAND_HEIGHT,
} from './projection';
export {
	EARTH_RADIUS_KM,
	GOES_ALTITUDE_KM,
	GOES_DISTANCE_EARTH_RADII,
	GOES_EAST_LONGITUDE,
	GOES_SUBSATELLITE_LATITUDE,
	GOES_WEST_LONGITUDE,
	type GoesProjectionOptions,
	goesEastProjection,
	goesProjection,
	goesWestProjection,
} from './projection-geostationary';
export type { ApplyPaletteInput, ApplyPaletteResult } from './raster/apply-palette';
// ----------------------------------------------------------------------
// Raster substrate -- type-only re-exports of the server-only warp module.
// The value export of `warpRaster` lives at @ab/wx-charts/server because
// it lazy-loads `sharp` and Node built-ins.
// ----------------------------------------------------------------------
export {
	ADVISORY_PALETTE,
	type AdvisoryPaletteEntry,
	CIP_PROBABILITY_BANDS,
	CIP_SEVERITY_TIERS,
	FREEZING_LEVEL_BANDS,
	FREEZING_LEVEL_EMPHASIZED_LINE_STROKE,
	FREEZING_LEVEL_LINE_STROKE,
	goesIrPalette,
	goesVisPalette,
	goesWvPalette,
	ICING_INTENSITY_PALETTE,
	isReflectivityNoData,
	NWS_REFLECTIVITY_STOPS,
	type ReflectivityStop,
	type RGB,
	type ScalarBandStop,
} from './raster/palettes';
export type { WarpInput, WarpResult } from './raster/warp';
export { parseWorldFile, pixelToWorld, type WorldFile, worldToPixel } from './raster/worldfile';
export { type AirportMarker, renderAirport } from './symbology/airports';
export {
	type FilledBandStop,
	type FilledScalarBandsOptions,
	type FilledScalarBandsResult,
	renderFilledScalarBands,
	renderScalarContours,
	type ScalarContourOptions,
} from './symbology/contours';
export type { FrontDef, FrontKind, PipSide } from './symbology/fronts';
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
export { type LegendDef, type LegendEntry, renderLegend } from './symbology/legend';
export { type PirepGlyphInput, type PirepGlyphOptions, renderPirepGlyph } from './symbology/pirep-glyph';
export {
	type PolygonLabel,
	type PolygonOverlay,
	type PolygonRing,
	type PolygonStyle,
	type RenderPolygonOverlaysOptions,
	renderPolygonOverlays,
} from './symbology/polygons';
export { type PipDef, type PipShape, renderPolylinePips, type ScreenVec } from './symbology/polyline-pips';
export { type PressureCenter, renderPressureCenter } from './symbology/pressure-centers';
export {
	type DenseStationGlyphInput,
	type DenseStationModelOptions,
	renderStationModel,
	renderStationModelFromMetar,
	type StationModelOptions,
	type StationOb,
} from './symbology/station-model';
// ----------------------------------------------------------------------
// Chart-renderer contract types (browser-safe)
// ----------------------------------------------------------------------
export type {
	ChartProjectionSpec,
	ChartRenderer,
	ChartRenderInput,
	ChartRenderMeta,
	ChartRenderResult,
	ChartSpec,
} from './types';
// ----------------------------------------------------------------------
// Weather-product parsers + derivation rules (Phase C)
// ----------------------------------------------------------------------
export { parseMetar } from './wx/metar/parser';
export type { CloudLayer, ParsedMetar, SkyCover, WindGroup } from './wx/metar/types';
export { parsePirep } from './wx/pirep/parser';
export type {
	IcingIntensity,
	IcingReport,
	IcingType,
	ParsedPirep,
	PirepCloudLayer,
	PirepKind,
	PirepLocation,
	TurbulenceIntensity,
	TurbulenceReport,
} from './wx/pirep/types';
export { ceilingFtAgl, celsiusToFahrenheit, computeFlightCategory, flightCategory, summarizeCover } from './wx/rules';
export { parseTaf } from './wx/taf/parser';
export type { ParsedTaf, TafChangeKind, TafPeriod } from './wx/taf/types';
export { parseFbGrid } from './wx/winds-aloft/parser';
export type { ParsedFbGrid, ParsedFbStation, WindsAloftRow } from './wx/winds-aloft/types';
