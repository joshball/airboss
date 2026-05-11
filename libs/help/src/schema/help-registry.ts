/**
 * Type contracts for the in-memory help registry.
 *
 * The concrete singleton implementation lives in `../registry.ts`. This
 * module exports the interface shape + the search-result types that cross
 * the library boundary.
 */

import type { AppSurface } from '@ab/constants';
import type { HelpPage } from './help-page';
import type { HelpPageBody } from './help-page-body';
import type { HelpPageIndex } from './help-page-index';
import type { SearchResultType } from './result-types';

/**
 * Help-registry-internal search hit shape.
 *
 * Returned only by `helpRegistry.search()` -- the help-only path. The
 * cross-library palette facade in `../search.ts` translates these (and
 * loader-produced rows) into the typed `SearchResult` exported from
 * `./result-types.ts`, which is the shape that crosses the library
 * boundary into the UI and command-registry surfaces.
 *
 * `type` is `airboss.help` for every row produced here (the registry only
 * holds help pages). Carrying it explicitly avoids a remap in the loader.
 */
export interface SearchResult {
	/** Which library this result came from. */
	library: 'aviation' | 'help';
	/** Result-type discriminator -- one of the SearchResultType values. */
	type: SearchResultType;
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
	/**
	 * Non-fatal grammar issues surfaced during parse (e.g. unterminated quote).
	 * Search runs gracefully on the recovered tokens; the UI can render these
	 * to give the author feedback instead of silently swallowing the input.
	 */
	warnings: ParseWarning[];
}

export type ParseWarningCode = 'unterminated_quote';

export interface ParseWarning {
	code: ParseWarningCode;
	/** Human-readable message keyed by code. UI may localize via `code`. */
	message: string;
	/** Char offset into the raw query where the issue began. */
	offset: number;
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
 *
 * Two registration paths:
 *   - `registerPages(appId, pages)` -- eager: hands over fully-bodied
 *     `HelpPage[]`. Used by Bun build scripts (the validator) and by tests
 *     where lazy loading isn't worth the indirection.
 *   - `registerIndex(appId, indexEntries, loader)` -- lazy: hands over
 *     metadata-only `HelpPageIndex[]` plus a `loader` that resolves a
 *     `HelpPageBody` for an id via dynamic import. Production browser apps
 *     use this so section bodies don't ride along in the always-loaded
 *     layout bundle.
 *
 * After `registerIndex`, `getById` returns a synthetic `HelpPage` with
 * `sections` carrying titles + empty bodies until `loadById` resolves.
 * `loadById(id)` materialises the full page (idempotent, cached).
 */
export interface HelpRegistry {
	/**
	 * Register a batch of pages for an app. Idempotent per-appId: calling
	 * twice with the same appId replaces that app's pages (supports HMR
	 * and per-request isolation in dev). Cross-app page-id collisions are
	 * reported as errors at build time by the validator.
	 */
	registerPages(appId: string, pages: readonly HelpPage[]): void;

	/**
	 * Register page indices + a body loader for an app. Same idempotency
	 * shape as `registerPages` but ships only metadata + precomputed search
	 * haystacks. Body markdown loads via `loader(id)` when a consumer calls
	 * `loadById`.
	 */
	registerIndex(appId: string, entries: readonly HelpPageIndex[], loader: HelpBodyLoader): void;

	/** All currently-registered pages, iteration order by app then page. */
	getAllPages(): readonly HelpPage[];

	/** Lookup a page by id. */
	getById(id: string): HelpPage | undefined;

	/**
	 * Resolve and cache the full `HelpPage` for an id, including section
	 * bodies + externalRefs. Idempotent: subsequent calls return the cached
	 * page. Returns `undefined` if the id isn't registered. Throws if the
	 * loader rejects (callers handle the error in their load function).
	 */
	loadById(id: string): Promise<HelpPage | undefined>;

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

/**
 * Body loader signature. Apps return a Promise resolving to the page body
 * (or `undefined` if the id isn't owned by this loader -- typically the
 * loader is invoked via the dispatch the registry tracks per-appId, so an
 * unknown id resolving to undefined is treated as a registry miss).
 */
export type HelpBodyLoader = (id: string) => Promise<HelpPageBody | undefined>;
