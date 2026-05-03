/**
 * ACS manifest seed adapter (FAA Airman Certification Standards, WP-ACS-V).
 *
 * Produces ONE `reference` row plus a 4-level tree of `reference_section`
 * rows: publication (depth 0) -> areas (depth 1) -> tasks (depth 2) ->
 * elements (depth 3). The deepest tree shipped to date.
 *
 * Subjects + primary_cert are NOT carried on ACS manifests -- those live
 * on the YAML row in `course/references/acs-pts.yaml`. In seed-all the
 * manifest phase (`handbooks`) runs first and creates the reference row
 * with empty subjects; the YAML phase (`references`) runs immediately
 * after and overwrites those fields with the canonical YAML values via the
 * same `(document_slug, edition)` upsert key. Same pattern as AC.
 *
 * Bridges the on-disk shape (`<rating>-airplane-<edition>` slug under
 * `acs/`) to the DB-side shape (`<rating>-airplane-acs-<edition>` +
 * canonical FAA edition designator) via the explicit registry at
 * `@ab/sources/acs` :: `getAcsSeedMapping`. A manifest with no registry
 * entry raises a clear seed-time error -- the YAML row must exist for the
 * ACS to land as a readable card.
 *
 * `section_schema = { levels: ['publication','area','task','element'],
 * strictSequence: true }` -- ACS is symmetric: publication -> area -> task
 * -> element with no skipping. Depth pins to level vocabulary index.
 *
 * Tree laydown:
 *
 *   - depth 0, level 'publication', code 'publication': container row.
 *     `content_md` empty; carries the publication title.
 *   - depth 1, level 'area', code = roman numeral (e.g. 'I', 'XII'):
 *     container row. Title from manifest; no body.
 *   - depth 2, level 'task', code = `<roman>.<task-letter-upper>` (e.g.
 *     'I.A'): the citable read surface. `content_md` from `body_path`;
 *     `content_hash` from `body_sha256`.
 *   - depth 3, level 'element', code = full FAA element id (e.g.
 *     'PA.I.A.K1'): leaf. No body markdown -- elements are bullets
 *     within the parent task body. `content_hash` is a deterministic
 *     synthetic SHA-256 over `acs:<code>:<title>` so re-seeding is
 *     idempotent.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { REFERENCE_KINDS, REFERENCE_SECTION_LEVELS } from '@ab/constants';
import { getAcsSeedMapping } from '@ab/sources/acs';
import type { AcsManifest, AcsManifestArea, AcsManifestElement, AcsManifestTask } from '../manifest-validation';
import { type SectionSchema, upsertReference, upsertReferenceSection } from '../references';
import type { SeedContext, SeedSummary } from './types';

const ACS_SCHEMA: SectionSchema = {
	levels: [
		REFERENCE_SECTION_LEVELS.PUBLICATION,
		REFERENCE_SECTION_LEVELS.AREA,
		REFERENCE_SECTION_LEVELS.TASK,
		REFERENCE_SECTION_LEVELS.ELEMENT,
	],
	strictSequence: true,
};

/**
 * Convert a 2-digit zero-padded area ordinal to the Roman numeral the FAA
 * prints in ACS body text + element codes (`'01' -> 'I'`, `'12' -> 'XII'`).
 * Bounded to the FAA's largest area count (14, the CFI ACS); throws on
 * out-of-range input rather than silently returning the wrong code, which
 * would produce a citation that doesn't round-trip.
 */
function paddedOrdinalToRoman(padded: string): string {
	const num = Number.parseInt(padded, 10);
	if (!Number.isFinite(num) || num < 1 || num > 99) {
		throw new Error(`ACS seed: cannot convert area ordinal "${padded}" to roman (out of bounds 1..99)`);
	}
	const tens = ['', 'X', 'XX', 'XXX', 'XL', 'L', 'LX', 'LXX', 'LXXX', 'XC'];
	const ones = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
	const tenIndex = Math.floor(num / 10);
	const oneIndex = num % 10;
	const tenPart = tens[tenIndex] ?? '';
	const onePart = ones[oneIndex] ?? '';
	return `${tenPart}${onePart}`;
}

/**
 * Synthetic content hash for an element row. Elements have no `content_md`
 * (their bodies are bullets within the parent task), but `reference_section`
 * requires a content_hash so the upsert can decide whether anything changed.
 * Hash over `acs:<code>:<title>` so re-seeding the same manifest is a no-op
 * but a relabelled title triggers an update.
 */
function elementContentHash(element: AcsManifestElement): string {
	return createHash('sha256').update(`acs:${element.code}:${element.title}`).digest('hex');
}

/**
 * Synthetic content hash for the publication container row. Hashes over
 * `acs:publication:<slug>:<title>`; the publication row carries no body so
 * this is the only mechanism for upsert to detect title changes.
 */
