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

import {
	search as aviationSearch,
	expandQuery,
	listReferences,
	type Reference,
	type SearchHit,
	type TagQuery,
} from '@ab/aviation';
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
	TOP_HITS_MAX,
} from '@ab/constants';
import { classifyIntent, type SearchIntent } from './intent-classifier';
import { loadAviationRefs } from './loaders/aviation-refs';
import { loadExternalTools } from './loaders/external-tools';
import { loadHelpPages } from './loaders/help-pages';
import { parseQuery } from './query-parser';
import { helpRegistry } from './registry';
import type { ParsedFilter, ParsedQuery, SearchFilters, SearchResult, SearchResultSet } from './schema/help-registry';
import {
	COLUMN_BY_TYPE,
	COLUMN_ORDER,
	EMPTY_GROUPED_RESULTS,
	type GroupedResults,
	type PaletteHost,
	type ResultColumn,
	type SearchResultType,
	type SynonymRewrite,
	type SearchResult as TypedResult,
} from './schema/result-types';
import { rankBucket, scoreResult } from './search-core';

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

/**
 * Legacy two-bucket facade. Returns `{ aviation, help }` -- the pre-Phase-2
 * shape. New callers should use `searchGrouped()` which produces the typed
 * `GroupedResults` (columns, banner hoist, clusters, synonyms applied,
 * filters). Removal target: next palette WP phase that touches this file
 * and verifies no remaining call sites.
 *
 * @deprecated -- use `searchGrouped()` instead.
 */
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
// chip story.
// =================================================================

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

	// Classify the search intent up front so the ranker variation +
	// result-panel shape decision is shared with the downstream UI. The
	// autocomplete-committed flag is not surfaced through `searchGrouped`
	// yet (the autocomplete component lands in PR B); a `doc:` chip on
	// `parsed.filters` is the only scoped-intent trigger today.
	const intent = classifyIntent(parsed, false);

	// Honor the `library:` filter / `mine` bare-token sugar. Picking a single
	// library narrows the fan-out so chip-scoped queries (`mine card`) don't
	// flood the columns with FAA + help + external rows the user just told us
	// to ignore. `both` (and absence of any library filter) keep the full
	// fan-out -- the default behavior.
	const libraryScope = libraryScopeFrom(parsed);
	const wantAviation = libraryScope === 'both' || libraryScope === 'aviation';
	const wantHelp = libraryScope === 'both' || libraryScope === 'help';
	const wantTools = libraryScope === 'both';

	// In-process loaders. DB-backed loaders run server-side and feed via `injected`.
	const aviation = wantAviation ? loadAviationRefs(parsed, host) : [];
	const helpPages = wantHelp ? loadHelpPages(parsed, host) : [];
	const tools = wantTools ? loadExternalTools(parsed, host) : [];
	const injectedRows = filterInjectedByScope(injected, libraryScope);

	// Score every row using the Phase 3.5 composite scorer. Loaders left
	// the rankBucket field populated (back-compat), but downstream sorting,
	// top-hits selection, and book-level collapse all key off the score.
	const all = withScores([...aviation, ...helpPages, ...tools, ...injectedRows], freeText, intent);

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

	// Sort each column by composite score (descending) then alpha title.
	for (const key of COLUMN_ORDER) {
		columns[key] = sortTyped(columns[key]);
	}

	// Book-level collapse (R11) -- in I-1 / I-2, roll handbook chapters
	// under their handbook root, CFR sections under their CFR Part. The
	// chapters are removed from the top-level column and become
	// `parent.children`. In I-3 phrase-FTS the leaf rows ARE the result,
	// so we skip the collapse entirely.
	if (intent !== 'phrase-fts') {
		columns['faa-resources'] = collapseBooks(columns['faa-resources']);
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

	// Library clusters. A handbook root row "owns" any chapter that
	// shares its `clusterKey` (canonical doc slug); a CFR part owns
	// sections whose `clusterKey` matches its slug. Children sort by
	// title. Note: clusters are computed BEFORE collapse for back-compat;
	// the collapsed column has the same parent rows but with the children
	// folded onto `parent.children`. UI PR migrates consumers to use
	// `children` and drops the `clusters` field.
	const clusters = buildClusters([
		...aviation,
		...injectedRows.filter((r) => COLUMN_BY_TYPE[r.type] === 'faa-resources'),
	]);

	// Top-hits strip (3.5c / R8) -- the top `TOP_HITS_MAX` rows across
	// every column by composite score. Mixed types. Hidden in I-3 mode
	// (phrase-FTS users want passages, not a top-hits summary).
	const topHits = intent === 'phrase-fts' ? [] : computeTopHits(columns);

	// Synonym chips: ask the aviation expander what it would rewrite the
	// free-text to. Each non-identity rewrite becomes a removable chip.
	const synonymsApplied: SynonymRewrite[] = buildSynonymRewrites(freeText);

	const totalCount = COLUMN_ORDER.reduce((sum, key) => sum + columns[key].length, 0);

	return {
		bannerHit,
		topHits,
		intent,
		columns,
		clusters,
		synonymsApplied,
		filters: parsed.filters,
		totalCount,
	};
}

