/**
 * Spatial-renderer styling tokens.
 *
 * The XC viewer renders the sectional with design tokens, not the fixed
 * FAA chart palette -- so it can recolor for dark mode + colorblind
 * variants (design.md "Why vector sectional for v1"). The CSS custom
 * properties below are declared in `libs/themes/` under a `spatial` slot;
 * this module names them so components never hardcode a `var(--...)`
 * string.
 *
 * Browser-safe pure module.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` B.1.
 */

/** Per-feature CSS-custom-property names for the basemap layer. */
export const SPATIAL_BASEMAP_TOKENS = {
	water: 'var(--color-spatial-water)',
	stateOutline: 'var(--color-spatial-state-outline)',
	road: 'var(--color-spatial-road)',
	city: 'var(--color-spatial-city)',
	cityLabel: 'var(--color-spatial-city-label)',
} as const;

/** Per-class CSS-custom-property names for the airspace layer. */
export const SPATIAL_AIRSPACE_TOKENS = {
	classB: 'var(--color-spatial-airspace-b)',
	classC: 'var(--color-spatial-airspace-c)',
	classD: 'var(--color-spatial-airspace-d)',
	classE: 'var(--color-spatial-airspace-e)',
	sua: 'var(--color-spatial-airspace-sua)',
} as const;

/** Airport + navaid symbol token names. */
export const SPATIAL_SYMBOL_TOKENS = {
	airportHard: 'var(--color-spatial-airport-hard)',
	airportSoft: 'var(--color-spatial-airport-soft)',
	navaid: 'var(--color-spatial-navaid)',
	symbolLabel: 'var(--color-spatial-symbol-label)',
} as const;

/** Route-layer token names. */
export const SPATIAL_ROUTE_TOKENS = {
	routeLine: 'var(--color-spatial-route-line)',
	routeWaypoint: 'var(--color-spatial-route-waypoint)',
	legLabelBg: 'var(--color-spatial-leg-label-bg)',
	legLabelInk: 'var(--color-spatial-leg-label-ink)',
	legLeader: 'var(--color-spatial-leg-leader)',
} as const;

/** Flight-category chip token names (matches the wx-charts CVA palette). */
export const SPATIAL_FLIGHT_CATEGORY_TOKENS = {
	VFR: 'var(--color-spatial-cat-vfr)',
	MVFR: 'var(--color-spatial-cat-mvfr)',
	IFR: 'var(--color-spatial-cat-ifr)',
	LIFR: 'var(--color-spatial-cat-lifr)',
} as const;

/** AIRMET per-family stroke token names. */
export const SPATIAL_AIRMET_TOKENS = {
	'airmet-sierra': 'var(--color-spatial-airmet-sierra)',
	'airmet-tango': 'var(--color-spatial-airmet-tango)',
	'airmet-zulu': 'var(--color-spatial-airmet-zulu)',
} as const;

/** Performance-band reserve-state token names. */
export const SPATIAL_RESERVE_TOKENS = {
	ok: 'var(--color-spatial-reserve-ok)',
	low: 'var(--color-spatial-reserve-low)',
	critical: 'var(--color-spatial-reserve-critical)',
} as const;

/** The layer-toggle key enum -- which layers can be shown / hidden. */
export const SPATIAL_LAYER_KEYS = {
	BASEMAP: 'basemap',
	AIRSPACE: 'airspace',
	NAVAIDS: 'navaids',
	AIRPORTS: 'airports',
	ROUTE: 'route',
	WEATHER: 'weather',
} as const;

export type SpatialLayerKey = (typeof SPATIAL_LAYER_KEYS)[keyof typeof SPATIAL_LAYER_KEYS];

/** Human labels for the layer-toggle UI. */
export const SPATIAL_LAYER_LABELS: Record<SpatialLayerKey, string> = {
	basemap: 'Basemap',
	airspace: 'Airspace',
	navaids: 'Navaids',
	airports: 'Airports',
	route: 'Route',
	weather: 'Weather',
};
