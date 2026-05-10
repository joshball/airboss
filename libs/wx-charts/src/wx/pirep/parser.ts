/**
 * PIREP (Pilot Report) string parser.
 *
 * Source of truth: FAA AIM Section 7-1-21 + FMH-1 Chapter 8. PIREP form:
 *
 *   <STATION> UA|UUA /OV <position> /TM <hhmm> /FL<altitude> /TP <type>
 *               /SK <sky-cover groups> /WX <weather> /TA <temp>
 *               /WV <wind> /TB <turb> /IC <icing> /RM <remarks>
 *
 * Each `/XX` block is optional. The order is FAA-recommended but not
 * enforced; the parser splits on `/` and matches each block by its
 * leading two-letter code.
 *
 * The parser is permissive: unparseable groups emit a warning and set
 * the corresponding field to `null`; only a missing station identifier
 * or missing UA/UUA marker throws.
 *
 * Browser-safe: pure regex + arithmetic, no Node imports.
 */

import type {
	IcingIntensity,
	IcingReport,
	IcingType,
	ParsedPirep,
	PirepCloudLayer,
	PirepKind,
	PirepLocation,
	TurbulenceIntensity,
	TurbulenceReport,
} from './types';

const STATION_REGEX = /^[A-Z][A-Z0-9]{2,4}$/;
const KIND_REGEX = /^(UA|UUA)$/;
// Station portion is 3 or 4 chars; the trailing radial+distance is all
// digits, so the optional 4th character must be a letter to prevent it
// from absorbing the leading radial digit.
// `CLE090030` -> station `CLE`, radial `090`, distance `030`.
// `KCLE090030` (rare) -> station `KCLE`, radial `090`, distance `030`.
const POSITION_RAD_DIST_REGEX = /^([A-Z][A-Z]{2}[A-Z]?)(\d{3})(\d{2,3})$/;
const POSITION_STATION_REGEX = /^([A-Z][A-Z0-9]{2,3})$/;
const TIME_REGEX = /^(\d{4})$/;
const FL_REGEX = /^FL?(\d{2,3})$/;
const TURB_INTENSITY_REGEX = /(NEG|LGT|MOD|SEV|EXTM)/;
const ICING_INTENSITY_REGEX = /(NEG|TRC|LGT|MOD|SEV)/;
const ICING_TYPE_REGEX = /(RIME|CLR|MX)/;
const ALT_BAND_REGEX = /(\d{2,3})\s*-\s*(\d{2,3})/;
const ALT_SINGLE_REGEX = /^(\d{2,3})$/;
const WV_REGEX = /^(\d{3})(\d{2,3})(?:KT)?$/;
const TEMP_REGEX = /^(M|-)?(\d{1,2})$/;
const SKY_LAYER_REGEX = /^(CLR|SKC|FEW|SCT|BKN|OVC|OVX)(\d{2,3})?(?:-(\d{2,3}))?$/;

/**
 * Parse a PIREP body into the typed shape the chart-renderer consumes.
 * Throws only on a structurally-unparseable body (no station + UA/UUA
 * marker). Other malformed groups emit warnings and set the field to
 * `null`.
 */
