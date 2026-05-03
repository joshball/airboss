/**
 * CFR manifest seed adapter (Code of Federal Regulations, WP-CFR).
 *
 * One CFR top-level manifest covers an entire Title (14 or 49) at one
 * eCFR snapshot date. The sibling `sections.json` carries every section's
 * canonical short, title, body path, and SHA -- keyed by Part number.
 *
 * The DB-side shape is one `study.reference` row per Part (slug:
 * `<title>cfr<part>`). The 11 production rows live in
 * `course/references/cfr-titles.yaml` (14cfr14/23/61/68/71/73/91/135/141 +
 * 49cfr830/1552). Parts in `sections.json` without an authored YAML row
 * are SKIPPED with a log line -- per WP-CFR spec, auto-creating references
 * for the long-tail (Parts 33, 27, etc.) is out of scope.
 *
 * Section laydown: each section becomes one `reference_section` at depth
 * 0, level `'section'`, parent_id null. Subpart rows are skipped (Subpart
 * is a grouping construct, not a separately-citable unit). Paragraph /
 * subparagraph / clause rows are also skipped -- the section is the
 * citable unit; paragraphs are addressed inline within the section body
 * via `(b)(1)(i)` notation.
 *
 * `section_schema = { levels: ['part','subpart','section','paragraph',
 * 'subparagraph','clause'], strict_sequence: false }`. The full level
 * vocabulary is declared even though the initial seed only emits
 * `'section'` rows -- a future WP can lay down Subpart / paragraph rows
 * without a schema migration.
 *
 * Returns `string[]` (one reference id per matched Part), unlike the
 * single-Part adapters (handbook / whole-doc / aim / ac) which return one
 * string. The dispatcher in `seed-references-from-manifest.ts`
 * uniformizes the contract by wrapping single-result adapters into
 * one-element arrays.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { REFERENCE_KINDS, REFERENCE_SECTION_LEVELS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { eq } from 'drizzle-orm';
import type { CfrManifest, CfrSectionEntry, CfrSectionsFile } from '../manifest-validation';
import { cfrSectionsFileSchema } from '../manifest-validation';
import { type SectionSchema, upsertReference, upsertReferenceSection } from '../references';
import { reference } from '../schema';
import type { SeedContext, SeedSummary } from './types';

const CFR_SCHEMA: SectionSchema = {
	levels: [
		REFERENCE_SECTION_LEVELS.PART,
		REFERENCE_SECTION_LEVELS.SUBPART,
		REFERENCE_SECTION_LEVELS.SECTION,
		REFERENCE_SECTION_LEVELS.PARAGRAPH,
		REFERENCE_SECTION_LEVELS.SUBPARAGRAPH,
		REFERENCE_SECTION_LEVELS.CLAUSE,
	],
	strictSequence: false,
};

/**
 * The CFR YAML rows author edition `current` (CFR is a rolling
 * publication, not editioned -- ADR 019's annual diff job is future work).
 * The seeded `reference_section` rows attach to that edition; future eCFR
 * snapshots will need a separate edition strategy.
 */
const CFR_DB_EDITION = 'current';

/**
 * Load + validate the sibling `sections.json` file given a CFR manifest's
 * absolute manifest path.
 */
export async function loadCfrSectionsFile(manifestAbsPath: string): Promise<CfrSectionsFile> {
	const sectionsPath = resolve(dirname(manifestAbsPath), 'sections.json');
	if (!existsSync(sectionsPath)) {
		throw new Error(`CFR seed: sections.json missing alongside ${manifestAbsPath} (expected at ${sectionsPath})`);
	}
	const raw = JSON.parse(await readFile(sectionsPath, 'utf-8'));
	return cfrSectionsFileSchema.parse(raw);
}

/**
 * Look up an existing reference by `document_slug` for the rolling CFR
 * edition. Returns null when no row exists -- the seed adapter logs a
 * skip and moves on rather than auto-creating long-tail references.
 */
async function findCfrReferenceBySlug(documentSlug: string): Promise<string | null> {
	const rows = await db
		.select({ id: reference.id })
		.from(reference)
		.where(eq(reference.documentSlug, documentSlug))
		.limit(1);
	return rows[0]?.id ?? null;
}

export interface SeedCfrManifestOptions {
	/** Absolute path to the manifest.json so the seeder can find sections.json + body files. */
	manifestAbsPath: string;
}

