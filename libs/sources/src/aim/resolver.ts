/**
 * Phase 7 -- the `aim` `CorpusResolver` implementation.
 *
 * Source of truth: ADR 019 §2.2 (`CorpusResolver` interface) + the WP at
 * `docs/work-packages/reference-aim-ingestion/`.
 *
 * Composes the locator + citation + URL helpers, plus reads from the
 * registry's `EDITIONS` map and the on-disk derivative tree (per ADR 018).
 * Phase 4 (renderer) consumes `getIndexedContent` for token substitution;
 * this module makes that possible without holding any per-render state.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { stripPin } from '../registry/query.ts';
import { getSources } from '../registry/sources.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatAimCitation } from './citation.ts';
import { bodyPathForEntry, type ManifestFile, manifestEntryForLocator, readManifest } from './derivative-reader.ts';
import { parseAimLocator } from './locator.ts';
import { getAimLiveUrl } from './url.ts';

export const AIM_CORPUS = 'aim';

const SOURCE_ID_PREFIX = 'airboss-ref:aim/';

/**
 * The directory root for in-repo AIM derivatives. Test code overrides via
 * `setAimDerivativeRoot`; production reads from `<cwd>/aim`.
 */
let _derivativeRoot: string = join(process.cwd(), 'aim');

export function setAimDerivativeRoot(root: string): void {
	_derivativeRoot = root;
}

export function getAimDerivativeRoot(): string {
	return _derivativeRoot;
}

/**
 * Manifest cache so repeated resolver calls within one process don't
 * re-parse the same JSON file. Keyed on `<edition>|<root>`. Tests reset via
 * `__aim_resolver_internal__.clearManifestCache`.
 */
const _manifestCache: Map<string, ManifestFile> = new Map();

function loadManifestCached(edition: string, root: string): ManifestFile | null {
	const key = `${edition}|${root}`;
	const cached = _manifestCache.get(key);
	if (cached !== undefined) return cached;
	try {
		const m = readManifest(edition, root);
		_manifestCache.set(key, m);
		return m;
	} catch {
		return null;
	}
}

/**
 * Build the production `aim` resolver. Stateless aside from the derivative
 * root + manifest cache, both overridable for tests.
 */
export const AIM_RESOLVER: CorpusResolver = {
	corpus: AIM_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseAimLocator(locator);
	},

	formatCitation(entry, style) {
		return formatAimCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Walk every aim-corpus entry's editions; return the lexically-largest
		// edition slug. Editions are `YYYY-MM`, so lexical max is also
		// publication max.
		const editionsMap = getEditionsMap();
		const sources = getSources();
		let max: EditionId | null = null;
		for (const id of Object.keys(sources)) {
			const entry = sources[id as SourceId];
			if (entry === undefined || entry.corpus !== AIM_CORPUS) continue;
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
		return getAimLiveUrl(id, edition);
	},

	getDerivativeContent(id: SourceId, edition: EditionId): string | null {
		const stripped = stripPin(id);
		if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
		const locator = stripped.slice(SOURCE_ID_PREFIX.length);
		const parsed = parseAimLocator(locator);
		if (parsed.kind !== 'ok' || parsed.aim === undefined) return null;
		const manifest = loadManifestCached(edition, _derivativeRoot);
		if (manifest === null) return null;
		const entry = manifestEntryForLocator(manifest, parsed.aim);
		if (entry === null) return null;
		const bodyPath = bodyPathForEntry(entry, _derivativeRoot);
		if (!existsSync(bodyPath)) return null;
		return readFileSync(bodyPath, 'utf-8');
	},

	async getIndexedContent(id: SourceId, edition: EditionId): Promise<IndexedContent | null> {
		const stripped = stripPin(id) as SourceId;
		const text = this.getDerivativeContent(stripped, edition);
		if (text === null) return null;
		return {
			id: stripped,
			edition,
			normalizedText: text,
		};
	},
};

/**
 * Test-only helpers.
 */
export const __aim_resolver_internal__ = {
	clearManifestCache(): void {
		_manifestCache.clear();
	},
};
