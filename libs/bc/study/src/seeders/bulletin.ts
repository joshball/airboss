/**
 * Bulletin manifest seed adapter (WP-SAFO-INFO).
 *
 * SAFOs (Safety Alerts for Operators) and InFOs (Information for Operators)
 * are short FAA bulletins (1-3 pages) with identical pipeline shape: 5-digit
 * `<YY><sequence>` id, single PDF, flat structure. The only thing that
 * differs between the two corpora is the `kind` discriminator and the
 * (document_slug, edition) registry. This module owns the seeder; the
 * SAFO and InFO entry points (`safo.ts` / `info.ts`) are thin dispatchers
 * that pass the right registry lookup function.
 *
 * Two seeding modes (mirror AC's whole-doc vs section-tree dispatch):
 *
 *   - `manifest.sections === []`     -> single body row at depth 0,
 *                                       level `'bulletin'`, code `'1'`.
 *                                       Body sourced from `manifest.body_path`;
 *                                       content_hash from `manifest.body_sha256`.
 *   - `manifest.sections.length > 0` -> one row per section, all at depth 0
 *                                       (flat tree under the reference). Each
 *                                       carries the section's heading slug as
 *                                       `code` and its body markdown.
 *
 * Subjects + primary_cert are NOT carried on the manifest -- those live on
 * the YAML row in `course/references/{safos,infos}.yaml`. The references
 * phase runs BEFORE the handbooks phase per `seed-all.ts`, so the YAML row
 * is already in place when this adapter upserts.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { REFERENCE_KINDS, REFERENCE_SECTION_LEVELS, type ReferenceKind } from '@ab/constants';
import { airbossRefForInfo, airbossRefForSafo } from '@ab/sources';
import type { BulletinSeedMappingEntry } from '@ab/sources/safo';
import type { InfoManifest, SafoManifest } from '../manifest-validation';
import { type SectionSchema, upsertReference, upsertReferenceSection } from '../references';
import type { SeedContext, SeedSummary } from './types';

/** Single legal level / depth -- bulletin body sits at depth 0. */
const BULLETIN_SCHEMA: SectionSchema = {
	levels: [REFERENCE_SECTION_LEVELS.BULLETIN],
	strictSequence: true,
};

export type BulletinManifest = SafoManifest | InfoManifest;

export interface BulletinSeedOptions {
	/** Reference kind (safo / info) used for the upserted `reference` row. */
	readonly referenceKind: ReferenceKind;
	/** Display label used inside `source_locator` (e.g. `SAFO 23001`). */
	readonly editionLabel: string;
	/** Lookup callback returning the (document_slug, edition) for the bulletin id. */
	readonly lookupMapping: (bulletinId: string) => BulletinSeedMappingEntry | null;
	/** Human-readable corpus name (e.g. `SAFO`) used in error messages. */
	readonly corpusLabel: string;
}

export async function seedBulletinManifest(
	manifest: BulletinManifest,
	options: BulletinSeedOptions,
	context: SeedContext,
	summary: SeedSummary,
): Promise<string> {
	const mapping = options.lookupMapping(manifest.bulletin_id);
	if (!mapping) {
		throw new Error(
			`${options.corpusLabel} seed: no DB mapping for manifest ${manifest.kind}/${manifest.bulletin_id}/. ` +
				`Add an entry to libs/sources/src/${manifest.kind}/seed-mapping.ts and a row to ` +
				`course/references/${manifest.kind}s.yaml so the ${options.corpusLabel} has a reference row to attach to.`,
		);
	}

	// Bulletin metadata lives on `reference.metadata` jsonb. Skip null/undefined
	// to keep the metadata compact.
	const metadata: Record<string, unknown> = {
		page_count: manifest.page_count,
		bulletin_id: manifest.bulletin_id,
	};
	if (manifest.publication_date !== null) {
		metadata.publication_date = manifest.publication_date;
	}
	if (manifest.audience !== null && manifest.audience !== undefined) {
		metadata.audience = manifest.audience;
	}

	const ref = await upsertReference({
		kind: options.referenceKind,
		documentSlug: mapping.documentSlug,
		edition: mapping.edition,
		title: manifest.title,
		publisher: manifest.publisher,
		url: manifest.source_url,
		// Subjects + primary_cert are intentionally omitted -- the YAML phase
		// owns those fields. Passing undefined preserves the existing values
		// on conflict (rather than blanking them).
		sectionSchema: BULLETIN_SCHEMA,
		metadata,
		seedOrigin: context.seedOrigin,
	});

	const isSectionTree = manifest.sections.length > 0;
	if (isSectionTree) {
		await seedBulletinSections(manifest, options, ref.id, context, summary);
	} else {
		await seedBulletinWholeDoc(manifest, options, ref.id, context, summary);
	}

	summary.editionsProcessed += 1;
	const sectionLabel = isSectionTree ? `section-tree (${manifest.sections.length} sections)` : 'whole-bulletin';
	context.onProgress?.(
		`  ${mapping.documentSlug} ${mapping.edition}: ${manifest.kind} ${sectionLabel}, ${manifest.page_count} pages`,
	);
	return ref.id;
}

