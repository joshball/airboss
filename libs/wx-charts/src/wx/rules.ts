/**
 * Pure derivation rules used by every chart that consumes parsed METAR
 * (and PIREP-derived approximations of) data.
 *
 * Source of truth: Spike 03 (`spikes/wx-charts/03-metar-plot-grid/src/metar.ts`)
 * and FAA AIM Section 7-1-9 / FAR 91 visibility-and-cloud minimums for
 * flight-category boundaries.
 *
 * The two functions are independent: `ceilingFtAgl` reduces a list of
 * cloud layers to the lowest broken/overcast/obscured layer; `flightCategory`
 * combines that ceiling with the visibility into the FAA four-tier
 * VFR/MVFR/IFR/LIFR enum.
 *
 * Browser-safe: pure arithmetic + iteration, no Node imports.
 */

import { FAA_FLIGHT_CATEGORIES, type FaaFlightCategory } from '@ab/constants';
import type { CloudLayer, ParsedMetar, SkyCover } from './metar/types';

/**
 * Lowest BKN / OVC / VV layer height in feet AGL, or `null` if no broken,
 * overcast, or obscured layer is reported. Ignores layers with `null`
 * heightFtAgl (defensive against an unparseable height token).
 */
export function ceilingFtAgl(clouds: readonly CloudLayer[]): number | null {
	let lowest: number | null = null;
	for (const c of clouds) {
		if (c.cover !== 'BKN' && c.cover !== 'OVC' && c.cover !== 'VV') continue;
		if (c.heightFtAgl === null) continue;
		if (lowest === null || c.heightFtAgl < lowest) lowest = c.heightFtAgl;
	}
	return lowest;
}

/**
 * Highest reported cloud-cover summary token. Used by the station-model
 * cloud-cover circle when authors prefer the `summary` rendering over
 * the `stack` (per-layer) rendering. SKC/CLR/NSC are equivalent.
 */
export function summarizeCover(clouds: readonly CloudLayer[]): SkyCover {
	if (clouds.length === 0) return 'SKC';
	const order: Record<SkyCover, number> = { SKC: 0, CLR: 0, NSC: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4, VV: 5 };
	let max: SkyCover = 'SKC';
	for (const c of clouds) {
		if (order[c.cover] > order[max]) max = c.cover;
	}
	return max;
}

/**
 * FAA four-tier flight category from ceiling + visibility:
 *
 * | Category | Ceiling (ft AGL) | Visibility (SM)         |
 * | -------- | ---------------- | ----------------------- |
 * | LIFR     | < 500            | OR < 1                  |
 * | IFR      | 500-1000         | OR 1 to less than 3     |
 * | MVFR     | 1000-3000        | OR 3 to 5 (inclusive)   |
 * | VFR      | > 3000           | AND > 5                 |
 *
 * `null` ceiling = unlimited (treated as +Infinity); `null` visibility =
 * unlimited (treated as +Infinity). The FAA boundaries themselves are
 * the source of truth -- we don't editorialize.
 */
export function flightCategory(ceilingFt: number | null, visibilitySM: number | null): FaaFlightCategory {
	const c = ceilingFt ?? Number.POSITIVE_INFINITY;
	const v = visibilitySM ?? Number.POSITIVE_INFINITY;
	if (c < 500 || v < 1) return FAA_FLIGHT_CATEGORIES.LIFR;
	if (c < 1000 || v < 3) return FAA_FLIGHT_CATEGORIES.IFR;
	if (c <= 3000 || v <= 5) return FAA_FLIGHT_CATEGORIES.MVFR;
	return FAA_FLIGHT_CATEGORIES.VFR;
}

/**
 * Convenience: derive flight category directly from a parsed METAR.
 * Equivalent to `flightCategory(ceilingFtAgl(parsed.clouds), parsed.visibilitySM)`.
 */
export function computeFlightCategory(parsed: Pick<ParsedMetar, 'clouds' | 'visibilitySM'>): FaaFlightCategory {
	return flightCategory(ceilingFtAgl(parsed.clouds), parsed.visibilitySM);
}

/**
 * Celsius -> Fahrenheit, rounded to nearest integer. Surfaces in the
 * station-model temperature/dewpoint labels.
 */
export function celsiusToFahrenheit(c: number): number {
	return Math.round((c * 9) / 5 + 32);
}
