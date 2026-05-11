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

import { search as aviationSearch, listReferences, type Reference, type SearchHit, type TagQuery } from '@ab/aviation';
import {
	AVIATION_TOPIC_VALUES,
	type AviationTopic,
	FLIGHT_RULES_VALUES,
	type FlightRules,
	KNOWLEDGE_KIND_VALUES,
	type KnowledgeKind,
	REFERENCE_SOURCE_TYPES,
	type ReferenceSourceType,
	SOURCE_TYPE_VALUES,
} from '@ab/constants';
import { parseQuery } from './query-parser';
import { helpRegistry } from './registry';
import type { ParsedFilter, ParsedQuery, SearchFilters, SearchResult, SearchResultSet } from './schema/help-registry';
import type { SearchResultType } from './schema/result-types';
import { rankBucket } from './search-core';

/**
 * Classify a registry `Reference` into a `SearchResultType` based on its
 * source-type tag. Handbook source-types map to the handbook root (`faa.handbook`);
 * CFR / AIM / AC / ACS / PCG map to their dedicated types. Everything else
 * (the firc glossary entries, authored / derived / SOP rows) maps to
 * `airboss.glossary`.
 *
 * Chapter rows (`faa.handbook.chapter`, `faa.cfr.sect`) come from
 * `study.reference_section` via the DB-backed loaders in `./loaders/*`, not
 * from the in-memory aviation registry, so they are not produced here.
 */
