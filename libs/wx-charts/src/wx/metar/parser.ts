/**
 * Minimal METAR string parser.
 *
 * Source of truth: Spike 03 (`spikes/wx-charts/03-metar-plot-grid/src/metar.ts`),
 * hardened for the library:
 *   - Returns `wind: null` (instead of throwing) on unparseable wind tokens
 *     and records a warning in `parsed.warnings` so the renderer can
 *     suppress the shaft and surface the issue in `meta.json.parser_warnings`.
 *   - Returns `visibilitySM: null` on unparseable visibility tokens with a
 *     warning entry; does NOT throw.
 *   - Returns `tempC` / `dewpointC` / `altimeterInHg` as `null` when the
 *     respective groups are missing.
 *   - Throws only when the body is structurally unparseable (no station
 *     ICAO, no DDhhmmZ group). Those are catastrophic failures the caller
 *     cannot recover from.
 *
 * Browser-safe: pure regex + arithmetic, no Node imports.
 */

import type { CloudLayer, ParsedMetar, SkyCover, WindGroup } from './types';

const WX_TOKEN_REGEX =
	/^([+-]|VC|RE)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+$/;

const STATION_REGEX = /^[A-Z][A-Z0-9]{3}$/;
const DT_REGEX = /^(\d{2})(\d{2})(\d{2})Z$/;
const WIND_REGEX = /^(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/;
const WIND_VARIABLE_DIRS_REGEX = /^\d{3}V\d{3}$/;
const VIS_FRACTION_REGEX = /^M?\d+(?:\/\d+)?SM$/;
const VIS_WHOLE_REGEX = /^\d+$/;
const VIS_FRACTION_FOLLOW_REGEX = /^\d+\/\d+SM$/;
const CLOUD_REGEX = /^(SKC|CLR|NSC|FEW|SCT|BKN|OVC)(\d{3})?(?:CB|TCU)?$/;
const VV_REGEX = /^VV(\d{3})$/;
const TEMP_DEW_REGEX = /^(M?\d{2})\/(M?\d{2})?$/;
const ALTIMETER_INHG_REGEX = /^A\d{4}$/;
const ALTIMETER_HPA_REGEX = /^Q\d{4}$/;

/**
 * Parse a single METAR string into the typed shape the chart-renderer
 * consumes. Throws only on a structurally-unparseable body (no station
 * identifier, no DDhhmmZ group). Other malformed groups emit warnings
 * and set the corresponding field to `null`.
 */
export function parseMetar(raw: string): ParsedMetar {
	const warnings: string[] = [];
	const trimmed = raw.replace(/\s+=\s*$/, '').trim();
	// Split off RMK section -- not parsed in v1.
	const beforeRmk = trimmed.split(/\bRMK\b/)[0]?.trim() ?? trimmed;
	const tokens = beforeRmk.split(/\s+/);

	let i = 0;

	// Optional METAR / SPECI / AMD / COR prefix.
	if (tokens[i] === 'METAR' || tokens[i] === 'SPECI') i += 1;
	if (tokens[i] === 'COR' || tokens[i] === 'AMD') i += 1;

	const station = tokens[i];
	if (station === undefined || !STATION_REGEX.test(station)) {
		throw new Error(`metar: expected 4-letter station identifier, got "${station ?? '(none)'}" in "${raw}"`);
	}
	i += 1;

	const dt = tokens[i]?.match(DT_REGEX);
	if (dt === null || dt === undefined) {
		throw new Error(`metar: expected DDhhmmZ group at token "${tokens[i] ?? '(none)'}" in "${raw}"`);
	}
	const day = Number(dt[1]);
	const hour = Number(dt[2]);
	const minute = Number(dt[3]);
	i += 1;

	// AUTO / COR modifier.
	if (tokens[i] === 'AUTO' || tokens[i] === 'COR') i += 1;

	// Wind group.
	let wind: WindGroup | null = null;
	const candidateWindToken = tokens[i];
	if (candidateWindToken !== undefined) {
		const wm = candidateWindToken.match(WIND_REGEX);
		if (wm !== null) {
			const dir = wm[1];
			const speedRaw = Number(wm[2]);
			const gustRaw = wm[3] !== undefined ? Number(wm[3]) : null;
			const unit = wm[4];
			const factor = unit === 'MPS' ? 1.94384 : 1;
			const speedKt = Math.round(speedRaw * factor);
			const gustKt = gustRaw !== null ? Math.round(gustRaw * factor) : null;
			const calm = dir === '000' && speedKt === 0;
			wind = {
				directionDeg: dir === 'VRB' ? null : Number(dir),
				speedKt,
				gustKt,
				variable: dir === 'VRB',
				calm,
			};
			i += 1;
			if (tokens[i]?.match(WIND_VARIABLE_DIRS_REGEX)) i += 1;
		} else if (/^\/{3,}KT$/.test(candidateWindToken) || candidateWindToken === '/////KT') {
			// Sensor-out wind report (e.g. `/////KT` from a MADIS 5-minute
			// report). Suppress the shaft and warn.
			warnings.push(`unparseable wind token '${candidateWindToken}' -- shaft suppressed`);
			i += 1;
		}
	}

	// Visibility.
	let visibilitySM: number | null = null;
	let cavok = false;
	if (tokens[i] === 'CAVOK') {
		cavok = true;
		visibilitySM = 10;
		i += 1;
	} else if (tokens[i]?.match(VIS_FRACTION_REGEX)) {
		const parsed = tryParseVisibility(tokens[i] ?? '');
		if (parsed === null) {
			warnings.push(`unparseable visibility token '${tokens[i]}'`);
		} else {
			visibilitySM = parsed;
		}
		i += 1;
	} else if (tokens[i]?.match(VIS_WHOLE_REGEX) && tokens[i + 1]?.match(VIS_FRACTION_FOLLOW_REGEX)) {
		const combined = `${tokens[i]} ${tokens[i + 1]}`;
		const parsed = tryParseVisibility(combined);
		if (parsed === null) {
			warnings.push(`unparseable visibility token '${combined}'`);
		} else {
			visibilitySM = parsed;
		}
		i += 2;
	}

	const weather: string[] = [];
	const clouds: CloudLayer[] = [];
	let tempC: number | null = null;
	let dewpointC: number | null = null;
	let altimeterInHg: number | null = null;

	for (; i < tokens.length; i += 1) {
		const t = tokens[i];
		if (t === undefined || t === '') continue;

		const cm = t.match(CLOUD_REGEX);
		if (cm !== null) {
			const cover = cm[1] as SkyCover;
			const heightFtAgl = cm[2] !== undefined ? Number(cm[2]) * 100 : null;
			clouds.push({ cover, heightFtAgl });
			continue;
		}
		const vvm = t.match(VV_REGEX);
		if (vvm !== null) {
			clouds.push({ cover: 'VV', heightFtAgl: Number(vvm[1]) * 100 });
			continue;
		}

		const td = t.match(TEMP_DEW_REGEX);
		if (td !== null) {
			tempC = parseTempPart(td[1] ?? '');
			dewpointC = td[2] !== undefined ? parseTempPart(td[2]) : null;
			continue;
		}

		if (ALTIMETER_INHG_REGEX.test(t)) {
			altimeterInHg = Number(t.slice(1)) / 100;
			continue;
		}
		if (ALTIMETER_HPA_REGEX.test(t)) {
			altimeterInHg = Number(t.slice(1)) * 0.02953;
			continue;
		}

		if (WX_TOKEN_REGEX.test(t)) {
			weather.push(t);
		}
		// Unknown token: skip silently. We don't warn -- METARs commonly
		// include locale-specific extension groups the spike ignored.
	}

	return {
		station,
		day,
		hour,
		minute,
		wind,
		visibilitySM,
		weather,
		clouds,
		tempC,
		dewpointC,
		altimeterInHg,
		cavok,
		raw: trimmed,
		warnings,
	};
}

function tryParseVisibility(s: string): number | null {
	const stripped = s.replace(/SM$/, '');
	if (stripped.startsWith('M')) {
		const inner = stripped.slice(1);
		const v = fractionToNumber(inner);
		return v === null ? null : v / 2;
	}
	return fractionToNumber(stripped);
}

function fractionToNumber(s: string): number | null {
	if (s.length === 0) return null;
	if (s.includes(' ')) {
		const parts = s.split(' ');
		const whole = Number(parts[0]);
		if (Number.isNaN(whole)) return null;
		const frac = parts[1] !== undefined ? fractionToNumber(parts[1]) : null;
		if (frac === null) return null;
		return whole + frac;
	}
	if (s.includes('/')) {
		const parts = s.split('/');
		const n = Number(parts[0]);
		const d = Number(parts[1]);
		if (Number.isNaN(n) || Number.isNaN(d) || d === 0) return null;
		return n / d;
	}
	const v = Number(s);
	if (Number.isNaN(v)) return null;
	return v;
}

function parseTempPart(s: string): number {
	if (s.startsWith('M')) return -Number(s.slice(1));
	return Number(s);
}