function publicationContentHash(slug: string, title: string): string {
	return createHash('sha256').update(`acs:publication:${slug}:${title}`).digest('hex');
}

/**
 * Synthetic content hash for an area container row. Hashes over
 * `acs:area:<slug>:<roman>:<title>`; the area row carries no body.
 */
function areaContentHash(slug: string, roman: string, title: string): string {
	return createHash('sha256').update(`acs:area:${slug}:${roman}:${title}`).digest('hex');
}

interface SeedAcsTaskArgs {
	readonly referenceId: string;
	readonly areaRefSectionId: string;
	readonly areaRoman: string;
	readonly editionDir: string;
	readonly task: AcsManifestTask;
	readonly ordinal: number;
	readonly mappingDocumentSlug: string;
	readonly mappingEdition: string;
}

async function seedAcsTask(args: SeedAcsTaskArgs, context: SeedContext, summary: SeedSummary): Promise<string> {
	const { referenceId, areaRefSectionId, areaRoman, editionDir, task, ordinal, mappingDocumentSlug, mappingEdition } =
		args;
	const taskCode = `${areaRoman}.${task.task.toUpperCase()}`;
	const bodyAbsPath = resolve(editionDir, task.body_path);
	if (!existsSync(bodyAbsPath)) {
		throw new Error(
			`ACS seed: missing task body file for ${mappingDocumentSlug} ${taskCode}: ${task.body_path} ` +
				`(resolved: ${bodyAbsPath}). Run \`bun run sources register acs\` to produce the inline derivative tree.`,
		);
	}
	const contentMd = await readFile(bodyAbsPath, 'utf-8');

	const { row, changed } = await upsertReferenceSection({
		referenceId,
		parentId: areaRefSectionId,
		level: REFERENCE_SECTION_LEVELS.TASK,
		ordinal,
		depth: 2,
		code: taskCode,
		title: task.title,
		faaPageStart: null,
		faaPageEnd: null,
		sourceLocator: `${mappingEdition} ${taskCode}`,
		contentMd,
		contentHash: task.body_sha256,
		hasFigures: false,
		hasTables: false,
		metadata: {
			task_letter: task.task,
			element_count: task.elements.length,
		},
		seedOrigin: context.seedOrigin,
	});
	summary.sectionsTouched += 1;
	if (changed) summary.sectionsChanged += 1;
	return row.id;
}

interface SeedAcsElementArgs {
	readonly referenceId: string;
	readonly taskRefSectionId: string;
	readonly element: AcsManifestElement;
	readonly ordinal: number;
	readonly mappingEdition: string;
}

async function seedAcsElement(args: SeedAcsElementArgs, context: SeedContext, summary: SeedSummary): Promise<void> {
	const { referenceId, taskRefSectionId, element, ordinal, mappingEdition } = args;
	const { changed } = await upsertReferenceSection({
		referenceId,
		parentId: taskRefSectionId,
		level: REFERENCE_SECTION_LEVELS.ELEMENT,
		ordinal,
		depth: 3,
		code: element.code,
		title: element.title,
		faaPageStart: null,
		faaPageEnd: null,
		sourceLocator: `${mappingEdition} ${element.code}`,
		contentMd: '',
		contentHash: elementContentHash(element),
		hasFigures: false,
		hasTables: false,
		metadata: {
			triad: element.triad,
			ordinal: element.ordinal,
		},
		seedOrigin: context.seedOrigin,
	});
	summary.sectionsTouched += 1;
	if (changed) summary.sectionsChanged += 1;
}

interface SeedAcsAreaArgs {
	readonly referenceId: string;
	readonly publicationRefSectionId: string;
	readonly editionDir: string;
	readonly area: AcsManifestArea;
	readonly ordinal: number;
	readonly mappingDocumentSlug: string;
	readonly mappingEdition: string;
}

