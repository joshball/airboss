/**
 * Flight-category classification.
 *
 * Maps a ceiling + visibility pair to the FAA VFR / MVFR / IFR / LIFR
 * category. Pure -- browser-safe; re-exported as a value from both
 * barrels (the renderer colors chips by category).
 *
 * Thresholds per the FAA flight-category definition:
 *  - LIFR: ceiling < 500 ft AND/OR visibility < 1 SM
 *  - IFR:  ceiling 500-999 ft AND/OR visibility 1 to < 3 SM
 *  - MVFR: ceiling 1000-3000 ft AND/OR visibility 3-5 SM
 *  - VFR:  ceiling > 3000 ft AND visibility > 5 SM
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` D.2.
 */

import type { FlightCategory } from './types';

/** A parsed cloud layer. */
export interface CloudLayer {
	cover: string;
	heightFtAgl: number;
}

/**
 * The lowest ceiling (broken or overcast layer) in feet AGL. Returns
 * `Infinity` when there is no ceiling layer (scattered / few / clear).
 */
export function lowestCeilingFtAgl(clouds: ReadonlyArray<CloudLayer>): number {
	let ceiling = Number.POSITIVE_INFINITY;
	for (const layer of clouds) {
		if ((layer.cover === 'BKN' || layer.cover === 'OVC' || layer.cover === 'VV') && layer.heightFtAgl < ceiling) {
			ceiling = layer.heightFtAgl;
		}
	}
	return ceiling;
}

/**
 * Classify a ceiling (ft AGL) + visibility (statute miles) pair into the
 * FAA flight category. The worse of the two drives the result.
 */
export function classifyFlightCategory(ceilingFtAgl: number, visibilitySM: number): FlightCategory {
	const byCeiling: FlightCategory =
		ceilingFtAgl < 500 ? 'LIFR' : ceilingFtAgl < 1000 ? 'IFR' : ceilingFtAgl <= 3000 ? 'MVFR' : 'VFR';
	const byVis: FlightCategory =
		visibilitySM < 1 ? 'LIFR' : visibilitySM < 3 ? 'IFR' : visibilitySM <= 5 ? 'MVFR' : 'VFR';
	// The worse (more restrictive) of the two wins.
	const rank: Record<FlightCategory, number> = { VFR: 0, MVFR: 1, IFR: 2, LIFR: 3 };
	return rank[byCeiling] >= rank[byVis] ? byCeiling : byVis;
}
