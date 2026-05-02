/**
 * Phase 10 -- the `plates` `CorpusResolver` implementation.
 *
 * Source of truth: ADR 019 §2.2.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { getCurrentEditionForCorpus } from '../registry/index-cache.ts';
import { stripPin } from '../registry/query.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatPlatesCitation } from './citation.ts';
import { parsePlatesLocator } from './locator.ts';
import { getPlatesLiveUrl } from './url.ts';

export const PLATES_CORPUS = 'plates';

export const PLATES_RESOLVER: CorpusResolver = {
	corpus: PLATES_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parsePlatesLocator(locator);
	},

	formatCitation(entry, style) {
		return formatPlatesCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Lex-max edition slug across the corpus. Backed by `index-cache.ts`:
		// see `regs/resolver.ts` for the convergent rationale.
		return getCurrentEditionForCorpus(PLATES_CORPUS);
	},

	async getEditions(id: SourceId): Promise<readonly Edition[]> {
		const stripped = stripPin(id) as SourceId;
		return getEditionsMap().get(stripped) ?? [];
	},

	getLiveUrl(id: SourceId, edition: EditionId): string | null {
		return getPlatesLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		return null;
	},
};
