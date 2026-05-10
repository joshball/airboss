/**
 * PIREP (Pilot Report) parser shape.
 *
 * Source of truth: FAA AIM Section 7-1-21 (Reporting Pilot Reports) +
 * FMH-1 Chapter 8 (PIREP format). The library captures the field set the
 * PIREP plot-grid renderer needs:
 *
 * - Station + observation type (UA = routine, UUA = urgent)
 * - Position (OV) -- can be a station ICAO + radial/distance (`CLE090030`)
 *   or a single station (`KORD`); we capture both forms and resolve to a
 *   lon/lat pair via the PirepObservation envelope (the chart spec
 *   provides the station-coord lookup).
 * - Time (TM) in HHMM Z
 * - Altitude (FL) in feet (FL060 = 6000) or DURC / DURD (during climb /
 *   descent)
 * - Aircraft type (TP) -- captured for the tooltip but not rendered as
 *   a glyph.
 * - Sky cover (SK) -- one or more layers
 * - Weather (WX) -- present-weather codes
 * - Temperature (TA) in degrees C
 * - Wind (WV) -- direction/speed
 * - Turbulence (TB) -- intensity + altitude band
 * - Icing (IC) -- intensity + type + altitude band
 * - Remarks (RM)
 *
 * # Coverage gaps -- not parsed in v1 (deferred per spec)
 *
 * - Multi-leg PIREPs are treated as one report (the first leg wins).
 * - Numeric ranges in altitude (`060-080`) are captured as a string;
 *   the renderer treats the lower bound as the report altitude.
 *
 * # Browser safety
 *
 * Pure type module; no values, no imports of Node built-ins.
 */

export type PirepKind = 'UA' | 'UUA';

/** AIM 7-1-23 turbulence intensity scale. */
export type TurbulenceIntensity = 'NEG' | 'LGT' | 'MOD' | 'SEV' | 'EXTM';

/** AIM 7-1-22 icing intensity scale. */
export type IcingIntensity = 'NEG' | 'TRC' | 'LGT' | 'MOD' | 'SEV';

/** AIM 7-1-22 icing type. */
export type IcingType = 'RIME' | 'CLR' | 'MX';

export interface PirepLocation {
	/** Original OV string (e.g. `CLE090030` or `KORD`). */
	raw: string;
	/** ICAO station identifier from the OV group, when present. */
	station: string | null;
	/** Radial in degrees true (the three digits after the station). */
	radialDeg: number | null;
	/** Distance from the station in nautical miles. */
	distanceNm: number | null;
}

export interface TurbulenceReport {
	intensity: TurbulenceIntensity;
	altitudeBandFt: { min: number | null; max: number | null } | null;
	raw: string;
}

export interface IcingReport {
	intensity: IcingIntensity;
	type: IcingType | null;
	altitudeBandFt: { min: number | null; max: number | null } | null;
	raw: string;
}

export interface PirepCloudLayer {
	cover: 'CLR' | 'SKC' | 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'OVX';
	baseFt: number | null;
	topFt: number | null;
}

export interface ParsedPirep {
	station: string;
	kind: PirepKind;
	location: PirepLocation;
	/** HHMM (Z). `null` if missing. */
	timeHhmmZ: number | null;
	/** Altitude in feet MSL. `null` for DURC / DURD or unparseable. */
	altitudeFt: number | null;
	/** Aircraft type (e.g. `B738`, `C172`). */
	aircraftType: string | null;
	skyCover: PirepCloudLayer[];
	weather: string[];
	temperatureC: number | null;
	wind: { directionDeg: number; speedKt: number } | null;
	turbulence: TurbulenceReport | null;
	icing: IcingReport | null;
	remarks: string | null;
	raw: string;
	warnings: string[];
}