async function seedAcsArea(args: SeedAcsAreaArgs, context: SeedContext, summary: SeedSummary): Promise<void> {
	const { referenceId, publicationRefSectionId, editionDir, area, ordinal, mappingDocumentSlug, mappingEdition } = args;
	const areaRoman = paddedOrdinalToRoman(area.area);
	const { row: areaRow, changed } = await upsertReferenceSection({
		referenceId,
		parentId: publicationRefSectionId,
		level: REFERENCE_SECTION_LEVELS.AREA,
		ordinal,
		depth: 1,
		code: areaRoman,
		title: area.title,
		faaPageStart: null,
		faaPageEnd: null,
		sourceLocator: `${mappingEdition} Area ${areaRoman}`,
		contentMd: '',
		contentHash: areaContentHash(mappingDocumentSlug, areaRoman, area.title),
		hasFigures: false,
		hasTables: false,
		metadata: {
			area_padded: area.area,
			area_roman: areaRoman,
			task_count: area.tasks.length,
		},
		seedOrigin: context.seedOrigin,
	});
	summary.sectionsTouched += 1;
	if (changed) summary.sectionsChanged += 1;

	let taskOrdinal = 0;
	for (const task of area.tasks) {
		const taskRefSectionId = await seedAcsTask(
			{
				referenceId,
				areaRefSectionId: areaRow.id,
				areaRoman,
				editionDir,
				task,
				ordinal: taskOrdinal,
				mappingDocumentSlug,
				mappingEdition,
			},
			context,
			summary,
		);
		taskOrdinal += 1;

		let elementOrdinal = 0;
		for (const element of task.elements) {
			await seedAcsElement(
				{
					referenceId,
					taskRefSectionId,
					element,
					ordinal: elementOrdinal,
					mappingEdition,
				},
				context,
				summary,
			);
			elementOrdinal += 1;
		}
	}
}

export async function seedAcsManifest(
	manifest: AcsManifest,
	context: SeedContext,
	summary: SeedSummary,
): Promise<string> {
	const mapping = getAcsSeedMapping(manifest.slug);
	if (!mapping) {
		throw new Error(
			`ACS seed: no DB mapping for manifest acs/${manifest.slug}/. ` +
				'Add an entry to libs/sources/src/acs/seed-mapping.ts and a row to ' +
				'course/references/acs-pts.yaml so the ACS has a reference row to attach to.',
		);
	}

	// Body paths are repo-relative (`acs/<slug>/area-<NN>/task-<x>.md`), so
	// the resolution root is `context.repoRoot`.
	const editionDir = context.repoRoot;

	const metadata: Record<string, unknown> = {
		page_count: manifest.page_count,
		manifest_slug: manifest.slug,
		area_count: manifest.areas.length,
		task_count: manifest.areas.reduce((acc, area) => acc + area.tasks.length, 0),
		element_count: manifest.areas.reduce(
			(acc, area) => acc + area.tasks.reduce((tAcc, task) => tAcc + task.elements.length, 0),
			0,
		),
	};
	if (manifest.publication_date !== null) {
		metadata.publication_date = manifest.publication_date;
	}

	const ref = await upsertReference({
		kind: REFERENCE_KINDS.ACS,
		documentSlug: mapping.documentSlug,
		edition: mapping.edition,
		title: manifest.title,
		publisher: manifest.publisher,
		url: manifest.source_url,
		// Subjects + primary_cert intentionally omitted -- the YAML phase owns
		// those fields. Passing undefined preserves the existing values on
		// conflict (rather than blanking them).
		sectionSchema: ACS_SCHEMA,
		metadata,
		seedOrigin: context.seedOrigin,
	});

	// Publication container row at depth 0.
	const { row: publicationRow, changed: publicationChanged } = await upsertReferenceSection({
		referenceId: ref.id,
		parentId: null,
		level: REFERENCE_SECTION_LEVELS.PUBLICATION,
		ordinal: 0,
		depth: 0,
		code: 'publication',
		title: manifest.title,
		faaPageStart: null,
		faaPageEnd: null,
		sourceLocator: mapping.edition,
		contentMd: '',
		contentHash: publicationContentHash(mapping.documentSlug, manifest.title),
		hasFigures: false,
		hasTables: false,
		metadata: {
			manifest_slug: manifest.slug,
			page_count: manifest.page_count,
		},
		seedOrigin: context.seedOrigin,
	});
	summary.sectionsTouched += 1;
	if (publicationChanged) summary.sectionsChanged += 1;

	let areaOrdinal = 0;
	for (const area of manifest.areas) {
		await seedAcsArea(
			{
				referenceId: ref.id,
				publicationRefSectionId: publicationRow.id,
				editionDir,
				area,
				ordinal: areaOrdinal,
				mappingDocumentSlug: mapping.documentSlug,
				mappingEdition: mapping.edition,
			},
			context,
			summary,
		);
		areaOrdinal += 1;
	}

	const taskCount = manifest.areas.reduce((acc, area) => acc + area.tasks.length, 0);
	const elementCount = manifest.areas.reduce(
		(acc, area) => acc + area.tasks.reduce((tAcc, task) => tAcc + task.elements.length, 0),
		0,
	);

	summary.editionsProcessed += 1;
	context.onProgress?.(
		`  ${mapping.documentSlug} ${mapping.edition}: 1 publication + ${manifest.areas.length} areas + ${taskCount} tasks + ${elementCount} elements`,
	);
	return ref.id;
}

/**
 * Test-only re-export so unit tests can build synthetic manifests and
 * round-trip through the same conversion the adapter uses.
 */
export { paddedOrdinalToRoman };
