/**
 * Section-tree manifest seed adapter (PHAK / AFH / AVWX shape).
 *
 * Produces one `reference` row plus N `reference_section` rows in a
 * chapter/section/subsection tree. Idempotent on `content_hash`.
 *
 * `section_schema = { levels: ['chapter','section','subsection'],
 * strict_sequence: true }` -- handbooks pin level to depth, so depth 0 is
 * always a chapter, depth 1 a section, depth 2 a subsection.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { airbossRefForHandbookSection } from '@ab/sources';
import type { SectionTreeManifest } from '../manifest-validation';
import { replaceFiguresForSection, type SectionSchema, upsertReference, upsertReferenceSection } from '../references';
import type { SeedContext, SeedSummary } from './types';

/** Depth lookup keyed by handbook level. */
const LEVEL_TO_DEPTH = { chapter: 0, section: 1, subsection: 2 } as const;

const SECTION_TREE_SCHEMA: SectionSchema = {
	levels: ['chapter', 'section', 'subsection'],
	strictSequence: true,
};

export async function seedSectionTreeManifest(
	manifest: SectionTreeManifest,
	context: SeedContext,
	summary: SeedSummary,
): Promise<string> {
	const ref = await upsertReference({
		kind: 'handbook',
		documentSlug: manifest.document_slug,
		edition: manifest.edition,
		title: manifest.title,
		publisher: manifest.publisher,
		url: manifest.source_url,
		subjects: manifest.subjects,
		primaryCert: manifest.primary_cert ?? null,
		sectionSchema: SECTION_TREE_SCHEMA,
		seedOrigin: context.seedOrigin,
	});

	const codeToSectionId: Map<string, string> = new Map();

	// Sort sections so chapters come before their children. Sort by code length
	// first (shortest first), then lexically; this keeps chapter "12" before
	// section "12.3" before subsection "12.3.2".
	const sortedSections = [...manifest.sections].sort((a, b) => {
		if (a.code.length !== b.code.length) return a.code.length - b.code.length;
		return a.code.localeCompare(b.code);
	});

	for (const section of sortedSections) {
		const parentId = section.parent_code ? (codeToSectionId.get(section.parent_code) ?? null) : null;
		const bodyAbsPath = resolve(context.repoRoot, section.body_path);
		// Mirror `whole-doc.ts`: a manifest that references a missing body
		// file is a seed-time error, not a silent empty-content fall-through.
		// Silently substituting `''` masked broken manifests for months.
		if (!existsSync(bodyAbsPath)) {
			throw new Error(
				`section-tree manifest references missing body file: ${section.body_path} (resolved: ${bodyAbsPath})`,
			);
		}
		const contentMd = await readFile(bodyAbsPath, 'utf-8');
		const { row, changed } = await upsertReferenceSection({
			referenceId: ref.id,
			parentId,
			level: section.level,
			ordinal: section.ordinal,
			depth: LEVEL_TO_DEPTH[section.level],
			code: section.code,
			airbossRef: airbossRefForHandbookSection(manifest.document_slug, manifest.edition, section.code),
			title: section.title,
			faaPageStart: section.faa_page_start,
			faaPageEnd: section.faa_page_end,
			sourceLocator: section.source_locator,
			contentMd,
			contentHash: section.content_hash,
			hasFigures: section.has_figures,
			hasTables: section.has_tables,
			seedOrigin: context.seedOrigin,
		});
		codeToSectionId.set(section.code, row.id);
		summary.sectionsTouched += 1;
		if (changed) {
			summary.sectionsChanged += 1;
			// Replace figures for this section since the body changed.
			const figuresForSection = manifest.figures.filter((f) => f.section_code === section.code);
			const written = await replaceFiguresForSection(
				row.id,
				figuresForSection.map((f) => ({
					ordinal: f.ordinal,
					caption: f.caption,
					assetPath: f.asset_path,
					width: f.width ?? null,
					height: f.height ?? null,
				})),
				undefined,
				context.seedOrigin,
			);
			summary.figuresWritten += written.length;
		}
	}

	summary.editionsProcessed += 1;
	context.onProgress?.(
		`  ${manifest.document_slug} ${manifest.edition}: ${sortedSections.length} sections, ${manifest.figures.length} figures, ${manifest.warnings.length} warnings`,
	);
	return ref.id;
}
