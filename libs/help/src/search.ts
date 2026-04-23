/**
 * Cross-library faceted search facade.
 *
 * Parses the raw query, runs it against both registries (`@ab/aviation`'s
 * `search` + the help registry's `search`), and returns two explicitly-
 * labeled buckets. Per architecture decision #4 there is no cross-bucket
 * implicit ranking; the caller decides layout, the facade decides grouping.
 *
 * Filter semantics:
 *   - `library: 'aviation'` narrows to the aviation bucket only.
 *   - `library: 'help'` narrows to the help bucket only.
 *   - `library: 'both'` (default) returns both buckets.
 *   - Within the aviation bucket, `source:`, `rules:`, `tag:`, `kind:`
 *     map to the `@ab/aviation` TagQuery axes. Help-only filters
 *     (`surface:`, `kind:` with a help-kind value) drop aviation hits.
 *   - Within the help bucket, `surface:`, `kind:`, `tag:` narrow through
 *     `matchesFilters` in search-core.
 *
 * Ranking within a bucket: exact > alias > keyword/body. Tie-break
 * alphabetically by title.
 */

import { search as aviationSearch, listReferences, type Reference, type TagQuery } from '@ab/aviation';
import {
	AVIATION_TOPIC_VALUES,
	type AviationTopic,
	FLIGHT_RULES_VALUES,
	type FlightRules,
	KNOWLEDGE_KIND_VALUES,
	type KnowledgeKind,
	type ReferenceSourceType,
	SOURCE_TYPE_VALUES,
} from '@ab/constants';
import { parseQuery } from './query-parser';
import { helpRegistry } from './registry';
import type { ParsedFilter, ParsedQuery, SearchFilters, SearchResult, SearchResultSet } from './schema/help-registry';
import { rankBucket } from './search-core';

const DEFAULT_LIMIT = 50;

export function search(rawQuery: string, filters: SearchFilters = {}): SearchResultSet {
	const parsed = parseQuery(rawQuery);
	const library = filters.library ?? pickLibrary(parsed) ?? 'both';
	const limit = filters.limit ?? DEFAULT_LIMIT;

	const aviation = library === 'help' ? [] : searchAviation(parsed, limit);
	const help = library === 'aviation' ? [] : searchHelp(parsed, limit);

	return { aviation, help };
}

/**
 * Surface parsed filters for unit tests + the UI chip rendering. Keeps
 * query -> facet translation logic in one place.
 */
export { parseQuery };

// -------- library detection --------

function pickLibrary(parsed: ParsedQuery): 'aviation' | 'help' | 'both' | null {
	for (const filter of parsed.filters) {
		if (filter.key !== 'lib') continue;
		if (filter.values.includes('both')) return 'both';
		const hasAviation = filter.values.includes('aviation');
		const hasHelp = filter.values.includes('help');
		if (hasAviation && !hasHelp) return 'aviation';
		if (hasHelp && !hasAviation) return 'help';
		return 'both';
	}
	return null;
}

// -------- aviation bucket --------

function searchAviation(parsed: ParsedQuery, limit: number): readonly SearchResult[] {
	// Help-only filters (`surface:`, `kind:` when the value is a help-kind)
	// empty the aviation bucket entirely -- those axes don't exist on
	// references. Detect that case up front.
	if (aviationFiltersImplyEmpty(parsed.filters)) return [];

	const tagQuery = buildAviationTagQuery(parsed.filters);

	// Call @ab/aviation's search. When tagQuery is empty + freeText empty,
	// return the full listing (caller wants every reference).
	const hits = aviationSearch({
		text: parsed.freeText.length > 0 ? parsed.freeText : undefined,
		tags: hasAnyAxis(tagQuery) ? tagQuery : undefined,
	});
	const refs: readonly Reference[] = hits.map((h) => h.reference);
	const needle = parsed.freeText.trim().toLowerCase();

	const results: SearchResult[] = [];
	for (const ref of refs) {
		const bucket = rankReference(ref, needle);
		if (bucket === null) continue;
		results.push({
			library: 'aviation',
			sourceType: ref.tags.sourceType,
			id: ref.id,
			title: ref.displayName,
			snippet: firstLine(ref.paraphrase),
			rankBucket: bucket,
		});
	}

	sortResults(results);

	// Handle the all-listing case where `aviationSearch` returned every ref
	// (freeText empty, no tags). The ranker assigns bucket 3 to every entry
	// -- that's correct for a tag-only filter. For a completely empty
	// query + no library narrowing, an empty result is more useful than
	// dumping 175 aviation rows, so the facade returns nothing for that
	// pathological case.
	if (parsed.freeText.trim().length === 0 && parsed.filters.length === 0) {
		return [];
	}

	// If the caller filtered tag-only (no freeText), surface in registration
	// order but still honor the per-bucket limit.
	if (parsed.freeText.trim().length === 0) {
		const tagHits: SearchResult[] = refs.slice(0, limit).map((ref) => ({
			library: 'aviation',
			sourceType: ref.tags.sourceType,
			id: ref.id,
			title: ref.displayName,
			snippet: firstLine(ref.paraphrase),
			rankBucket: 3,
		}));
		return tagHits;
	}

	return results.slice(0, limit);
}

