/**
 * TAF (Terminal Aerodrome Forecast) parser.
 *
 * Spec source: AIM 7-1-29, AC 00-45H Ch 5 TAF section, FAA Order 7900.5
 * (Surface Weather Observing -- METAR / TAF formatting authority).
 *
 * # Strategy
 *
 * 1. Tokenize on whitespace (skipping `=` terminators).
 * 2. Read header tokens: optional `TAF`/`AMD`/`COR`, station, `DDhhmmZ`
 *    issuance group, `DDHH/DDHH` valid-period group.
 * 3. Walk the rest, splitting on TAF change-group keywords (`FM`,
 *    `BECMG`, `TEMPO`, `PROB30`, `PROB40`) into per-period token streams.
 * 4. Decode each period independently using a METAR-shaped decoder
 *    (wind / visibility / weather / clouds / CAVOK).
 * 5. Resolve all DDhh / DDHH boundaries against the issuance time so the
 *    output carries absolute UTC ISO timestamps.
 *
 * The trailing period's `end` is the TAF `validTo`; an FM/INITIAL
 * period's `end` is the start of the next FM (or `validTo`). BECMG /
 * TEMPO / PROB periods always carry their own explicit `[start, end]`
 * window.
 *
 * Browser-safe: pure regex + arithmetic, no Node imports.
 */

import type { CloudLayer, SkyCover, WindGroup } from '../metar/types';
import type { ParsedTaf, TafChangeKind, TafPeriod } from './types';

const STATION_REGEX = /^[A-Z][A-Z0-9]{3}$/;
const ISSUE_REGEX = /^(\d{2})(\d{2})(\d{2})Z$/;
const VALID_PERIOD_REGEX = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/;
const FM_REGEX = /^FM(\d{2})(\d{2})(\d{2})$/;
const PERIOD_RANGE_REGEX = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/;
const PROB_REGEX = /^PROB(30|40)$/;

