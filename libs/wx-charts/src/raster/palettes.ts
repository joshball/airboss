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

// ----------------------------------------------------------------------
// GOES satellite palettes (Phase F)
// ----------------------------------------------------------------------
// Each palette is a function `(value) -> [r, g, b]`. The "value" semantics
// per palette:
//   - IR:  brightness temperature in degrees Celsius (warmer = lower
//          cloud tops; colder = higher / more intense convection).
//   - WV:  brightness temperature in degrees Celsius from the water-vapor
//          band (drier mid/upper troposphere appears warmer in BT terms;
//          moister appears colder).
//   - VIS: 8-bit visible-band reflectance (0-255). Linear grayscale ramp.
//
// These functions are designed to be called inline from the warp pipeline:
// the warp samples a brightness-temperature byte from the source raster
// (per the source product's encoding) and routes it through the palette
// function. Inputs are clamped at the palette boundaries.

export type RGB = [r: number, g: number, b: number];

interface IrStop {
	tempC: number;
	rgb: RGB;
}

/**
 * Standard NWS IR enhancement curve (sometimes called the "AVN" or
 * "RAMSDIS" enhancement). Interpolates between the published color stops
 * below. Above ~+25 C the curve is solid black (no cloud signal); from
 * +25 down to -32 C it is a smooth gray ramp (warm low cloud tops);
 * colder than -32 C the curve enters a colored regime (white, then
 * yellow/orange/red/purple as the tops climb above -64 C, signalling
 * deep convection).
 *
 * The exact stops and ramps vary by product (the AVN, RAMSDIS, and CIRA
 * enhancement curves all differ slightly). The curve below is faithful
 * to the published AC 00-45H Chapter 4 IR satellite reading guide and
 * matches the AWC standard rendering.
 */
const IR_STOPS: readonly IrStop[] = [
	{ tempC: 30, rgb: [0, 0, 0] }, // warm: black (no cloud, ground-temp signal)
	{ tempC: 0, rgb: [180, 180, 180] }, // 0 C: medium gray (warm clouds, low tops)
	{ tempC: -32, rgb: [255, 255, 255] }, // -32 C: white (mid-level cloud tops)
	{ tempC: -42, rgb: [255, 255, 0] }, // -42 C: yellow (transition into deep cloud)
	{ tempC: -52, rgb: [255, 128, 0] }, // -52 C: orange
	{ tempC: -62, rgb: [255, 0, 0] }, // -62 C: red (overshooting tops)
	{ tempC: -72, rgb: [128, 0, 128] }, // -72 C: purple
	{ tempC: -85, rgb: [0, 0, 0] }, // <= -85 C: black (extreme tops)
];

function interpolateRgb(a: RGB, b: RGB, t: number): RGB {
	const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
	return [
		Math.round(a[0] + (b[0] - a[0]) * clamped),
		Math.round(a[1] + (b[1] - a[1]) * clamped),
		Math.round(a[2] + (b[2] - a[2]) * clamped),
	];
}

/**
 * Map a GOES IR brightness temperature (Celsius) to an enhanced RGB.
 * Values above the warmest stop snap to that stop; values below the
 * coldest stop snap to that stop.
 */
export function goesIrPalette(brightnessTempC: number): RGB {
	const stops = IR_STOPS;
	if (brightnessTempC >= stops[0].tempC) return stops[0].rgb;
	const last = stops[stops.length - 1];
	if (brightnessTempC <= last.tempC) return last.rgb;
	for (let i = 0; i < stops.length - 1; i += 1) {
		const a = stops[i];
		const b = stops[i + 1];
		if (brightnessTempC <= a.tempC && brightnessTempC > b.tempC) {
			// Lerp from a -> b. tempC decreases monotonically, so:
			//   t = (a.tempC - bt) / (a.tempC - b.tempC)
			const t = (a.tempC - brightnessTempC) / (a.tempC - b.tempC);
			return interpolateRgb(a.rgb, b.rgb, t);
		}
	}
	return last.rgb;
}

/**
 * GOES visible-band palette: linear grayscale 0..255. The visible band
 * encodes top-of-atmosphere reflectance; brighter pixels = more
 * reflective surface (cloud, snow, sun glint). Pure passthrough: the
 * source byte IS the rendered intensity.
 */
export function goesVisPalette(reflectance0to255: number): RGB {
	const v = reflectance0to255 < 0 ? 0 : reflectance0to255 > 255 ? 255 : Math.round(reflectance0to255);
	return [v, v, v];
}

