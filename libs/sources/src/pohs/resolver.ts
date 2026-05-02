/**
 * Phase 10 -- the `pohs` `CorpusResolver` implementation.
 *
 * Source of truth: ADR 019 §2.2.
 *
 * Phase 10 first slice ships locator validation only. POHs have no public
 * URL formula (manufacturer-controlled), so `getLiveUrl` always returns
 * null until per-aircraft ingestion records a `source_url`.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { getCurrentEditionForCorpus } from '../registry/index-cache.ts';
import { stripPin } from '../registry/query.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatPohsCitation } from './citation.ts';
import { parsePohsLocator } from './locator.ts';
import { getPohsLiveUrl } from './url.ts';

export const POHS_CORPUS = 'pohs';

export const POHS_RESOLVER: CorpusResolver = {
	corpus: POHS_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parsePohsLocator(locator);
	},

	formatCitation(entry, style) {
		return formatPohsCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Lex-max edition slug across the corpus. Backed by `index-cache.ts`:
		// see `regs/resolver.ts` for the convergent rationale.
		return getCurrentEditionForCorpus(POHS_CORPUS);
	},

	async getEditions(id: SourceId): Promise<readonly Edition[]> {
		const stripped = stripPin(id) as SourceId;
		return getEditionsMap().get(stripped) ?? [];
	},

	getLiveUrl(id: SourceId, edition: EditionId): string | null {
		return getPohsLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		return null;
	},
};
