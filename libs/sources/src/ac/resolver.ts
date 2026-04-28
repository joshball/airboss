/**
 * Phase 8 -- the `ac` `CorpusResolver` implementation.
 *
 * Source of truth: ADR 019 §2.2 (`CorpusResolver` interface) + the WP at
 * `docs/work-packages/reference-ac-ingestion/`.
 *
 * Composes the locator + citation + URL helpers, plus reads from the
 * registry's `EDITIONS` map and the on-disk derivative tree (per ADR 018).
 * Phase 4 (renderer) consumes `getIndexedContent` for token substitution.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { stripPin } from '../registry/query.ts';
import { getSources } from '../registry/sources.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatAcCitation } from './citation.ts';
import { type AcManifestFile, docSlugFromDocNumber, readAcManifest } from './derivative-reader.ts';
import { parseAcLocator } from './locator.ts';
import { getAcLiveUrl } from './url.ts';

export const AC_CORPUS = 'ac';

const SOURCE_ID_PREFIX = 'airboss-ref:ac/';

/**
 * The directory root for in-repo AC derivatives. Test code overrides via
 * `setAcDerivativeRoot`; production reads from `<cwd>/ac`.
 */
let _derivativeRoot: string = join(process.cwd(), 'ac');

export function setAcDerivativeRoot(root: string): void {
	_derivativeRoot = root;
}

export function getAcDerivativeRoot(): string {
	return _derivativeRoot;
}

/**
 * Per-AC manifest cache. Keyed on `<doc-slug>|<rev>|<root>`. Tests reset via
 * `__ac_resolver_internal__.clearManifestCache`.
 */
const _manifestCache: Map<string, AcManifestFile> = new Map();

function loadManifestCached(docSlug: string, revision: string, root: string): AcManifestFile | null {
	const key = `${docSlug}|${revision}|${root}`;
	const cached = _manifestCache.get(key);
	if (cached !== undefined) return cached;
	try {
		const m = readAcManifest(root, docSlug, revision);
		_manifestCache.set(key, m);
		return m;
	} catch {
		return null;
	}
}

/**
 * Read a body markdown file relative to the per-AC manifest dir. Returns null
 * when the file does not exist on disk.
 */
function readBody(bodyPath: string, root: string): string | null {
	const fullPath = bodyPath.startsWith('ac/') ? join(root, bodyPath.slice('ac/'.length)) : join(root, bodyPath);
	if (!existsSync(fullPath)) return null;
	return readFileSync(fullPath, 'utf-8');
}

/**
 * The production `ac` resolver. Stateless aside from the derivative root +
 * manifest cache, both overridable for tests.
 */
export const AC_RESOLVER: CorpusResolver = {
	corpus: AC_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseAcLocator(locator);
	},

	formatCitation(entry, style) {
		return formatAcCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Walk every ac-corpus entry's editions; return the lexically-largest
		// edition slug. AC edition pins are ISO publication dates (`YYYY-MM-DD`),
		// so lexical max is also publication max. Across docs the result is
		// doc-dependent; this method's contract is "the most recent edition
		// slug ingested", matching the AIM and handbooks implementations.
		const editionsMap = getEditionsMap();
		const sources = getSources();
		let max: EditionId | null = null;
		for (const id of Object.keys(sources)) {
			const entry = sources[id as SourceId];
			if (entry === undefined || entry.corpus !== AC_CORPUS) continue;
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
		return getAcLiveUrl(id, edition);
	},

	getDerivativeContent(id: SourceId, _edition: EditionId): string | null {
		const stripped = stripPin(id);
		if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
		const locator = stripped.slice(SOURCE_ID_PREFIX.length);
		const parsed = parseAcLocator(locator);
		if (parsed.kind !== 'ok' || parsed.ac === undefined) return null;

		const { docNumber, revision, section, change } = parsed.ac;
		const docSlug = docSlugFromDocNumber(docNumber);
		const manifest = loadManifestCached(docSlug, revision, _derivativeRoot);
		if (manifest === null) return null;

		if (section !== undefined) {
			const sec = manifest.sections.find((s) => s.section === section);
			if (sec === undefined) return null;
			return readBody(sec.body_path, _derivativeRoot);
		}

		if (change !== undefined) {
			const ch = manifest.changes.find((c) => c.change === change);
			if (ch === undefined) return null;
			return readBody(ch.body_path, _derivativeRoot);
		}

		return readBody(manifest.body_path, _derivativeRoot);
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
export const __ac_resolver_internal__ = {
	clearManifestCache(): void {
		_manifestCache.clear();
	},
};
