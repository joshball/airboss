/**
 * Search ranking + filter predicates shared by the help registry and the
 * cross-library search facade.
 *
 * Kept in a separate module so:
 *  - `registry.ts` can rank help-only hits without pulling `@ab/aviation`;
 *  - `search.ts` can reuse the same filter predicates to narrow aviation
 *    hits through the same facet language (`tag:`, `rules:`, etc.).
 *
 * No heuristics or semantic search. Three rank buckets, deterministic,
 * alphabetical tie-break.
 */

import type { HelpPage } from './schema/help-page';
import type { ParsedFilter } from './schema/help-registry';

export interface RankInput {
	needle: string;
	displayName: string;
	aliases: readonly string[];
	keywords: readonly string[];
	/**
	 * Any additional string haystacks to match for the keyword/body bucket.
	 * For aviation: the paraphrase. For help: summary + section bodies.
	 */
	bodies: readonly string[];
}

/**
 * Returns the rank bucket for the given input:
 *   1 = exact-match on displayName (case-insensitive) or in aliases.
 *   2 = substring-match on displayName or alias.
 *   3 = substring-match on any keyword or body.
 * null = no hit.
 */
export function rankBucket(input: RankInput): 1 | 2 | 3 | null {
	const { needle } = input;
	if (needle.length === 0) return 3;
	const lowerName = input.displayName.toLowerCase();
	const lowerAliases = input.aliases.map((a) => a.toLowerCase());

	if (lowerName === needle) return 1;
	if (lowerAliases.includes(needle)) return 1;

	if (lowerName.includes(needle)) return 2;
	for (const alias of lowerAliases) {
		if (alias.includes(needle)) return 2;
	}

	for (const keyword of input.keywords) {
		if (keyword.toLowerCase().includes(needle)) return 3;
	}
	for (const body of input.bodies) {
		if (body.toLowerCase().includes(needle)) return 3;
	}
	return null;
}

/**
 * True when a help page satisfies every provided facet filter. Each filter
 * is AND; within a filter, its comma-separated values are OR.
 *
 * Facets consumed here:
 *   - `lib:help` / `lib:aviation` -- handled at the search facade level
 *     (we trust only help pages reach this function when the filter is
 *     `lib:help` from the facade).
 *   - `surface:<appSurface>` -- matches any entry in page.tags.appSurface.
 *   - `kind:<helpKind>` -- matches page.tags.helpKind.
 *   - `tag:<aviationTopic>` -- matches when page.tags.aviationTopic
 *     includes the value.
 *   - `source:*` / `rules:*` -- don't apply to help pages; returns false
 *     when filtered (so help bucket empties cleanly).
 */
export function matchesFilters(page: HelpPage, filters: readonly ParsedFilter[]): boolean {
	for (const filter of filters) {
		switch (filter.key) {
			case 'lib': {
				// Help pages only match `lib:help` / `lib:both`. `lib:aviation`
				// alone empties the help bucket.
				if (!filter.values.includes('help') && !filter.values.includes('both')) {
					return false;
				}
				break;
			}
			case 'surface': {
				const anyMatch = page.tags.appSurface.some((s) => filter.values.includes(s));
				if (!anyMatch) return false;
				break;
			}
			case 'kind': {
				if (!filter.values.includes(page.tags.helpKind)) return false;
				break;
			}
			case 'tag': {
				const topics = page.tags.aviationTopic ?? [];
				const anyMatch = topics.some((t) => filter.values.includes(t));
				if (!anyMatch) return false;
				break;
			}
			case 'source':
			case 'rules':
				// These facets describe aviation-only axes (sourceType,
				// flightRules). A help page can never satisfy them.
				return false;
			default: {
				// Should be exhaustive, but keep the guard in case a new
				// FilterKey is added without updating this switch.
				const exhaustive: never = filter.key;
				void exhaustive;
				return false;
			}
		}
	}
	return true;
}