const WIND_REGEX = /^(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/;
const VIS_FRACTION_REGEX = /^M?\d+(?:\/\d+)?SM$/;
const VIS_WHOLE_REGEX = /^\d+$/;
const VIS_FRACTION_FOLLOW_REGEX = /^\d+\/\d+SM$/;
const CLOUD_REGEX = /^(SKC|CLR|NSC|FEW|SCT|BKN|OVC)(\d{3})?(CB|TCU)?$/;
const VV_REGEX = /^VV(\d{3})$/;
const WX_TOKEN_REGEX =
	/^([+-]|VC|RE)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+$/;
const WIND_SHEAR_REGEX = /^WS\d{3}\/\d{3}\d{2,3}KT$/;

const CHANGE_KEYWORDS: ReadonlySet<string> = new Set(['FM', 'BECMG', 'TEMPO']);

interface DecodedHeader {
	station: string;
	amended: boolean;
	corrected: boolean;
	issuedAtUtc: { day: number; hour: number; minute: number };
	validFromUtc: { day: number; hour: number };
	validToUtc: { day: number; hour: number };
	bodyTokens: string[];
}

interface RawPeriodChunk {
	kind: TafChangeKind;
	headerTokens: string[];
	bodyTokens: string[];
	raw: string;
}

/**
 * Parse a single TAF string. Throws on a structurally invalid header
 * (missing station / issuance / valid-period). Per-period decoding is
 * tolerant: malformed tokens emit warnings and the corresponding field
 * becomes `null`.
 */
export function parseTaf(raw: string): ParsedTaf {
	const warnings: string[] = [];
	const trimmed = normalizeRaw(raw);
	const tokens = trimmed.split(/\s+/);
	const header = readHeader(tokens, trimmed);

	const issuedAt = composeIssuedAt(header.issuedAtUtc);
	const validFrom = composeValidBoundary(header.validFromUtc, issuedAt);
	const validTo = composeValidBoundary(header.validToUtc, validFrom, /*forwardOnly=*/ true);

	const chunks = splitIntoPeriodChunks(header.bodyTokens);
	const decoded: TafPeriod[] = [];
	for (const chunk of chunks) {
		decoded.push(decodePeriodChunk(chunk, validFrom, validTo, warnings));
	}
	closePeriodEnds(decoded, validTo);

	return {
		station: header.station,
		amended: header.amended,
		corrected: header.corrected,
		issuedAt,
		validFrom,
		validTo,
		periods: decoded,
		raw: trimmed,
		warnings,
	};
}

// ----------------------------------------------------------------------
// Header
// ----------------------------------------------------------------------

function normalizeRaw(raw: string): string {
	return raw
		.replace(/\s+=\s*$/, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function readHeader(tokens: string[], raw: string): DecodedHeader {
	let i = 0;
	let amended = false;
	let corrected = false;

	if (tokens[i] === 'TAF') i += 1;
	if (tokens[i] === 'AMD') {
		amended = true;
		i += 1;
	}
	if (tokens[i] === 'COR') {
		corrected = true;
		i += 1;
	}

	const station = tokens[i];
	if (station === undefined || !STATION_REGEX.test(station)) {
		throw new Error(`taf: expected 4-letter station identifier, got "${station ?? '(none)'}" in "${raw}"`);
	}
	i += 1;

	const issueMatch = tokens[i]?.match(ISSUE_REGEX);
	if (issueMatch === null || issueMatch === undefined) {
		throw new Error(`taf: expected DDhhmmZ issuance group at "${tokens[i] ?? '(none)'}" in "${raw}"`);
	}
	const issuedAtUtc = {
		day: Number(issueMatch[1]),
		hour: Number(issueMatch[2]),
		minute: Number(issueMatch[3]),
	};
	i += 1;

	// AMD/COR can also follow the issuance group in some bulletins.
	if (tokens[i] === 'AMD') {
		amended = true;
		i += 1;
	}
	if (tokens[i] === 'COR') {
		corrected = true;
		i += 1;
	}

	const validMatch = tokens[i]?.match(VALID_PERIOD_REGEX);
	if (validMatch === null || validMatch === undefined) {
		throw new Error(`taf: expected DDHH/DDHH valid-period group at "${tokens[i] ?? '(none)'}" in "${raw}"`);
	}
	const validFromUtc = { day: Number(validMatch[1]), hour: Number(validMatch[2]) };
	const validToUtc = { day: Number(validMatch[3]), hour: Number(validMatch[4]) };
	i += 1;

	return {
		station,
		amended,
		corrected,
		issuedAtUtc,
		validFromUtc,
		validToUtc,
		bodyTokens: tokens.slice(i),
	};
}

/**
 * Compose an absolute UTC ISO timestamp for the issuance group. The
 * day-of-month establishes the reference month / year: the issuance
 * day must equal the day from the DDhhmmZ group; we anchor month / year
 * by treating the wallclock as "the most recent UTC date matching that
 * day-of-month" (TAFs are always issued for a near-future window, so
 * the lookahead never crosses a 28-day boundary).
 *
 * If anchoring is ambiguous (e.g., today is the 5th and the TAF says
 * day 28), we treat the TAF as belonging to the previous month.
 */
function composeIssuedAt(t: { day: number; hour: number; minute: number }): string {
	const now = new Date();
	const yearGuess = now.getUTCFullYear();
	const monthGuess = now.getUTCMonth();
	const candidate = new Date(Date.UTC(yearGuess, monthGuess, t.day, t.hour, t.minute));
	const todayUtc = Date.UTC(yearGuess, monthGuess, now.getUTCDate());
	// Issuance is in the past relative to "now" (forecasts are issued
	// before they're valid). If the candidate is more than one day in
	// the future, walk back a month.
	if (candidate.getTime() > todayUtc + 24 * 3600_000) {
		candidate.setUTCMonth(candidate.getUTCMonth() - 1);
	}
	return candidate.toISOString();
}

/**
 * Compose an absolute UTC ISO timestamp for a `DDhh` boundary, anchored
 * to a known reference timestamp. TAF valid-period boundaries are
 * always >= issuance and <= issuance + 30 hours (`validFrom`) /
 * <= issuance + 36 hours (`validTo`); change boundaries inside the
 * valid window are always between `validFrom` and `validTo`.
 *
 * Hour `24` is the FAA convention for "end of day -- midnight of the
 * next day"; we promote it to day+1 hour 0.
 */
function composeValidBoundary(t: { day: number; hour: number }, reference: string, forwardOnly = false): string {
	const ref = new Date(reference);
	let day = t.day;
	let hour = t.hour;
	if (hour === 24) {
		// FAA convention: hour 24 -> next day at 00Z.
		day += 1;
		hour = 0;
	}
	let candidate = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), day, hour, 0));
	// If we landed before the reference, walk forward a month -- a TAF
	// boundary is always at-or-after the reference.
	while (candidate.getTime() < ref.getTime() && forwardOnly === false) {
		candidate = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, day, hour, 0));
		if (candidate.getTime() < ref.getTime()) break;
	}
	if (forwardOnly && candidate.getTime() < ref.getTime()) {
		candidate = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, day, hour, 0));
	}
	return candidate.toISOString();
}

// ----------------------------------------------------------------------
// Period chunking
// ----------------------------------------------------------------------