/**
 * Annotate each typed result with its composite Phase 3.5 score (computed
 * here, not by individual loaders). Loaders supplied `rankBucket` already;
 * we add `score` so downstream code (sort, top-hits, collapse, UI) can
 * key off the more precise signal. Leaves the rest of the row untouched.
 */
function withScores(rows: readonly TypedResult[], needle: string, intent: SearchIntent): readonly TypedResult[] {
	if (rows.length === 0) return rows;
	return rows.map((r) => ({
		...r,
		score: scoreResult(needle, r, intent),
	}));
}

/**
 * Sort rows by composite score (descending) when present, falling back
 * to the legacy `rankBucket` for any row that hasn't been scored yet
 * (defensive -- `withScores` ran on every facade-bound row, but
 * external callers may invoke `sortTyped` on un-scored arrays).
 */
function sortTyped(rows: readonly TypedResult[]): TypedResult[] {
	return [...rows].sort((a, b) => {
		const aScore = a.score ?? null;
		const bScore = b.score ?? null;
		if (aScore !== null && bScore !== null && aScore !== bScore) {
			return bScore - aScore;
		}
		if (a.rankBucket !== b.rankBucket) return a.rankBucket - b.rankBucket;
		return a.title.localeCompare(b.title);
	});
}

/**
 * Compute the top-hits strip rows. Picks the highest-scored
 * `TOP_HITS_MAX` rows across every column. Rows already sorted within
 * their column; this is a global k-way merge that respects descending
 * score order.
 */
function computeTopHits(columns: Record<ResultColumn, readonly TypedResult[]>): readonly TypedResult[] {
	const all: TypedResult[] = [];
	for (const key of COLUMN_ORDER) {
		for (const row of columns[key]) all.push(row);
	}
	all.sort((a, b) => {
		const aScore = a.score ?? 0;
		const bScore = b.score ?? 0;
		if (aScore !== bScore) return bScore - aScore;
		return a.title.localeCompare(b.title);
	});
	return all.slice(0, TOP_HITS_MAX);
}

/**
 * Book-level collapse (Phase 3.5 / R11). Walks the FAA Resources column,
 * pairs handbook chapters with their handbook root by `clusterKey`, and
 * folds the children onto `parent.children`. The chapters are removed
 * from the top-level array. Same for CFR Part + CFR sections.
 *
 * When a child has no matching parent in the column (parent didn't
 * match the query, or parent isn't in the result set), the child stays
 * at top-level -- we never silently drop matches.
 */
