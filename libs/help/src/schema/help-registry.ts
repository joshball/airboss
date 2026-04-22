/**
 * Type contracts for the in-memory help registry.
 *
 * The concrete singleton implementation lives in `../registry.ts`. This
 * module exports the interface shape + the search-result types that cross
 * the library boundary.
 */

import type { AppSurface } from '@ab/constants';
import type { HelpPage } from './help-page';

/**
 * Result from cross-library search. Library + sourceType are always set so
 * the UI can label the result explicitly. There is no cross-bucket implicit
 * ranking -- results are grouped by `library` and ranked within each bucket.
 */
export interface SearchResult {
	/** Which library this result came from. */
	library: 'aviation' | 'help';
	/**
	 * Source-type subtag. For aviation: `cfr` / `aim` / `authored` / ...
	 * For help: the `helpKind` (`concept` / `how-to` / ...).
	 */
	sourceType: string;
	/** Stable id in the owning registry. */
	id: string;
	/** Human-facing label for the result. */
	title: string;
	/** One-line snippet for the result card. */
	snippet: string;
	/**
	 * Which rank bucket this hit fell into: 1 = exact, 2 = alias, 3 =
	 * keyword/body. Lower is better. Tie-break alphabetically by title.
	 */
	rankBucket: 1 | 2 | 3;
}

/**
 * Two-bucket search result set. Aviation + help are returned as independent
 * lists -- the UI decides ordering (library first is layout, not ranking).
 * Per architecture decision #4, there is no cross-bucket ranking.
 */
export interface SearchResultSet {
	aviation: readonly SearchResult[];
	help: readonly SearchResult[];
}

/** Parsed query output from `query-parser.ts`. */
export interface ParsedQuery {
	/** Free-text tokens, joined with spaces for substring matching. */
	freeText: string;
	/** Structured facet filters. Multi-value per facet allowed (OR within). */
	filters: ParsedFilter[];
}

export interface ParsedFilter {
	/** Facet key, normalized lowercase. */
	key: FilterKey;
	/** Comma-separated values; at least one. */
	values: readonly string[];
}

/**
 * Recognized filter facets. Unknown facets fall back to free-text rather
 * than erroring, so authors' typos do not produce empty result sets.
 */
export type FilterKey = 'tag' | 'source' | 'rules' | 'kind' | 'surface' | 'lib';

/** Top-level filters applied to `search(raw, filters)` from the caller. */
export interface SearchFilters {
	/** Narrow to a single library; `both` is the default. */
	library?: 'aviation' | 'help' | 'both';
	/** Limit the per-bucket result count. Default 50 per bucket. */
	limit?: number;
}

/**
 * The registry API. The concrete singleton is exported from
 * `../registry.ts` as `helpRegistry`.
 */
export interface HelpRegistry {
	/**
	 * Register a batch of pages for an app. Idempotent per-appId: calling
	 * twice with the same appId replaces that app's pages (supports HMR
	 * and per-request isolation in dev). Cross-app page-id collisions are
	 * reported as errors at build time by the validator.
	 */
	registerPages(appId: string, pages: readonly HelpPage[]): void;

	/** All currently-registered pages, iteration order by app then page. */
	getAllPages(): readonly HelpPage[];

	/** Lookup a page by id. */
	getById(id: string): HelpPage | undefined;

	/**
	 * Every page whose primary `appSurface` (first entry) is the given
	 * surface. Drives the `/help` index grouping.
	 */
	getByAppSurface(surface: AppSurface): readonly HelpPage[];

	/**
	 * Search the help-only registry. Returns within-bucket-ranked help
	 * results; does NOT search aviation. Use `search()` in `../search.ts`
	 * for the cross-library facade.
	 */
	search(query: ParsedQuery): readonly SearchResult[];

	/** Reset the registry. Tests + HMR only. */
	clear(): void;
}
