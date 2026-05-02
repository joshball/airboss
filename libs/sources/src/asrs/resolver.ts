/**
 * Phase 10 -- the `asrs` `CorpusResolver` implementation.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { getCurrentEditionForCorpus } from '../registry/index-cache.ts';
import { stripPin } from '../registry/query.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatAsrsCitation } from './citation.ts';
import { parseAsrsLocator } from './locator.ts';
import { getAsrsLiveUrl } from './url.ts';

export const ASRS_CORPUS = 'asrs';

export const ASRS_RESOLVER: CorpusResolver = {
	corpus: ASRS_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseAsrsLocator(locator);
	},

	formatCitation(entry, style) {
		return formatAsrsCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Lex-max edition slug across the corpus. Backed by `index-cache.ts`:
		// see `regs/resolver.ts` for the convergent rationale.
		return getCurrentEditionForCorpus(ASRS_CORPUS);
	},

	async getEditions(id: SourceId): Promise<readonly Edition[]> {
		const stripped = stripPin(id) as SourceId;
		return getEditionsMap().get(stripped) ?? [];
	},

	getLiveUrl(id: SourceId, edition: EditionId): string | null {
		return getAsrsLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		return null;
	},
};
