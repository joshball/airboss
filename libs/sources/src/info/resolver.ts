/**
 * Phase 10 -- the `info` `CorpusResolver` implementation.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { getCurrentEditionForCorpus } from '../registry/index-cache.ts';
import { stripPin } from '../registry/query.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatInfoCitation } from './citation.ts';
import { parseInfoLocator } from './locator.ts';
import { getInfoLiveUrl } from './url.ts';

export const INFO_CORPUS = 'info';

export const INFO_RESOLVER: CorpusResolver = {
	corpus: INFO_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseInfoLocator(locator);
	},

	formatCitation(entry, style) {
		return formatInfoCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Lex-max edition slug across the corpus. Backed by `index-cache.ts`:
		// see `regs/resolver.ts` for the convergent rationale.
		return getCurrentEditionForCorpus(INFO_CORPUS);
	},

	async getEditions(id: SourceId): Promise<readonly Edition[]> {
		const stripped = stripPin(id) as SourceId;
		return getEditionsMap().get(stripped) ?? [];
	},

	getLiveUrl(id: SourceId, edition: EditionId): string | null {
		return getInfoLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		return null;
	},
};
