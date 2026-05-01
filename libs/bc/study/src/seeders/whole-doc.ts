/**
 * Whole-doc manifest seed adapter (post-#384 handbooks-extras shape).
 *
 * Produces one `reference` row plus a single `reference_section` row at
 * depth 0, level `'document'`, code `'1'`. The body is read from
 * `manifest.body_path`; `content_hash` is the manifest's `body_sha256`.
 *
 * Subjects + primary_cert may be carried on the manifest OR supplied via
 * a prior `seed-references.ts` YAML upsert; this seeder respects whichever
 * is present (manifest wins) and falls back to empty / null otherwise.
 *
 * `section_schema = { levels: ['document'], strict_sequence: true }` --
 * whole-doc handbooks have a single legal level at a single legal depth.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { WholeDocManifest } from '../manifest-validation';
import { type SectionSchema, upsertReference, upsertReferenceSection } from '../references';
import type { SeedContext, SeedSummary } from './types';

const WHOLE_DOC_SCHEMA: SectionSchema = {
	levels: ['document'],
	strictSequence: true,
};

export async function seedWholeDocManifest(
	manifest: WholeDocManifest,
	context: SeedContext,
	summary: SeedSummary,
): Promise<string> {
	const bodyAbsPath = resolve(context.repoRoot, manifest.body_path);
	if (!existsSync(bodyAbsPath)) {
		throw new Error(
			`whole-doc manifest references missing body file: ${manifest.body_path} (resolved: ${bodyAbsPath})`,
		);
	}
	const contentMd = await readFile(bodyAbsPath, 'utf-8');

	const metadata: Record<string, unknown> = {};
	if (manifest.page_count !== undefined) metadata.page_count = manifest.page_count;
	if (manifest.doc_id !== undefined) metadata.doc_id = manifest.doc_id;
	if (manifest.faa_edition !== undefined) metadata.faa_edition = manifest.faa_edition;

	const ref = await upsertReference({
		kind: 'handbook',
		documentSlug: manifest.document_slug,
		edition: manifest.edition,
		title: manifest.title,
		publisher: manifest.publisher,
		url: manifest.source_url,
		// Subjects on a whole-doc manifest are optional; the YAML seeder may
		// have already populated them. Pass undefined so upsertReference
		// preserves the existing array on conflict (rather than blanking it).
		subjects: manifest.subjects,
		primaryCert: manifest.primary_cert ?? null,
		sectionSchema: WHOLE_DOC_SCHEMA,
		metadata,
		seedOrigin: context.seedOrigin,
	});

	const { changed } = await upsertReferenceSection({
		referenceId: ref.id,
		parentId: null,
		level: 'document',
		ordinal: 0,
		depth: 0,
		code: '1',
		title: manifest.title,
		faaPageStart: null,
		faaPageEnd: null,
		sourceLocator: `${manifest.title} (${manifest.edition})`,
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
	console.log(
		`  ${manifest.document_slug} ${manifest.edition}: whole-doc (${manifest.page_count ?? '?'} pages, ${changed ? 'changed' : 'unchanged'})`,
	);
	return ref.id;
}
