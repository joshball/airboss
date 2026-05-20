/**
 * Hazard product autodetection.
 *
 * The user can paste any supported product and the decoder figures
 * out which parser to invoke. Multi-product inputs (e.g. a Convective
 * SIGMET *and* an SVR Warning copied from the same screenshot) are
 * detected and split.
 *
 * Browser-safe.
 */

import { looksLikeConvectiveSigmet, type ParseOptions, parseConvectiveSigmet } from './parse-convective-sigmet';
import { looksLikeSvrWarning, type ParseSvrOptions, parseSvrWarning } from './parse-svr-warning';
import type { DecodedHazard } from './types';

export interface DecodeOptions extends ParseOptions, ParseSvrOptions {}

export interface DecodeResult {
	hazards: readonly DecodedHazard[];
	/** Sub-strings the autodetector could not classify. */
	unrecognized: readonly string[];
}

/**
 * Decode arbitrary pasted text. Splits on the `---` separator that
 * the AWC GFA viewer paints between stacked products, then attempts
 * each known parser per chunk.
 */
export function decodeHazardText(raw: string, opts: DecodeOptions = {}): DecodeResult {
	const chunks = splitChunks(raw);
	const hazards: DecodedHazard[] = [];
	const unrecognized: string[] = [];

	for (const chunk of chunks) {
		if (chunk.trim().length === 0) continue;
		if (looksLikeConvectiveSigmet(chunk)) {
			hazards.push(parseConvectiveSigmet(chunk, opts));
			// Pasted bundles often append an SVR after the SIGMET text.
			const svrChunk = extractTrailingSvr(chunk);
			if (svrChunk && looksLikeSvrWarning(svrChunk)) {
				hazards.push(parseSvrWarning(svrChunk, opts));
			}
			continue;
		}
		if (looksLikeSvrWarning(chunk)) {
			hazards.push(parseSvrWarning(chunk, opts));
			continue;
		}
		unrecognized.push(chunk);
	}

	return { hazards: dedupeHazards(hazards), unrecognized };
}

/** Split on AWC GFA-viewer separator dashes (`---` runs of 3+). */
function splitChunks(raw: string): string[] {
	return raw.split(/\n-{3,}\n/);
}

/** Inside a chunk that already contains a SIGMET, look for an appended
 *  Severe Thunderstorm Warning section (the GFA "co-attached" shape). */
function extractTrailingSvr(chunk: string): string | null {
	const idx = chunk.search(/^Severe Thunderstorm Warning$/im);
	if (idx < 0) return null;
	return chunk.slice(idx);
}

/** Drop duplicate hazards (identical wmoHeader / office+validUntil). */
function dedupeHazards(input: DecodedHazard[]): DecodedHazard[] {
	const seen = new Set<string>();
	const out: DecodedHazard[] = [];
	for (const h of input) {
		const key = identityKey(h);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(h);
	}
	return out;
}

function identityKey(h: DecodedHazard): string {
	if (h.kind === 'convective-sigmet') return `cs:${h.wmoHeader}:${h.seriesId}`;
	return `svr:${h.office}:${h.validUntil.toISOString()}:${h.areaDescription}`;
}
