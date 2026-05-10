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
