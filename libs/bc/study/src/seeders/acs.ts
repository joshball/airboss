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
import {
	airbossRefForAcsArea,
	airbossRefForAcsElement,
	airbossRefForAcsPublication,
	airbossRefForAcsTask,
} from '@ab/sources';
import { getAcsSeedMapping } from '@ab/sources/acs';
import type { AcsManifest, AcsManifestArea, AcsManifestElement, AcsManifestTask } from '../manifest-validation';
import {
	bulkUpsertReferenceSections,
	type SectionSchema,
	type UpsertReferenceSectionInput,
	upsertReference,
} from '../references';
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

	// Pre-read every task body file in parallel; tasks are the only ACS
	// rows with markdown bodies (publication/area/element rows are
	// container-or-leaf-only).
	const taskBodyByCode = new Map<string, string>();
	const taskReads: Array<Promise<void>> = [];
	for (const area of manifest.areas) {
		const areaRoman = paddedOrdinalToRoman(area.area);
		for (const task of area.tasks) {
			const taskCode = `${areaRoman}.${task.task.toUpperCase()}`;
			const bodyAbsPath = resolve(editionDir, task.body_path);
			if (!existsSync(bodyAbsPath)) {
				throw new Error(
					`ACS seed: missing task body file for ${mapping.documentSlug} ${taskCode}: ${task.body_path} ` +
						`(resolved: ${bodyAbsPath}). Run \`bun run sources register acs\` to produce the inline derivative tree.`,
				);
			}
			taskReads.push(
				readFile(bodyAbsPath, 'utf-8').then((body) => {
					taskBodyByCode.set(taskCode, body);
				}),
			);
		}
	}
	await Promise.all(taskReads);

	// Depth 0: publication container row.
	const publicationInputs: UpsertReferenceSectionInput[] = [
		{
			referenceId: ref.id,
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.PUBLICATION,
			ordinal: 0,
			depth: 0,
			code: 'publication',
			airbossRef: airbossRefForAcsPublication(manifest.slug),
			title: manifest.title,
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
		},
	];
	const [publicationResult] = await bulkUpsertReferenceSections(publicationInputs);
	if (!publicationResult) {
		throw new Error(`ACS seed: bulk upsert returned no row for publication of ${mapping.documentSlug}`);
	}
	summary.sectionsTouched += 1;
	if (publicationResult.changed) summary.sectionsChanged += 1;
	const publicationRow = publicationResult.row;

	// Depth 1: areas under the publication.
	const areaInputs: UpsertReferenceSectionInput[] = manifest.areas.map((area, areaOrdinal) => {
		const areaRoman = paddedOrdinalToRoman(area.area);
		return {
			referenceId: ref.id,
			parentId: publicationRow.id,
			level: REFERENCE_SECTION_LEVELS.AREA,
			ordinal: areaOrdinal,
			depth: 1,
			code: areaRoman,
			airbossRef: airbossRefForAcsArea(manifest.slug, area.area),
			title: area.title,
			sourceLocator: `${mapping.edition} Area ${areaRoman}`,
			contentMd: '',
			contentHash: areaContentHash(mapping.documentSlug, areaRoman, area.title),
			hasFigures: false,
			hasTables: false,
			metadata: {
				area_padded: area.area,
				area_roman: areaRoman,
				task_count: area.tasks.length,
			},
			seedOrigin: context.seedOrigin,
		};
	});
	const areaResults = await bulkUpsertReferenceSections(areaInputs);
	const areaIdByPadded = new Map<string, string>();
	for (let i = 0; i < manifest.areas.length; i += 1) {
		const area = manifest.areas[i];
		const result = areaResults[i];
		if (!area || !result) continue;
		areaIdByPadded.set(area.area, result.row.id);
		summary.sectionsTouched += 1;
		if (result.changed) summary.sectionsChanged += 1;
	}

	// Depth 2: tasks under each area.
	const taskInputs: UpsertReferenceSectionInput[] = [];
	const taskKeyToAreaPadded: Array<{
		readonly area: AcsManifestArea;
		readonly task: AcsManifestTask;
		readonly taskCode: string;
	}> = [];
	for (const area of manifest.areas) {
		const areaRoman = paddedOrdinalToRoman(area.area);
		const areaSectionId = areaIdByPadded.get(area.area);
		if (!areaSectionId) continue;
		let taskOrdinal = 0;
		for (const task of area.tasks) {
			const taskCode = `${areaRoman}.${task.task.toUpperCase()}`;
			taskInputs.push({
				referenceId: ref.id,
				parentId: areaSectionId,
				level: REFERENCE_SECTION_LEVELS.TASK,
				ordinal: taskOrdinal,
				depth: 2,
				code: taskCode,
				airbossRef: airbossRefForAcsTask(manifest.slug, area.area, task.task),
				title: task.title,
				sourceLocator: `${mapping.edition} ${taskCode}`,
				contentMd: taskBodyByCode.get(taskCode) ?? '',
				contentHash: task.body_sha256,
				hasFigures: false,
				hasTables: false,
				metadata: {
					task_letter: task.task,
					element_count: task.elements.length,
				},
				seedOrigin: context.seedOrigin,
			});
			taskKeyToAreaPadded.push({ area, task, taskCode });
			taskOrdinal += 1;
		}
	}
	const taskResults = await bulkUpsertReferenceSections(taskInputs);
	const taskIdByCode = new Map<string, string>();
	for (let i = 0; i < taskInputs.length; i += 1) {
		const result = taskResults[i];
		const meta = taskKeyToAreaPadded[i];
		if (!result || !meta) continue;
		taskIdByCode.set(meta.taskCode, result.row.id);
		summary.sectionsTouched += 1;
		if (result.changed) summary.sectionsChanged += 1;
	}

	// Depth 3: elements under each task.
	const elementInputs: UpsertReferenceSectionInput[] = [];
	for (const meta of taskKeyToAreaPadded) {
		const taskSectionId = taskIdByCode.get(meta.taskCode);
		if (!taskSectionId) continue;
		let elementOrdinal = 0;
		for (const element of meta.task.elements) {
			// Element URI uses 2-digit zero-padded ordinal per
			// libs/sources/src/acs/locator.ts:82 (`elem-<triad><NN>`).
			const elementOrdinalPadded = String(element.ordinal).padStart(2, '0');
			elementInputs.push({
				referenceId: ref.id,
				parentId: taskSectionId,
				level: REFERENCE_SECTION_LEVELS.ELEMENT,
				ordinal: elementOrdinal,
				depth: 3,
				code: element.code,
				airbossRef: airbossRefForAcsElement(
					manifest.slug,
					meta.area.area,
					meta.task.task,
					element.triad,
					elementOrdinalPadded,
				),
				title: element.title,
				sourceLocator: `${mapping.edition} ${element.code}`,
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
			elementOrdinal += 1;
		}
	}
	if (elementInputs.length > 0) {
		const elementResults = await bulkUpsertReferenceSections(elementInputs);
		for (const result of elementResults) {
			summary.sectionsTouched += 1;
			if (result.changed) summary.sectionsChanged += 1;
		}
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
