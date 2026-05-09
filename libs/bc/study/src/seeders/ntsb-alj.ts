/**
 * NTSB-ALJ ruling manifest seed adapter (WP-NTSB-ALJ).
 *
 * Two modes, dispatched on `manifest.sections.length`:
 *
 *   1. Whole-doc: when `sections === []`, the seeder produces ONE
 *      `reference_section` row at depth 0, level `'document'`, code `'1'`.
 *      The body is read from `manifest.body_path`; `content_hash` is the
 *      manifest's `body_sha256`. Phase 1 of the WP ships in this shape
 *      (manual curation; per-section extraction comes later).
 *
 *   2. Section-tree: when `sections.length > 0`, the seeder writes the
 *      depth-0 document root from `body_path` plus one depth-1 row per
 *      `sections[]` entry (Findings of Fact / Conclusions of Law / Order /
 *      Discussion / Final). The five-section vocabulary is locked by the
 *      manifest schema (`ntsbAljManifestSectionSchema`).
 *
 * Subjects + primary_cert are NOT carried on NTSB-ALJ manifests -- those
 * live on the YAML row in `course/references/ntsb-alj.yaml`. The references
 * phase runs FIRST and creates the reference row; this adapter (which runs
 * in the manifest / handbooks phase) preserves those YAML-authored fields
 * via `upsertReference`'s null-defaulting on conflict (same pattern as AC).
 *
 * `kind` is `REFERENCE_KINDS.NTSB` -- ALJ rulings share the umbrella NTSB
 * card's downstream chrome (citation rendering, reference-tag taxonomy)
 * per the WP spec. A future WP can split into a dedicated `ntsb-alj`
 * REFERENCE_KIND when the data model diverges.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { REFERENCE_KINDS, REFERENCE_SECTION_LEVELS } from '@ab/constants';
import { airbossRefForNtsbAljDocument, airbossRefForNtsbAljSection } from '@ab/sources';
import type { NtsbAljManifest } from '../manifest-validation';
import {
	bulkUpsertReferenceSections,
	type SectionSchema,
	type UpsertReferenceSectionInput,
	upsertReference,
	upsertReferenceSection,
} from '../references';
import type { SeedContext, SeedSummary } from './types';

/**
 * Whole-doc schema -- single legal level at a single legal depth (the
 * whole-document body row). Used when the manifest carries no `sections[]`.
 * Mirrors the ACs whole-doc shape and the SAFO/InFO `'document'` convention.
 */
const NTSB_ALJ_WHOLE_DOC_SCHEMA: SectionSchema = {
	levels: [REFERENCE_SECTION_LEVELS.DOCUMENT],
	strictSequence: true,
};

/**
 * Section-tree schema -- document root plus the five locked opinion-section
 * codes at depth 1. The schema declares the level vocabulary; the manifest
 * schema (`ntsbAljManifestSectionSchema`) restricts `code` to the locked
 * five-section enum.
 */
const NTSB_ALJ_SECTION_TREE_SCHEMA: SectionSchema = {
	levels: [REFERENCE_SECTION_LEVELS.DOCUMENT, REFERENCE_SECTION_LEVELS.SECTION],
	strictSequence: true,
};

/**
 * Build the DB `document_slug` from the manifest's case number. Slug shape
 * (`ntsb-alj-<prefix>-<sequence>`) mirrors `course/references/ntsb-alj.yaml`
 * so the YAML phase's reference row and the manifest phase's section rows
 * land on the same `(document_slug, edition)` upsert key.
 */
function documentSlugFor(caseNumber: string): string {
	return `ntsb-alj-${caseNumber}`;
}

