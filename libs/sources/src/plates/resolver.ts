/**
 * Phase 10 -- the `plates` `CorpusResolver` implementation.
 *
 * Source of truth: ADR 019 §2.2.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { stripPin } from '../registry/query.ts';
import { getSources } from '../registry/sources.ts';
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
		const editionsMap = getEditionsMap();
		const sources = getSources();
		let max: EditionId | null = null;
		for (const id of Object.keys(sources)) {
			const entry = sources[id as SourceId];
			if (entry === undefined || entry.corpus !== PLATES_CORPUS) continue;
			const editions = editionsMap.get(id as SourceId) ?? [];
			for (const edition of editions) {
				if (max === null || edition.id > max) max = edition.id;
			}
		}
		return max;
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
