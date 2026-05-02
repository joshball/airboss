/**
 * Phase 10 -- the `safo` `CorpusResolver` implementation.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { getCurrentEditionForCorpus } from '../registry/index-cache.ts';
import { stripPin } from '../registry/query.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatSafoCitation } from './citation.ts';
import { parseSafoLocator } from './locator.ts';
import { getSafoLiveUrl } from './url.ts';

export const SAFO_CORPUS = 'safo';

export const SAFO_RESOLVER: CorpusResolver = {
	corpus: SAFO_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseSafoLocator(locator);
	},

	formatCitation(entry, style) {
		return formatSafoCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Lex-max edition slug across the corpus. Backed by `index-cache.ts`:
		// see `regs/resolver.ts` for the convergent rationale.
		return getCurrentEditionForCorpus(SAFO_CORPUS);
	},

	async getEditions(id: SourceId): Promise<readonly Edition[]> {
		const stripped = stripPin(id) as SourceId;
		return getEditionsMap().get(stripped) ?? [];
	},

	getLiveUrl(id: SourceId, edition: EditionId): string | null {
		return getSafoLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		return null;
	},
};
