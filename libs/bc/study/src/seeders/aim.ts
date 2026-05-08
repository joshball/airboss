/**
 * AIM manifest seed adapter (Aeronautical Information Manual).
 *
 * Produces one `reference` row plus N `reference_section` rows in a
 * chapter / section / paragraph tree, with appendices + glossary entries
 * sitting alongside chapters at depth 0. Idempotent on `content_hash`.
 *
 * `section_schema = { levels: ['chapter','section','paragraph','appendix','glossary'],
 * strict_sequence: false }` -- the AIM is asymmetric (glossary entries are
 * flat at depth 0; chapters go three deep), so depth is NOT pinned to level.
 *
 * Tree-build strategy: parent/child relationships are derived from each
 * entry's `code` field (the manifest's `entries[]` is flat). Two-pass walk:
 *
 *   1. Sort entries so parents land before children (chapters first, then
 *      sections, then paragraphs; appendix + glossary stay at depth 0).
 *   2. Walk the sorted array. For each entry, compute its parent code from
 *      the dotted prefix (`"1-1-3"` -> `"1-1"`; `"1-1"` -> `"1"`; `"1"` ->
 *      null). Look up the parent's section id in the running `code -> id`
 *      map; throw a clear error if a section/paragraph claims a parent that
 *      doesn't exist.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { REFERENCE_KINDS, REFERENCE_SECTION_LEVELS, type ReferenceSectionLevel } from '@ab/constants';
import { airbossRefForAimEntry } from '@ab/sources';
import type { AimManifest, AimManifestEntry } from '../manifest-validation';
import {
	bulkUpsertReferenceSections,
	type SectionSchema,
	type UpsertReferenceSectionInput,
	upsertReference,
} from '../references';
import type { SeedContext, SeedSummary } from './types';

const AIM_SCHEMA: SectionSchema = {
	levels: [
		REFERENCE_SECTION_LEVELS.CHAPTER,
		REFERENCE_SECTION_LEVELS.SECTION,
		REFERENCE_SECTION_LEVELS.PARAGRAPH,
		REFERENCE_SECTION_LEVELS.APPENDIX,
		REFERENCE_SECTION_LEVELS.GLOSSARY,
	],
	strictSequence: false,
};

/** Sort priority by entry kind. Chapters before sections before paragraphs so
 * the running `code -> id` map always has the parent populated when a child
 * row is upserted. Appendix + glossary land at depth 0 (no parent), and they
 * don't have children, so their relative order amongst themselves is just
 * stable-by-code.
 */
const KIND_SORT_ORDER: Record<AimManifestEntry['kind'], number> = {
	chapter: 0,
	appendix: 1,
	glossary: 2,
	section: 3,
	paragraph: 4,
};

const KIND_TO_LEVEL: Record<AimManifestEntry['kind'], ReferenceSectionLevel> = {
	chapter: REFERENCE_SECTION_LEVELS.CHAPTER,
	section: REFERENCE_SECTION_LEVELS.SECTION,
	paragraph: REFERENCE_SECTION_LEVELS.PARAGRAPH,
	appendix: REFERENCE_SECTION_LEVELS.APPENDIX,
	glossary: REFERENCE_SECTION_LEVELS.GLOSSARY,
};

const KIND_TO_DEPTH: Record<AimManifestEntry['kind'], number> = {
	chapter: 0,
	appendix: 0,
	glossary: 0,
	section: 1,
	paragraph: 2,
};

/**
 * Compute the parent code from a child entry's code.
 *
 * - `"1"` (chapter) -> null
 * - `"1-1"` (section) -> `"1"`
 * - `"1-1-3"` (paragraph) -> `"1-1"`
 * - `"appendix-1"` -> null
 * - `"glossary/<term>"` -> null
 */
function parentCodeFor(entry: AimManifestEntry): string | null {
	switch (entry.kind) {
		case 'chapter':
		case 'appendix':
		case 'glossary':
			return null;
		case 'section': {
			const dash = entry.code.indexOf('-');
			if (dash <= 0) {
				throw new Error(`AIM section code "${entry.code}" has no chapter prefix; expected "<chapter>-<section>".`);
			}
			return entry.code.slice(0, dash);
		}
		case 'paragraph': {
			const lastDash = entry.code.lastIndexOf('-');
			if (lastDash <= 0) {
				throw new Error(
					`AIM paragraph code "${entry.code}" has no section prefix; expected "<chapter>-<section>-<para>".`,
				);
			}
			return entry.code.slice(0, lastDash);
		}
	}
}

/**
 * Build a per-parent ordinal counter so siblings get a stable 0..N-1 sort
 * order. Sorting `entries[]` by (kind, code) lexically already yields the
 * right relative order for numeric codes ("1" < "10" because we sort by kind
 * first then code with localeCompare numeric=true), so the counter just
 * tracks the running position within each parent.
 */
