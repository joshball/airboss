/**
 * Phase 10 -- the `interp` `CorpusResolver` implementation.
 *
 * Source of truth: ADR 019 §2.2 (`CorpusResolver` interface).
 *
 * Phase 10 first slice ships locator validation + live URL composition
 * only. Per-letter ingestion is deferred until a lesson actually authors
 * an `airboss-ref:interp/...` URL.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { stripPin } from '../registry/query.ts';
import { getSources } from '../registry/sources.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatInterpCitation } from './citation.ts';
import { parseInterpLocator } from './locator.ts';
import { getInterpLiveUrl } from './url.ts';

export const INTERP_CORPUS = 'interp';

export const INTERP_RESOLVER: CorpusResolver = {
	corpus: INTERP_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseInterpLocator(locator);
	},

	formatCitation(entry, style) {
		return formatInterpCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		const editionsMap = getEditionsMap();
		const sources = getSources();
		let max: EditionId | null = null;
		for (const id of Object.keys(sources)) {
			const entry = sources[id as SourceId];
			if (entry === undefined || entry.corpus !== INTERP_CORPUS) continue;
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
		return getInterpLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		return null;
	},
};
