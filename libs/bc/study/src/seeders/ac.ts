/**
 * AC manifest seed adapter (FAA Advisory Circulars, WP-AC).
 *
 * Produces ONE `reference_section` row per AC at depth 0, level
 * `'circular'`, code `'1'`. The body is read from `manifest.body_path`;
 * `content_hash` is the manifest's `body_sha256`.
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
 * `@ab/sources` :: `getAcSeedMapping`. A manifest with no registry entry
 * raises a clear seed-time error -- the YAML row must exist for the AC
 * to land as a readable card.
 *
 * `section_schema = { levels: ['circular'], strict_sequence: true }` --
 * AC references have a single legal level at a single legal depth (the
 * whole-document body row).
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { REFERENCE_KINDS, REFERENCE_SECTION_LEVELS } from '@ab/constants';
import { getAcSeedMapping } from '@ab/sources';
import type { AcManifest } from '../manifest-validation';
import { type SectionSchema, upsertReference, upsertReferenceSection } from '../references';
import type { SeedContext, SeedSummary } from './types';

const AC_SCHEMA: SectionSchema = {
	levels: [REFERENCE_SECTION_LEVELS.CIRCULAR],
	strictSequence: true,
};

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

	const bodyAbsPath = resolve(context.repoRoot, manifest.body_path);
	if (!existsSync(bodyAbsPath)) {
		throw new Error(`AC manifest references missing body file: ${manifest.body_path} (resolved: ${bodyAbsPath})`);
	}
	const contentMd = await readFile(bodyAbsPath, 'utf-8');

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
		sectionSchema: AC_SCHEMA,
		metadata,
		seedOrigin: context.seedOrigin,
	});

	const { changed } = await upsertReferenceSection({
		referenceId: ref.id,
		parentId: null,
		level: REFERENCE_SECTION_LEVELS.CIRCULAR,
		ordinal: 0,
		depth: 0,
		code: '1',
		title: manifest.title,
		faaPageStart: null,
		faaPageEnd: null,
		sourceLocator: `${mapping.edition} (${manifest.page_count} pp.)`,
		contentMd,
		contentHash: manifest.body_sha256,
		hasFigures: false,
		hasTables: false,
		metadata: {},
		seedOrigin: context.seedOrigin,
	});

	summary.sectionsTouched += 1;
	if (changed) summary.sectionsChanged += 1;
	summary.editionsProcessed += 1;
	context.onProgress?.(
		`  ${mapping.documentSlug} ${mapping.edition}: ac (${manifest.page_count} pages, ${
			changed ? 'changed' : 'unchanged'
		})`,
	);
	return ref.id;
}