function aviationFiltersImplyEmpty(filters: readonly ParsedFilter[]): boolean {
	for (const filter of filters) {
		if (filter.key === 'surface') return true;
		if (filter.key === 'kind') {
			// `kind` is ambiguous between help-kind and knowledge-kind; if
			// NONE of the values resolve to a valid knowledge-kind, the
			// aviation bucket is empty.
			const hasAviationKind = filter.values.some((v) => (KNOWLEDGE_KIND_VALUES as readonly string[]).includes(v));
			if (!hasAviationKind) return true;
		}
	}
	return false;
}

function buildAviationTagQuery(filters: readonly ParsedFilter[]): TagQuery {
	const query: TagQuery = {};
	for (const filter of filters) {
		switch (filter.key) {
			case 'source': {
				const value = filter.values.find((v) => (SOURCE_TYPE_VALUES as readonly string[]).includes(v)) as
					| ReferenceSourceType
					| undefined;
				if (value) query.sourceType = value;
				break;
			}
			case 'rules': {
				const value = filter.values.find((v) => (FLIGHT_RULES_VALUES as readonly string[]).includes(v)) as
					| FlightRules
					| undefined;
				if (value) query.flightRules = value;
				break;
			}
			case 'kind': {
				const value = filter.values.find((v) => (KNOWLEDGE_KIND_VALUES as readonly string[]).includes(v)) as
					| KnowledgeKind
					| undefined;
				if (value) query.knowledgeKind = value;
				break;
			}
			case 'tag': {
				const topics = filter.values.filter((v) =>
					(AVIATION_TOPIC_VALUES as readonly string[]).includes(v),
				) as AviationTopic[];
				if (topics.length > 0) query.aviationTopic = topics;
				break;
			}
			default:
				break;
		}
	}
	return query;
}

function hasAnyAxis(query: TagQuery): boolean {
	return Boolean(
		query.sourceType ||
			query.flightRules ||
			query.knowledgeKind ||
			(query.aviationTopic && query.aviationTopic.length > 0),
	);
}

function rankReference(ref: Reference, needle: string): 1 | 2 | 3 | null {
	if (needle.length === 0) return 3;
	return rankBucket({
		needle,
		displayName: ref.displayName,
		aliases: ref.aliases,
		keywords: ref.tags.keywords ?? [],
		bodies: [ref.paraphrase],
	});
}

// -------- help bucket --------

function searchHelp(parsed: ParsedQuery, limit: number): readonly SearchResult[] {
	// Empty query + no filters: don't flood the bucket with every page.
	if (parsed.freeText.trim().length === 0 && parsed.filters.length === 0) return [];

	const results = helpRegistry.search(parsed);
	return results.slice(0, limit);
}

// -------- helpers --------

function firstLine(text: string): string {
	const trimmed = text.trim();
	const firstBreak = trimmed.indexOf('\n');
	return firstBreak < 0 ? trimmed : trimmed.slice(0, firstBreak).trim();
}

function sortResults(results: SearchResult[]): SearchResult[] {
	return results.sort((a, b) => {
		if (a.rankBucket !== b.rankBucket) return a.rankBucket - b.rankBucket;
		return a.title.localeCompare(b.title);
	});
}

/**
 * Helper used by tests + diagnostic surfaces to enumerate aviation refs
 * without going through `search()`. Kept here (rather than re-exporting
 * from `@ab/aviation`) so consumers only import `@ab/help`.
 */
export function listAviationReferences(): readonly Reference[] {
	return listReferences();
}
