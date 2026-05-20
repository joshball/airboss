/**
 * Convective SIGMET parser.
 *
 * Source-of-truth grammar: AC 00-45H section 5.7 + the WMO product
 * shape distributed as WSUS31/32/33 KKCI from the Aviation Weather
 * Center. Bulletins look like:
 *
 *   WSUS31 KKCI 192055
 *   SIGE
 *   CONVECTIVE SIGMET 70E
 *   VALID UNTIL 2255Z
 *   ME MA NH RI VT CT NY NJ AND ME MA NH CSTL WTRS
 *   FROM 50NE ENE-70SE ENE-20ESE SAX-10SW ALB-40SSE MPV-50NE ENE
 *   AREA TS MOV FROM 26035KT. TOPS TO FL400.
 *
 *   OUTLOOK VALID 192255-200255
 *   AREA 1...FROM ...
 *   REF WW 230.
 *   WST ISSUANCES EXPD. REFER TO MOST RECENT ACUS01 KWNS ...
 *
 *   AREA 2...FROM ...
 *   ...
 *
 * The parser is strict on the WMO header and the SIGMET frame, and
 * forgiving on free-text body shape. It records the original `raw`
 * text so the UI can let users toggle source view.
 *
 * Browser-safe -- no Node imports.
 */

import { lookupNavaid } from './navaids';
import { parseDdhhmm, parseHhmmZ } from './time';
import {
	type ConvectiveOutlook,
	type ConvectiveOutlookArea,
	type ConvectivePhenomenon,
	type ConvectiveSigmet,
	HAZARD_QUADRANTS,
	type HazardBoundary,
	type HazardFromPoint,
	type HazardMovement,
	type HazardQuadrant,
} from './types';

/** Strip the pre-bulletin "SIGMET: Convective" preview block AWC's
 *  GFA viewer paints above the raw text when copying. */
function stripPreviewHeader(raw: string): string {
	const lines = raw.split(/\r?\n/);
	const wmoIdx = lines.findIndex((line) => /^WSUS3[0-9] KKCI /.test(line.trim()));
	if (wmoIdx > 0) return lines.slice(wmoIdx).join('\n');
	return raw;
}

const QUADRANT_SET = new Set<HazardQuadrant>(HAZARD_QUADRANTS);

/**
 * Parse a single FROM-point token. Three shapes:
 *   "50NE ENE"  -> 50 nm in the NE quadrant of ENE
 *   "50NEENE"   -> same, no inter-token space
 *   "DCA"       -> AT the DCA VOR (distance 0, quadrant 'N' as a convention)
 */
export function parseFromPoint(token: string): HazardFromPoint | null {
	const cleaned = token.trim().toUpperCase();
	if (cleaned === '') return null;
	// Bare VOR form: a 3-letter identifier with nothing else.
	const bareMatch = /^([A-Z]{3})$/.exec(cleaned);
	if (bareMatch) {
		const navaidId = bareMatch[1];
		const lookup = lookupNavaid(navaidId);
		return {
			distanceNm: 0,
			quadrant: 'N',
			navaidId,
			navaidName: lookup?.name ?? null,
			raw: token.trim(),
		};
	}
	// Distance + quadrant + VOR.
	const match = /^(\d{1,3})\s*([NSEW]{1,3})\s*([A-Z]{3})$/.exec(cleaned);
	if (!match) return null;
	const quadrantStr = match[2];
	const navaidId = match[3];
	if (!QUADRANT_SET.has(quadrantStr as HazardQuadrant)) return null;
	const distance = Number.parseInt(match[1], 10);
	if (!Number.isFinite(distance)) return null;
	const lookup = lookupNavaid(navaidId);
	return {
		distanceNm: distance,
		quadrant: quadrantStr as HazardQuadrant,
		navaidId,
		navaidName: lookup?.name ?? null,
		raw: token.trim(),
	};
}

/**
 * Split a "FROM ..." or "AREA N...FROM ..." boundary line into FROM-point
 * tokens. AWC separates tokens with `-`; the line can wrap across multiple
 * source lines.
 */
function splitBoundaryTokens(boundaryText: string): string[] {
	return boundaryText
		.replace(/\s+/g, ' ')
		.split('-')
		.map((token) => token.trim())
		.filter((token) => token.length > 0);
}

function parseBoundary(boundaryText: string): HazardBoundary {
	const tokens = splitBoundaryTokens(boundaryText);
	const points: HazardFromPoint[] = [];
	for (const token of tokens) {
		const point = parseFromPoint(token);
		if (point) points.push(point);
	}
	return { points };
}

