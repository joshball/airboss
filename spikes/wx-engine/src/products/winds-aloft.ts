/**
 * Spike 01 -- Layer 2 Winds & Temps Aloft (FB) derivation.
 *
 * Walk truth.upperLevel.windByAltitude -> emit one row per station for
 * the canonical FAA FB altitude set. Format as a fixed-width FB
 * bulletin and round-trip via parseFbGrid.
 *
 * Spike 01 uses the truth's mean wind-by-altitude (no spatial variation
 * across the region) -- production would interpolate the upper-level
 * field at each station's lon/lat.
 */

import { parseFbGrid, type ParsedFbGrid } from '@ab/wx-charts';
import type { TruthModel } from '../truth/types';

const STANDARD_ALTITUDES = [3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000];

export interface DerivedFbGrid {
	parsed: ParsedFbGrid;
	raw: string;
}

export function deriveFbGrid(truth: TruthModel, stationIcaos: string[]): DerivedFbGrid {
	const dt = new Date(truth.validAt);
	const day = String(dt.getUTCDate()).padStart(2, '0');
	const hour = String(dt.getUTCHours()).padStart(2, '0');
	const validZ = `${day}${hour}00Z`;
	const basedOnDt = new Date(dt.getTime() - 6 * 3600_000);
	const basedOnZ = `${String(basedOnDt.getUTCDate()).padStart(2, '0')}${String(basedOnDt.getUTCHours()).padStart(2, '0')}00Z`;

	const lines: string[] = [];
	lines.push(`DATA BASED ON ${basedOnZ}`);
	lines.push(`VALID ${validZ}   FOR USE ${hour}00-${String((Number(hour) + 4) % 24).padStart(2, '0')}00Z. TEMPS NEG ABV 24000`);
	lines.push('');
	// FT header line. Spec sample uses 3-letter station codes (no leading K).
	// The wx-charts parser splits on whitespace; emit the header with simple
	// spaces between altitude labels.
	const altHeader = `   FT  ${STANDARD_ALTITUDES.map((a) => String(a).padStart(6, ' ')).join('  ')}`;
	lines.push(altHeader);

	const wind = truth.upperLevel.windByAltitude;
	for (const icao of stationIcaos) {
		const station = truth.stations[icao];
		if (station === undefined) continue;
		const code = icao.length === 4 && icao.startsWith('K') ? icao.slice(1) : icao;
		const elevFt = station.elevationFt;

		const rowParts: string[] = [];
		for (const alt of STANDARD_ALTITUDES) {
			// Skip 3000 ft when station elevation is high (>2000 ft AGL would
			// mean 3000 ft MSL is below the station).
			if (alt - elevFt < 1500) {
				// Emit a placeholder of the right column width so subsequent
				// tokens still line up visually. The parser tolerates blanks.
				rowParts.push('      ');
				continue;
			}
			const w = wind.find((r) => r.altitudeFt === alt);
			if (w === undefined) {
				rowParts.push('      ');
				continue;
			}
			rowParts.push(formatFbToken(w.meanDirDeg, w.meanSpeedKt, w.meanTempC, alt).padStart(6, ' '));
		}
		lines.push(`${code.padEnd(3)} ${rowParts.join('  ')}`);
	}

	const raw = lines.join('\n');
	const parsed = parseFbGrid(raw);
	return { parsed, raw };
}

function formatFbToken(dirDeg: number, speedKt: number, tempC: number, altitudeFt: number): string {
	// Direction encoded in tens of degrees. Nearest 10.
	let dirCode = Math.round(dirDeg / 10) % 36;
	if (dirCode === 0) dirCode = 36;
	let speedEnc = speedKt;
	if (speedKt > 99) {
		dirCode += 50;
		speedEnc = speedKt - 100;
	}
	const dirStr = String(dirCode).padStart(2, '0');
	const speedStr = String(Math.min(99, speedEnc)).padStart(2, '0');
	if (altitudeFt < 4500) {
		// Below 5000 ft: no temp.
		return `${dirStr}${speedStr}`;
	}
	// Temp encoded as 2 digits; sign explicit below FL240, implied negative above.
	let tempStr: string;
	if (altitudeFt > 24000) {
		// Implied negative; magnitude.
		tempStr = String(Math.min(99, Math.abs(Math.round(tempC)))).padStart(2, '0');
	} else if (tempC < 0) {
		tempStr = `-${String(Math.min(99, Math.abs(Math.round(tempC)))).padStart(2, '0')}`;
	} else {
		tempStr = `+${String(Math.min(99, Math.round(tempC))).padStart(2, '0')}`;
	}
	return `${dirStr}${speedStr}${tempStr}`;
}
