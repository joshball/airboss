/**
 * METAR parser shape -- the typed inputs the station-model renderer
 * consumes.
 *
 * Source of truth: Spike 03 (`spikes/wx-charts/03-metar-plot-grid/src/metar.ts`)
 * + the WP design.md "metar-plot-grid (Phase C)" section.
 *
 * # Coverage
 *
 * Field set captured: wind direction / speed / gust, visibility (statute
 * miles, with `M1/4SM` / `1 1/2SM` / `1/8SM` form support), present
 * weather codes, cloud layers, temperature / dewpoint, altimeter
 * setting, CAVOK, and the raw METAR string for traceability.
 *
 * # Coverage gaps -- not parsed in v1 (deferred per spec)
 *
 * - RMK section -- ignored (sea-level pressure, 6-hour temp/dewpoint,
 *   precip totals all live there; the station model doesn't need them).
 * - Runway visual range (RVR) groups -- ignored.
 * - Trend forecast (BECMG/TEMPO) blocks -- ignored.
 * - SPECI vs METAR distinction -- treated identically.
 * - Recent weather (RE prefix) -- ignored.
 * - Wind shear / variable wind directions (`310V040`) -- variable
 *   secondary direction discarded; primary direction kept.
 *
 * # Browser safety
 *
 * Pure type module; no values, no imports of Node built-ins.
 */

export type SkyCover = 'SKC' | 'CLR' | 'NSC' | 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV';

export interface WindGroup {
	/** Direction wind is FROM, in degrees true. `null` if VRB (variable). */
	directionDeg: number | null;
	/** Wind speed in knots. `0` = calm. */
	speedKt: number;
	/** Gust in knots; `null` if no gust group reported. */
	gustKt: number | null;
	/** True if reported as `VRB...KT`. */
	variable: boolean;
	/** True if reported as `00000KT`. */
	calm: boolean;
}

export interface CloudLayer {
	cover: SkyCover;
	/** Layer base in feet AGL; `null` for SKC/CLR/NSC and missing/unparseable heights. */
	heightFtAgl: number | null;
	/**
	 * Cloud-type tag appended to the layer group: `CB` (cumulonimbus) or
	 * `TCU` (towering cumulus). `null` when no tag was reported. Convective
	 * cloud tags drive the truth-aware synoptic `why` annotation in
	 * `@ab/wx-explain`; the station-model renderer can also surface them.
	 */
	cloudType: 'CB' | 'TCU' | null;
}

export interface ParsedMetar {
	/** ICAO 4-letter station identifier. */
	station: string;
	/** Day-of-month (Z) from the DDhhmmZ group. */
	day: number;
	/** Hour (Z) from the DDhhmmZ group. */
	hour: number;
	/** Minute (Z) from the DDhhmmZ group. */
	minute: number;
	wind: WindGroup | null;
	/** Visibility in statute miles; `null` if unparseable / missing. */
	visibilitySM: number | null;
	/** Present-weather codes, raw (e.g. `+RA`, `BR`, `VCTS`). */
	weather: string[];
	clouds: CloudLayer[];
	tempC: number | null;
	dewpointC: number | null;
	altimeterInHg: number | null;
	cavok: boolean;
	/** The original METAR string (whitespace-normalized). */
	raw: string;
	/**
	 * Parser warnings emitted for tokens that were silently dropped or
	 * coerced. Empty when the body parsed cleanly. The chart-renderer
	 * collects these into `meta.json.parser_warnings`.
	 */
	warnings: string[];
}
