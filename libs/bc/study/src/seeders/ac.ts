/**
 * AC manifest seed adapter (FAA Advisory Circulars, WP-AC + WP-AC-PROMOTE).
 *
 * Two modes, dispatched on `manifest.sections.length`:
 *
 *   1. Whole-doc (legacy WP-AC, preserved): when `sections === []`, the
 *      seeder produces ONE `reference_section` row at depth 0, level
 *      `'circular'`, code `'1'`. The body is read from `manifest.body_path`;
 *      `content_hash` is the manifest's `body_sha256`.
 *
 *   2. Section-tree (WP-AC-PROMOTE): when `sections.length > 0`, the seeder
 *      walks the chapter/section/subsection tree and produces N rows. The
 *      whole-document `body_path` is NOT seeded as a separate row; chapters
 *      become the depth-0 rows so the reader's drill-down is consistent
 *      with handbooks. `section_schema` flips to the chapter/section/
 *      subsection vocabulary.
 *
 * Subjects + primary_cert are NOT carried on AC manifests -- those live on
 * the YAML row in `course/references/advisory-circulars.yaml`. In seed-all
 * the manifest phase (`handbooks`) runs first and creates the reference row
 * with empty subjects; the YAML phase (`references`) runs immediately after
 * and overwrites those fields with the canonical YAML values via the same
 * `(document_slug, edition)` upsert key. End state matches the YAML.
 *
 * Bridges the on-disk shape (doc_slug + revision under `ac/`) to the
 * DB-side shape (document_slug + edition) via the explicit registry at
 * `@ab/sources/ac` :: `getAcSeedMapping`. A manifest with no registry entry
 * raises a clear seed-time error -- the YAML row must exist for the AC
 * to land as a readable card.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { REFERENCE_KINDS, REFERENCE_SECTION_LEVELS } from '@ab/constants';
import { getAcSeedMapping } from '@ab/sources/ac';
import type { AcManifest } from '../manifest-validation';
import { type SectionSchema, upsertReference, upsertReferenceSection } from '../references';
import type { SeedContext, SeedSummary } from './types';

/**
 * Whole-doc schema -- single legal level at a single legal depth (the
 * whole-document body row). Used when the manifest carries no `sections[]`.
 */
const AC_WHOLE_DOC_SCHEMA: SectionSchema = {
	levels: [REFERENCE_SECTION_LEVELS.CIRCULAR],
	strictSequence: true,
};

/**
 * Section-tree schema -- chapter / section / subsection vocabulary mirroring
 * handbooks. Used when the manifest carries one or more `sections[]` entries.
 */
const AC_SECTION_TREE_SCHEMA: SectionSchema = {
	levels: [REFERENCE_SECTION_LEVELS.CHAPTER, REFERENCE_SECTION_LEVELS.SECTION, REFERENCE_SECTION_LEVELS.SUBSECTION],
	strictSequence: true,
};

/** Depth lookup keyed by section-tree level. */
const LEVEL_TO_DEPTH = {
	[REFERENCE_SECTION_LEVELS.CHAPTER]: 0,
	[REFERENCE_SECTION_LEVELS.SECTION]: 1,
	[REFERENCE_SECTION_LEVELS.SUBSECTION]: 2,
} as const;

export async function seedAcManifest(
	manifest: AcManifest,
	context: SeedContext,
	summary: SeedSummary,
): Promise<string> {
	const mapping = getAcSeedMapping(manifest.doc_slug, manifest.revision);
	if (!mapping) {
		throw new Error(
			`AC seed: no DB mapping for manifest ac/${manifest.doc_slug}/${manifest.revision}/. ` +
				'Add an entry to libs/sources/src/ac/seed-mapping.ts and a row to ' +
				'course/references/advisory-circulars.yaml so the AC has a reference row to attach to.',
		);
	}

	// Optional metadata lands on `reference.metadata` jsonb. Skip null /
	// undefined so the metadata stays compact.
	const metadata: Record<string, unknown> = {
		page_count: manifest.page_count,
		doc_number: manifest.doc_number,
		revision: manifest.revision,
	};
	if (manifest.publication_date !== null) {
		metadata.publication_date = manifest.publication_date;
	}

	const isSectionTree = manifest.sections.length > 0;

	const ref = await upsertReference({
		kind: REFERENCE_KINDS.AC,
		documentSlug: mapping.documentSlug,
		edition: mapping.edition,
		title: manifest.title,
		publisher: manifest.publisher,
		url: manifest.source_url,
		// Subjects + primary_cert are intentionally omitted -- the YAML phase
		// owns those fields. Passing undefined preserves the existing values
		// on conflict (rather than blanking them).
		sectionSchema: isSectionTree ? AC_SECTION_TREE_SCHEMA : AC_WHOLE_DOC_SCHEMA,
		metadata,
		seedOrigin: context.seedOrigin,
	});

	if (isSectionTree) {
		await seedSectionTree(manifest, ref.id, mapping.edition, context, summary);
	} else {
		await seedWholeDoc(manifest, ref.id, mapping.edition, context, summary);
	}

	summary.editionsProcessed += 1;
	const sectionLabel = isSectionTree ? `section-tree (${manifest.sections.length} sections)` : 'whole-doc';
	context.onProgress?.(
		`  ${mapping.documentSlug} ${mapping.edition}: ac ${sectionLabel}, ${manifest.page_count} pages`,
	);
	return ref.id;
}