interface WvStop {
	tempC: number;
	rgb: RGB;
}

/**
 * GOES water-vapor enhancement curve. The 6.2 / 6.9 / 7.3 micron WV bands
 * sense mid- and upper-tropospheric moisture as brightness temperature.
 * Drier columns appear *warmer* (radiation reaches the satellite from
 * lower / warmer atmospheric layers); moister columns appear *colder*.
 *
 * The standard NWS WV enhancement uses a brown -> yellow -> green -> blue
 * ramp from warm/dry to cold/moist. This matches the AWC GOES WV product
 * commonly seen on aviationweather.gov.
 */
const WV_STOPS: readonly WvStop[] = [
	{ tempC: 10, rgb: [120, 60, 20] }, // very warm/dry: brown
	{ tempC: -20, rgb: [200, 130, 30] }, // dry: tan
	{ tempC: -40, rgb: [240, 220, 60] }, // borderline: yellow
	{ tempC: -50, rgb: [120, 200, 80] }, // moistening: green
	{ tempC: -60, rgb: [40, 160, 220] }, // moist: cyan
	{ tempC: -70, rgb: [40, 60, 200] }, // very moist: blue
	{ tempC: -80, rgb: [160, 0, 200] }, // upper-trop moist + cold tops: purple
];

/**
 * Map a GOES water-vapor brightness temperature (Celsius) to RGB. Same
 * lookup shape as `goesIrPalette`. Inputs are clamped at the palette
 * boundaries.
 */
