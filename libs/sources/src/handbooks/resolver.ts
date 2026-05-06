// @browser-globals: server-only -- never imported by client .svelte
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
import { SOURCE_CACHE } from '@ab/constants';
import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { getCurrentEditionForCorpus } from '../registry/index-cache.ts';
import { stripPin } from '../registry/query.ts';
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
	// Whole-doc-only handbooks (handbooks-extras). Edition slug = `8083-<n>[<rev>]`,
	// derivative dir = `FAA-H-8083-<n>[<rev>]`. The null-edition handbook
	// (Aviation Instructor's Handbook) uses the bare `8083-9` slug; FAA does
	// not currently publish a revision letter for it. See
	// `libs/sources/src/handbooks-extras/` for the ingestion pipeline.
	'risk-management': {
		'8083-2A': 'FAA-H-8083-2A',
	},
	'aviation-instructor': {
		'8083-9': 'FAA-H-8083-9',
	},
	ifh: {
		'8083-15B': 'FAA-H-8083-15B',
	},
	iph: {
		'8083-16B': 'FAA-H-8083-16B',
	},
	// Non-FAA-H-numbered FAA pamphlet (Tips on Mountain Flying). Edition slug
	// = `mtn-2003` (current public FAA-hosted version is undated; traced to
	// the early-2000s authoring window). On-disk dir uses uppercase to match
	// the FAA-H-* convention.
	'tips-mountain-flying': {
		'mtn-2003': 'MTN-2003',
	},
};

const SOURCE_ID_PREFIX = 'airboss-ref:handbooks/';

/**
 * The directory root for in-repo handbook derivatives. Test code overrides
 * via `setHandbooksDerivativeRoot`; production reads from `<cwd>/handbooks`.
 */
let _derivativeRoot: string = join(process.cwd(), SOURCE_CACHE.HANDBOOKS);

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
 * Registry-aware "is this a known edition for this doc?" predicate per ADR
 * 019 amendment 2026-05 §1. Wired into `parseHandbooksLocator` so the
 * locator parser can disambiguate "edition pin vs chapter" without
 * round-tripping through the resolver registry.
 */
export function isKnownHandbookEdition(doc: string, candidate: string): boolean {
	const docMap = HANDBOOK_DOC_EDITIONS[doc];
	if (docMap === undefined) return false;
	return docMap[candidate] !== undefined;
}

/**
 * Pick the current edition for a handbook doc when the locator omits the
 * edition. Per ADR 019 amendment 2026-05 §1: "Edition omitted: resolver
 * returns the current (latest non-superseded) entry for the slug." Today
 * each doc has exactly one edition entry in `HANDBOOK_DOC_EDITIONS`; when
 * a doc gets a successor we pick the lex-max edition slug (matching the
 * existing `getCurrentEdition` contract).
 */
export function currentEditionForDoc(doc: string): string | null {
	const docMap = HANDBOOK_DOC_EDITIONS[doc];
	if (docMap === undefined) return null;
	const editions = Object.keys(docMap);
	if (editions.length === 0) return null;
	let max: string | null = null;
	for (const ed of editions) {
		if (max === null || ed > max) max = ed;
	}
	return max;
}

/**
 * Build the production `handbooks` resolver. Stateless aside from the
 * derivative root + manifest cache, both overridable for tests.
 */
