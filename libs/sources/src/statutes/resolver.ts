/**
 * Phase 10 -- the `statutes` `CorpusResolver` implementation.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { getCurrentEditionForCorpus } from '../registry/index-cache.ts';
import { stripPin } from '../registry/query.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatStatutesCitation } from './citation.ts';
import { parseStatutesLocator } from './locator.ts';
import { getStatutesLiveUrl } from './url.ts';

export const STATUTES_CORPUS = 'statutes';

export const STATUTES_RESOLVER: CorpusResolver = {
	corpus: STATUTES_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseStatutesLocator(locator);
	},

	formatCitation(entry, style) {
		return formatStatutesCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Lex-max edition slug across the corpus. Backed by `index-cache.ts`:
		// see `regs/resolver.ts` for the convergent rationale.
		return getCurrentEditionForCorpus(STATUTES_CORPUS);
	},

	async getEditions(id: SourceId): Promise<readonly Edition[]> {
		const stripped = stripPin(id) as SourceId;
		return getEditionsMap().get(stripped) ?? [];
	},

	getLiveUrl(id: SourceId, edition: EditionId): string | null {
		return getStatutesLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		return null;
	},
};