/** Parse the convective phenomenon classification line. */
function parsePhenomenon(body: string): ConvectivePhenomenon {
	const upper = body.toUpperCase();
	if (/\bTORNAD/.test(upper)) return 'tornado';
	if (/\bHAIL\b/.test(upper)) return 'hail';
	if (/\bEMBD(?:D|ED)? TS\b/.test(upper)) return 'embedded-ts';
	if (/\bLINE\s+TS\b/.test(upper) || /\bLN\s+TS\b/.test(upper)) return 'line-ts';
	if (/\bISOL\w*\s+TS\b/.test(upper)) return 'isolated-ts';
	if (/\bSEV\w*\s+TS\b/.test(upper)) return 'severe-ts';
	if (/\bAREA\s+TS\b/.test(upper)) return 'area-ts';
	if (/\bTS\b/.test(upper)) return 'area-ts';
	return 'unknown';
}

/** Parse "MOV FROM DDDFFKT" (where DDD = direction, FF = speed). */
function parseMovement(body: string): HazardMovement | null {
	const match = /MOV\s+FROM\s+(\d{3})(\d{2,3})KT/i.exec(body);
	if (!match) return null;
	const fromDeg = Number.parseInt(match[1], 10);
	const speedKt = Number.parseInt(match[2], 10);
	if (fromDeg < 0 || fromDeg > 360) return null;
	if (speedKt < 0 || speedKt > 200) return null;
	return { fromDeg: fromDeg % 360, speedKt };
}

/** Parse "TOPS TO FLnnn" (or "TOP TO FLnnn"). */
function parseTops(body: string): number | null {
	const match = /TOPS?\s+TO\s+FL(\d{2,3})/i.exec(body);
	if (!match) return null;
	const fl = Number.parseInt(match[1], 10);
	return Number.isFinite(fl) ? fl : null;
}

/** Pull `WW NNN`, `ACUS01 KWNS`, etc. references from outlook narrative. */
function extractReferences(narrative: string): string[] {
	const matches: string[] = [];
	const wwMatches = narrative.match(/\bWW\s+\d+\b/gi);
	if (wwMatches) matches.push(...wwMatches.map((m) => m.toUpperCase().replace(/\s+/g, ' ')));
	const acusMatches = narrative.match(/\bACUS\d+\s+K[A-Z]{3,4}\b/gi);
	if (acusMatches) matches.push(...acusMatches.map((m) => m.toUpperCase()));
	return [...new Set(matches)];
}

/**
 * Parse the outlook block. Returns null if no outlook is present.
 */
function parseOutlook(outlookText: string, now: Date): ConvectiveOutlook | null {
	const headerMatch = /OUTLOOK\s+VALID\s+(\d{6})-(\d{6})/i.exec(outlookText);
	if (!headerMatch) return null;
	const validFrom = parseDdhhmm(headerMatch[1], now);
	const validUntil = parseDdhhmm(headerMatch[2], now);
	if (!validFrom || !validUntil) return null;

	const areas: ConvectiveOutlookArea[] = [];
	// Split on "AREA N..." headers. Each chunk includes the AREA-N label.
	const areaSplit = outlookText.split(/(AREA\s+\d+\.{3})/i);
	// areaSplit[0] is text before the first AREA marker (the OUTLOOK header
	// line). Pairs after that are [label, body, label, body, ...].
	for (let i = 1; i < areaSplit.length; i += 2) {
		const label = areaSplit[i].replace(/\.{3,}/, '').trim();
		const body = areaSplit[i + 1] ?? '';
		// Boundary is everything up to the first "REF " / "WST " / blank
		// section header.
		const fromMatch = /FROM\s+([\s\S]*?)(?=\bREF\b|\bWST\b|\b\n[A-Z]{4,}\b|$)/i.exec(body);
		const boundary = fromMatch ? parseBoundary(fromMatch[1]) : { points: [] };
		const references = extractReferences(body);
		const narrativeStart = fromMatch ? fromMatch.index + fromMatch[0].length : 0;
		const narrative = body.slice(narrativeStart).trim();
		areas.push({ label, boundary, references, narrative });
	}

	return { validFrom, validUntil, areas };
}

export interface ParseOptions {
	/** Reference instant used to expand DDHHMM tokens. Defaults to `new Date()`. */
	now?: Date;
}

/**
 * Parse a Convective SIGMET bulletin into the decoded model.
 * Throws when the text is not a Convective SIGMET (no WSUS3x header
 * or no "CONVECTIVE SIGMET" body line).
 */