export const HANDBOOKS_RESOLVER: CorpusResolver = {
	corpus: HANDBOOKS_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		// Per ADR 019 amendment 2026-05 §1, the path-grammar disambiguation
		// is registry-aware: the segment after `<doc>` is treated as an
		// edition pin iff it appears in `HANDBOOK_DOC_EDITIONS[doc]`. The
		// resolver is the registry; the locator parser delegates here.
		return parseHandbooksLocator(locator, isKnownHandbookEdition);
	},

	formatCitation(entry, style) {
		return formatHandbooksCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Memoized through the generation-invalidated index in
		// `registry/index-cache.ts`. The cache walks the handbooks-corpus
		// entry list once per (sources-gen, editions-gen); subsequent reads
		// are O(1) Map-gets. Editions are letter-suffixed FAA revisions
		// (8083-25A < 8083-25B < 8083-25C), so lexical max is also publication
		// max within a doc. Across docs the result is doc-dependent; this
		// method's contract is "the most recent edition slug ingested",
		// matching Phase 3's regs implementation.
		const editionsMap = getEditionsMap();
		return getCurrentEditionForCorpus(HANDBOOKS_CORPUS, (id) => editionsMap.get(id) ?? []);
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
		// Per ADR 019 amendment 2026-05 §1: when the locator omits the
		// edition, resolve to the current (latest) edition for the doc.
		const effectiveEdition = editionSlug.length > 0 ? editionSlug : (currentEditionForDoc(doc) ?? '');
		const faaDir = faaDirFor(doc, effectiveEdition);
		if (faaDir === null) return null;
		const manifest = loadManifestCached(doc, faaDir, _derivativeRoot);
		if (manifest === null) return null;

		// Whole-doc reference (no chapter/section/subsection): if the manifest
		// records a top-level `body_path` (handbooks-extras Class C handbooks
		// without chapter splits), read it directly. Falls back to the
		// section-resolution path otherwise so chapter-aware handbooks keep
		// their existing behaviour.
		const isWholeDoc =
			parsed.handbooks.chapter === undefined &&
			parsed.handbooks.section === undefined &&
			parsed.handbooks.subsection === undefined &&
			parsed.handbooks.paragraph === undefined &&
			parsed.handbooks.figure === undefined &&
			parsed.handbooks.table === undefined;
		if (isWholeDoc && typeof manifest.body_path === 'string' && manifest.body_path.length > 0) {
			const bodyPath = manifest.body_path.startsWith('handbooks/')
				? join(_derivativeRoot, manifest.body_path.slice('handbooks/'.length))
				: join(_derivativeRoot, manifest.body_path);
			if (!existsSync(bodyPath)) return null;
			return readFileSync(bodyPath, 'utf-8');
		}

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

	/**
	 * Look up the captured sentinel field's value in the resolved manifest.
	 * Per ADR 019 amendment 2026-05 §2 (D4: handbooks ship first).
	 *
	 * - `chapter_title` -- read the chapter section's `title` from the
	 *   manifest, addressed by the locator's chapter code.
	 * - `section_title` -- read the section's title at the chapter+section
	 *   manifest code.
	 * - `paragraph_text` / `page_heading` -- not implemented for handbooks
	 *   in this slice; return null. Per amendment D4 the vocabulary is
	 *   committed inline; per-corpus impls land in their corpus WP. Wire
	 *   here when the AFH-3B / page-pin work surfaces.
	 */
	getSentinelValue(parsed, field): string | null {
		if (parsed.corpus !== HANDBOOKS_CORPUS) return null;
		const locatorParsed = parseHandbooksLocator(parsed.locator, isKnownHandbookEdition);
		if (locatorParsed.kind !== 'ok' || locatorParsed.handbooks === undefined) return null;
		const { doc, edition: editionSlug, chapter, section } = locatorParsed.handbooks;
		const effectiveEdition = editionSlug.length > 0 ? editionSlug : (currentEditionForDoc(doc) ?? '');
		const faaDir = faaDirFor(doc, effectiveEdition);
		if (faaDir === null) return null;
		const manifest = loadManifestCached(doc, faaDir, _derivativeRoot);
		if (manifest === null) return null;
		if (field === 'chapter_title') {
			if (chapter === undefined) return null;
			const chapterSection = manifest.sections.find((s) => s.level === 'chapter' && s.code === chapter);
			return chapterSection?.title ?? null;
		}
		if (field === 'section_title') {
			if (chapter === undefined || section === undefined || section === 'intro') return null;
			const code = `${chapter}.${section}`;
			const sectionEntry = manifest.sections.find((s) => s.level === 'section' && s.code === code);
			return sectionEntry?.title ?? null;
		}
		// `paragraph_text` and `page_heading` not implemented for handbooks
		// in this slice; the validator surfaces null as match=false which is
		// the correct conservative default (NOTICE prompts the author to
		// either pin or capture a more applicable sentinel).
		return null;
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
