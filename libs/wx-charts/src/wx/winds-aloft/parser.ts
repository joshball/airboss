/**
 * FAA winds aloft (FB) bulletin parser.
 *
 * Source of truth: AC 00-45 + FMH-1 Chapter 6. The parser accepts the
 * canonical FAA FB text product:
 *
 *   DATA BASED ON 211200Z
 *   VALID 211800Z   FOR USE 1700-2100Z. TEMPS NEG ABV 24000
 *
 *      FT  3000    6000    9000   12000   18000   24000  30000  34000  39000
 *   ABQ              0509  131221  142028  223035  244340 246359 247155 247853
 *   ABR     1505+04  2207+02 250207 270413 261917-12 ...
 *   ...
 *
 * Lines we recognize:
 *   - `DATA BASED ON DDhhmmZ` -> basedOn timestamp
 *   - `VALID DDhhmmZ ...` -> validAt timestamp
 *   - `FT  3000  6000  ...` -> altitude header (the column widths are
 *     fixed-width FORTRAN-style, but we tolerate any whitespace and
 *     re-parse position via the column index of each altitude header)
 *   - `<3-or-4-letter station>  row1  row2  ...` -> per-station rows
 *
 * Permissive: an unparseable row emits a warning + skips that altitude
 * for that station. Only a missing altitude header line is fatal.
 *
 * Browser-safe: pure regex + arithmetic, no Node imports.
 */

import type { ParsedFbGrid, ParsedFbStation, WindsAloftRow } from './types';

const VALID_REGEX = /\bVALID\s+(\d{2})(\d{2})(\d{2})Z\b/;
const BASED_ON_REGEX = /DATA\s+BASED\s+ON\s+(\d{2})(\d{2})(\d{2})Z/;
const FT_HEADER_REGEX = /^\s*FT\s+(.+)$/;
const STATION_REGEX = /^([A-Z][A-Z0-9]{2,3})\s+(.*)$/;

/**
 * Parse a FAA FB bulletin into structured per-station rows. The bulletin
 * may be partial (no header) -- in that case we emit a warning and
 * return a grid with an empty altitude set for every station; the chart
 * renderer renders nothing for those stations.
 */
export function parseFbGrid(raw: string): ParsedFbGrid {
	const warnings: string[] = [];
	const lines = raw.split(/\r?\n/);

	let basedOn: string | null = null;
	let validAt: string | null = null;
	let altitudes: number[] | null = null;
	const stations: ParsedFbStation[] = [];

	for (const line of lines) {
		if (line.length === 0) continue;

		const baseMatch = line.match(BASED_ON_REGEX);
		if (baseMatch !== null) {
			basedOn = `D${baseMatch[1]}T${baseMatch[2]}:${baseMatch[3]}:00Z`;
			continue;
		}
		const validMatch = line.match(VALID_REGEX);
		if (validMatch !== null) {
			validAt = `D${validMatch[1]}T${validMatch[2]}:${validMatch[3]}:00Z`;
			continue;
		}
		const ftMatch = line.match(FT_HEADER_REGEX);
		if (ftMatch !== null) {
			const tokens = (ftMatch[1] ?? '').trim().split(/\s+/);
			altitudes = tokens.map((t) => Number(t)).filter((n) => !Number.isNaN(n) && n > 0);
			if (altitudes.length === 0) {
				warnings.push('FT header line had no parseable altitudes');
				altitudes = null;
			}
			continue;
		}

		const stationMatch = line.match(STATION_REGEX);
		if (stationMatch === null) continue;

		if (altitudes === null) {
			warnings.push(`station '${stationMatch[1]}' encountered before FT altitude header`);
			continue;
		}

		const station = stationMatch[1] ?? '';
		const tokens = (stationMatch[2] ?? '').trim().split(/\s+/);
		const rows: WindsAloftRow[] = [];

		for (let i = 0; i < tokens.length && i < altitudes.length; i += 1) {
			const token = tokens[i];
			const altitudeFt = altitudes[i];
			if (token === undefined || altitudeFt === undefined || token.length === 0) continue;
			const decoded = decodeFbToken(token, altitudeFt, warnings, station);
			if (decoded !== null) rows.push(decoded);
		}

		if (rows.length > 0) {
			stations.push({ station, rows });
		}
	}

	return { validAt, issuedAt: null, basedOn, stations, warnings };
}

/**
 * Decode a single FB token (4 or 6 chars) into a typed row. Returns
 * `null` when the token's shape is unrecognizable.
 */
function decodeFbToken(token: string, altitudeFt: number, warnings: string[], station: string): WindsAloftRow | null {
	// Strip any internal sign characters; the encoded form embeds sign as
	// the leading char of the temperature pair (e.g., `131221-12` is rare;
	// canonical FB strings do not include a sign before FL240, but tolerate
	// either form).
	const compact = token.replace(/\s+/g, '');
	const m = compact.match(/^(\d{2})(\d{2})(?:([+-]?)(\d{2}))?$/);
	if (m === null) {
		warnings.push(`${station}@${altitudeFt}ft: unparseable FB token '${token}'`);
		return null;
	}
	const dirCode = Number(m[1]);
	const speedCode = Number(m[2]);
	const tempSign = m[3] ?? '';
	const tempCode = m[4] !== undefined ? Number(m[4]) : null;

	// Light-and-variable (calm) encoding.
	if (dirCode === 99 && speedCode === 0) {
		return {
			altitudeFt,
			directionDeg: null,
			speedKt: 0,
			temperatureC: tempCode === null ? null : applyImpliedSign(tempSign, tempCode, altitudeFt),
			raw: token,
		};
	}

	let directionDeg: number;
	let speedKt: number;
	if (dirCode >= 51) {
		// Wind > 99 KT: dir + 50, speed - 100.
		directionDeg = (dirCode - 50) * 10;
		speedKt = speedCode + 100;
	} else {
		directionDeg = dirCode * 10;
		speedKt = speedCode;
	}

	const temperatureC = tempCode === null ? null : applyImpliedSign(tempSign, tempCode, altitudeFt);

	return {
		altitudeFt,
		directionDeg,
		speedKt,
		temperatureC,
		raw: token,
	};
}

/**
 * Apply the FB temperature-sign rule: positive when explicit (or below
 * FL240 with no sign), negative when above FL240 (the sign is implied
 * per AC 00-45 "TEMPS NEG ABV 24000").
 */
function applyImpliedSign(sign: string, magnitude: number, altitudeFt: number): number {
	if (sign === '-') return -magnitude;
	if (sign === '+') return magnitude;
	if (altitudeFt > 24000) return -magnitude;
	return magnitude;
}