function collapseBooks(rows: readonly TypedResult[]): TypedResult[] {
	const PARENT_TYPES: ReadonlySet<SearchResultType> = new Set(['faa.handbook', 'faa.cfr.part', 'faa.aim']);
	const CHILD_TYPES: ReadonlySet<SearchResultType> = new Set(['faa.handbook.chapter', 'faa.cfr.sect']);
	const parentByKey = new Map<string, TypedResult>();
	const out: TypedResult[] = [];
	const childGroups = new Map<string, TypedResult[]>();
	for (const row of rows) {
		if (PARENT_TYPES.has(row.type) && row.clusterKey) {
			parentByKey.set(row.clusterKey, row);
			out.push(row);
		} else if (CHILD_TYPES.has(row.type) && row.clusterKey) {
			const bucket = childGroups.get(row.clusterKey) ?? [];
			bucket.push(row);
			childGroups.set(row.clusterKey, bucket);
		} else {
			out.push(row);
		}
	}
	// Attach children to their parent or, if no parent matched, restore
	// the children to the flat output (they're real matches, just orphans).
	const collapsed: TypedResult[] = [];
	const orphanChildren: TypedResult[] = [];
	for (const [key, children] of childGroups) {
		const parent = parentByKey.get(key);
		if (parent) {
			const idx = out.indexOf(parent);
			if (idx >= 0) {
				out[idx] = {
					...parent,
					children: [...children].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.title.localeCompare(b.title)),
				};
			}
		} else {
			for (const c of children) orphanChildren.push(c);
		}
	}
	for (const row of out) collapsed.push(row);
	for (const orphan of orphanChildren) collapsed.push(orphan);
	// Re-sort the collapsed array by score descending.
	collapsed.sort((a, b) => {
		const aScore = a.score ?? 0;
		const bScore = b.score ?? 0;
		if (aScore !== bScore) return bScore - aScore;
		return a.title.localeCompare(b.title);
	});
	return collapsed;
}

function buildClusters(
	faaRows: readonly TypedResult[],
): readonly { parent: TypedResult; children: readonly TypedResult[] }[] {
	const byClusterKey = new Map<string, TypedResult[]>();
	const rootsByKey = new Map<string, TypedResult>();
	for (const row of faaRows) {
		if (!row.clusterKey) continue;
		if (row.type === 'faa.handbook' || row.type === 'faa.cfr.part') {
			rootsByKey.set(row.clusterKey, row);
		} else {
			const bucket = byClusterKey.get(row.clusterKey) ?? [];
			bucket.push(row);
			byClusterKey.set(row.clusterKey, bucket);
		}
	}
	const out: { parent: TypedResult; children: readonly TypedResult[] }[] = [];
	for (const [key, children] of byClusterKey) {
		const parent = rootsByKey.get(key);
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

/**
 * Library scopes supported by the chip story. `mine` is the new value
 * introduced for the bare-token sugar (`mine` -> `library:mine`); the other
 * three match the legacy `library:` filter values.
 */
type LibraryScope = 'both' | 'aviation' | 'help' | 'mine';

function libraryScopeFrom(parsed: ParsedQuery): LibraryScope {
	for (const filter of parsed.filters) {
		if (filter.key !== 'library' && filter.key !== 'lib') continue;
		if (filter.values.includes('mine')) return 'mine';
		if (filter.values.includes('both')) return 'both';
		const hasAviation = filter.values.includes('aviation');
		const hasHelp = filter.values.includes('help');
		if (hasAviation && !hasHelp) return 'aviation';
		if (hasHelp && !hasAviation) return 'help';
		return 'both';
	}
	return 'both';
}

/**
 * Drop injected rows that don't belong to the active library scope. `both`
 * keeps everything; `mine` keeps only mine.* rows; `aviation` keeps faa.*
 * and airboss.* content rows but drops mine.* / web.tool; `help` keeps only
 * airboss.help rows from the injected slice (DB-backed help would be the
 * only candidate; today no DB-backed help loader exists, so this is empty in
 * practice).
 */
function filterInjectedByScope(injected: readonly TypedResult[], scope: LibraryScope): readonly TypedResult[] {
	if (scope === 'both') return injected;
	if (scope === 'mine') return injected.filter((row) => row.type.startsWith('mine.'));
	if (scope === 'aviation') {
		return injected.filter(
			(row) =>
				row.type.startsWith('faa.') ||
				row.type === 'airboss.knode' ||
				row.type === 'airboss.course' ||
				row.type === 'airboss.glossary',
		);
	}
	// help
	return injected.filter((row) => row.type === 'airboss.help');
}
