/**
 * Palette definitions for raster overlays.
 *
 * Phase B ships:
 *   - NWS reflectivity ramp (n0r product, 5 dBZ steps from 5 -> 75)
 *   - "no-data" filter for the IEM n0r PNG (palette indices 0..6 and
 *     22..255 decode to opaque black; we drop them so the basemap shows
 *     through)
 *
 * Browser-safe: pure data + small helpers, no Node imports.
 *
 * The ramp values mirror the IEM-supplied palette so that the warped
 * radar in Phase B's chart matches the NWS reference exactly. The
 * palette source is the IEM-published n0r PLTE table (reproduced in
 * spike 02's notes); each entry below is a 5-dBZ stop with the colour
 * the source palette emits at that intensity.
 */

export interface ReflectivityStop {
	/** Reflectivity value in dBZ. */
	dbz: number;
	/** RGB colour for this stop, hex CSS form. */
	hex: string;
	/** Whether the legend should label this stop with a number. */
	label: boolean;
}

/**
 * NWS reflectivity ramp for the n0r composite product. 15 stops between
 * 5 and 75 dBZ in 5 dBZ steps. Even-indexed stops are labelled in the
 * legend; odd-indexed stops fill in the colour ramp visually.
 */
export const NWS_REFLECTIVITY_STOPS: readonly ReflectivityStop[] = [
	{ dbz: 5, hex: '#00ECEC', label: true },
	{ dbz: 10, hex: '#01A0F6', label: false },
	{ dbz: 15, hex: '#0000F6', label: true },
	{ dbz: 20, hex: '#00FF00', label: false },
	{ dbz: 25, hex: '#00C800', label: true },
	{ dbz: 30, hex: '#009000', label: false },
	{ dbz: 35, hex: '#FFFF00', label: true },
	{ dbz: 40, hex: '#E7C000', label: false },
	{ dbz: 45, hex: '#FF9000', label: true },
	{ dbz: 50, hex: '#FF0000', label: false },
	{ dbz: 55, hex: '#D60000', label: true },
	{ dbz: 60, hex: '#C00000', label: false },
	{ dbz: 65, hex: '#FF00FF', label: true },
	{ dbz: 70, hex: '#9955C9', label: false },
	{ dbz: 75, hex: '#FFFFFF', label: true },
];

/**
 * "No-data" filter for IEM-decoded n0r RGBA pixels. The IEM PNG uses a
 * paletted PNG where indices outside the 7..21 range (precipitation
 * stops 5..75 dBZ) all decode to opaque black. We treat any pure-black
 * pixel as "no data" so the warped raster is transparent there and the
 * basemap shows through.
 */
export function isReflectivityNoData(r: number, g: number, b: number): boolean {
	return r === 0 && g === 0 && b === 0;
}

/**
 * AIRMET / SIGMET advisory palette per the FAA / NWS rendering convention.
 * Each entry carries the stroke + fill colours for that advisory family.
 *
 * - `airmet-sierra` (IFR / Mountain Obscuration) -- yellow-fill polygons
 * - `airmet-tango`  (Turbulence)                  -- orange dashed polygons
 * - `airmet-zulu`   (Icing)                       -- blue dashed polygons
 * - `sigmet`        (severe wx)                   -- solid red polygons
 * - `convective-sigmet` (thunderstorm)            -- red with thunderstorm glyph
 */
export interface AdvisoryPaletteEntry {
	stroke: string;
	fill: string;
	fillOpacity: number;
	dasharray?: string;
	label: string;
}

export const ADVISORY_PALETTE: Record<string, AdvisoryPaletteEntry> = {
	'airmet-sierra': {
		stroke: '#c2a200',
		fill: '#ffe07a',
		fillOpacity: 0.32,
		label: 'AIRMET Sierra (IFR / Mtn Obscn)',
	},
	'airmet-tango': {
		stroke: '#c4661f',
		fill: '#ffb070',
		fillOpacity: 0.22,
		dasharray: '6 4',
		label: 'AIRMET Tango (Turbulence)',
	},
	'airmet-zulu': {
		stroke: '#1f63c4',
		fill: '#88b6ff',
		fillOpacity: 0.22,
		dasharray: '6 4',
		label: 'AIRMET Zulu (Icing)',
	},
	sigmet: {
		stroke: '#a40000',
		fill: '#ff5050',
		fillOpacity: 0.28,
		label: 'SIGMET (Severe Wx)',
	},
	'convective-sigmet': {
		stroke: '#7a0000',
		fill: '#ff2828',
		fillOpacity: 0.32,
		label: 'Convective SIGMET (Tstm)',
	},
};

/**
 * G-AIRMET icing-intensity palette per AC 00-45H Ch 5 + Aviation Weather
 * Handbook (FAA-H-8083-28) Ch 19. The G-AIRMET icing product partitions the
 * forecast into intensity tiers (light, moderate, severe) with an optional
 * type qualifier (clear / mixed / rime). Severity drives colour ramp; the
 * polygon family blue-cyan-purple matches the AWC G-AIRMET viewer.
 *
 * The four entries below mirror the canonical ramp (lightest -> deepest).
 * `icing-light-mod` is the combined "light or moderate" forecast band the
 * AWC product emits when severity is hedged across the polygon.
 */
