/**
 * Phase 3 -- the `regs` `CorpusResolver` implementation.
 *
 * Source of truth: ADR 019 §2.2 (`CorpusResolver` interface) + the WP at
 * `docs/work-packages/reference-cfr-ingestion-bulk/`.
 *
 * Composes the parser + citation + URL helpers, plus reads from the registry's
 * `EDITIONS` map and the on-disk derivative tree (per ADR 018). Phase 4
 * (renderer) is what consumes `getIndexedContent` for token substitution; this
 * module makes that possible without holding any per-render state.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCE_CACHE } from '@ab/constants';
import type { CorpusResolver } from '../registry/corpus-resolver.ts';
import { getEditionsMap } from '../registry/editions.ts';
import { getCurrentEditionForCorpus } from '../registry/index-cache.ts';
import { stripPin } from '../registry/query.ts';
import type { Edition, EditionId, IndexedContent, LocatorError, ParsedLocator, SourceId } from '../types.ts';
import { formatRegsCitation } from './citation.ts';
import { parseRegsLocator } from './locator.ts';
import { getRegsLiveUrl } from './url.ts';

export const REGS_CORPUS = 'regs';

/**
 * The directory root for in-repo regulation derivatives. Test code overrides
 * via `setRegsDerivativeRoot`; production reads from `<cwd>/regulations`.
 */
let _derivativeRoot: string = join(process.cwd(), SOURCE_CACHE.REGS);

export function setRegsDerivativeRoot(root: string): void {
	_derivativeRoot = root;
}

export function getRegsDerivativeRoot(): string {
	return _derivativeRoot;
}

/**
 * Build the production `regs` resolver. Stateless aside from the derivative
 * root, which is overridable for tests.
 */
export const REGS_RESOLVER: CorpusResolver = {
	corpus: REGS_CORPUS,

	parseLocator(locator: string): ParsedLocator | LocatorError {
		return parseRegsLocator(locator);
	},

	formatCitation(entry, style) {
		return formatRegsCitation(entry, style);
	},

	getCurrentEdition(): EditionId | null {
		// Memoized through the generation-invalidated index in
		// `registry/index-cache.ts`. The cache walks the regs-corpus entry
		// list once per (sources-gen, editions-gen); subsequent reads are
		// O(1) Map-gets. Editions are calendar years (or YYYY-MM-DD), so
		// lexical max is also chronological max.
		const editionsMap = getEditionsMap();
		return getCurrentEditionForCorpus(REGS_CORPUS, (id) => editionsMap.get(id) ?? []);
	},

	async getEditions(id: SourceId): Promise<readonly Edition[]> {
		const stripped = stripPin(id) as SourceId;
		return getEditionsMap().get(stripped) ?? [];
	},

	getLiveUrl(id: SourceId, edition: EditionId): string | null {
		const editionsMap = getEditionsMap();
		const stripped = stripPin(id) as SourceId;
		const editions = editionsMap.get(stripped) ?? [];
		const editionRecord = editions.find((e) => e.id === edition);
		const snapshotDate = editionRecord !== undefined ? toIsoDate(editionRecord.published_date) : undefined;

		const current = this.getCurrentEdition();
		const isCurrent = current !== null && current === edition;

		return getRegsLiveUrl(id, edition, { isCurrent, snapshotDate });
	},

	getDerivativeContent(id: SourceId, edition: EditionId): string | null {
		const path = derivativePathFor(id, edition);
		if (path === null) return null;
		if (!existsSync(path)) return null;
		return readFileSync(path, 'utf-8');
	},

	async getIndexedContent(id: SourceId, edition: EditionId): Promise<IndexedContent | null> {
		const editionsMap = getEditionsMap();
		const stripped = stripPin(id) as SourceId;
		const editions = editionsMap.get(stripped) ?? [];
		const editionRecord = editions.find((e) => e.id === edition);
		if (editionRecord === undefined) return null;

		const sectionsJsonPath = sectionsJsonPathFor(stripped, editionRecord);
		if (sectionsJsonPath === null || !existsSync(sectionsJsonPath)) return null;

		const sectionsJson = JSON.parse(readFileSync(sectionsJsonPath, 'utf-8')) as {
			sectionsByPart?: Record<string, Array<{ id: string; body_path: string; body_sha256: string }>>;
		};
		const partFromId = partNumberFromSourceId(stripped);
		const partList = sectionsJson.sectionsByPart?.[partFromId] ?? [];
		const record = partList.find((r) => r.id === stripped);
		if (record === undefined) return null;

		// Read the section's body markdown for `normalizedText`.
		const editionDir = editionDirFor(stripped, editionRecord);
		if (editionDir === null) return null;
		const bodyPath = join(editionDir, record.body_path);
		const normalizedText = existsSync(bodyPath) ? readFileSync(bodyPath, 'utf-8') : '';

		return {
			id: stripped,
			edition,
			normalizedText,
		};
	},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function partNumberFromSourceId(id: SourceId): string {
	const segs = id.replace('airboss-ref:regs/', '').split('/');
	return segs[1] ?? '';
}

function titleNumberFromSourceId(id: SourceId): '14' | '49' | null {
	const segs = id.replace('airboss-ref:regs/', '').split('/');
	const titleSlug = segs[0] ?? '';
	if (titleSlug === 'cfr-14') return '14';
	if (titleSlug === 'cfr-49') return '49';
	return null;
}

function sectionFileBaseFromSourceId(id: SourceId): string | null {
	const segs = id.replace('airboss-ref:regs/', '').split('/');
	if (segs.length < 3) return null;
	const part = segs[1] ?? '';
	const section = segs[2] ?? '';
	if (section.startsWith('subpart-')) return null;
	return `${part}-${section}`;
}

function editionDirFor(id: SourceId, edition: Edition): string | null {
	const title = titleNumberFromSourceId(id);
	if (title === null) return null;
	const date = toIsoDate(edition.published_date);
	return join(getRegsDerivativeRoot(), `cfr-${title}`, date);
}

function derivativePathFor(id: SourceId, edition: EditionId): string | null {
	const stripped = stripPin(id) as SourceId;
	const editionsMap = getEditionsMap();
	const editions = editionsMap.get(stripped) ?? [];
	const editionRecord = editions.find((e) => e.id === edition);
	if (editionRecord === undefined) return null;
	const editionDir = editionDirFor(stripped, editionRecord);
	if (editionDir === null) return null;

	// Section: `<part>/<part>-<section>.md`
	const fileBase = sectionFileBaseFromSourceId(stripped);
	if (fileBase !== null) {
		return join(editionDir, partNumberFromSourceId(stripped), `${fileBase}.md`);
	}

	// Subpart: `<part>/subpart-<letter>.md`
	const segs = stripped.replace('airboss-ref:regs/', '').split('/');
	const last = segs[segs.length - 1] ?? '';
	if (last.startsWith('subpart-')) {
		return join(editionDir, partNumberFromSourceId(stripped), `${last}.md`);
	}

	// Part: `<part>/index.md`
	if (segs.length === 2) {
		return join(editionDir, partNumberFromSourceId(stripped), 'index.md');
	}

	return null;
}

function sectionsJsonPathFor(id: SourceId, edition: Edition): string | null {
	const editionDir = editionDirFor(id, edition);
	if (editionDir === null) return null;
	return join(editionDir, 'sections.json');
}

function toIsoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}
