/**
 * `acs` corpus `CorpusResolver` implementation.
 *
 * Source of truth: ADR 019 §2.2 (`CorpusResolver` interface) + the WP at
 * `docs/work-packages/cert-syllabus-and-goal-composer/`.
 *
 * Composes the locator / citation / URL helpers, plus reads from the
 * registry's `EDITIONS` map and the on-disk derivative tree (per ADR 018).
 * The Lane D slice ships per-task body files; element-level derivative
 * content is sliced out of the containing task body when an element id is
 * resolved.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { stripPin } from '../registry/query.ts';
import { getSources } from '../registry/sources.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatAcsCitation } from './citation.ts';
import { type AcsManifestFile, readAcsManifest } from './derivative-reader.ts';
import { parseAcsLocator } from './locator.ts';
import { getAcsLiveUrl } from './url.ts';

export const ACS_CORPUS = 'acs';

const SOURCE_ID_PREFIX = 'airboss-ref:acs/';

/**
 * The directory root for in-repo ACS derivatives. Test code overrides via
 * `setAcsDerivativeRoot`; production reads from `<cwd>/acs`.
 */
let _derivativeRoot: string = join(process.cwd(), 'acs');

export function setAcsDerivativeRoot(root: string): void {
	_derivativeRoot = root;
}

export function getAcsDerivativeRoot(): string {
	return _derivativeRoot;
}

/**
 * Per-publication manifest cache. Keyed on `<cert>|<edition>|<root>`. Tests
 * reset via `__acs_resolver_internal__.clearManifestCache`.
 */
const _manifestCache: Map<string, AcsManifestFile> = new Map();

function loadManifestCached(cert: string, edition: string, root: string): AcsManifestFile | null {
	const key = `${cert}|${edition}|${root}`;
	const cached = _manifestCache.get(key);
	if (cached !== undefined) return cached;
	try {
		const m = readAcsManifest(root, cert, edition);
		_manifestCache.set(key, m);
		return m;
	} catch {
		return null;
	}
}

function readBody(repoRelativePath: string, root: string): string | null {
	const fullPath = repoRelativePath.startsWith('acs/')
		? join(root, repoRelativePath.slice('acs/'.length))
		: join(root, repoRelativePath);
	if (!existsSync(fullPath)) return null;
	return readFileSync(fullPath, 'utf-8');
}

/**
 * Slice the lines for a single ACS element out of its containing task body.
 * Lines whose first whitespace-trimmed token is exactly `<code>` (or
 * `<code><sub-letter>`) are included. Sub-lettered children of the same code
 * (`PA.I.C.K3a`, `PA.I.C.K3b`) are included so the element body reads
 * naturally; siblings (`PA.I.C.K4`) are excluded.
 */
function sliceElementFromTaskBody(taskBody: string, code: string): string | null {
	const lines = taskBody.split('\n');
	const matched: string[] = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === code || trimmed.startsWith(`${code} `)) {
			matched.push(line);
			continue;
		}
		if (trimmed.startsWith(code) && /^[a-z]\b/.test(trimmed.slice(code.length))) {
			matched.push(line);
		}
	}
	if (matched.length === 0) return null;
	return matched.join('\n');
}

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

	getDerivativeContent(id: SourceId, _edition: EditionId): string | null {
		const stripped = stripPin(id);
		if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
		const locator = stripped.slice(SOURCE_ID_PREFIX.length);
		const parsed = parseAcsLocator(locator);
		if (parsed.kind !== 'ok' || parsed.acs === undefined) return null;

		const { cert, edition, area, task, elementTriad, elementOrdinal } = parsed.acs;
		const manifest = loadManifestCached(cert, edition, _derivativeRoot);
		if (manifest === null) return null;

		// Whole publication: return the manifest title (the body is split
		// across many task files; concatenating them is rarely useful).
		if (area === undefined) return manifest.title;

		const areaEntry = manifest.areas.find((a) => a.area === area);
		if (areaEntry === undefined) return null;

		if (task === undefined) return areaEntry.title;

		const taskEntry = areaEntry.tasks.find((t) => t.task === task);
		if (taskEntry === undefined) return null;
		const taskBody = readBody(taskEntry.body_path, _derivativeRoot);
		if (taskBody === null) return null;

		if (elementTriad === undefined || elementOrdinal === undefined) {
			return taskBody;
		}

		const manifestEl = taskEntry.elements.find((e) => e.triad === elementTriad && e.ordinal === elementOrdinal);
		if (manifestEl === undefined) return null;
		return sliceElementFromTaskBody(taskBody, manifestEl.code) ?? manifestEl.title;
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
export const __acs_resolver_internal__ = {
	clearManifestCache(): void {
		_manifestCache.clear();
	},
};
