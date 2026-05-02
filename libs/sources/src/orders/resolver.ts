/**
 * Phase 10 -- the `orders` `CorpusResolver` implementation.
 *
 * Source of truth: ADR 019 §2.2 (`CorpusResolver` interface) + the WP at
 * `docs/work-packages/reference-irregular-corpora/`.
 *
 * Phase 10 first slice ships locator validation + live URL composition
 * only. Ingestion (manifest-based registry population, derivative-tier
 * extraction, indexed content) is deferred until the first lesson
 * actually authors an `airboss-ref:orders/...` URL. The resolver returns
 * null from `getDerivativeContent` and `getIndexedContent` until that
 * lands; the validator's row-2 "entry not in registry" check correctly
 * surfaces the missing-ingestion state as an ERROR.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { getCurrentEditionForCorpus } from '../registry/index-cache.ts';
import { stripPin } from '../registry/query.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatOrdersCitation } from './citation.ts';
import { parseOrdersLocator } from './locator.ts';
import { getOrdersLiveUrl } from './url.ts';

export const ORDERS_CORPUS = 'orders';

/**
 * The production `orders` resolver. Stateless -- no cache, no
 * derivative-tier reads (deferred until ingestion lands).
 */
export const ORDERS_RESOLVER: CorpusResolver = {
	corpus: ORDERS_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseOrdersLocator(locator);
	},

	formatCitation(entry, style) {
		return formatOrdersCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Lex-max edition slug across the corpus. Orders pin format is `?at=YYYY-MM`
		// or `?at=YYYY`, so lexical max is also publication max. Backed by
		// `index-cache.ts`: see `regs/resolver.ts` for the convergent rationale.
		return getCurrentEditionForCorpus(ORDERS_CORPUS);
	},

	async getEditions(id: SourceId): Promise<readonly Edition[]> {
		const stripped = stripPin(id) as SourceId;
		return getEditionsMap().get(stripped) ?? [];
	},

	getLiveUrl(id: SourceId, edition: EditionId): string | null {
		return getOrdersLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		// Deferred: ingestion + derivative tree comes with the first orders WP
		// that needs full-text rendering. URL-formula fallback covers the
		// reader experience until then.
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		// Deferred (see getDerivativeContent).
		return null;
	},
};