export async function seedCfrManifest(
	manifest: CfrManifest,
	options: SeedCfrManifestOptions,
	context: SeedContext,
	summary: SeedSummary,
): Promise<string[]> {
	const sectionsFile = await loadCfrSectionsFile(options.manifestAbsPath);
	const editionDir = dirname(options.manifestAbsPath);
	const refIds: string[] = [];

	// Stable per-Part order so seed logs are deterministic. Numeric-aware
	// sort so Part 91 lands before Part 135 in the output.
	const partKeys = Object.keys(sectionsFile.sectionsByPart).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

	for (const partKey of partKeys) {
		const sections = sectionsFile.sectionsByPart[partKey] ?? [];
		const documentSlug = `${manifest.title}cfr${partKey}`;

		const existingRefId = await findCfrReferenceBySlug(documentSlug);
		if (existingRefId === null) {
			context.onProgress?.(
				`  skip ${documentSlug}: no DB row in study.reference (long-tail Part out of scope per WP-CFR spec)`,
			);
			continue;
		}

		// Upsert the reference to populate `section_schema` while preserving
		// YAML-authored metadata (subjects, primary_cert, title, url) via the
		// undefined-on-conflict path in `upsertReference`. The YAML phase
		// runs BEFORE this in `seed-all` and is the canonical author for
		// those fields; we just attach the level vocabulary here.
		const ref = await upsertReference({
			kind: REFERENCE_KINDS.CFR,
			documentSlug,
			edition: CFR_DB_EDITION,
			// `title` is a required upsert field; the YAML phase ran just
			// before this and authored the canonical `14 CFR Part 91 -- ...`
			// form. Pre-stamp it with a placeholder that's still
			// recognisable if the YAML phase is somehow skipped.
			title: `${manifest.title} CFR Part ${partKey}`,
			publisher: 'FAA',
			url: `https://www.ecfr.gov/current/title-${manifest.title}/part-${partKey}`,
			sectionSchema: CFR_SCHEMA,
			metadata: {
				title_number: manifest.title,
				part_number: partKey,
				edition_date: manifest.editionDate,
				edition_slug: manifest.editionSlug,
				section_count: sections.length,
			},
			seedOrigin: context.seedOrigin,
		});

		// Sort sections by section number (numeric-aware) so the reader's flat
		// list renders in regulatory order, not the file's reverse insertion
		// order.
		const sortedSections = [...sections].sort((a, b) =>
			a.canonical_short.localeCompare(b.canonical_short, 'en', { numeric: true }),
		);

		let ordinal = 0;
		for (const entry of sortedSections) {
			const bodyAbsPath = resolve(editionDir, entry.body_path);
			if (!existsSync(bodyAbsPath)) {
				throw new Error(
					`CFR seed: missing body file for ${documentSlug} ${entry.canonical_short}: ` +
						`${entry.body_path} (resolved: ${bodyAbsPath}). Run \`bun run sources register cfr ` +
						`--title=${manifest.title} --edition=${manifest.editionDate}\` to produce the inline derivative tree.`,
				);
			}
			const contentMd = await readFile(bodyAbsPath, 'utf-8');

			const { changed } = await upsertReferenceSection({
				referenceId: ref.id,
				parentId: null,
				level: REFERENCE_SECTION_LEVELS.SECTION,
				ordinal,
				depth: 0,
				code: entry.canonical_short,
				title: entry.canonical_title,
				faaPageStart: null,
				faaPageEnd: null,
				sourceLocator: `${manifest.title} CFR ${entry.canonical_short}`,
				contentMd,
				contentHash: entry.body_sha256,
				hasFigures: false,
				hasTables: false,
				metadata: {
					last_amended_date: entry.last_amended_date,
					airboss_ref: entry.id,
				},
				seedOrigin: context.seedOrigin,
			});
			summary.sectionsTouched += 1;
			if (changed) summary.sectionsChanged += 1;
			ordinal += 1;
		}

		summary.editionsProcessed += 1;
		refIds.push(ref.id);
		context.onProgress?.(`  ${documentSlug} ${CFR_DB_EDITION}: ${sortedSections.length} sections`);
	}

	return refIds;
}

/**
 * Test-only re-export so unit tests can build synthetic sections.json
 * data and round-trip through the same validator the adapter uses.
 */
export { type CfrSectionEntry, cfrSectionsFileSchema };
