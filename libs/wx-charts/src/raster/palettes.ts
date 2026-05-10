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