function aviationResultType(ref: Reference): SearchResultType {
	const st = ref.tags.sourceType;
	if (st === REFERENCE_SOURCE_TYPES.CFR) return 'faa.cfr.part';
	if (st === REFERENCE_SOURCE_TYPES.AIM) return 'faa.aim';
	if (st === REFERENCE_SOURCE_TYPES.AC) return 'faa.ac';
	if (st === REFERENCE_SOURCE_TYPES.ACS) return 'faa.acs';
	if (st === REFERENCE_SOURCE_TYPES.PCG) return 'airboss.glossary';
	// Handbook family -- one slot per book; mapped via REFERENCE_SOURCE_TYPES.
	if (
		st === REFERENCE_SOURCE_TYPES.PHAK ||
		st === REFERENCE_SOURCE_TYPES.AFH ||
		st === REFERENCE_SOURCE_TYPES.IFH ||
		st === REFERENCE_SOURCE_TYPES.AVWX ||
		st === REFERENCE_SOURCE_TYPES.IPH ||
		st === REFERENCE_SOURCE_TYPES.RMH ||
		st === REFERENCE_SOURCE_TYPES.AIH ||
		st === REFERENCE_SOURCE_TYPES.HFH ||
		st === REFERENCE_SOURCE_TYPES.GFH ||
		st === REFERENCE_SOURCE_TYPES.BFH
	) {
		return 'faa.handbook';
	}
	// Everything else (authored / derived / NTSB / GAJSC / AOPA / FAA_SAFETY /
	// SOP / POH / sectional) is a glossary or domain row -- not a top-level
	// FAA document. Surface in the Airboss Content column.
	return 'airboss.glossary';
}

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
	const refs: readonly Reference[] = hits.map((h: SearchHit) => h.reference);
	const needle = parsed.freeText.trim().toLowerCase();

	const results: SearchResult[] = [];
	for (const ref of refs) {
		const bucket = rankReference(ref, needle);
		if (bucket === null) continue;
		results.push({
			library: 'aviation',
			type: aviationResultType(ref),
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
			type: aviationResultType(ref),
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

// =================================================================
// Typed multi-column facade (Phase 2 of command-palette WP)
//
// `searchGrouped()` is the production facade the multi-column palette UI
// consumes. It composes loader outputs into a `GroupedResults` with column
// buckets, a hoist banner, FAA Resources clusters, and the synonym-rewrite
// chip story. The legacy 2-bucket `search()` is preserved one release for
// any straggler consumer; the only known consumer is `HelpSearchPalette.svelte`
// which is migrated in the same PR.
// =================================================================

import { expandQuery } from '@ab/aviation';
import { loadAviationRefs } from './loaders/aviation-refs';
import { loadExternalTools } from './loaders/external-tools';
import { loadHelpPages } from './loaders/help-pages';
import type {
	GroupedResults,
	PaletteHost,
	ResultColumn,
	SynonymRewrite,
	SearchResult as TypedResult,
} from './schema/result-types';
import { COLUMN_BY_TYPE, COLUMN_ORDER, EMPTY_GROUPED_RESULTS } from './schema/result-types';

/**
 * Compose the typed multi-column palette result set.
 *
 * Composition strategy:
 *   1. Parse the query. Apply synonyms via `@ab/aviation`'s expander so the
 *      rewrite list is the same one the aviation registry sees.
 *   2. Run every loader that doesn't need a DB connection in-process. DB-
 *      backed loaders (cards, reps, plans, knowledge nodes, handbook
 *      sections, CFR sections, AIM sections) are invoked by the route's
 *      `+page.server.ts` and merged via `mergeServerLoadedResults()` before
 *      the UI renders.
 *   3. Assign every row to its column via `COLUMN_BY_TYPE`.
 *   4. Compute the banner hit (a single tier-1 match across all groups).
 *   5. Compute FAA Resources clusters -- handbook chapters under their
 *      handbook root, CFR sections under their part.
 *
 * The function is synchronous and pure; no I/O. Server-side loaders run
 * outside this function and pass their typed rows back via the `injected`
 * argument (Phase 2c wires the server hand-off).
 */
export function searchGrouped(
	rawQuery: string,
	host: PaletteHost,
	injected: readonly TypedResult[] = [],
): GroupedResults {
	const parsed = parseQuery(rawQuery);
	const freeText = parsed.freeText.trim();
	if (freeText.length === 0 && parsed.filters.length === 0 && injected.length === 0) {
		return { ...EMPTY_GROUPED_RESULTS, filters: parsed.filters };
	}

	// In-process loaders. DB-backed loaders run server-side and feed via `injected`.
	const aviation = loadAviationRefs(parsed, host);
	const helpPages = loadHelpPages(parsed, host);
	const tools = loadExternalTools(parsed, host);
	const all = [...aviation, ...helpPages, ...tools, ...injected];

	// Bucket into columns.
	const columns: Record<ResultColumn, TypedResult[]> = {
		'faa-resources': [],
		'airboss-content': [],
		'app-help': [],
		'my-stuff': [],
		'external-tools': [],
		commands: [],
	};
	for (const row of all) {
		const col = COLUMN_BY_TYPE[row.type];
		columns[col].push(row);
	}

	// Sort each column by rankBucket then title.
	for (const key of COLUMN_ORDER) {
		columns[key] = sortTyped(columns[key]);
	}

	// Banner hoist: a single tier-1 match across every column. If 0 or >1,
	// no banner -- ambiguous queries don't earn a guess.
	const tierOnes: TypedResult[] = [];
	for (const key of COLUMN_ORDER) {
		for (const row of columns[key]) {
			if (row.rankBucket === 1) tierOnes.push(row);
			if (tierOnes.length > 1) break;
		}
		if (tierOnes.length > 1) break;
	}
	const bannerHit = tierOnes.length === 1 ? (tierOnes[0] ?? null) : null;

	// FAA Resources clusters. A handbook root row "owns" any chapter that
	// names its doc-code as `parentDocCode`; a CFR part owns sections that
	// reference its id. Children sort by title (the loader sets a stable
	// title; an ordinal field could plug in here later).
	const clusters = buildClusters(columns['faa-resources']);

	// Synonym chips: ask the aviation expander what it would rewrite the
	// free-text to. Each non-identity rewrite becomes a removable chip.
	const synonymsApplied: SynonymRewrite[] = buildSynonymRewrites(freeText);

	const totalCount = COLUMN_ORDER.reduce((sum, key) => sum + columns[key].length, 0);

	return {
		bannerHit,
		columns,
		clusters,
		synonymsApplied,
		filters: parsed.filters,
		totalCount,
	};
}

function sortTyped(rows: readonly TypedResult[]): TypedResult[] {
	return [...rows].sort((a, b) => {
		if (a.rankBucket !== b.rankBucket) return a.rankBucket - b.rankBucket;
		return a.title.localeCompare(b.title);
	});
}

function buildClusters(
	faaRows: readonly TypedResult[],
): readonly { parent: TypedResult; children: readonly TypedResult[] }[] {
	const byParent = new Map<string, TypedResult[]>();
	const rootsById = new Map<string, TypedResult>();
	for (const row of faaRows) {
		if (row.type === 'faa.handbook' || row.type === 'faa.cfr.part') {
			rootsById.set(row.id, row);
		} else if (row.parentDocCode) {
			const bucket = byParent.get(row.parentDocCode) ?? [];
			bucket.push(row);
			byParent.set(row.parentDocCode, bucket);
		}
	}
	const out: { parent: TypedResult; children: readonly TypedResult[] }[] = [];
	for (const [parentId, children] of byParent) {
		const parent = rootsById.get(parentId);
		if (!parent) continue;
		out.push({ parent, children: [...children].sort((a, b) => a.title.localeCompare(b.title)) });
	}
	return out;
}

function buildSynonymRewrites(freeText: string): SynonymRewrite[] {
	const lower = freeText.toLowerCase().trim();
	if (lower.length === 0) return [];
	const rewrites: SynonymRewrite[] = [];
	for (const token of lower.split(/\s+/)) {
		if (!token) continue;
		const expanded = expandQuery(token);
		for (const candidate of expanded) {
			if (candidate === token) continue;
			rewrites.push({ from: token, to: candidate });
		}
	}
	// Dedupe by (from, to) pair, preserve first occurrence.
	const seen = new Set<string>();
	const deduped: SynonymRewrite[] = [];
	for (const rw of rewrites) {
		const key = `${rw.from}␟${rw.to}`;
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push(rw);
	}
	return deduped;
}
