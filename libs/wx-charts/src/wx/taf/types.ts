/**
 * TAF (Terminal Aerodrome Forecast) parser shape -- the typed inputs the
 * Phase G timeline renderer consumes.
 *
 * Source of truth:
 *   - AIM 7-1-29 ("Terminal Aerodrome Forecast (TAF)")
 *   - AC 00-45H Ch 5 TAF section
 *   - WP design.md "taf-timeline (Phase G)" section
 *
 * # Coverage
 *
 * Field set captured per period:
 *   - kind (initial / FM / BECMG / TEMPO / PROB30 / PROB40)
 *   - start + end timestamps (decoded against the reference issuance time)
 *   - wind (direction, speed, gust, variable, calm) -- shape mirrors METAR
 *   - visibility (statute miles, with `M1/4SM` / `1 1/2SM` etc. forms)
 *   - present-weather codes (e.g., `+RA`, `BR`, `VCTS`, `SHRA`)
 *   - cloud layers (cover + height AGL, plus VV)
 *   - probability (30 / 40, set on PROB30 / PROB40 periods only)
 *
 * # Coverage gaps -- not parsed in v1 (deferred per spec)
 *
 * - Wind shear groups (`WS020/24050KT`) -- ignored.
 * - Icing / turbulence forecast groups (`5xxxx` in raw TAF) -- ignored.
 * - Min/max temp forecast groups (`TX..../TN....`) -- ignored.
 * - Trend forecast `NSW` / `WSCONDS` extension groups -- ignored.
 * - Per-period CB / TCU cloud-type tags -- discarded.
 *
 * # Browser safety
 *
 * Pure type module; no values, no imports of Node built-ins.
 */

import type { CloudLayer, WindGroup } from '../metar/types';

export type TafChangeKind = 'INITIAL' | 'FM' | 'BECMG' | 'TEMPO' | 'PROB30' | 'PROB40';

/**
 * One forecast period inside a TAF. The `INITIAL` period covers
 * `validFrom` through the next change boundary; `FM` opens a new
 * baseline at `start`; `BECMG`, `TEMPO`, `PROB30`, `PROB40` describe
 * conditions over a [`start`, `end`] window.
 *
 * `INITIAL` and `FM` periods set `end` to the next FM start (or to the
 * TAF `validTo` for the trailing period). `BECMG` / `TEMPO` / `PROB`
 * periods carry the explicit `<DDHH>/<DDHH>` window.
 */
export interface TafPeriod {
	kind: TafChangeKind;
	/** UTC ISO timestamp when this period begins. */
	start: string;
	/** UTC ISO timestamp when this period ends. */
	end: string;
	wind: WindGroup | null;
	/** Visibility in statute miles; `null` if unparseable / not given. */
	visibilitySM: number | null;
	/** Present-weather codes, raw (e.g. `+SHRA`, `BR`, `VCTS`). */
	weather: string[];
	clouds: CloudLayer[];
	/** True if this period reported `CAVOK`. */
	cavok: boolean;
	/** Probability percentage (30 or 40) for `PROB30` / `PROB40`; `null` otherwise. */
	probability: number | null;
	/** Raw TAF substring this period was decoded from -- traceability. */
	raw: string;
}

export interface ParsedTaf {
	/** ICAO 4-letter station identifier. */
	station: string;
	/** True if the TAF carried an `AMD` modifier (amended). */
	amended: boolean;
	/** True if the TAF carried a `COR` modifier (corrected). */
	corrected: boolean;
	/** UTC ISO timestamp the TAF was issued. */
	issuedAt: string;
	/** UTC ISO timestamp the TAF valid period begins. */
	validFrom: string;
	/** UTC ISO timestamp the TAF valid period ends. */
	validTo: string;
	/** Forecast periods, in order: INITIAL, then any FM/BECMG/TEMPO/PROB. */
	periods: TafPeriod[];
	/** Original TAF string (whitespace-normalized). */
	raw: string;
	/**
	 * Parser warnings emitted for tokens that were silently dropped or
	 * coerced. Empty when the body parsed cleanly.
	 */
	warnings: string[];
}
