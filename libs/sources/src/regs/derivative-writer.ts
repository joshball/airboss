/**
 * Phase 3 -- derivative tree writer.
 *
 * Source of truth: ADR 018 (storage policy: derivatives are committed inline)
 * + ADR 019 §2.5 (indexed-tier JSON shape) + the WP at
 * `docs/work-packages/reference-cfr-ingestion-bulk/`.
 *
 * Writes per-section markdown, per-section meta JSON, subpart + Part overview
 * markdown, per-edition `manifest.json`, and per-edition `sections.json`. Hash-
 * compares each file before writing; skips writes when unchanged. Idempotent.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { SourceEntry } from '../types.ts';
import { sha256 } from './cache.ts';
import type { NormalizedPart, NormalizedSection, NormalizedSubpart } from './normalizer.ts';

export interface DerivativeWriteInput {
	readonly title: '14' | '49';
	readonly editionDate: string; // YYYY-MM-DD
	readonly editionSlug: string; // year-only (e.g. '2026')
	readonly outRoot: string; // typically `<repo>/regulations`
	readonly sections: readonly NormalizedSection[];
	readonly subparts: readonly NormalizedSubpart[];
	readonly parts: readonly NormalizedPart[];
	readonly manifest: ManifestInput;
}

export interface ManifestInput {
	readonly sourceUrl: string;
	readonly sourceSha256: string;
	readonly fetchedAt: string; // ISO-8601
}

export interface ManifestRecord {
	readonly schemaVersion: 1;
	readonly title: '14' | '49';
	readonly editionSlug: string;
	readonly editionDate: string;
	readonly sourceUrl: string;
	readonly sourceSha256: string;
	readonly fetchedAt: string;
	readonly partCount: number;
	readonly subpartCount: number;
	readonly sectionCount: number;
}

export interface SectionsJsonRecord {
	readonly schemaVersion: 1;
	readonly edition: string;
	readonly sectionsByPart: Record<string, readonly SectionEntry[]>;
}

export interface SectionEntry {
	readonly id: string;
	readonly canonical_short: string;
	readonly canonical_title: string;
	readonly last_amended_date: string;
	readonly body_path: string;
	readonly body_sha256: string;
}

export interface DerivativeWriteReport {
	readonly filesWritten: number;
	readonly filesUnchanged: number;
	readonly editionDir: string;
}

export function writeDerivativeTree(input: DerivativeWriteInput): DerivativeWriteReport {
	const editionDir = join(input.outRoot, `cfr-${input.title}`, input.editionDate);
	let filesWritten = 0;
	let filesUnchanged = 0;

	// 1. Per-section markdown + meta JSON
	const sectionEntriesByPart: Record<string, SectionEntry[]> = {};
	for (const section of input.sections) {
		const sectionFileName = sectionFileBaseName(section.entry);
		const partDir = join(editionDir, partNumberFromEntry(section.entry));
		mkdirSync(partDir, { recursive: true });

		const mdPath = join(partDir, `${sectionFileName}.md`);
		const writeResult = writeIfChanged(mdPath, section.bodyMarkdown);
		if (writeResult.wrote) filesWritten += 1;
		else filesUnchanged += 1;

		const metaPath = join(partDir, `${sectionFileName}.meta.json`);
		const metaContent = `${JSON.stringify(buildSectionMeta(section), null, 2)}\n`;
		const metaResult = writeIfChanged(metaPath, metaContent);
		if (metaResult.wrote) filesWritten += 1;
		else filesUnchanged += 1;

		const part = partNumberFromEntry(section.entry);
		if (sectionEntriesByPart[part] === undefined) sectionEntriesByPart[part] = [];
		sectionEntriesByPart[part].push({
			id: section.entry.id,
			canonical_short: section.entry.canonical_short,
			canonical_title: section.entry.canonical_title,
			last_amended_date: section.entry.last_amended_date.toISOString().slice(0, 10),
			body_path: join(part, `${sectionFileName}.md`),
			body_sha256: sha256(section.bodyMarkdown),
		});
	}

	// 2. Subpart overview markdown
	for (const subpart of input.subparts) {
		const partNum = partNumberFromEntry(subpart.entry);
		const subpartLetter = subpartLetterFromEntry(subpart.entry);
		const partDir = join(editionDir, partNum);
		mkdirSync(partDir, { recursive: true });
		const path = join(partDir, `subpart-${subpartLetter}.md`);
		const result = writeIfChanged(path, subpart.bodyMarkdown);
		if (result.wrote) filesWritten += 1;
		else filesUnchanged += 1;
	}

	// 3. Part overview markdown
	for (const part of input.parts) {
		const partNum = partNumberFromEntry(part.entry);
		const partDir = join(editionDir, partNum);
		mkdirSync(partDir, { recursive: true });
		const path = join(partDir, 'index.md');
		const result = writeIfChanged(path, part.bodyMarkdown);
		if (result.wrote) filesWritten += 1;
		else filesUnchanged += 1;
	}

	// 4. sections.json
	const sectionsJson: SectionsJsonRecord = {
		schemaVersion: 1,
		edition: input.editionSlug,
		sectionsByPart: sectionEntriesByPart,
	};
	const sectionsPath = join(editionDir, 'sections.json');
	const sectionsContent = `${JSON.stringify(sectionsJson, null, 2)}\n`;
	const sectionsResult = writeIfChanged(sectionsPath, sectionsContent);
	if (sectionsResult.wrote) filesWritten += 1;
	else filesUnchanged += 1;

	// 5. manifest.json
	const manifest: ManifestRecord = {
		schemaVersion: 1,
		title: input.title,
		editionSlug: input.editionSlug,
		editionDate: input.editionDate,
		sourceUrl: input.manifest.sourceUrl,
		sourceSha256: input.manifest.sourceSha256,
		fetchedAt: input.manifest.fetchedAt,
		partCount: input.parts.length,
		subpartCount: input.subparts.length,
		sectionCount: input.sections.length,
	};
	const manifestPath = join(editionDir, 'manifest.json');
	const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
	const manifestResult = writeIfChanged(manifestPath, manifestContent);
	if (manifestResult.wrote) filesWritten += 1;
	else filesUnchanged += 1;

	return {
		filesWritten,
		filesUnchanged,
		editionDir,
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeIfChanged(path: string, content: string): { wrote: boolean } {
	mkdirSync(dirname(path), { recursive: true });
	if (existsSync(path)) {
		const current = readFileSync(path, 'utf-8');
		if (current === content) return { wrote: false };
	}
	writeFileSync(path, content, 'utf-8');
	return { wrote: true };
}

function partNumberFromEntry(entry: SourceEntry): string {
	// Entry id: 'airboss-ref:regs/cfr-14/91/103' -> '91'
	const segs = entry.id.replace('airboss-ref:regs/', '').split('/');
	if (segs.length < 2) return 'unknown';
	return segs[1] ?? 'unknown';
}

function subpartLetterFromEntry(entry: SourceEntry): string {
	const segs = entry.id.replace('airboss-ref:regs/', '').split('/');
	const last = segs[segs.length - 1] ?? '';
	return last.startsWith('subpart-') ? last.slice('subpart-'.length) : 'unknown';
}

function sectionFileBaseName(entry: SourceEntry): string {
	// Entry id: 'airboss-ref:regs/cfr-14/91/103' -> '91-103'
	const segs = entry.id.replace('airboss-ref:regs/', '').split('/');
	if (segs.length < 3) return 'unknown';
	const part = segs[1] ?? '';
	const section = segs[2] ?? '';
	return `${part}-${section}`;
}

function buildSectionMeta(section: NormalizedSection): SectionMeta {
	return {
		schemaVersion: 1,
		id: section.entry.id,
		last_amended_date: section.entry.last_amended_date.toISOString().slice(0, 10),
		body_sha256: sha256(section.bodyMarkdown),
	};
}

interface SectionMeta {
	readonly schemaVersion: 1;
	readonly id: string;
	readonly last_amended_date: string;
	readonly body_sha256: string;
}
