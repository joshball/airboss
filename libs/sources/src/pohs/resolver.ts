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
import { stripPin } from '../registry/query.ts';
import { getSources } from '../registry/sources.ts';
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
		const editionsMap = getEditionsMap();
		const sources = getSources();
		let max: EditionId | null = null;
		for (const id of Object.keys(sources)) {
			const entry = sources[id as SourceId];
			if (entry === undefined || entry.corpus !== POHS_CORPUS) continue;
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
		return getPohsLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		return null;
	},
};
