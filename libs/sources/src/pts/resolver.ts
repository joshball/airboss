/**
 * `pts` corpus `CorpusResolver` implementation.
 *
 * Source of truth: ADR 019 §2.2 (`CorpusResolver` interface) + the
 * cert-syllabus WP's locked Q7 format.
 *
 * Composes the locator / citation / URL helpers, plus reads from the
 * registry's `EDITIONS` map. `getDerivativeContent` and `getIndexedContent`
 * return null until PTS PDF ingestion ships in a follow-on WP -- the
 * `syllabus_node` row already carries the structured tree, so the renderer
 * has no need for derivative PTS markdown today.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { stripPin } from '../registry/query.ts';
import { getSources } from '../registry/sources.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatPtsCitation } from './citation.ts';
import { parsePtsLocator } from './locator.ts';
import { getPtsLiveUrl } from './url.ts';

export const PTS_CORPUS = 'pts';

export const PTS_RESOLVER: CorpusResolver = {
	corpus: PTS_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parsePtsLocator(locator);
	},

	formatCitation(entry, style) {
		return formatPtsCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		const editionsMap = getEditionsMap();
		const sources = getSources();
		let max: EditionId | null = null;
		for (const id of Object.keys(sources)) {
			const entry = sources[id as SourceId];
			if (entry === undefined || entry.corpus !== PTS_CORPUS) continue;
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
		return getPtsLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		// PTS PDF ingestion lands in a follow-on WP; until then the syllabus_node
		// tree is the canonical structured surface and there is no derivative
		// markdown to read.
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		return null;
	},
};
