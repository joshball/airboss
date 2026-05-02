/**
 * Phase 10 -- the `sectionals` `CorpusResolver` implementation.
 *
 * Source of truth: ADR 019 §2.2.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { getCurrentEditionForCorpus } from '../registry/index-cache.ts';
import { stripPin } from '../registry/query.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatSectionalsCitation } from './citation.ts';
import { parseSectionalsLocator } from './locator.ts';
import { getSectionalsLiveUrl } from './url.ts';

export const SECTIONALS_CORPUS = 'sectionals';

export const SECTIONALS_RESOLVER: CorpusResolver = {
	corpus: SECTIONALS_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseSectionalsLocator(locator);
	},

	formatCitation(entry, style) {
		return formatSectionalsCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Lex-max edition slug across the corpus. Backed by `index-cache.ts`:
		// see `regs/resolver.ts` for the convergent rationale.
		return getCurrentEditionForCorpus(SECTIONALS_CORPUS);
	},

	async getEditions(id: SourceId): Promise<readonly Edition[]> {
		const stripped = stripPin(id) as SourceId;
		return getEditionsMap().get(stripped) ?? [];
	},

	getLiveUrl(id: SourceId, edition: EditionId): string | null {
		return getSectionalsLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		return null;
	},
};
