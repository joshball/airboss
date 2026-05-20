/**
 * Severe Thunderstorm Warning (SVR) parser.
 *
 * NWS WFOs issue SVRs as VTEC-tagged products. The legacy text-bulletin
 * carries the threat tag table (e.g. "HAIL THREAT...RADAR INDICATED")
 * and a polygon footer line ("LAT...LON ..."). The new api.weather.gov
 * /alerts feed delivers the same info as JSON; for paste-decode we
 * parse the text shape.
 *
 *   WWUS5x KBOX 191945
 *   SVRBOX
 *   Severe Thunderstorm Warning
 *   National Weather Service Boston/Norton MA
 *   345 PM EDT Tue May 19 2026
 *
 *   The National Weather Service in Boston/Norton has issued a
 *
 *   * Severe Thunderstorm Warning for...
 *     Northern Litchfield County in northwest Connecticut...
 *
 *   * Until 2245Z.
 *
 *   * At 1945Z, a severe thunderstorm was located 5 miles east of...
 *
 *   HAZARD...60 mph wind gusts and quarter size hail.
 *
 *   LAT...LON 4174 7290 4185 7271 4196 7268 4179 7295
 *
 * Browser-safe.
 */

import { ParseError } from './parse-convective-sigmet';
import { parseDdhhmm, parseHhmmZ } from './time';
import type { SevereThunderstormWarning } from './types';

export function looksLikeSvrWarning(raw: string): boolean {
	if (!/Severe Thunderstorm Warning/i.test(raw)) return false;
	// SVR products carry SVR<office> on a line and/or a WMO WWUS5x header.
	if (/^SVR[A-Z]{3,4}\b/m.test(raw)) return true;
	if (/^WWUS5[0-9]\s+K[A-Z]{3,4}/m.test(raw)) return true;
	// The AWC GFA viewer composites SVRs with SIGMETs as a short tag block:
	//   Severe Thunderstorm Warning
	//   End:2245 UTC 19 May
	//   Office:KBOX
	if (/Office:\s*K[A-Z]{3,4}/i.test(raw) && /End:\s*\d{4}\s*UTC/i.test(raw)) return true;
	return false;
}

export interface ParseSvrOptions {
	now?: Date;
}

export function parseSvrWarning(rawInput: string, opts: ParseSvrOptions = {}): SevereThunderstormWarning {
	const now = opts.now ?? new Date();
	const raw = rawInput.trim();

	const wmoMatch = /^WWUS5[0-9]\s+(K[A-Z]{3,4})\s+(\d{6})/m.exec(raw);
	const productHeaderMatch = /^SVR([A-Z]{3,4})\b/m.exec(raw);
	const officeFieldMatch = /^Office:\s*(K[A-Z]{3,4})/im.exec(raw);
	const office = wmoMatch
		? wmoMatch[1]
		: productHeaderMatch
			? `K${productHeaderMatch[1]}`
			: officeFieldMatch
				? officeFieldMatch[1]
				: null;
	if (!office) throw new ParseError('Missing WFO office (WWUS5x / SVR<office> / Office:K...)', raw);
	const issuedAt = wmoMatch ? parseDdhhmm(wmoMatch[2], now) : null;

	// Until line. The bulletin shape is one of:
	//   "Until 2245Z."                              (NWS canonical)
	//   "End:2215 UTC 19 May"                        (GFA viewer short form)
	//   "End:2215 UTC"                               (GFA short form, no day)
	// When the explicit day is present we honor it; otherwise we anchor
	// to the issued time (or `now`) and resolve via parseHhmmZ.
	const untilExplicit = /End:\s*(\d{4})\s*UTC\s+(\d{1,2})\s+([A-Za-z]+)/i.exec(raw);
	const untilZulu = /Until\s+(\d{4})Z\b/i.exec(raw) ?? /End:\s*(\d{4})\s*UTC/i.exec(raw);
	let validUntil: Date | null = null;
	if (untilExplicit) {
		validUntil = buildExplicitUtc(untilExplicit[1], untilExplicit[2], untilExplicit[3], now);
	} else if (untilZulu) {
		const reference = issuedAt ?? now;
		validUntil = parseHhmmZ(untilZulu[1], reference);
	}
	if (!validUntil) throw new ParseError('Missing Zulu validity ("Until HHMMZ" or "End: HHMM UTC")', raw);

	const areaMatch = /Severe Thunderstorm Warning for[.]*\s*\n([\s\S]*?)(?=\n\s*\*\s|\n\n)/i.exec(raw);
	const areaDescription = areaMatch ? areaMatch[1].replace(/\s+/g, ' ').trim() : '';

	const hazardLine = /HAZARD\.{3}\s*([^\n]+)/i.exec(raw);
	const hazardText = hazardLine ? hazardLine[1] : '';

	const windMatch = /(\d{2,3})\s*mph\s+wind/i.exec(hazardText) ?? /(\d{2,3})\s*mph\s+wind/i.exec(raw);
	const maxWindMph = windMatch ? Number.parseInt(windMatch[1], 10) : null;

	const maxHailIn = parseHailSize(hazardText) ?? parseHailSize(raw);
	const tornadoPossible = /TORNADO\.{3,}\s*POSSIBLE/i.test(raw);

	const polygon = parseLatLonPolygon(raw);

	return {
		kind: 'severe-thunderstorm-warning',
		severity: 'severe',
		office,
		validFrom: issuedAt,
		validUntil,
		areaDescription,
		polygon,
		maxWindMph,
		maxHailIn,
		tornadoPossible,
		narrative: hazardText,
		raw,
	};
}

