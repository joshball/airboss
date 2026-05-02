/**
 * In-memory `HelpPage` registry.
 *
 * A module-global singleton. Apps call either:
 *
 *   - `helpRegistry.registerPages(appId, pages)` -- eager: hand over fully-
 *     bodied `HelpPage[]`. Used by Bun build scripts and tests.
 *   - `helpRegistry.registerIndex(appId, entries, loader)` -- lazy: hand
 *     over metadata-only `HelpPageIndex[]` + a body loader. Used by browser
 *     apps so section markdown does not ride along in the always-loaded
 *     layout bundle.
 *
 * The registry stores pages keyed by id and, per-app, the set of ids an
 * app has registered. Re-registering the same `appId` replaces that app's
 * prior pages (supports HMR + makes a second call at boot a no-op rather
 * than a duplicate-id error).
 *
 * Lookup is O(1) by id and O(n) by appSurface (n ~ page count). Search is
 * linear over the page set -- small dataset, deterministic ranking. Search
 * runs against per-page precomputed lowercased fields (`lowerTitle`,
 * `lowerKeywords`, `searchHaystack`) so each keystroke avoids per-page
 * `String.prototype.toLowerCase` allocations.
 *
 * Tests reset via `helpRegistry.clear()`.
 */

import type { AppSurface } from '@ab/constants';
import type { HelpPage } from './schema/help-page';
import type { HelpPageIndex } from './schema/help-page-index';
import type { HelpBodyLoader, HelpRegistry, ParsedQuery, SearchResult } from './schema/help-registry';
import { matchesFilters, rankBucketIndexed } from './search-core';

// -------- storage --------

/**
 * The materialised view of a page used by every consumer. `bodyLoaded`
 * tracks whether `sections` carry full markdown or just titles.
 */
interface IndexedPage {
	page: HelpPage;
	/** Pre-lowercased search haystack: summary + section bodies + keywords. */
	searchHaystack: string;
	/** Pre-lowercased title for bucket-1/2 ranking. */
	lowerTitle: string;
	/** Pre-lowercased keywords for bucket-3 ranking. */
	lowerKeywords: readonly string[];
	/** True once a body has been merged in (or the page was registered eagerly). */
	bodyLoaded: boolean;
}

const byId = new Map<string, IndexedPage>();
/** appId -> set of page ids that app registered. Drives per-app replacement. */
const byApp = new Map<string, Set<string>>();
/** appId -> body loader registered via `registerIndex`. */
const loaderByApp = new Map<string, HelpBodyLoader>();
/** id -> in-flight load promise; cached so concurrent loaders share work. */
const inflightLoads = new Map<string, Promise<HelpPage | undefined>>();

// -------- index helpers --------

/**
 * Build the parallel search index for a fully-bodied `HelpPage`. Used by
 * the eager registration path; mirrors what the index file's
 * `searchHaystack` carries on the lazy path.
 */
function indexFromHelpPage(page: HelpPage): IndexedPage {
	const keywords = page.tags.keywords ?? [];
	const haystackParts: string[] = [page.summary];
	for (const section of page.sections) {
		haystackParts.push(section.body);
	}
	for (const keyword of keywords) {
		haystackParts.push(keyword);
	}
	return {
		page,
		searchHaystack: haystackParts.join(' ').toLowerCase(),
		lowerTitle: page.title.toLowerCase(),
		lowerKeywords: keywords.map((k) => k.toLowerCase()),
		bodyLoaded: true,
	};
}

/**
 * Build a stub `HelpPage` from a metadata-only index entry. Sections
 * carry titles only; bodies are empty strings until `loadById` resolves
 * the body and replaces the entry.
 */
function pageFromIndex(entry: HelpPageIndex, appId: string): HelpPage {
	return {
		id: entry.id,
		title: entry.title,
		summary: entry.summary,
		tags: entry.tags,
		sections: entry.sections.map((s) => ({ id: s.id, title: s.title, body: '' })),
		documents: entry.documents,
		related: entry.related,
		author: entry.author,
		reviewedAt: entry.reviewedAt,
		appId,
		concept: entry.concept,
		externalRefs: entry.externalRefs,
	};
}

function indexFromIndexEntry(entry: HelpPageIndex, appId: string): IndexedPage {
	const keywords = entry.tags.keywords ?? [];
	return {
		page: pageFromIndex(entry, appId),
		searchHaystack: entry.searchHaystack,
		lowerTitle: entry.title.toLowerCase(),
		lowerKeywords: keywords.map((k) => k.toLowerCase()),
		bodyLoaded: false,
	};
}

// -------- implementation --------

function dropAppEntries(appId: string): void {
	const existing = byApp.get(appId);
	if (!existing) return;
	for (const priorId of existing) {
		byId.delete(priorId);
		inflightLoads.delete(priorId);
	}
	existing.clear();
}

