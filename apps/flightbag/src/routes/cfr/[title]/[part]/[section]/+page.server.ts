/**
 * `/cfr/[title]/[part]/[section]` -- CFR section reader.
 *
 * Validates the URI parses end-to-end, then resolves the section row via
 * `(referenceId, code)`. CFR ingest is not yet seeding `reference_section`
 * rows -- when that lands, this loader surfaces the section body. Until
 * then, the page returns a soft 404 with a deep eCFR link so the URL still
 * resolves to something useful.
 */

import { getReferenceByDocument, listAllSectionsForReference } from '@ab/bc-study';
import { CITATION_URL_TEMPLATES, type ReferenceKind, ROUTES } from '@ab/constants';
import { isParseError, parseIdentifier, parseRegsLocator } from '@ab/sources';
import { error } from '@sveltejs/kit';
import { buildSourceLinks } from '../../../../../lib/source-links';
import type { PageServerLoad } from './$types';

const NUM_SHAPE = /^\d+$/;
const PART_SHAPE = /^[a-z0-9-]+$/i;
const SECTION_SHAPE = /^[a-z0-9-]+$/i;

export const load: PageServerLoad = async ({ params }) => {
	if (!NUM_SHAPE.test(params.title)) throw error(404, 'Invalid CFR title.');
	if (!PART_SHAPE.test(params.part)) throw error(404, 'Invalid CFR part.');
	if (!SECTION_SHAPE.test(params.section)) throw error(404, 'Invalid CFR section.');

	const rawUri = `airboss-ref:regs/cfr-${params.title}/${params.part}/${params.section}`;
	const parsed = parseIdentifier(rawUri);
	if (isParseError(parsed)) throw error(404, `Malformed CFR reference: ${parsed.message}`);
	const locator = parseRegsLocator(parsed.locator);
	if (locator.kind === 'error') throw error(404, `Malformed CFR locator: ${locator.message}`);

	const documentSlug = `${params.title}cfr${params.part}`;
	const ref = await getReferenceByDocument(documentSlug).catch(() => null);
	if (!ref) throw error(404, `${params.title} CFR Part ${params.part} not seeded.`);

	const allSections = await listAllSectionsForReference(ref.id);
	const sectionRow = allSections.find((s) => s.code === params.section);

	const titleNum = Number.parseInt(params.title, 10);
	const partNum = Number.parseInt(params.part, 10);
	const ecfrUrl =
		Number.isFinite(titleNum) && Number.isFinite(partNum)
			? CITATION_URL_TEMPLATES.CFR(titleNum, partNum, params.section)
			: null;

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	return {
		uri: rawUri,
		sourceLinks,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			partHref: ROUTES.FLIGHTBAG_CFR_PART(params.title, params.part),
		},
		// `section` is null when CFR ingest hasn't populated the per-section
		// rows -- the page renders the eCFR fallback in that case.
		section: sectionRow
			? {
					id: sectionRow.id,
					code: sectionRow.code,
					title: sectionRow.title,
					contentMd: sectionRow.contentMd,
					sourceLocator: sectionRow.sourceLocator,
				}
			: null,
		ecfrUrl,
		raw: {
			title: params.title,
			part: params.part,
			section: params.section,
		},
	};
};
