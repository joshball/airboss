/**
 * Constants for the weather-chart symbology library.
 *
 * Source of truth: [docs/work-packages/wx-chart-symbology-library/spec.md](
 *   ../../../docs/work-packages/wx-chart-symbology-library/spec.md
 * ) "Constants" section.
 *
 * - `CHART_TYPES` enumerates the v1 chart types covering the PPL ACS Task C
 *   K2 cluster plus the icing/freezing-level forecast products added by the
 *   spec amendment (G-AIRMET icing, CIP, FIP, freezing-level forecast).
 * - `LAYER_BANDS` is the closed substrate z-order contract (Spike 02). Changing
 *   the set is a substrate change: bump `libs/wx-charts/package.json` version
 *   and regenerate every chart via `bun run charts build --all`.
 * - `FAA_FLIGHT_CATEGORIES` is the canonical four-tier flight-category enum
 *   used by METAR plot, CVA, and any "color by ceiling/visibility" rendering.
 *
 * Browser-safe: pure literals + types, no Node-only globals or imports.
 */

export const CHART_TYPES = {
	SURFACE_ANALYSIS: 'surface-analysis',
	RADAR_MOSAIC: 'radar-mosaic',
	ADVISORY_OVERLAY: 'advisory-overlay',
	METAR_PLOT_GRID: 'metar-plot-grid',
	PIREP_PLOT_GRID: 'pirep-plot-grid',
	WINDS_ALOFT_FB: 'winds-aloft-fb',
	PROG_CHART: 'prog-chart',
	GFA: 'gfa',
	CONVECTIVE_OUTLOOK: 'convective-outlook',
	CVA: 'cva',
	TAF_TIMELINE: 'taf-timeline',
	TURBULENCE_GAIRMET: 'turbulence-gairmet',
	TURBULENCE_GTG: 'turbulence-gtg',
	ICING_GAIRMET: 'icing-gairmet',
	ICING_CIP: 'icing-cip',
	ICING_FIP: 'icing-fip',
	FREEZING_LEVEL: 'freezing-level',
} as const;

export const CHART_TYPE_VALUES = Object.values(CHART_TYPES);
export type ChartType = (typeof CHART_TYPE_VALUES)[number];

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
	'surface-analysis': 'Surface Analysis',
	'radar-mosaic': 'Radar Mosaic',
	'advisory-overlay': 'AIRMET / SIGMET',
	'metar-plot-grid': 'METAR Plot',
	'pirep-plot-grid': 'PIREP Plot',
	'winds-aloft-fb': 'Winds Aloft FB',
	'prog-chart': 'Prog Chart',
	gfa: 'Graphical Forecasts for Aviation',
	'convective-outlook': 'Convective Outlook',
	cva: 'Ceiling and Visibility Analysis',
	'taf-timeline': 'TAF Timeline',
	'turbulence-gairmet': 'Turbulence G-AIRMET',
	'turbulence-gtg': 'Graphical Turbulence Guidance',
	'icing-gairmet': 'G-AIRMET Icing',
	'icing-cip': 'Current Icing Product (CIP)',
	'icing-fip': 'Forecast Icing Product (FIP)',
	'freezing-level': 'Freezing Level Forecast',
};

export const LAYER_BANDS = {
	BACKGROUND: 'background',
	GRATICULE: 'graticule',
	BASEMAP_FILL: 'basemap-fill',
	BASEMAP_BORDERS: 'basemap-borders',
	RASTER_OVERLAY: 'raster-overlay',
	BASEMAP_RE_STROKE: 'basemap-re-stroke',
	VECTOR_SYMBOLOGY: 'vector-symbology',
	POINT_SYMBOLOGY: 'point-symbology',
	CHROME: 'chrome',
} as const;

/**
 * Canonical z-order for `composeChart()`. Earlier entries are stacked first
 * (drawn at the back); later entries layer on top. Mirrors the spec's
 * "Layer band contract" table.
 */
export const LAYER_BAND_VALUES = [
	LAYER_BANDS.BACKGROUND,
	LAYER_BANDS.GRATICULE,
	LAYER_BANDS.BASEMAP_FILL,
	LAYER_BANDS.BASEMAP_BORDERS,
	LAYER_BANDS.RASTER_OVERLAY,
	LAYER_BANDS.BASEMAP_RE_STROKE,
	LAYER_BANDS.VECTOR_SYMBOLOGY,
	LAYER_BANDS.POINT_SYMBOLOGY,
	LAYER_BANDS.CHROME,
] as const;

export type LayerBand = (typeof LAYER_BAND_VALUES)[number];

export const FAA_FLIGHT_CATEGORIES = {
	VFR: 'VFR',
	MVFR: 'MVFR',
	IFR: 'IFR',
	LIFR: 'LIFR',
} as const;

export const FAA_FLIGHT_CATEGORY_VALUES = Object.values(FAA_FLIGHT_CATEGORIES);
export type FaaFlightCategory = (typeof FAA_FLIGHT_CATEGORY_VALUES)[number];

/**
 * Slug shape: `wx-<chart-type>-<isodate>[-<frame>]`. Lowercase + hyphens,
 * starts with `wx-`, 3..82 visible chars after the prefix.
 */
export const WX_CHART_SLUG_REGEX = /^wx-[a-z0-9][a-z0-9-]{1,80}[a-z0-9]$/;

/**
 * Output size budgets for `chart.svg`. Per spec "Edge cases" -> output SVG
 * size budget. Soft warning at 500 KB; hard abort at 5 MB.
 */
export const WX_CHART_SVG_WARN_BYTES = 500 * 1024;
export const WX_CHART_SVG_HARD_LIMIT_BYTES = 5 * 1024 * 1024;