function makeOrdinalCounter(): (parentKey: string) => number {
	const counts = new Map<string, number>();
	return (parentKey: string) => {
		const next = counts.get(parentKey) ?? 0;
		counts.set(parentKey, next + 1);
		return next;
	};
}

export async function seedAimManifest(
	manifest: AimManifest,
	context: SeedContext,
	summary: SeedSummary,
): Promise<string> {
	const ref = await upsertReference({
		kind: REFERENCE_KINDS.AIM,
		documentSlug: manifest.document_slug,
		edition: manifest.edition,
		title: manifest.title,
		publisher: manifest.publisher,
		url: manifest.source_url,
		subjects: manifest.subjects,
		primaryCert: manifest.primary_cert ?? null,
		sectionSchema: AIM_SCHEMA,
		seedOrigin: context.seedOrigin,
	});

	// Sort: kind order first (chapter -> appendix -> glossary -> section ->
	// paragraph), then code lexically with numeric awareness so "10" comes
	// after "9". Ensures parent rows are always upserted before child rows.
	const sortedEntries = [...manifest.entries].sort((a, b) => {
		const kindDiff = KIND_SORT_ORDER[a.kind] - KIND_SORT_ORDER[b.kind];
		if (kindDiff !== 0) return kindDiff;
		return a.code.localeCompare(b.code, 'en', { numeric: true });
	});

	const codeToSectionId = new Map<string, string>();
	const nextOrdinal = makeOrdinalCounter();

	// Pre-read every body file in parallel so the bulk upsert path is purely
	// DB-bound. Some AIM paragraphs have no body file on disk (legacy stubs);
	// `existsSync` keeps that branch silent rather than throwing.
	const bodyByCode = new Map<string, string>();
	await Promise.all(
		sortedEntries.map(async (entry) => {
			const bodyAbsPath = resolve(context.repoRoot, entry.body_path);
			bodyByCode.set(entry.code, existsSync(bodyAbsPath) ? await readFile(bodyAbsPath, 'utf-8') : '');
		}),
	);

	// Bucket by depth: chapters (0) before sections (1) before paragraphs
	// (2) so the parent_id FK resolves at INSERT time. Appendix + glossary
	// are also depth 0 with no children.
	const byDepth = new Map<number, AimManifestEntry[]>();
	const ordinalByEntry = new Map<AimManifestEntry, number>();
	const parentCodeByEntry = new Map<AimManifestEntry, string | null>();
	for (const entry of sortedEntries) {
		const parentCode = parentCodeFor(entry);
		parentCodeByEntry.set(entry, parentCode);
		const ordinalKey = parentCode ?? `__top__:${entry.kind}`;
		ordinalByEntry.set(entry, nextOrdinal(ordinalKey));
		const depth = KIND_TO_DEPTH[entry.kind];
		const list = byDepth.get(depth);
		if (list) list.push(entry);
		else byDepth.set(depth, [entry]);
	}

	const depths = [...byDepth.keys()].sort((a, b) => a - b);
	for (const depth of depths) {
		const entriesAtDepth = byDepth.get(depth) ?? [];
		const inputs: UpsertReferenceSectionInput[] = entriesAtDepth.map((entry) => {
			const parentCode = parentCodeByEntry.get(entry) ?? null;
			let parentId: string | null = null;
			if (parentCode !== null) {
				const found = codeToSectionId.get(parentCode);
				if (!found) {
					throw new Error(
						`AIM seed: entry "${entry.code}" (${entry.kind}) references missing parent "${parentCode}". ` +
							'Manifest is malformed -- parent must exist before child in entries[].',
					);
				}
				parentId = found;
			}
			return {
				referenceId: ref.id,
				parentId,
				level: KIND_TO_LEVEL[entry.kind],
				ordinal: ordinalByEntry.get(entry) ?? 0,
				depth,
				code: entry.code,
				airbossRef: airbossRefForAimEntry(entry.code),
				title: entry.title,
				sourceLocator: `AIM ${entry.code}`,
				contentMd: bodyByCode.get(entry.code) ?? '',
				contentHash: entry.content_hash,
				hasFigures: false,
				hasTables: false,
				seedOrigin: context.seedOrigin,
			};
		});

		const results = await bulkUpsertReferenceSections(inputs);
		for (let i = 0; i < entriesAtDepth.length; i += 1) {
			const entry = entriesAtDepth[i];
			const result = results[i];
			if (!entry || !result) continue;
			codeToSectionId.set(entry.code, result.row.id);
			summary.sectionsTouched += 1;
			if (result.changed) summary.sectionsChanged += 1;
		}
	}

	summary.editionsProcessed += 1;
	context.onProgress?.(
		`  ${manifest.document_slug} ${manifest.edition}: ${sortedEntries.length} entries (chapters/sections/paragraphs/appendices/glossary)`,
	);
	return ref.id;
}