export function parsePirep(raw: string): ParsedPirep {
	const warnings: string[] = [];
	const trimmed = raw.replace(/\s+/g, ' ').trim();

	// Split on '/' but keep the station + kind prefix together.
	// Pattern: `KCLE UA /OV ... /TM ... /...` -> ['KCLE UA ', 'OV ...', 'TM ...', ...]
	const parts = trimmed.split('/').map((s) => s.trim());
	if (parts.length === 0 || parts[0] === undefined) {
		throw new Error(`pirep: empty body in "${raw}"`);
	}
	const headerTokens = parts[0].split(/\s+/);
	const station = headerTokens[0];
	const kindToken = headerTokens[1];
	if (station === undefined || !STATION_REGEX.test(station)) {
		throw new Error(`pirep: expected leading station identifier in "${raw}"`);
	}
	if (kindToken === undefined || !KIND_REGEX.test(kindToken)) {
		throw new Error(`pirep: expected UA or UUA marker in "${raw}"`);
	}
	const kind = kindToken as PirepKind;

	const blocks = new Map<string, string>();
	for (let i = 1; i < parts.length; i += 1) {
		const block = parts[i];
		if (block === undefined || block.length < 2) continue;
		const code = block.slice(0, 2).toUpperCase();
		const body = block.slice(2).trim();
		blocks.set(code, body);
	}

	const ovBody = blocks.get('OV') ?? '';
	const location = parseLocation(ovBody, warnings);

	const tmBody = blocks.get('TM') ?? '';
	let timeHhmmZ: number | null = null;
	if (tmBody.length > 0) {
		const m = tmBody.match(TIME_REGEX);
		if (m === null) {
			warnings.push(`unparseable TM token '${tmBody}'`);
		} else {
			timeHhmmZ = Number(m[1]);
		}
	}

	const flBody = blocks.get('FL') ?? '';
	let altitudeFt: number | null = null;
	if (flBody.length > 0) {
		if (flBody === 'DURC' || flBody === 'DURD' || flBody === 'UNKN') {
			// During-climb / during-descent / unknown -> altitude not reported.
		} else {
			const m = flBody.match(FL_REGEX) ?? `FL${flBody}`.match(FL_REGEX);
			if (m === null) {
				warnings.push(`unparseable FL token '${flBody}'`);
			} else {
				altitudeFt = Number(m[1]) * 100;
			}
		}
	}

	const aircraftType = (blocks.get('TP') ?? '').length > 0 ? ((blocks.get('TP') ?? '').split(/\s+/)[0] ?? null) : null;

	const skyCover = parseSkyCover(blocks.get('SK') ?? '', warnings);

	const weather = (blocks.get('WX') ?? '').split(/\s+/).filter((s) => s.length > 0);

	const taBody = blocks.get('TA') ?? '';
	let temperatureC: number | null = null;
	if (taBody.length > 0) {
		const m = taBody.match(TEMP_REGEX);
		if (m === null) {
			warnings.push(`unparseable TA token '${taBody}'`);
		} else {
			temperatureC = (m[1] === undefined ? 1 : -1) * Number(m[2]);
		}
	}

	const wvBody = blocks.get('WV') ?? '';
	let wind: ParsedPirep['wind'] = null;
	if (wvBody.length > 0) {
		const m = wvBody.match(WV_REGEX);
		if (m === null) {
			warnings.push(`unparseable WV token '${wvBody}'`);
		} else {
			wind = { directionDeg: Number(m[1]), speedKt: Number(m[2]) };
		}
	}

	const turbulence = parseTurbulence(blocks.get('TB') ?? '', warnings);
	const icing = parseIcing(blocks.get('IC') ?? '', warnings);
	const remarks = (blocks.get('RM') ?? '').length > 0 ? (blocks.get('RM') ?? '') : null;

	return {
		station,
		kind,
		location,
		timeHhmmZ,
		altitudeFt,
		aircraftType,
		skyCover,
		weather,
		temperatureC,
		wind,
		turbulence,
		icing,
		remarks,
		raw: trimmed,
		warnings,
	};
}

function parseLocation(body: string, warnings: string[]): PirepLocation {
	if (body.length === 0) {
		return { raw: '', station: null, radialDeg: null, distanceNm: null };
	}
	const compact = body.replace(/\s+/g, '');
	const radial = compact.match(POSITION_RAD_DIST_REGEX);
	if (radial !== null) {
		return {
			raw: body,
			station: radial[1] ?? null,
			radialDeg: Number(radial[2]),
			distanceNm: Number(radial[3]),
		};
	}
	const station = compact.match(POSITION_STATION_REGEX);
	if (station !== null) {
		return { raw: body, station: station[1] ?? null, radialDeg: null, distanceNm: null };
	}
	warnings.push(`unparseable OV token '${body}'`);
	return { raw: body, station: null, radialDeg: null, distanceNm: null };
}

function parseSkyCover(body: string, warnings: string[]): PirepCloudLayer[] {
	if (body.length === 0) return [];
	const layers: PirepCloudLayer[] = [];
	const tokens = body.split(/\s+/);
	for (const t of tokens) {
		if (t.length === 0) continue;
		const m = t.match(SKY_LAYER_REGEX);
		if (m === null) {
			warnings.push(`unparseable SK token '${t}'`);
			continue;
		}
		const cover = m[1] as PirepCloudLayer['cover'];
		const baseFt = m[2] !== undefined ? Number(m[2]) * 100 : null;
		const topFt = m[3] !== undefined ? Number(m[3]) * 100 : null;
		layers.push({ cover, baseFt, topFt });
	}
	return layers;
}

function parseTurbulence(body: string, warnings: string[]): TurbulenceReport | null {
	if (body.length === 0) return null;
	const intensity = body.match(TURB_INTENSITY_REGEX);
	if (intensity === null) {
		warnings.push(`unparseable TB token '${body}'`);
		return null;
	}
	const band = parseAltBand(body);
	return {
		intensity: intensity[1] as TurbulenceIntensity,
		altitudeBandFt: band,
		raw: body,
	};
}

function parseIcing(body: string, warnings: string[]): IcingReport | null {
	if (body.length === 0) return null;
	const intensity = body.match(ICING_INTENSITY_REGEX);
	if (intensity === null) {
		warnings.push(`unparseable IC token '${body}'`);
		return null;
	}
	const type = body.match(ICING_TYPE_REGEX);
	const band = parseAltBand(body);
	return {
		intensity: intensity[1] as IcingIntensity,
		type: type !== null ? (type[1] as IcingType) : null,
		altitudeBandFt: band,
		raw: body,
	};
}

function parseAltBand(body: string): { min: number | null; max: number | null } | null {
	const range = body.match(ALT_BAND_REGEX);
	if (range !== null) {
		return { min: Number(range[1]) * 100, max: Number(range[2]) * 100 };
	}
	const tokens = body.split(/\s+/);
	for (const t of tokens) {
		const m = t.match(ALT_SINGLE_REGEX);
		if (m !== null) return { min: Number(m[1]) * 100, max: null };
	}
	return null;
}
