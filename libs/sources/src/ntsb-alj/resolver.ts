/**
 * The `ntsb-alj` `CorpusResolver` implementation.
 *
 * Source of truth: WP-NTSB-ALJ spec at `docs/work-packages/wp-ntsb-alj/spec.md`,
 * library-completeness §4.A, and ADR 019 §2.2 (`CorpusResolver` interface).
 *
 * First slice ships locator validation + landing-page URL fallback. Per-ruling
 * ingestion (manifest registration, opinion-section indexing) is deferred until
 * a lesson actually authors an `airboss-ref:ntsb-alj/...` URL. The resolver
 * returns null from `getDerivativeContent` and `getIndexedContent` until that
 * lands; the validator's row-2 "entry not in registry" check correctly surfaces
 * the missing-ingestion state as an ERROR.
 *
 * NTSB ALJ rulings are immutable post-publication; "current edition" is the
 * lexically-largest edition slug across every registered ntsb-alj entry,
 * matching the contract used by AC, AIM, NTSB, and SAFO.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { stripPin } from '../registry/query.ts';
import { getSources } from '../registry/sources.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatNtsbAljCitation } from './citation.ts';
import { parseNtsbAljLocator } from './locator.ts';
import { getNtsbAljLiveUrl } from './url.ts';

export const NTSB_ALJ_CORPUS = 'ntsb-alj';

export const NTSB_ALJ_RESOLVER: CorpusResolver = {
	corpus: NTSB_ALJ_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseNtsbAljLocator(locator);
	},

	formatCitation(entry, style) {
		return formatNtsbAljCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		const editionsMap = getEditionsMap();
		const sources = getSources();
		let max: EditionId | null = null;
		for (const id of Object.keys(sources)) {
			const entry = sources[id as SourceId];
			if (entry === undefined || entry.corpus !== NTSB_ALJ_CORPUS) continue;
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
		return getNtsbAljLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		// Deferred: per-ruling ingestion + section-indexing comes when the first
		// lesson cites an ALJ ruling. URL-formula fallback covers the reader
		// experience until then.
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		// Deferred (see getDerivativeContent).
		return null;
	},
};
