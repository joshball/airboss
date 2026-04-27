/**
 * Phase 6 -- the `handbooks` `CorpusResolver` implementation.
 *
 * Source of truth: ADR 019 §2.2 (`CorpusResolver` interface) + the WP at
 * `docs/work-packages/reference-handbook-ingestion/`.
 *
 * Composes the locator + citation + URL helpers, plus reads from the
 * registry's `EDITIONS` map and the on-disk derivative tree from PR #242
 * (per ADR 018). Phase 4 (renderer) consumes `getIndexedContent` for token
 * substitution; this module makes that possible without holding any
 * per-render state.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { stripPin } from '../registry/query.ts';
import { getSources } from '../registry/sources.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatHandbooksCitation } from './citation.ts';
import { bodyPathForSection, type ManifestFile, manifestSectionForLocator, readManifest } from './derivative-reader.ts';
import { parseHandbooksLocator } from './locator.ts';
import { getHandbooksLiveUrl } from './url.ts';

export const HANDBOOKS_CORPUS = 'handbooks';

/**
 * Per-doc edition slug -> on-disk directory name. The locator uses the short
 * edition slug (`8083-25C`); the on-disk directory uses the full FAA filename
 * (`FAA-H-8083-25C`). Adding a new handbook edition means adding here AND
 * extending `HANDBOOK_DOC_SLUGS` in `locator.ts` plus `HANDBOOK_LIVE_URLS` in
 * `url.ts`.
 */
export const HANDBOOK_DOC_EDITIONS: Record<string, Record<string, string>> = {
	phak: {
		'8083-25C': 'FAA-H-8083-25C',
	},
	afh: {
		'8083-3C': 'FAA-H-8083-3C',
	},
	avwx: {
		'8083-28B': 'FAA-H-8083-28B',
	},
};

const SOURCE_ID_PREFIX = 'airboss-ref:handbooks/';

/**
 * The directory root for in-repo handbook derivatives. Test code overrides
 * via `setHandbooksDerivativeRoot`; production reads from `<cwd>/handbooks`.
 */
let _derivativeRoot: string = join(process.cwd(), 'handbooks');

export function setHandbooksDerivativeRoot(root: string): void {
	_derivativeRoot = root;
}

export function getHandbooksDerivativeRoot(): string {
	return _derivativeRoot;
}

/**
 * Manifest cache so repeated resolver calls within one process don't re-parse
 * the same JSON file. Keyed on `<doc>/<faaDir>`. Tests reset via
 * `__handbooks_resolver_internal__.clearManifestCache`.
 */
const _manifestCache: Map<string, ManifestFile> = new Map();

function loadManifestCached(doc: string, faaDir: string, root: string): ManifestFile | null {
	const key = `${doc}/${faaDir}|${root}`;
	const cached = _manifestCache.get(key);
	if (cached !== undefined) return cached;
	try {
		const m = readManifest(faaDir, root, doc);
		_manifestCache.set(key, m);
		return m;
	} catch {
		return null;
	}
}

/**
 * Resolve a parsed locator's edition slug to its on-disk dir name. Returns
 * null when the doc / edition combination is unknown.
 */
function faaDirFor(doc: string, edition: string): string | null {
	const docMap = HANDBOOK_DOC_EDITIONS[doc];
	if (docMap === undefined) return null;
	return docMap[edition] ?? null;
}

/**
 * Build the production `handbooks` resolver. Stateless aside from the
 * derivative root + manifest cache, both overridable for tests.
 */
export const HANDBOOKS_RESOLVER: CorpusResolver = {
	corpus: HANDBOOKS_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseHandbooksLocator(locator);
	},

	formatCitation(entry, style) {
		return formatHandbooksCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Walk every handbooks-corpus entry's editions; return the lexically-
		// largest edition slug. Editions are letter-suffixed FAA revisions
		// (8083-25A < 8083-25B < 8083-25C), so lexical max is also publication
		// max within a doc. Across docs the result is doc-dependent; this
		// method's contract is "the most recent edition slug ingested",
		// matching Phase 3's regs implementation.
		const editionsMap = getEditionsMap();
		const sources = getSources();
		let max: EditionId | null = null;
		for (const id of Object.keys(sources)) {
			const entry = sources[id as SourceId];
			if (entry === undefined || entry.corpus !== HANDBOOKS_CORPUS) continue;
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
		return getHandbooksLiveUrl(id, edition);
	},

	getDerivativeContent(id: SourceId, _edition: EditionId): string | null {
		const stripped = stripPin(id);
		if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
		const locator = stripped.slice(SOURCE_ID_PREFIX.length);
		const parsed = parseHandbooksLocator(locator);
		if (parsed.kind !== 'ok' || parsed.handbooks === undefined) return null;
		const { doc, edition: editionSlug } = parsed.handbooks;
		const faaDir = faaDirFor(doc, editionSlug);
		if (faaDir === null) return null;
		const manifest = loadManifestCached(doc, faaDir, _derivativeRoot);
		if (manifest === null) return null;
		const section = manifestSectionForLocator(manifest, parsed.handbooks);
		if (section === null) return null;
		const bodyPath = bodyPathForSection(section, _derivativeRoot);
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
export const __handbooks_resolver_internal__ = {
	clearManifestCache(): void {
		_manifestCache.clear();
	},
};
