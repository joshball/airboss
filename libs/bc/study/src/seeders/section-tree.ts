/**
 * Section-tree manifest seed adapter (PHAK / AFH / AVWX shape).
 *
 * Produces one `reference` row plus N `reference_section` rows in a
 * chapter/section/subsection tree. Idempotent on `content_hash`.
 *
 * `section_schema = { levels: ['front-matter','chapter','section','subsection'],
 * strict_sequence: false }` -- chapters pin to depth 0 with their
 * children at deeper depths, but `front-matter` is also a depth-0 peer
 * (cover, preface, acknowledgments, prose introduction; see
 * WP-HANDBOOK-RE-EXTRACTION-V2 Sub-phase 1C). Strict-sequence is
 * therefore off: at depth 0 the level may be either `front-matter` or
 * `chapter`. Sections / subsections still pin to their depth.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { airbossRefForHandbookSection } from '@ab/sources';
import type { HandbookManifestSection, SectionTreeManifest } from '../manifest-validation';
import {
	bulkReplaceFiguresForSections,
	bulkUpsertReferenceSections,
	type SectionSchema,
	type UpsertReferenceSectionInput,
	upsertReference,
} from '../references';
import type { SeedContext, SeedSummary } from './types';

/**
 * Depth lookup keyed by handbook level.
 *
 * Both `front-matter` and `chapter` sit at depth 0 (peers in the
 * chapter-list view; `front-matter` rows come first per their ordinals).
 * `section` is depth 1, `subsection` is depth 2.
 */
const LEVEL_TO_DEPTH = {
	'front-matter': 0,
	chapter: 0,
	section: 1,
	subsection: 2,
} as const satisfies Record<HandbookManifestSection['level'], number>;

