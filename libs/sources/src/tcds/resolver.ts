/**
 * Phase 10 -- the `tcds` `CorpusResolver` implementation.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { getCurrentEditionForCorpus } from '../registry/index-cache.ts';
import { stripPin } from '../registry/query.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatTcdsCitation } from './citation.ts';
import { parseTcdsLocator } from './locator.ts';
import { getTcdsLiveUrl } from './url.ts';

export const TCDS_CORPUS = 'tcds';

export const TCDS_RESOLVER: CorpusResolver = {
	corpus: TCDS_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseTcdsLocator(locator);
	},

	formatCitation(entry, style) {
		return formatTcdsCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Lex-max edition slug across the corpus. Backed by `index-cache.ts`:
		// see `regs/resolver.ts` for the convergent rationale.
		return getCurrentEditionForCorpus(TCDS_CORPUS);
	},

	async getEditions(id: SourceId): Promise<readonly Edition[]> {
		const stripped = stripPin(id) as SourceId;
		return getEditionsMap().get(stripped) ?? [];
	},

	getLiveUrl(id: SourceId, edition: EditionId): string | null {
		return getTcdsLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		return null;
	},
};
