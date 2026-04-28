/**
 * Phase 10 -- the `ntsb` `CorpusResolver` implementation.
 *
 * Source of truth: ADR 019 §2.2 (`CorpusResolver` interface) + the WP at
 * `docs/work-packages/reference-irregular-corpora/`.
 *
 * Phase 10 first slice ships locator validation + live URL composition
 * only. Per-report ingestion (manifest registration, factual / probable-
 * cause section indexing) is deferred until a lesson actually authors an
 * `airboss-ref:ntsb/...` URL. The resolver returns null from
 * `getDerivativeContent` and `getIndexedContent` until that lands; the
 * validator's row-2 "entry not in registry" check correctly surfaces
 * the missing-ingestion state as an ERROR.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { stripPin } from '../registry/query.ts';
import { getSources } from '../registry/sources.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatNtsbCitation } from './citation.ts';
import { parseNtsbLocator } from './locator.ts';
import { getNtsbLiveUrl } from './url.ts';

export const NTSB_CORPUS = 'ntsb';

/**
 * The production `ntsb` resolver. Stateless -- NTSB reports are immutable
 * post-publication, so there's no edition cache or reissue tracking
 * required at this layer.
 */
export const NTSB_RESOLVER: CorpusResolver = {
	corpus: NTSB_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseNtsbLocator(locator);
	},

	formatCitation(entry, style) {
		return formatNtsbCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// NTSB reports are immutable; the "current edition" concept doesn't
		// apply per-corpus. Return the lexically-largest edition slug across
		// every ntsb-corpus entry as a degenerate implementation, matching
		// the contract used by AC and AIM.
		const editionsMap = getEditionsMap();
		const sources = getSources();
		let max: EditionId | null = null;
		for (const id of Object.keys(sources)) {
			const entry = sources[id as SourceId];
			if (entry === undefined || entry.corpus !== NTSB_CORPUS) continue;
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
		return getNtsbLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		// Deferred: per-report ingestion + section-indexing comes with the
		// first NTSB-citing lesson. URL-formula fallback covers the reader
		// experience until then.
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		// Deferred (see getDerivativeContent).
		return null;
	},
};