function splitIntoPeriodChunks(bodyTokens: readonly string[]): RawPeriodChunk[] {
	const chunks: RawPeriodChunk[] = [];
	let current: { kind: TafChangeKind; headerTokens: string[]; bodyTokens: string[] } = {
		kind: 'INITIAL',
		headerTokens: [],
		bodyTokens: [],
	};

	for (let i = 0; i < bodyTokens.length; i += 1) {
		const t = bodyTokens[i];
		if (t === undefined) continue;

		if (FM_REGEX.test(t)) {
			pushChunk(chunks, current);
			current = { kind: 'FM', headerTokens: [t], bodyTokens: [] };
			continue;
		}

		if (CHANGE_KEYWORDS.has(t)) {
			pushChunk(chunks, current);
			const headerTokens: string[] = [t];
			// BECMG / TEMPO are followed by a DDHH/DDHH range.
			const next = bodyTokens[i + 1];
			if (next !== undefined && PERIOD_RANGE_REGEX.test(next)) {
				headerTokens.push(next);
				i += 1;
			}
			current = { kind: t === 'BECMG' ? 'BECMG' : 'TEMPO', headerTokens, bodyTokens: [] };
			continue;
		}

		const probMatch = t.match(PROB_REGEX);
		if (probMatch !== null) {
			pushChunk(chunks, current);
			const headerTokens: string[] = [t];
			const next = bodyTokens[i + 1];
			if (next !== undefined && PERIOD_RANGE_REGEX.test(next)) {
				headerTokens.push(next);
				i += 1;
			}
			// PROB may be followed by TEMPO -- carry the keyword onto the
			// header (PROB30 TEMPO 1218/1224 ...). The probability still
			// stands; we capture both as a PROB period.
			const after = bodyTokens[i + 1];
			if (after === 'TEMPO') {
				headerTokens.push(after);
				i += 1;
				const after2 = bodyTokens[i + 1];
				if (after2 !== undefined && PERIOD_RANGE_REGEX.test(after2)) {
					// Override range with the inner TEMPO range when present.
					headerTokens[1] = after2;
					i += 1;
				}
			}
			const kind: TafChangeKind = probMatch[1] === '30' ? 'PROB30' : 'PROB40';
			current = { kind, headerTokens, bodyTokens: [] };
			continue;
		}

		current.bodyTokens.push(t);
	}
	pushChunk(chunks, current);
	return chunks;
}

function pushChunk(
	chunks: RawPeriodChunk[],
	current: { kind: TafChangeKind; headerTokens: string[]; bodyTokens: string[] },
): void {
	const allTokens = [...current.headerTokens, ...current.bodyTokens];
	if (allTokens.length === 0) return;
	chunks.push({
		kind: current.kind,
		headerTokens: current.headerTokens,
		bodyTokens: current.bodyTokens,
		raw: allTokens.join(' '),
	});
}

// ----------------------------------------------------------------------
// Per-period decoding
// ----------------------------------------------------------------------

function decodePeriodChunk(chunk: RawPeriodChunk, validFrom: string, validTo: string, warnings: string[]): TafPeriod {
	const { kind, headerTokens, bodyTokens, raw } = chunk;
	const { start, end } = decodePeriodWindow(kind, headerTokens, validFrom, validTo);
	const probability = decodeProbability(kind, headerTokens);
	const decoded = decodeBody(bodyTokens, raw, warnings);
	return {
		kind,
		start,
		end,
		probability,
		raw,
		...decoded,
	};
}

function decodePeriodWindow(
	kind: TafChangeKind,
	headerTokens: readonly string[],
	validFrom: string,
	validTo: string,
): { start: string; end: string } {
	if (kind === 'INITIAL') {
		// `end` is reconciled against the next period after all chunks decoded.
		return { start: validFrom, end: validTo };
	}
	if (kind === 'FM') {
		const t = headerTokens[0];
		const fm = t?.match(FM_REGEX);
		if (fm === null || fm === undefined || t === undefined) {
			return { start: validFrom, end: validTo };
		}
		const day = Number(fm[1]);
		const hour = Number(fm[2]);
		const minute = Number(fm[3]);
		const start = composeAbsoluteTimestamp(day, hour, minute, validFrom);
		// `end` is reconciled against the next period after all chunks decoded.
		return { start, end: validTo };
	}
	// BECMG / TEMPO / PROB - explicit DDHH/DDHH range.
	const rangeToken = headerTokens.find((t) => PERIOD_RANGE_REGEX.test(t));
	const range = rangeToken?.match(PERIOD_RANGE_REGEX);
	if (range === null || range === undefined || rangeToken === undefined) {
		return { start: validFrom, end: validTo };
	}
	const startDay = Number(range[1]);
	const startHour = Number(range[2]);
	const endDay = Number(range[3]);
	const endHour = Number(range[4]);
	const start = composeAbsoluteTimestamp(startDay, startHour, 0, validFrom);
	const end = composeAbsoluteTimestamp(endDay, endHour, 0, start);
	return { start, end };
}