function registerPages(appId: string, pages: readonly HelpPage[]): void {
	// Replace the app's prior entries rather than appending. Supports HMR /
	// second-boot-call-is-no-op the spec requires.
	dropAppEntries(appId);
	loaderByApp.delete(appId);
	const owned = byApp.get(appId) ?? new Set<string>();

	for (const page of pages) {
		const stamped = { ...page, appId };
		byId.set(page.id, indexFromHelpPage(stamped));
		owned.add(page.id);
	}

	byApp.set(appId, owned);
}

function registerIndex(appId: string, entries: readonly HelpPageIndex[], loader: HelpBodyLoader): void {
	dropAppEntries(appId);
	const owned = byApp.get(appId) ?? new Set<string>();

	for (const entry of entries) {
		byId.set(entry.id, indexFromIndexEntry(entry, appId));
		owned.add(entry.id);
	}

	byApp.set(appId, owned);
	loaderByApp.set(appId, loader);
}

function getAllPages(): readonly HelpPage[] {
	const out: HelpPage[] = [];
	for (const indexed of byId.values()) {
		out.push(indexed.page);
	}
	return out;
}

function getById(id: string): HelpPage | undefined {
	return byId.get(id)?.page;
}

async function loadById(id: string): Promise<HelpPage | undefined> {
	const indexed = byId.get(id);
	if (!indexed) return undefined;
	if (indexed.bodyLoaded) return indexed.page;
	const cached = inflightLoads.get(id);
	if (cached) return cached;

	const appId = indexed.page.appId;
	const loader = appId ? loaderByApp.get(appId) : undefined;
	if (!loader) {
		// Body wasn't registered (no loader for this app). Treat as already-
		// loaded so we don't keep retrying; the page just renders without a
		// body. Validator catches missing bodies at build time.
		indexed.bodyLoaded = true;
		return indexed.page;
	}

	const promise: Promise<HelpPage | undefined> = (async () => {
		const body = await loader(id);
		// Re-fetch under the lock; another caller may have raced ahead.
		const current = byId.get(id);
		if (!current) return undefined;
		if (current.bodyLoaded && current !== indexed) return current.page;
		if (!body) {
			current.bodyLoaded = true;
			return current.page;
		}
		const merged: HelpPage = {
			...current.page,
			sections: body.sections.map((s) => ({ ...s })),
			externalRefs: body.externalRefs ?? current.page.externalRefs,
		};
		current.page = merged;
		current.bodyLoaded = true;
		// Refresh the haystack to include real body bytes -- if the index
		// haystack already contained them this is a no-op rebuild that
		// stabilises content/index drift after a body edit.
		const keywords = merged.tags.keywords ?? [];
		const parts: string[] = [merged.summary];
		for (const section of merged.sections) {
			parts.push(section.body);
		}
		for (const keyword of keywords) {
			parts.push(keyword);
		}
		current.searchHaystack = parts.join(' ').toLowerCase();
		return current.page;
	})();

	inflightLoads.set(id, promise);
	try {
		return await promise;
	} finally {
		inflightLoads.delete(id);
	}
}

function getByAppSurface(surface: AppSurface): readonly HelpPage[] {
	const out: HelpPage[] = [];
	for (const indexed of byId.values()) {
		if (indexed.page.tags.appSurface[0] === surface) out.push(indexed.page);
	}
	return out;
}

function search(query: ParsedQuery): readonly SearchResult[] {
	const results: SearchResult[] = [];
	const needle = query.freeText.trim().toLowerCase();
	for (const indexed of byId.values()) {
		if (!matchesFilters(indexed.page, query.filters)) continue;
		const bucket = rankBucketIndexed({
			needle,
			lowerTitle: indexed.lowerTitle,
			lowerAliases: [],
			lowerKeywords: indexed.lowerKeywords,
			lowerHaystack: indexed.searchHaystack,
		});
		if (bucket === null) continue;
		results.push({
			library: 'help',
			sourceType: indexed.page.tags.helpKind,
			id: indexed.page.id,
			title: indexed.page.title,
			snippet: indexed.page.summary,
			rankBucket: bucket,
		});
	}
	return sortResults(results);
}

function clear(): void {
	byId.clear();
	byApp.clear();
	loaderByApp.clear();
	inflightLoads.clear();
}

function sortResults(results: SearchResult[]): SearchResult[] {
	return results.sort((a, b) => {
		if (a.rankBucket !== b.rankBucket) return a.rankBucket - b.rankBucket;
		return a.title.localeCompare(b.title);
	});
}

// -------- singleton export --------

export const helpRegistry: HelpRegistry = {
	registerPages,
	registerIndex,
	getAllPages,
	getById,
	loadById,
	getByAppSurface,
	search,
	clear,
};
