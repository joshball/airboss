/**
 * FB (Winds and Temperatures Aloft) token-walker. One annotation for the
 * header context, then one per station + one per altitude row.
 */

import type { ParsedFbGrid } from '@ab/wx-charts';
import type { TruthModel } from '@ab/wx-engine';
import type { TokenAnnotation } from './types';

export function explainFb(parsed: ParsedFbGrid, truth?: TruthModel): TokenAnnotation[] {
	const out: TokenAnnotation[] = [];
	out.push({
		token: 'FB',
		family: 'fb-bulletin',
		decode: 'Winds and Temperatures Aloft Forecast (FB) - issued by AWC, model-derived per-altitude forecast',
	});
	if (parsed.validAt) {
		out.push({
			token: parsed.validAt,
			family: 'fb-valid',
			decode: `valid at ${parsed.validAt}`,
		});
	}
	if (parsed.basedOn) {
		out.push({
			token: parsed.basedOn,
			family: 'fb-based-on',
			decode: `model run: ${parsed.basedOn}`,
		});
	}
	for (const station of parsed.stations) {
		out.push({
			token: station.station,
			family: 'fb-station',
			decode: `station ${station.station}`,
		});
		for (const row of station.rows) {
			let decode: string;
			if (row.directionDeg === null) {
				decode = `${row.altitudeFt} ft: light and variable, ${row.temperatureC !== null ? `${row.temperatureC} deg C` : 'no temp'}`;
			} else {
				const tempLine = row.temperatureC !== null ? `, ${row.temperatureC} deg C` : '';
				decode = `${row.altitudeFt} ft: from ${row.directionDeg} deg true at ${row.speedKt} kt${tempLine}`;
			}
			out.push({
				token: row.raw,
				family: 'fb-row',
				decode,
			});
		}
	}
	void truth;
	return out;
}
