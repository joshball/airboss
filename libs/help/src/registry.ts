/**
 * In-memory `HelpPage` registry.
 *
 * A module-global singleton. Apps call `helpRegistry.registerPages(appId,
 * pages)` at boot to hand over their content; the registry stores pages
 * keyed by id and, per-app, the set of ids an app has registered. Re-
 * registering the same `appId` replaces that app's prior pages (supports
 * HMR + makes a second call at boot a no-op rather than a duplicate-id
 * error).
 *
 * Lookup is O(1) by id and O(n) by appSurface (n ~ page count). Search is
 * linear over the page set -- small dataset, deterministic ranking.
 *
 * Tests reset via `helpRegistry.clear()`.
 */

import type { AppSurface } from '@ab/constants';
import type { HelpPage } from './schema/help-page';
import type { HelpRegistry, ParsedQuery, SearchResult } from './schema/help-registry';
import { matchesFilters, rankBucket } from './search-core';

// -------- storage --------

const byId = new Map<string, HelpPage>();
/** appId -> set of page ids that app registered. Drives per-app replacement. */
const byApp = new Map<string, Set<string>>();

// -------- implementation --------

function registerPages(appId: string, pages: readonly HelpPage[]): void {
	// Replace the app's prior entries rather than appending. Supports the
	// HMR / second-boot-call-is-no-op case the spec requires.
	const existing = byApp.get(appId);
	if (existing) {
		for (const priorId of existing) {
			byId.delete(priorId);
		}
		existing.clear();
	}
	const owned = existing ?? new Set<string>();

	for (const page of pages) {
		// Cross-app duplicate ids are caught by the validator at build
		// time. At runtime we trust the build; last-write-wins.
		byId.set(page.id, { ...page, appId });
		owned.add(page.id);
	}

	byApp.set(appId, owned);
}

function getAllPages(): readonly HelpPage[] {
	return Array.from(byId.values());
}

function getById(id: string): HelpPage | undefined {
	return byId.get(id);
}

function getByAppSurface(surface: AppSurface): readonly HelpPage[] {
	const out: HelpPage[] = [];
	for (const page of byId.values()) {
		if (page.tags.appSurface[0] === surface) out.push(page);
	}
	return out;
}

function search(query: ParsedQuery): readonly SearchResult[] {
	const results: SearchResult[] = [];
	const needle = query.freeText.trim().toLowerCase();
	for (const page of byId.values()) {
		if (!matchesFilters(page, query.filters)) continue;
		const bucket = rankHelpPage(page, needle);
		if (bucket === null) continue;
		results.push({
			library: 'help',
			sourceType: page.tags.helpKind,
			id: page.id,
			title: page.title,
			snippet: page.summary,
			rankBucket: bucket,
		});
	}
	return sortResults(results);
}

function clear(): void {
	byId.clear();
	byApp.clear();
}

// -------- ranking --------

function rankHelpPage(page: HelpPage, needle: string): 1 | 2 | 3 | null {
	if (needle.length === 0) return 3;
	return rankBucket({
		needle,
		displayName: page.title,
		aliases: [],
		keywords: page.tags.keywords ?? [],
		bodies: [page.summary, ...page.sections.map((s) => s.body)],
	});
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
	getAllPages,
	getById,
	getByAppSurface,
	search,
	clear,
};