function composeAbsoluteTimestamp(day: number, hour: number, minute: number, reference: string): string {
	const ref = new Date(reference);
	let actualDay = day;
	let actualHour = hour;
	if (actualHour === 24) {
		actualDay += 1;
		actualHour = 0;
	}
	let candidate = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), actualDay, actualHour, minute));
	if (candidate.getTime() < ref.getTime()) {
		// Crosses month boundary.
		candidate = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, actualDay, actualHour, minute));
	}
	return candidate.toISOString();
}

function decodeProbability(kind: TafChangeKind, headerTokens: readonly string[]): number | null {
	if (kind !== 'PROB30' && kind !== 'PROB40') return null;
	const t = headerTokens[0];
	const m = t?.match(PROB_REGEX);
	if (m === null || m === undefined) return null;
	return Number(m[1]);
}

interface DecodedBody {
	wind: WindGroup | null;
	visibilitySM: number | null;
	weather: string[];
	clouds: CloudLayer[];
	cavok: boolean;
}

function decodeBody(tokens: readonly string[], rawForWarnings: string, warnings: string[]): DecodedBody {
	let i = 0;
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
		} else if (/^\/{3,}KT$/.test(candidateWindToken)) {
			warnings.push(`taf: unparseable wind token '${candidateWindToken}' in "${rawForWarnings}"`);
			i += 1;
		}
	}

	let visibilitySM: number | null = null;
	let cavok = false;
	if (tokens[i] === 'CAVOK') {
		cavok = true;
		visibilitySM = 10;
		i += 1;
	} else if (tokens[i]?.match(VIS_FRACTION_REGEX)) {
		const parsed = tryParseVisibility(tokens[i] ?? '');
		if (parsed === null) {
			warnings.push(`taf: unparseable visibility token '${tokens[i]}' in "${rawForWarnings}"`);
		} else {
			visibilitySM = parsed;
		}
		i += 1;
	} else if (tokens[i]?.match(VIS_WHOLE_REGEX) && tokens[i + 1]?.match(VIS_FRACTION_FOLLOW_REGEX)) {
		const combined = `${tokens[i]} ${tokens[i + 1]}`;
		const parsed = tryParseVisibility(combined);
		if (parsed === null) {
			warnings.push(`taf: unparseable visibility token '${combined}' in "${rawForWarnings}"`);
		} else {
			visibilitySM = parsed;
		}
		i += 2;
	}

	const weather: string[] = [];
	const clouds: CloudLayer[] = [];

	for (; i < tokens.length; i += 1) {
		const t = tokens[i];
		if (t === undefined || t === '') continue;
		if (WIND_SHEAR_REGEX.test(t)) continue; // Wind shear groups -- deferred per types.ts.
		if (/^5\d{4}$/.test(t)) continue; // Icing forecast group -- deferred.
		if (/^6\d{4}$/.test(t)) continue; // Turbulence forecast group -- deferred.
		if (/^T[XN]M?\d{2}\/\d{4}Z$/.test(t)) continue; // Min/max temp -- deferred.

		const cm = t.match(CLOUD_REGEX);
		if (cm !== null) {
			const cover = cm[1] as SkyCover;
			const heightFtAgl = cm[2] !== undefined ? Number(cm[2]) * 100 : null;
			const cloudType = cm[3] === 'CB' || cm[3] === 'TCU' ? cm[3] : null;
			clouds.push({ cover, heightFtAgl, cloudType });
			continue;
		}
		const vvm = t.match(VV_REGEX);
		if (vvm !== null) {
			clouds.push({ cover: 'VV', heightFtAgl: Number(vvm[1]) * 100, cloudType: null });
			continue;
		}
		if (WX_TOKEN_REGEX.test(t)) {
			weather.push(t);
			continue;
		}
		// Unknown token: silent skip (TAFs commonly include locale extensions).
	}

	return { wind, visibilitySM, weather, clouds, cavok };
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

/**
 * Reconcile period ends. INITIAL and FM periods establish a baseline
 * forecast that holds until the next FM (or the TAF `validTo`). BECMG
 * / TEMPO / PROB periods carry their own explicit end -- we leave
 * those alone.
 */
function closePeriodEnds(periods: TafPeriod[], validTo: string): void {
	const baselineKinds: ReadonlySet<TafChangeKind> = new Set(['INITIAL', 'FM']);
	for (let i = 0; i < periods.length; i += 1) {
		const period = periods[i];
		if (period === undefined) continue;
		if (!baselineKinds.has(period.kind)) continue;
		// Find the next baseline (FM) period; that's our end.
		let nextEnd = validTo;
		for (let j = i + 1; j < periods.length; j += 1) {
			const next = periods[j];
			if (next === undefined) continue;
			if (next.kind === 'FM') {
				nextEnd = next.start;
				break;
			}
		}
		period.end = nextEnd;
	}
}
