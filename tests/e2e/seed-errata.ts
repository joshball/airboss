/**
 * E2e fixture seeder for `study.handbook_section_errata`.
 *
 * The Playwright suite covers the handbook reader's amendment panel via
 * `handbook-amendment.spec.ts`. The dev-seed pipeline does not run the
 * `--apply-errata` Python flow, so the table is empty at e2e start. This
 * helper inserts a fixed set of MOSAIC fixtures across three patch kinds
 * (`add_subsection`, `append_paragraph`, `replace_paragraph`) for AFH
 * sections that already exist in the handbooks tree.
 *
 * Idempotent: deletes prior rows for `errata_id = 'mosaic'` then inserts.
 * Safe to run on every `bunx playwright test` invocation.
 *
 * Tracked under R6.12a of `apply-errata-and-afh-mosaic` work package.
 */

import { and, eq } from 'drizzle-orm';
import {
	type ErrataInsert,
	deleteErrataByErratumId,
	getHandbookSection,
	getReferenceByDocument,
	insertErrataRows,
} from '../../libs/bc/study/src';
import { db } from '../../libs/db/src/connection';
import { handbookSection } from '../../libs/bc/study/src/schema';
import { HANDBOOK_ERRATA_PATCH_KINDS } from '../../libs/constants/src';

/** AFH MOSAIC FAA URL -- matches the spec's URL-fragment assertion. */
const AFH_MOSAIC_URL =
	'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf';
const AFH_MOSAIC_PUBLISHED_AT = '2025-10-20';
const ERRATA_ID = 'mosaic';

/**
 * Resolve a handbook_section row id by document slug + section code (e.g.
 * `afh` + `2.2`). Throws if the section is missing -- the Playwright suite
 * runs against a freshly seeded dev DB where these rows must exist.
 */
async function resolveSectionId(documentSlug: string, code: string): Promise<string> {
	const ref = await getReferenceByDocument(documentSlug);
	const rows = await db
		.select({ id: handbookSection.id })
		.from(handbookSection)
		.where(and(eq(handbookSection.referenceId, ref.id), eq(handbookSection.code, code)))
		.limit(1);
	const row = rows[0];
	if (!row) throw new Error(`seed-errata: section ${documentSlug} §${code} not found`);
	return row.id;
}

/** Confirm the section page round-trip through the BC works for the spec target. */
async function ensureRouteResolves(documentSlug: string, chapter: string, section: string): Promise<void> {
	const ref = await getReferenceByDocument(documentSlug);
	await getHandbookSection(ref.id, chapter, section);
}

/**
 * Seed the e2e errata fixtures. Returns the inserted row count so the
 * Playwright setup can log a one-line confirmation.
 */
export async function seedErrataFixtures(): Promise<number> {
	// Sanity: confirm the spec's primary target route resolves before we
	// write rows. If the AFH §2.2 row isn't present (e.g. dev DB never
	// seeded the handbooks phase), fail loudly here rather than letting
	// the spec produce an opaque "badge not visible" failure.
	await ensureRouteResolves('afh', '2', '2');

	const [appendId, replaceId, addSubsectionId] = await Promise.all([
		resolveSectionId('afh', '2.2'),
		resolveSectionId('afh', '1.2'),
		resolveSectionId('afh', '1.8'),
	]);

	const rows: ErrataInsert[] = [
		// append_paragraph -- the spec's primary assertion target.
		{
			sectionId: appendId,
			errataId: ERRATA_ID,
			sourceUrl: AFH_MOSAIC_URL,
			publishedAt: AFH_MOSAIC_PUBLISHED_AT,
			patchKind: HANDBOOK_ERRATA_PATCH_KINDS.APPEND_PARAGRAPH,
			targetAnchor: 'Preflight Assessment of the Aircraft, Engine, and Propeller',
			targetPage: '2-12',
			originalText: null,
			replacementText:
				'Many light sport category certificated airplanes are equipped with water-cooled engines. ' +
				'These airplanes may be tightly cowled, which reduces drag. A liquid-cooled engine ' +
				'minimizes the need for cylinder cooling inlets, which further reduces drag and improves ' +
				'performance. Preflighting this system requires that the radiator, coolant hoses, and ' +
				'expansion tank are checked for condition, freedom from leaks, and coolant level requirements.',
		},
		// replace_paragraph -- exercises the inline word-diff path in ErrataEntry.
		{
			sectionId: replaceId,
			errataId: ERRATA_ID,
			sourceUrl: AFH_MOSAIC_URL,
			publishedAt: AFH_MOSAIC_PUBLISHED_AT,
			patchKind: HANDBOOK_ERRATA_PATCH_KINDS.REPLACE_PARAGRAPH,
			targetAnchor: 'Role of the FAA',
			targetPage: '1-4',
			originalText:
				'The Federal Aviation Administration (FAA) is empowered by Congress to regulate civil aviation in the United States.',
			replacementText:
				'The Federal Aviation Administration (FAA) is empowered by Congress to regulate civil aviation in the United States and its territories.',
		},
		// add_subsection -- exercises the "no original text" rendering branch.
		{
			sectionId: addSubsectionId,
			errataId: ERRATA_ID,
			sourceUrl: AFH_MOSAIC_URL,
			publishedAt: AFH_MOSAIC_PUBLISHED_AT,
			patchKind: HANDBOOK_ERRATA_PATCH_KINDS.ADD_SUBSECTION,
			targetAnchor: 'Continuing Education',
			targetPage: '1-16',
			originalText: null,
			replacementText:
				'### Pilot Certificate Privileges & Limitations\n\n' +
				'A new MOSAIC subsection summarizing the post-rule privileges and limitations ' +
				'every certificate holder should review at least once per flight review cycle.',
		},
	];

	// Idempotent: clear any prior fixtures for this erratum, then insert.
	await deleteErrataByErratumId(ERRATA_ID);
	const inserted = await insertErrataRows(rows);
	return inserted.length;
}
