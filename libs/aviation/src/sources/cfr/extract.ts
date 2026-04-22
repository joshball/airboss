/**
 * CFR `SourceExtractor` implementation.
 *
 * Glue between the extraction orchestrator in `scripts/references/` and the
 * XML parser in `./parser.ts`. Handles any `sourceId` starting with `cfr-`.
 *
 * The extractor caches parsed documents per sourceFile so a batch run that
 * extracts 10 CFR sections only parses the XML once. Callers get fresh
 * parses by calling `resetCache()` or constructing a new `CfrExtractor`.
 */

import { readFileSync } from 'node:fs';
import type { SourceExtractor } from '../../schema/source';
import { SOURCES } from '../registry';
import { type CfrDocument, type CfrSectionLocator, parseCfrXml } from './parser';

export class CfrExtractor implements SourceExtractor {
	private readonly cache = new Map<string, CfrDocument>();

	canHandle(sourceId: string): boolean {
		return sourceId.startsWith('cfr-');
	}

	async extract(
		locator: Readonly<Record<string, string | number>>,
		sourceFile: string,
	): Promise<{ text: string; sourceVersion: string; extractedAt: string }> {
		const normalizedLocator = normalizeLocator(locator);
		const doc = this.loadDocument(sourceFile);
		const parsed = doc.getSection(normalizedLocator);

		const source = SOURCES.find((s) => s.path === sourceFile);
		const sourceVersion = source?.version ?? 'unknown';

		return {
			text: parsed.bodyMarkdown,
			sourceVersion,
			extractedAt: new Date().toISOString(),
		};
	}

	resetCache(): void {
		this.cache.clear();
	}

	private loadDocument(sourceFile: string): CfrDocument {
		const cached = this.cache.get(sourceFile);
		if (cached) return cached;
		const xml = readFileSync(sourceFile, 'utf8');
		const doc = parseCfrXml(xml, sourceFile);
		this.cache.set(sourceFile, doc);
		return doc;
	}
}

function normalizeLocator(locator: Readonly<Record<string, string | number>>): CfrSectionLocator {
	const title = Number(locator.title);
	const part = Number(locator.part);
	const section = locator.section;
	if (!Number.isFinite(title)) {
		throw new Error(`CFR locator requires numeric 'title' (got ${JSON.stringify(locator.title)})`);
	}
	if (!Number.isFinite(part)) {
		throw new Error(`CFR locator requires numeric 'part' (got ${JSON.stringify(locator.part)})`);
	}
	if (section === undefined || section === null || `${section}`.trim() === '') {
		throw new Error("CFR locator requires non-empty 'section'");
	}
	return { title, part, section: String(section) };
}

/** Default singleton used by `scripts/references/extract.ts`. */
export const cfrExtractor = new CfrExtractor();