async function seedWholeDoc(
	manifest: AcManifest,
	referenceId: string,
	edition: string,
	context: SeedContext,
	summary: SeedSummary,
): Promise<void> {
	const bodyAbsPath = resolve(context.repoRoot, manifest.body_path);
	if (!existsSync(bodyAbsPath)) {
		throw new Error(`AC manifest references missing body file: ${manifest.body_path} (resolved: ${bodyAbsPath})`);
	}
	const contentMd = await readFile(bodyAbsPath, 'utf-8');

	const { changed } = await upsertReferenceSection({
		referenceId,
		parentId: null,
		level: REFERENCE_SECTION_LEVELS.CIRCULAR,
		ordinal: 0,
		depth: 0,
		code: '1',
		title: manifest.title,
		faaPageStart: null,
		faaPageEnd: null,
		sourceLocator: `${edition} (${manifest.page_count} pp.)`,
		contentMd,
		contentHash: manifest.body_sha256,
		hasFigures: false,
		hasTables: false,
		metadata: {},
		seedOrigin: context.seedOrigin,
	});

	summary.sectionsTouched += 1;
	if (changed) summary.sectionsChanged += 1;
}

async function seedSectionTree(
	manifest: AcManifest,
	referenceId: string,
	edition: string,
	context: SeedContext,
	summary: SeedSummary,
): Promise<void> {
	// Sort sections so chapters land before their children. Chapters carry
	// integer codes; appendix containers carry `appendix-<id>`; sections /
	// subsections carry dotted-decimal codes. Sort first by depth (chapters
	// before sections before subsections via level rank), then by ordinal
	// within a level. This preserves document order without trusting the
	// raw `code` lex-sort (chapter `appendix-a` would otherwise sort before
	// chapter `1`).
	const sortedSections = [...manifest.sections].sort((a, b) => {
		const rankA = LEVEL_TO_DEPTH[a.level];
		const rankB = LEVEL_TO_DEPTH[b.level];
		if (rankA !== rankB) return rankA - rankB;
		return a.ordinal - b.ordinal;
	});

	const codeToSectionId = new Map<string, string>();

	for (const section of sortedSections) {
		const parentId = section.parent_code === null ? null : (codeToSectionId.get(section.parent_code) ?? null);
		if (section.parent_code !== null && parentId === null) {
			throw new Error(
				`AC seed: section ${section.code} references unknown parent ${section.parent_code} (edition ${edition})`,
			);
		}
		const bodyAbsPath = resolve(context.repoRoot, section.body_path);
		if (!existsSync(bodyAbsPath)) {
			throw new Error(`AC manifest references missing section body: ${section.body_path} (resolved: ${bodyAbsPath})`);
		}
		const contentMd = await readFile(bodyAbsPath, 'utf-8');
		const { row, changed } = await upsertReferenceSection({
			referenceId,
			parentId,
			level: section.level,
			ordinal: section.ordinal,
			depth: LEVEL_TO_DEPTH[section.level],
			code: section.code,
			title: section.title,
			faaPageStart: section.faa_page_start,
			faaPageEnd: section.faa_page_end,
			sourceLocator: section.source_locator,
			contentMd,
			contentHash: section.content_hash,
			hasFigures: false,
			hasTables: false,
			metadata: {},
			seedOrigin: context.seedOrigin,
		});
		codeToSectionId.set(section.code, row.id);
		summary.sectionsTouched += 1;
		if (changed) summary.sectionsChanged += 1;
	}
}
