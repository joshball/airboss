/**
 * Aviation-registry loader. Wraps `@ab/aviation`'s in-memory `search()` and
 * classifies each hit into a `SearchResultType` so the palette can route it
 * into the right column.
 *
 * Handbook chapter / CFR section rows live in `study.reference_section` and
 * are produced by `handbook-sections.ts` / `cfr-sections.ts`, not here.
 */

import { search as aviationSearch, type Reference, type SearchHit } from '@ab/aviation';
import { REFERENCE_SOURCE_TYPES, type ReferenceSourceType, ROUTES } from '@ab/constants';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, RankBucket, SearchResult, SearchResultType } from '../schema/result-types';

const LOADER_LIMIT = 50;

/**
 * Map an aviation `score` (0-100) to a `RankBucket` (1-5). The aviation
 * registry's tiered scorer uses 100/90/80/70/50/40/30/20 -- collapse that
 * into the palette's 1-5 scale.
 */
function rankFromScore(score: number): RankBucket {
	if (score >= 90) return 1;
	if (score >= 70) return 2;
	if (score >= 50) return 3;
	if (score >= 30) return 4;
	return 5;
}

const HANDBOOK_TYPES = new Set<ReferenceSourceType>([
	REFERENCE_SOURCE_TYPES.PHAK,
	REFERENCE_SOURCE_TYPES.AFH,
	REFERENCE_SOURCE_TYPES.IFH,
	REFERENCE_SOURCE_TYPES.AVWX,
	REFERENCE_SOURCE_TYPES.IPH,
	REFERENCE_SOURCE_TYPES.RMH,
	REFERENCE_SOURCE_TYPES.AIH,
	REFERENCE_SOURCE_TYPES.HFH,
	REFERENCE_SOURCE_TYPES.GFH,
	REFERENCE_SOURCE_TYPES.BFH,
]);

function classify(ref: Reference): SearchResultType {
	const st = ref.tags.sourceType;
	if (HANDBOOK_TYPES.has(st)) return 'faa.handbook';
	if (st === REFERENCE_SOURCE_TYPES.CFR) return 'faa.cfr.part';
	if (st === REFERENCE_SOURCE_TYPES.AIM) return 'faa.aim';
	if (st === REFERENCE_SOURCE_TYPES.AC) return 'faa.ac';
	if (st === REFERENCE_SOURCE_TYPES.ACS) return 'faa.acs';
	if (st === REFERENCE_SOURCE_TYPES.PCG) return 'airboss.glossary';
	return 'airboss.glossary';
}

/**
 * Derive a navigation href for an aviation registry row. Glossary-level rows
 * (Va, density altitude, ...) route to the in-app reference detail card.
 * Doc-code rows could route to the flightbag reader, but cross-app
 * navigation is the caller's concern; we emit the in-app reference path
 * (`/library/reference/<id>`) and let the renderer upgrade if a richer
 * flightbag URL is available.
 */
function hrefFor(ref: Reference): string {
	return ROUTES.REFERENCE_GLOSSARY_ID(ref.id);
}

export function loadAviationRefs(parsed: ParsedQuery, _host: PaletteHost): readonly SearchResult[] {
	void _host; // host boost is applied by the search facade, not the loader.
	const text = parsed.freeText.trim();
	// `searchGrouped` early-exits on an empty (no-text, no-filter) query, but
	// a tag-only query still calls in here -- we want to surface refs that
	// match a tag filter even without free text. The aviation registry
	// already supports this via the empty-text + tags path.
	const hits = aviationSearch({
		text: text.length > 0 ? text : undefined,
		expandSynonyms: true,
	});
	const out: SearchResult[] = [];
	for (const hit of hits.slice(0, LOADER_LIMIT)) {
		out.push(toSearchResult(hit));
	}
	return out;
}

function toSearchResult(hit: SearchHit): SearchResult {
	const ref = hit.reference;
	const type = classify(ref);
	const result: SearchResult = {
		id: ref.id,
		type,
		title: ref.displayName,
		subtitle: subtitleFor(ref),
		href: hrefFor(ref),
		rankBucket: rankFromScore(hit.score),
	};
	return result;
}

function subtitleFor(ref: Reference): string | undefined {
	// "PHAK · FAA-H-8083-25C" style subtitle for handbooks; just the source
	// label for glossary rows. Kept simple in Phase 2; richer formats land
	// when the detail pane needs more context.
	const st = ref.tags.sourceType;
	if (HANDBOOK_TYPES.has(st)) {
		return `${st.toUpperCase()} handbook`;
	}
	if (st === REFERENCE_SOURCE_TYPES.CFR) return '14 CFR Part';
	if (st === REFERENCE_SOURCE_TYPES.AC) return 'Advisory Circular';
	if (st === REFERENCE_SOURCE_TYPES.ACS) return 'ACS';
	if (st === REFERENCE_SOURCE_TYPES.AIM) return 'AIM';
	if (st === REFERENCE_SOURCE_TYPES.PCG) return 'Pilot/Controller Glossary';
	return undefined;
}
