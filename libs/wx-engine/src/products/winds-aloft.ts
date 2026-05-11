/**
 * Layer-2 Winds & Temps Aloft (FB) derivation.
 *
 * Pure function: `(TruthModel, stationIcaos) -> DerivedFbGrid`. Walks
 * `truth.upperLevel.windByAltitude` and emits one row per station per
 * standard FAA altitude (3000, 6000, 9000, 12000, 18000, 24000, 30000,
 * 34000, 39000 ft MSL). Formats per the FAA fixed-width FB bulletin grammar
 * and round-trips through `parseFbGrid` from `@ab/wx-charts` with zero
 * warnings.
 *
 * High-elevation rule: a row is skipped when the standard altitude is less
 * than 1500 ft above the station elevation -- per FAA FB convention, winds
 * at AGL below ~1500 ft are not forecast. The skipped slot becomes a blank
 * column so subsequent rows still line up visually.
 *
 * V1 uses the truth's mean wind-by-altitude with no per-station spatial
 * variation. S2/S3 would interpolate the upper-level field at each
 * station's lon/lat.
 *
 * Lifted from the spike's pre-retirement `spikes/wx-engine/src/products/winds-aloft.ts`
 * (PR #801 -- now retired).
 */

import { parseFbGrid } from '@ab/wx-charts';
import type { TruthModel } from '../truth/types';
import type { DerivedFbGrid } from './types';

/** Canonical FAA FB altitudes (ft MSL). */
const STANDARD_ALTITUDES = [3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000] as const;
/** Minimum AGL (ft) above station elevation for a row to be emitted. */
const MIN_AGL_FOR_EMIT_FT = 1500;
/** Altitude below which the row omits the temperature column (per FAA). */
const NO_TEMP_BELOW_FT = 4500;
/** Altitude above which the temperature sign is implied negative (per FAA). */
const IMPLIED_NEG_TEMP_ABOVE_FT = 24000;
/** FAA "wind over 99 kt" direction offset (encoded direction = (deg/10) + 50). */
const HIGH_WIND_DIR_OFFSET = 50;

/**
 * Derive an FB bulletin covering the given stations. Each station emits one
 * row per standard altitude (modulo the high-elevation skip rule). Rows use
 * the FAA fixed-width encoding; the bulletin re-parses cleanly.
 */
export function deriveFbGrid(truth: TruthModel, stationIcaos: string[]): DerivedFbGrid {
	const dt = new Date(truth.validAt);
	const day = String(dt.getUTCDate()).padStart(2, '0');
	const hour = String(dt.getUTCHours()).padStart(2, '0');
	const validZ = `${day}${hour}00Z`;
	const basedOnDt = new Date(dt.getTime() - 6 * 3_600_000);
	const basedOnZ = `${String(basedOnDt.getUTCDate()).padStart(2, '0')}${String(basedOnDt.getUTCHours()).padStart(2, '0')}00Z`;

	const lines: string[] = [];
	lines.push(`DATA BASED ON ${basedOnZ}`);
	lines.push(
		`VALID ${validZ}   FOR USE ${hour}00-${String((Number(hour) + 4) % 24).padStart(2, '0')}00Z. TEMPS NEG ABV 24000`,
	);
	lines.push('');
	// FT header. The parser splits on whitespace; columns are 6 chars wide.
	const altHeader = `   FT  ${STANDARD_ALTITUDES.map((a) => String(a).padStart(6, ' ')).join('  ')}`;
	lines.push(altHeader);

	const wind = truth.upperLevel.windByAltitude;
	for (const icao of stationIcaos) {
		const station = truth.stations[icao];
		if (station === undefined) continue;
		// Bulletins use the 3-letter station code (drop the leading K).
		const code = icao.length === 4 && icao.startsWith('K') ? icao.slice(1) : icao;
		const elevFt = station.elevationFt;

		const rowParts: string[] = [];
		for (const alt of STANDARD_ALTITUDES) {
			// Skip the row when the altitude is below ~1500 ft AGL.
			if (alt - elevFt < MIN_AGL_FOR_EMIT_FT) {
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
	if (parsed.warnings.length > 0) {
		throw new Error(
			`deriveFbGrid: emitted FB bulletin re-parses with warnings: ${parsed.warnings.join('; ')}\nraw:\n${raw}`,
		);
	}
	return { raw, parsed };
}

function formatFbToken(dirDeg: number, speedKt: number, tempC: number, altitudeFt: number): string {
	// Direction encoded in tens of degrees (nearest 10). 360 emits as "36".
	let dirCode = Math.round(dirDeg / 10) % 36;
	if (dirCode === 0) dirCode = 36;
	let speedEnc = speedKt;
	if (speedKt > 99) {
		dirCode += HIGH_WIND_DIR_OFFSET;
		speedEnc = speedKt - 100;
	}
	const dirStr = String(dirCode).padStart(2, '0');
	const speedStr = String(Math.min(99, speedEnc)).padStart(2, '0');
	if (altitudeFt < NO_TEMP_BELOW_FT) {
		// Below ~5000 ft: no temperature.
		return `${dirStr}${speedStr}`;
	}
	let tempStr: string;
	if (altitudeFt > IMPLIED_NEG_TEMP_ABOVE_FT) {
		// Implied negative; magnitude only.
		tempStr = String(Math.min(99, Math.abs(Math.round(tempC)))).padStart(2, '0');
	} else if (tempC < 0) {
		tempStr = `-${String(Math.min(99, Math.abs(Math.round(tempC)))).padStart(2, '0')}`;
	} else {
		tempStr = `+${String(Math.min(99, Math.round(tempC))).padStart(2, '0')}`;
	}
	return `${dirStr}${speedStr}${tempStr}`;
}