export function goesWvPalette(brightnessTempC: number): RGB {
	const stops = WV_STOPS;
	if (brightnessTempC >= stops[0].tempC) return stops[0].rgb;
	const last = stops[stops.length - 1];
	if (brightnessTempC <= last.tempC) return last.rgb;
	for (let i = 0; i < stops.length - 1; i += 1) {
		const a = stops[i];
		const b = stops[i + 1];
		if (brightnessTempC <= a.tempC && brightnessTempC > b.tempC) {
			const t = (a.tempC - brightnessTempC) / (a.tempC - b.tempC);
			return interpolateRgb(a.rgb, b.rgb, t);
		}
	}
	return last.rgb;
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

/**
 * SPC convective outlook tier palette per the NWS Storm Prediction Center
 * categorical-outlook product description (https://www.spc.noaa.gov/misc/about.html).
 * Six tiers from "general thunderstorm" through "high risk." The colour palette
 * matches the SPC standard rendering used on every SPC outlook PNG.
 *
 * Outermost tier (TSTM) is drawn first so layered higher-risk tiers stack on
 * top -- the renderer enforces this ordering by sorting on tier index before
 * emission.
 */
export interface ConvectiveOutlookTierEntry {
	stroke: string;
	fill: string;
	fillOpacity: number;
	label: string;
	/** Visual ordering: 0 = outermost / lowest risk, increases inward. */
	order: number;
}

export const CONVECTIVE_OUTLOOK_TIERS = {
	TSTM: 'tstm',
	MRGL: 'mrgl',
	SLGT: 'slgt',
	ENH: 'enh',
	MDT: 'mdt',
	HIGH: 'high',
} as const;

export type ConvectiveOutlookTier = (typeof CONVECTIVE_OUTLOOK_TIERS)[keyof typeof CONVECTIVE_OUTLOOK_TIERS];

export const CONVECTIVE_OUTLOOK_PALETTE: Record<ConvectiveOutlookTier, ConvectiveOutlookTierEntry> = {
	tstm: { stroke: '#5a8a3a', fill: '#c4e4a0', fillOpacity: 0.36, label: 'TSTM (General thunder)', order: 0 },
	mrgl: { stroke: '#2f6e2a', fill: '#7ec57a', fillOpacity: 0.42, label: 'MRGL (Marginal risk)', order: 1 },
	slgt: { stroke: '#a08020', fill: '#f4d77a', fillOpacity: 0.5, label: 'SLGT (Slight risk)', order: 2 },
	enh: { stroke: '#a85020', fill: '#f0a060', fillOpacity: 0.55, label: 'ENH (Enhanced risk)', order: 3 },
	mdt: { stroke: '#a01616', fill: '#e85050', fillOpacity: 0.6, label: 'MDT (Moderate risk)', order: 4 },
	high: { stroke: '#5a0a8a', fill: '#c060e0', fillOpacity: 0.65, label: 'HIGH (High risk)', order: 5 },
};

/**
 * FAA flight-category fill palette for CVA (Ceiling and Visibility Analysis)
 * area shading per AIM 7-1-6 + AC 00-45H Ch 5. The CVA product shows current
 * VFR / MVFR / IFR / LIFR areas as filled polygons across CONUS. The colours
 * match the AWC standard rendering used on aviationweather.gov/cva.
 *
 * VFR uses a low-opacity green so basemap detail still reads through; the
 * non-VFR tiers escalate through blue / red / magenta with rising contrast.
 */
export interface FlightCategoryFillEntry {
	stroke: string;
	fill: string;
	fillOpacity: number;
	label: string;
}

export const FLIGHT_CATEGORY_FILL: Record<string, FlightCategoryFillEntry> = {
	VFR: { stroke: '#2f7a2f', fill: '#9fd99f', fillOpacity: 0.35, label: 'VFR (>= 3 SM and >= 3000 ft ceiling)' },
	MVFR: { stroke: '#1565c0', fill: '#7ab0e8', fillOpacity: 0.42, label: 'MVFR (3-5 SM or 1000-3000 ft)' },
	IFR: { stroke: '#c62828', fill: '#f08585', fillOpacity: 0.5, label: 'IFR (1-3 SM or 500-1000 ft)' },
	LIFR: { stroke: '#6a1b9a', fill: '#c080d8', fillOpacity: 0.55, label: 'LIFR (< 1 SM or < 500 ft)' },
};

/**
 * GFA (Graphical Forecasts for Aviation) cloud-coverage / precipitation
 * polygon palette per AC 00-45H Ch 5 + AWC product page
 * (https://aviationweather.gov/gfa). The GFA renders cloud areas, precip
 * areas, and IFR conditions as polygons; this palette is the AWC standard
 * for each polygon family.
 */
export interface GfaPolygonEntry {
	stroke: string;
	fill: string;
	fillOpacity: number;
	label: string;
	dasharray?: string;
}

export const GFA_PALETTE = {
	clouds_few_sct: {
		stroke: '#8aa0c4',
		fill: '#c0d0e8',
		fillOpacity: 0.3,
		label: 'FEW/SCT clouds',
	},
	clouds_bkn_ovc: {
		stroke: '#4a6080',
		fill: '#8090b0',
		fillOpacity: 0.45,
		label: 'BKN/OVC clouds',
	},
	precip_rain: {
		stroke: '#2a8a3a',
		fill: '#7ec57a',
		fillOpacity: 0.45,
		label: 'Rain (-RA / RA)',
	},
	precip_snow: {
		stroke: '#5060a0',
		fill: '#b0c0e0',
		fillOpacity: 0.5,
		label: 'Snow (-SN / SN)',
	},
	precip_mixed: {
		stroke: '#7a4080',
		fill: '#d0a0e0',
		fillOpacity: 0.45,
		label: 'Mixed precipitation',
	},
	precip_tstm: {
		stroke: '#a01616',
		fill: '#ff7575',
		fillOpacity: 0.45,
		label: 'Thunderstorms',
		dasharray: '6 4',
	},
	ifr_area: {
		stroke: '#c62828',
		fill: '#f08585',
		fillOpacity: 0.32,
		label: 'IFR conditions',
		dasharray: '8 4',
	},
	mvfr_area: {
		stroke: '#1565c0',
		fill: '#7ab0e8',
		fillOpacity: 0.28,
		label: 'MVFR conditions',
		dasharray: '8 4',
	},
} as const satisfies Record<string, GfaPolygonEntry>;

export type GfaPolygonKind = keyof typeof GFA_PALETTE;

/**
 * Prog-chart hazard polygon palette. Prog charts pair frontal symbology with
 * forecast hazard areas (turbulence, icing, IFR conditions) drawn as dashed
 * polygons per AC 00-45H Ch 5 SIGWX guidance.
 */
export const PROG_HAZARD_PALETTE = {
	turbulence: {
		stroke: '#c4661f',
		fill: '#ffb070',
		fillOpacity: 0.18,
		dasharray: '4 4',
		label: 'Turbulence forecast',
	},
	icing: {
		stroke: '#1f63c4',
		fill: '#88b6ff',
		fillOpacity: 0.18,
		dasharray: '4 4',
		label: 'Icing forecast',
	},
	ifr: {
		stroke: '#c62828',
		fill: '#f08585',
		fillOpacity: 0.18,
		dasharray: '6 4',
		label: 'IFR conditions forecast',
	},
} as const;

export type ProgHazardKind = keyof typeof PROG_HAZARD_PALETTE;