export const ICING_INTENSITY_PALETTE: Record<string, AdvisoryPaletteEntry> = {
	'icing-light': {
		stroke: '#3a8fd0',
		fill: '#bcdcff',
		fillOpacity: 0.32,
		label: 'Light icing',
	},
	'icing-light-mod': {
		stroke: '#1f63c4',
		fill: '#88b6ff',
		fillOpacity: 0.32,
		label: 'Light to moderate icing',
	},
	'icing-moderate': {
		stroke: '#0a2faa',
		fill: '#5a8cf0',
		fillOpacity: 0.36,
		label: 'Moderate icing',
	},
	'icing-severe': {
		stroke: '#3a006a',
		fill: '#7a3acd',
		fillOpacity: 0.42,
		label: 'Severe icing',
	},
};

/**
 * Filled scalar-band stop for gridded probability / severity / altitude
 * fields. `min` / `max` define the half-open band [min, max); the renderer
 * picks the first stop whose band contains the cell value.
 */
export interface ScalarBandStop {
	/** Lower bound of the band (inclusive). */
	min: number;
	/** Upper bound of the band (exclusive); use `Infinity` for the top tier. */
	max: number;
	/** Hex fill colour for the band. */
	fill: string;
	/** Fill opacity in [0, 1]. */
	fillOpacity: number;
	/** Legend label (e.g. "20-40%", ">10000 ft"). */
	label: string;
}

/**
 * CIP / FIP icing-probability palette per AC 00-45H Ch 5 + AWC icing product
 * (https://aviationweather.gov/icing). The Current Icing Product (CIP) and
 * Forecast Icing Product (FIP) emit a 0-100 percent probability of any icing
 * at a flight level; the canonical AWC ramp progresses cyan -> blue -> purple
 * as probability rises. Six bands in 20-percent steps cover the published
 * range; 0-19 percent is rendered as no-fill so the basemap shows through.
 */
export const CIP_PROBABILITY_BANDS: readonly ScalarBandStop[] = [
	{ min: 20, max: 40, fill: '#9fd9ff', fillOpacity: 0.55, label: '20-40%' },
	{ min: 40, max: 55, fill: '#5fb7f7', fillOpacity: 0.6, label: '40-55%' },
	{ min: 55, max: 70, fill: '#2a86e0', fillOpacity: 0.65, label: '55-70%' },
	{ min: 70, max: 85, fill: '#1456b8', fillOpacity: 0.7, label: '70-85%' },
	{ min: 85, max: 95, fill: '#5728a6', fillOpacity: 0.72, label: '85-95%' },
	{ min: 95, max: Number.POSITIVE_INFINITY, fill: '#3a006a', fillOpacity: 0.78, label: '95%+' },
];

/**
 * CIP / FIP severity overlay. The AWC product also publishes a 0-1 severity
 * index (0 = trace, 1 = heavy). When the spec opts in to severity contours
 * the renderer overlays line contours at the published severity tiers using
 * this stroke palette so authors can teach "high probability + low severity"
 * vs "moderate probability + high severity" combinations side by side.
 */
export const CIP_SEVERITY_TIERS: readonly { value: number; stroke: string; label: string }[] = [
	{ value: 0.25, stroke: '#5a8cf0', label: 'Trace' },
	{ value: 0.5, stroke: '#1456b8', label: 'Light' },
	{ value: 0.75, stroke: '#5728a6', label: 'Moderate' },
];

/**
 * Freezing-level altitude palette per AC 00-45H Ch 5 + AC 00-6B Ch 17. The
 * NWS / NCEP gridded freezing-level product emits the height of the lowest
 * 0 degC isotherm in feet MSL. Bands progress purple -> blue -> green -> orange
 * from sea level to 15000+ ft so a learner can read the altitude band against
 * a typical normally-aspirated piston ceiling at a glance.
 */
export const FREEZING_LEVEL_BANDS: readonly ScalarBandStop[] = [
	{ min: 0, max: 2000, fill: '#d4c0e8', fillOpacity: 0.55, label: 'SFC-2000 ft' },
	{ min: 2000, max: 4000, fill: '#a89cd6', fillOpacity: 0.55, label: '2-4 kft' },
	{ min: 4000, max: 6000, fill: '#7c8fc4', fillOpacity: 0.55, label: '4-6 kft' },
	{ min: 6000, max: 8000, fill: '#5fa8c7', fillOpacity: 0.55, label: '6-8 kft' },
	{ min: 8000, max: 10000, fill: '#62b894', fillOpacity: 0.55, label: '8-10 kft' },
	{ min: 10000, max: 12000, fill: '#a8c466', fillOpacity: 0.55, label: '10-12 kft' },
	{ min: 12000, max: 15000, fill: '#e0a64a', fillOpacity: 0.55, label: '12-15 kft' },
	{ min: 15000, max: Number.POSITIVE_INFINITY, fill: '#c46b3a', fillOpacity: 0.55, label: '15 kft+' },
];

/**
 * Freezing-level contour line palette. The line contours are drawn at the
 * SAME altitude breakpoints as the band fills; the stroke ramp keeps the
 * thicker contours readable on top of the filled bands.
 */
export const FREEZING_LEVEL_LINE_STROKE = '#3d3a32';
export const FREEZING_LEVEL_EMPHASIZED_LINE_STROKE = '#1a1a1a';