export function parseConvectiveSigmet(rawInput: string, opts: ParseOptions = {}): ConvectiveSigmet {
	const now = opts.now ?? new Date();
	const raw = rawInput.trim();
	const stripped = stripPreviewHeader(raw);

	const wmoMatch = /^(WSUS3[0-9])\s+(KKCI)\s+(\d{6})/m.exec(stripped);
	if (!wmoMatch) throw new ParseError('Missing WMO header (WSUS3x KKCI DDHHMM)', raw);
	const wmoHeader = `${wmoMatch[1]} ${wmoMatch[2]} ${wmoMatch[3]}`;
	const issuedAt = parseDdhhmm(wmoMatch[3], now);
	if (!issuedAt) throw new ParseError(`Invalid issue token ${wmoMatch[3]}`, raw);

	const regionMatch = /^(SIGE|SIGC|SIGW)\b/m.exec(stripped);
	if (!regionMatch) throw new ParseError('Missing region line (SIGE / SIGC / SIGW)', raw);
	const region = regionMatch[1] as ConvectiveSigmet['region'];

	const seriesMatch = /^CONVECTIVE\s+SIGMET\s+([0-9]+)([ECW])\b/im.exec(stripped);
	if (!seriesMatch) throw new ParseError('Missing CONVECTIVE SIGMET <N><region>', raw);
	const seriesNumber = Number.parseInt(seriesMatch[1], 10);
	const seriesId = `${seriesNumber}${seriesMatch[2]}`;

	const validMatch = /^VALID\s+UNTIL\s+(\d{4}Z?)/im.exec(stripped);
	if (!validMatch) throw new ParseError('Missing VALID UNTIL HHMMZ', raw);
	const validUntil = parseHhmmZ(validMatch[1], issuedAt);
	if (!validUntil) throw new ParseError(`Invalid VALID UNTIL token ${validMatch[1]}`, raw);

	// Affected line is the first non-empty line between VALID UNTIL and the
	// FROM ... boundary. It's a free-text state-list with optional " AND ".
	const afterValid = stripped.slice(validMatch.index + validMatch[0].length);
	const affectedLineMatch = /\n([^\n]+?)\n+FROM\s/i.exec(afterValid);
	const affectedRegions = affectedLineMatch ? tokenizeAffected(affectedLineMatch[1]) : [];

	// Boundary: from "FROM " through end-of-line / period.
	const boundaryMatch =
		/^FROM\s+([\s\S]*?)(?=\n[A-Z]{2,}|\bAREA\b|\bEMBD\b|\bLINE\b|\bLN\b|\bISOL\b|\bSEV\b|\bTS\b)/im.exec(stripped);
	const boundary: HazardBoundary = boundaryMatch ? parseBoundary(boundaryMatch[1]) : { points: [] };

	// Phenomenon body line: from the first phenomenon keyword through the
	// blank line that separates active body from outlook.
	const activeEndIdx = (() => {
		const outlookIdx = stripped.search(/OUTLOOK\s+VALID/i);
		return outlookIdx >= 0 ? outlookIdx : stripped.length;
	})();
	const activeBody = stripped.slice(0, activeEndIdx);
	const phenomenon: ConvectivePhenomenon = parsePhenomenon(activeBody);
	const movement: HazardMovement | null = parseMovement(activeBody);
	const topsFL: number | null = parseTops(activeBody);

	// Outlook block (optional).
	const outlookText = stripped.slice(activeEndIdx);
	const outlook = outlookText.length > 0 ? parseOutlook(outlookText, now) : null;

	return {
		kind: 'convective-sigmet',
		severity: 'severe',
		wmoHeader,
		region,
		seriesId,
		seriesNumber,
		issuedAt,
		validFrom: issuedAt,
		validUntil,
		affectedRegions,
		boundary,
		phenomenon,
		movement,
		topsFL,
		outlook,
		raw,
	};
}

/**
 * Split the affected-regions line into state / waters tokens.
 *
 * AWC writes the line in segments joined by " AND ". The first segment
 * is usually a sequence of 2-letter state codes; later segments often
 * carry a multi-word qualifier like "ME MA NH CSTL WTRS" (states +
 * "coastal waters"). We treat each AND-segment as one unit: if it
 * ends with a non-state word, the whole segment is one descriptive
 * token; otherwise we explode the state codes.
 */
function tokenizeAffected(line: string): string[] {
	const segments = line
		.toUpperCase()
		.trim()
		.split(/\s+AND\s+/);
	const out: string[] = [];
	for (const segment of segments) {
		const pieces = segment.split(/\s+/).filter((p) => p.length > 0);
		const hasNonState = pieces.some((p) => !/^[A-Z]{2}$/.test(p));
		if (hasNonState) {
			out.push(pieces.join(' '));
		} else {
			out.push(...pieces);
		}
	}
	return out;
}

/** Thrown by `parseConvectiveSigmet` on malformed input. */
export class ParseError extends Error {
	readonly raw: string;
	constructor(reason: string, raw: string) {
		super(`hazard parse error: ${reason}`);
		this.name = 'ParseError';
		this.raw = raw;
	}
}

/** Heuristic: does the text look like a Convective SIGMET? */
export function looksLikeConvectiveSigmet(raw: string): boolean {
	if (!/WSUS3[0-9]\s+KKCI/.test(raw)) return false;
	if (!/CONVECTIVE\s+SIGMET/i.test(raw)) return false;
	return true;
}