async function seedBulletinWholeDoc(
	manifest: BulletinManifest,
	options: BulletinSeedOptions,
	referenceId: string,
	context: SeedContext,
	summary: SeedSummary,
): Promise<void> {
	const bodyAbsPath = resolve(context.repoRoot, manifest.body_path);
	if (!existsSync(bodyAbsPath)) {
		throw new Error(
			`${options.corpusLabel} manifest references missing body file: ${manifest.body_path} (resolved: ${bodyAbsPath})`,
		);
	}
	const contentMd = await readFile(bodyAbsPath, 'utf-8');

	// SAFO + InFO bulletins have no section-level routes in the flightbag
	// reader (`urlForSafo` / `urlForInfo` only handle the bulletin landing).
	// Every row in this bulletin's tree therefore shares the same bulletin URI
	// -- the ancestor chip + child chip both deep-link to the bulletin's
	// landing page. Authored once here.
	const airbossRef = bulletinAirbossRef(options.referenceKind, manifest.bulletin_id);

	const { changed } = await upsertReferenceSection({
		referenceId,
		parentId: null,
		level: REFERENCE_SECTION_LEVELS.BULLETIN,
		ordinal: 0,
		depth: 0,
		code: '1',
		airbossRef,
		title: manifest.title,
		sourceLocator: `${options.editionLabel} (${manifest.page_count} pp.)`,
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

async function seedBulletinSections(
	manifest: BulletinManifest,
	options: BulletinSeedOptions,
	referenceId: string,
	context: SeedContext,
	summary: SeedSummary,
): Promise<void> {
	// Sort by ordinal so document order is preserved.
	const sortedSections = [...manifest.sections].sort((a, b) => a.ordinal - b.ordinal);
	const airbossRef = bulletinAirbossRef(options.referenceKind, manifest.bulletin_id);

	for (const section of sortedSections) {
		const bodyAbsPath = resolve(context.repoRoot, section.body_path);
		if (!existsSync(bodyAbsPath)) {
			throw new Error(
				`${options.corpusLabel} manifest references missing section body: ${section.body_path} (resolved: ${bodyAbsPath})`,
			);
		}
		const contentMd = await readFile(bodyAbsPath, 'utf-8');
		const { changed } = await upsertReferenceSection({
			referenceId,
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.BULLETIN,
			ordinal: section.ordinal,
			depth: 0,
			code: section.code,
			airbossRef,
			title: section.title,
			sourceLocator: section.source_locator,
			contentMd,
			contentHash: section.content_hash,
			hasFigures: false,
			hasTables: false,
			metadata: {},
			seedOrigin: context.seedOrigin,
		});
		summary.sectionsTouched += 1;
		if (changed) summary.sectionsChanged += 1;
	}
}

function bulletinAirbossRef(kind: ReferenceKind, bulletinId: string): string {
	if (kind === REFERENCE_KINDS.SAFO) return airbossRefForSafo(bulletinId);
	if (kind === REFERENCE_KINDS.INFO) return airbossRefForInfo(bulletinId);
	throw new Error(`bulletin seeder: unsupported referenceKind "${String(kind)}"`);
}

/**
 * Re-export the parent SAFO/InFO REFERENCE_KINDS for convenience so the thin
 * dispatchers don't have to re-import from `@ab/constants`.
 */
export const BULLETIN_KIND = {
	SAFO: REFERENCE_KINDS.SAFO,
	INFO: REFERENCE_KINDS.INFO,
} as const;
