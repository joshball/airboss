/**
 * `acs` corpus `CorpusResolver` implementation.
 *
 * Source of truth: ADR 019 §2.2 (`CorpusResolver` interface) + the WP at
 * `docs/work-packages/cert-syllabus-and-goal-composer/`.
 *
 * Composes the locator / citation / URL helpers, plus reads from the
 * registry's `EDITIONS` map. `getDerivativeContent` and `getIndexedContent`
 * return null until ACS PDF ingestion ships in a follow-on WP -- the
 * `syllabus_node` row already carries the structured tree, so the renderer
 * has no need for derivative ACS markdown today.
 */

import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { stripPin } from '../registry/query.ts';
import { getSources } from '../registry/sources.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatAcsCitation } from './citation.ts';
import { parseAcsLocator } from './locator.ts';
import { getAcsLiveUrl } from './url.ts';

export const ACS_CORPUS = 'acs';

export const ACS_RESOLVER: CorpusResolver = {
	corpus: ACS_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseAcsLocator(locator);
	},

	formatCitation(entry, style) {
		return formatAcsCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Walk every acs-corpus entry's editions; return the lexically-largest
		// edition slug. ACS editions are FAA publication IDs (`faa-s-acs-25`,
		// `faa-s-acs-6b`); lexical max approximates publication-most-recent
		// within a single cert family. Cross-cert it is cert-dependent; this
		// method's contract matches the regs / handbooks pattern.
		const editionsMap = getEditionsMap();
		const sources = getSources();
		let max: EditionId | null = null;
		for (const id of Object.keys(sources)) {
			const entry = sources[id as SourceId];
			if (entry === undefined || entry.corpus !== ACS_CORPUS) continue;
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
		return getAcsLiveUrl(id, edition);
	},

	getDerivativeContent(_id: SourceId, _edition: EditionId): string | null {
		// ACS PDF ingestion lands in a follow-on WP; until then the syllabus_node
		// tree is the canonical structured surface and there is no derivative
		// markdown to read.
		return null;
	},

	async getIndexedContent(_id: SourceId, _edition: EditionId): Promise<IndexedContent | null> {
		// Same as getDerivativeContent: indexed-tier content lands when the ACS
		// PDF ingestion ships.
		return null;
	},
};
