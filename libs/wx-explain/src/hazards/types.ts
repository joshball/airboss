/**
 * Hazard product decoder -- shared types.
 *
 * Models the AWC + NWS convective-hazard family at a uniform shape so a
 * pilot can ask "what's pointed at me right now?" across multiple
 * products without learning each one's grammar:
 *
 *   - Convective SIGMET (WSUS / WST, regions SIGE/SIGC/SIGW)
 *   - Severe Thunderstorm Warning (SVR)        -- Phase 1
 *   - Non-convective SIGMET (turb/ice/ash)      -- Phase 2
 *   - AIRMET Sierra/Tango/Zulu                  -- Phase 2
 *   - CWA (Center Weather Advisory)             -- Phase 2
 *   - Tornado Warning (TOR)                     -- Phase 3
 *   - SPC Mesoscale Discussion (MCD)            -- Phase 3
 *   - SPC Convective Watch (WW)                 -- Phase 3
 *
 * Browser-safe: pure types + value objects, no Node imports.
 */

/** Hazard product family. */
export type HazardKind =
	| 'convective-sigmet'
	| 'sigmet'
	| 'airmet'
	| 'cwa'
	| 'severe-thunderstorm-warning'
	| 'tornado-warning'
	| 'spc-mesoscale-discussion'
	| 'spc-convective-watch';

/**
 * Severity tier driving the unified color/iconography across products.
 *
 *   - 'severe'        immediate life/airframe threat. Red. Tornado, convective
 *                     SIGMET, SVR Warning, volcanic ash SIGMET.
 *   - 'significant'   significant operational impact. Yellow. Non-convective
 *                     SIGMETs (moderate turb/ice), AIRMETs, CWAs, MCDs, WWs.
 *   - 'informational' planning context, no hazard declared. Dim. Outlook
 *                     polygons inside a convective SIGMET, expiring products
 *                     in their last 15 min.
 */
export type HazardSeverity = 'severe' | 'significant' | 'informational';

/** AWC product region. */
export type AwcRegion = 'SIGE' | 'SIGC' | 'SIGW';

/**
 * A FROM-point in the AWC "DDD QUAD VOR" grammar, e.g. `50NE ENE` =
 * 50 nautical miles in the NE quadrant of the Kennebunk VOR (ENE).
 *
 * When the parser cannot resolve the VOR identifier to a named navaid
 * the `navaidName` field is `null`; callers should fall back to the raw
 * identifier in `navaidId`.
 */
export interface HazardFromPoint {
	/** Distance in nautical miles. May be 0 for "AT VOR" form. */
	distanceNm: number;
	/** 8-point compass quadrant token, e.g. NNE, NE, ENE, E ... NNW. */
	quadrant: HazardQuadrant;
	/** VOR identifier (3 letters). */
	navaidId: string;
	/** Resolved navaid name, or null when the identifier is unknown. */
	navaidName: string | null;
	/** Raw token as it appeared in the source product. */
	raw: string;
}

export type HazardQuadrant =
	| 'N'
	| 'NNE'
	| 'NE'
	| 'ENE'
	| 'E'
	| 'ESE'
	| 'SE'
	| 'SSE'
	| 'S'
	| 'SSW'
	| 'SW'
	| 'WSW'
	| 'W'
	| 'WNW'
	| 'NW'
	| 'NNW';

/** All 16 compass quadrants in clockwise order. */
export const HAZARD_QUADRANTS = [
	'N',
	'NNE',
	'NE',
	'ENE',
	'E',
	'ESE',
	'SE',
	'SSE',
	'S',
	'SSW',
	'SW',
	'WSW',
	'W',
	'WNW',
	'NW',
	'NNW',
] as const satisfies readonly HazardQuadrant[];

/** A closed boundary polygon described as an ordered list of FROM-points. */
export interface HazardBoundary {
	/** Ordered vertices. First and last are usually the same point. */
	points: readonly HazardFromPoint[];
}

/** Cell movement: storms moving FROM `fromDeg` AT `speedKt`. */
export interface HazardMovement {
	/** Bearing storms are coming FROM, in degrees true, 0-359. */
	fromDeg: number;
	/** Forward speed in knots. */
	speedKt: number;
}

/** Convective phenomenon class. */
export type ConvectivePhenomenon =
	| 'area-ts'
	| 'embedded-ts'
	| 'line-ts'
	| 'isolated-ts'
	| 'severe-ts'
	| 'tornado'
	| 'hail'
	| 'unknown';

/** Outlook area inside a convective SIGMET product. NOT itself a hazard. */
export interface ConvectiveOutlookArea {
	/** Label as it appeared in the source, e.g. "AREA 1". */
	label: string;
	/** Polygon boundary. */
	boundary: HazardBoundary;
	/** Other product references called out in the area body, e.g. "WW 230". */
	references: readonly string[];
	/** Trailing narrative lines after the references. */
	narrative: string;
}

/** Outlook block (next 4-hour forecast of upcoming convective SIGMETs). */
export interface ConvectiveOutlook {
	validFrom: Date;
	validUntil: Date;
	areas: readonly ConvectiveOutlookArea[];
}

/** Decoded Convective SIGMET (the AWC product, not an SVR). */
export interface ConvectiveSigmet {
	kind: 'convective-sigmet';
	severity: 'severe';
	/** WMO header line, e.g. "WSUS31 KKCI 192055". */
	wmoHeader: string;
	/** AWC region: SIGE / SIGC / SIGW. */
	region: AwcRegion;
	/** Series id, e.g. "70E". */
	seriesId: string;
	/** Series number stripped of region suffix, e.g. 70. */
	seriesNumber: number;
	/** Issued at (parsed from WMO header day+HHMM, UTC). */
	issuedAt: Date;
	/** Valid window. */
	validFrom: Date;
	validUntil: Date;
	/** State + region tokens parsed from the affected line. */
	affectedRegions: readonly string[];
	/** Polygon boundary. */
	boundary: HazardBoundary;
	/** Convective phenomenon classification. */
	phenomenon: ConvectivePhenomenon;
	/** Storm motion, when stated. */
	movement: HazardMovement | null;
	/** Tops in flight level (e.g. 400 = FL400). null when not stated. */
	topsFL: number | null;
	/** Outlook block, when the product carries one. */
	outlook: ConvectiveOutlook | null;
	/** Original raw text. */
	raw: string;
}

/** Decoded NWS Severe Thunderstorm Warning. */
export interface SevereThunderstormWarning {
	kind: 'severe-thunderstorm-warning';
	severity: 'severe';
	/** Issuing WFO id, e.g. "KBOX". */
	office: string;
	/** Window. */
	validFrom: Date | null;
	validUntil: Date;
	/** Affected counties / zones (free text). */
	areaDescription: string;
	/** Polygon vertices in [lat, lon] (NWS native order). null when product
	 *  is a legacy zone-based warning with no polygon. */
	polygon: readonly (readonly [number, number])[] | null;
	/** Threat fields parsed from the bulletin's tag table. */
	maxWindMph: number | null;
	maxHailIn: number | null;
	tornadoPossible: boolean;
	/** Trailing free-text body. */
	narrative: string;
	raw: string;
}

/** Any hazard the decoder knows how to render. */
export type DecodedHazard = ConvectiveSigmet | SevereThunderstormWarning;