const SECTION_TREE_SCHEMA: SectionSchema = {
	levels: ['front-matter', 'chapter', 'section', 'subsection'],
	// `strict_sequence: false` because depth 0 admits two levels
	// (`front-matter` and `chapter`); the validator falls back to the
	// loose `every level IN levels[]` rule.
	strictSequence: false,
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

	// Sort sections so depth-0 rows seed before their descendants and
	// front-matter rows seed before chapters at the same depth (their
	// ordinals already reflect that order). Sort by code length first
	// (shortest first), then by `front-matter` before `chapter` at the
	// same depth, then by ordinal, then lexically by code as a final
	// tiebreaker. This keeps `front-matter/00-cover` ordinal=0 before
	// chapter "1" ordinal=1 before section "1.3".
	const levelRank = (level: HandbookManifestSection['level']): number => (level === 'front-matter' ? 0 : 1);
	const sortedSections = [...manifest.sections].sort((a, b) => {
		if (a.code.length !== b.code.length) return a.code.length - b.code.length;
		if (a.code.length === 1) {
			// Depth-0 tiebreaker: front-matter before chapter, then by ordinal.
			const lr = levelRank(a.level) - levelRank(b.level);
			if (lr !== 0) return lr;
			if (a.ordinal !== b.ordinal) return a.ordinal - b.ordinal;
		}
		return a.code.localeCompare(b.code);
	});

	// Read every body file in parallel before staging the upsert inputs so
	// the bulk path is purely DB-bound. The single-row path used to
	// interleave per-row reads with per-row upserts; once we batch the
	// upserts, sequential reads become the bottleneck.
	const bodyByCode = new Map<string, string>();
	const bodyReads = sortedSections.map(async (section) => {
		const bodyAbsPath = resolve(context.repoRoot, section.body_path);
		// Mirror `whole-doc.ts`: a manifest that references a missing body
		// file is a seed-time error, not a silent empty-content fall-through.
		// Silently substituting `''` masked broken manifests for months.
		if (!existsSync(bodyAbsPath)) {
			throw new Error(
				`section-tree manifest references missing body file: ${section.body_path} (resolved: ${bodyAbsPath})`,
			);
		}
		bodyByCode.set(section.code, await readFile(bodyAbsPath, 'utf-8'));
	});
	await Promise.all(bodyReads);

	// Bucket sections by depth so depth-0 rows commit before depth-1
	// (parents must exist before child FKs land). Within a depth the
	// `(reference_id, code)` unique constraint pins one row per code,
	// so order is irrelevant.
	const codeToSectionId: Map<string, string> = new Map();
	const sectionsByDepth = new Map<number, HandbookManifestSection[]>();
	for (const section of sortedSections) {
		const depth = LEVEL_TO_DEPTH[section.level];
		const list = sectionsByDepth.get(depth);
		if (list) list.push(section);
		else sectionsByDepth.set(depth, [section]);
	}

	const figuresToReplace: Array<{
		readonly sectionId: string;
		readonly figures: ReadonlyArray<{
			readonly ordinal: number;
			readonly caption: string;
			readonly assetPath: string;
			readonly width: number | null;
			readonly height: number | null;
		}>;
	}> = [];

	const depths = [...sectionsByDepth.keys()].sort((a, b) => a - b);
	for (const depth of depths) {
		const sectionsAtDepth = sectionsByDepth.get(depth) ?? [];
		const inputs: UpsertReferenceSectionInput[] = sectionsAtDepth.map((section) => ({
			referenceId: ref.id,
			parentId: section.parent_code ? (codeToSectionId.get(section.parent_code) ?? null) : null,
			level: section.level,
			ordinal: section.ordinal,
			depth,
			code: section.code,
			airbossRef: airbossRefForHandbookSection(manifest.document_slug, manifest.edition, section.code),
			title: section.title,
			faaPages: section.faa_page_start ? { start: section.faa_page_start, end: section.faa_page_end } : null,
			sourceLocator: section.source_locator,
			contentMd: bodyByCode.get(section.code) ?? '',
			contentHash: section.content_hash,
			hasFigures: section.has_figures,
			hasTables: section.has_tables,
			// Forward `metadata.extraction_status` (Sub-phase 1C) into the
			// `study.reference_section.metadata` jsonb so the reader can
			// surface placeholder badges + "merged from orphans" tooltips.
			// Pre-1C manifests omit `metadata`; the bulk upsert defers to
			// the existing row's metadata when undefined arrives.
			metadata: section.metadata,
			seedOrigin: context.seedOrigin,
		}));

		const results = await bulkUpsertReferenceSections(inputs);

		for (let i = 0; i < sectionsAtDepth.length; i += 1) {
			const section = sectionsAtDepth[i];
			const result = results[i];
			if (!section || !result) continue;
			codeToSectionId.set(section.code, result.row.id);
			summary.sectionsTouched += 1;
			if (result.changed) {
				summary.sectionsChanged += 1;
				const figuresForSection = manifest.figures.filter((f) => f.section_code === section.code);
				if (figuresForSection.length > 0) {
					figuresToReplace.push({
						sectionId: result.row.id,
						figures: figuresForSection.map((f) => ({
							ordinal: f.ordinal,
							caption: f.caption,
							assetPath: f.asset_path,
							width: f.width ?? null,
							height: f.height ?? null,
						})),
					});
				} else {
					// Even when the new section has zero figures, prior rows
					// might have had some -- the bulk replacer treats an
					// empty figures[] as "drop everything for this section".
					figuresToReplace.push({ sectionId: result.row.id, figures: [] });
				}
			}
		}
	}

	if (figuresToReplace.length > 0) {
		const written = await bulkReplaceFiguresForSections(figuresToReplace, undefined, context.seedOrigin);
		summary.figuresWritten += written;
	}

	summary.editionsProcessed += 1;
	context.onProgress?.(
		`  ${manifest.document_slug} ${manifest.edition}: ${sortedSections.length} sections, ${manifest.figures.length} figures, ${manifest.warnings.length} warnings`,
	);
	return ref.id;
}