export async function seedNtsbAljManifest(
	manifest: NtsbAljManifest,
	context: SeedContext,
	summary: SeedSummary,
): Promise<string> {
	const documentSlug = documentSlugFor(manifest.case_number);

	const metadata: Record<string, unknown> = {
		case_number: manifest.case_number,
	};
	if (manifest.publication_date !== null) {
		metadata.publication_date = manifest.publication_date;
	}
	if (manifest.page_count != null) {
		metadata.page_count = manifest.page_count;
	}

	const isSectionTree = manifest.sections.length > 0;

	const ref = await upsertReference({
		kind: REFERENCE_KINDS.NTSB,
		documentSlug,
		edition: manifest.edition,
		title: manifest.title,
		publisher: manifest.publisher,
		url: manifest.source_url,
		// Subjects + primary_cert are intentionally omitted -- the YAML phase
		// owns those fields. Passing undefined preserves the existing values
		// on conflict (rather than blanking them).
		sectionSchema: isSectionTree ? NTSB_ALJ_SECTION_TREE_SCHEMA : NTSB_ALJ_WHOLE_DOC_SCHEMA,
		metadata,
		seedOrigin: context.seedOrigin,
	});

	const documentSectionId = await seedDocumentRoot(manifest, ref.id, context, summary);

	if (isSectionTree) {
		await seedOpinionSections(manifest, ref.id, documentSectionId, context, summary);
	}

	summary.editionsProcessed += 1;
	const sectionLabel = isSectionTree ? `section-tree (${manifest.sections.length} opinion sections)` : 'whole-doc';
	context.onProgress?.(
		`  ${documentSlug} ${manifest.edition}: ntsb-alj ${sectionLabel}, ${manifest.page_count ?? '?'} pages`,
	);
	return ref.id;
}

/**
 * Lay down the depth-0 document root from `manifest.body_path`. Used for both
 * whole-doc and section-tree modes -- in the section-tree case, the document
 * row is the parent of every opinion section.
 */
async function seedDocumentRoot(
	manifest: NtsbAljManifest,
	referenceId: string,
	context: SeedContext,
	summary: SeedSummary,
): Promise<string> {
	const bodyAbsPath = resolve(context.repoRoot, manifest.body_path);
	if (!existsSync(bodyAbsPath)) {
		throw new Error(`ntsb-alj manifest references missing body file: ${manifest.body_path} (resolved: ${bodyAbsPath})`);
	}
	const contentMd = await readFile(bodyAbsPath, 'utf-8');

	const { row, changed } = await upsertReferenceSection({
		referenceId,
		parentId: null,
		level: REFERENCE_SECTION_LEVELS.DOCUMENT,
		ordinal: 0,
		depth: 0,
		code: '1',
		airbossRef: airbossRefForNtsbAljDocument(manifest.case_number),
		title: manifest.title,
		sourceLocator: `${manifest.case_number} (${manifest.edition})`,
		contentMd,
		contentHash: manifest.body_sha256,
		hasFigures: false,
		hasTables: false,
		metadata: {},
		seedOrigin: context.seedOrigin,
	});

	summary.sectionsTouched += 1;
	if (changed) summary.sectionsChanged += 1;
	return row.id;
}

/**
 * Lay down the depth-1 opinion-section rows under the document root. The
 * five-section vocabulary (Findings of Fact / Conclusions of Law / Order /
 * Discussion / Final) is enforced by the manifest schema; this adapter walks
 * `sections[]` in the order the manifest declares.
 */
async function seedOpinionSections(
	manifest: NtsbAljManifest,
	referenceId: string,
	documentSectionId: string,
	context: SeedContext,
	summary: SeedSummary,
): Promise<void> {
	const sortedSections = [...manifest.sections].sort((a, b) => a.ordinal - b.ordinal);

	const bodyByCode = new Map<string, string>();
	await Promise.all(
		sortedSections.map(async (section) => {
			const bodyAbsPath = resolve(context.repoRoot, section.body_path);
			if (!existsSync(bodyAbsPath)) {
				throw new Error(
					`ntsb-alj manifest references missing section body: ${section.body_path} (resolved: ${bodyAbsPath})`,
				);
			}
			bodyByCode.set(section.code, await readFile(bodyAbsPath, 'utf-8'));
		}),
	);

	const inputs: UpsertReferenceSectionInput[] = sortedSections.map((section) => ({
		referenceId,
		parentId: documentSectionId,
		level: section.level,
		ordinal: section.ordinal,
		depth: 1,
		code: section.code,
		airbossRef: airbossRefForNtsbAljSection(manifest.case_number, section.code),
		title: section.title,
		sourceLocator: `${manifest.case_number}/${section.code}`,
		contentMd: bodyByCode.get(section.code) ?? '',
		contentHash: section.content_hash,
		hasFigures: false,
		hasTables: false,
		metadata: {},
		seedOrigin: context.seedOrigin,
	}));
	const results = await bulkUpsertReferenceSections(inputs);
	for (const result of results) {
		summary.sectionsTouched += 1;
		if (result.changed) summary.sectionsChanged += 1;
	}
}