const MONTH_INDEX: Record<string, number> = {
	jan: 0,
	feb: 1,
	mar: 2,
	apr: 3,
	may: 4,
	jun: 5,
	jul: 6,
	aug: 7,
	sep: 8,
	oct: 9,
	nov: 10,
	dec: 11,
};

function buildExplicitUtc(hhmm: string, dayStr: string, monthStr: string, now: Date): Date | null {
	const month = MONTH_INDEX[monthStr.slice(0, 3).toLowerCase()];
	if (month === undefined) return null;
	const day = Number.parseInt(dayStr, 10);
	if (!Number.isFinite(day) || day < 1 || day > 31) return null;
	const hh = Number.parseInt(hhmm.slice(0, 2), 10);
	const mm = Number.parseInt(hhmm.slice(2, 4), 10);
	if (hh > 23 || mm > 59) return null;
	let year = now.getUTCFullYear();
	// If the (month, day) is more than ~6 months ahead of `now`, treat it
	// as last year. Avoids the "explicit December date on a January now"
	// foot-gun without needing a calendar.
	const candidate = new Date(Date.UTC(year, month, day, hh, mm));
	const lookahead = 1000 * 60 * 60 * 24 * 180;
	if (candidate.getTime() - now.getTime() > lookahead) year -= 1;
	return new Date(Date.UTC(year, month, day, hh, mm));
}

function parseHailSize(text: string): number | null {
	const match =
		/(quarter|nickel|penny|ping pong ball|golf ball|tennis ball|baseball|softball|half dollar)\s*size\s+hail/i.exec(
			text,
		);
	if (match) {
		const sizeWord = match[1].toLowerCase();
		const SIZE_INCHES: Record<string, number> = {
			penny: 0.75,
			nickel: 0.88,
			quarter: 1.0,
			'half dollar': 1.25,
			'ping pong ball': 1.5,
			'golf ball': 1.75,
			'tennis ball': 2.5,
			baseball: 2.75,
			softball: 4.0,
		};
		return SIZE_INCHES[sizeWord] ?? null;
	}
	const inchMatch = /(\d+(?:\.\d+)?)\s*"?\s*hail/i.exec(text) ?? /hail\s+to\s+(\d+(?:\.\d+)?)/i.exec(text);
	if (inchMatch) return Number.parseFloat(inchMatch[1]);
	return null;
}

function parseLatLonPolygon(raw: string): readonly (readonly [number, number])[] | null {
	const match = /LAT\.{3}LON\s+([\s\S]+?)(?=\n\n|\n[A-Z]{2,}|$)/i.exec(raw);
	if (!match) return null;
	const tokens = match[1].trim().split(/\s+/);
	if (tokens.length < 6 || tokens.length % 2 !== 0) return null;
	const polygon: [number, number][] = [];
	for (let i = 0; i < tokens.length; i += 2) {
		const latRaw = tokens[i];
		const lonRaw = tokens[i + 1];
		if (!/^\d{4,5}$/.test(latRaw) || !/^\d{4,5}$/.test(lonRaw)) return null;
		// NWS encodes lat/lon as deg+min*100 with the implicit decimal at
		// position 2 from the end. 4174 -> 41.74 N; 7290 -> -72.90 (W).
		const lat = Number.parseInt(latRaw, 10) / 100;
		const lon = -Number.parseInt(lonRaw, 10) / 100;
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
		polygon.push([lat, lon]);
	}
	return polygon;
}
