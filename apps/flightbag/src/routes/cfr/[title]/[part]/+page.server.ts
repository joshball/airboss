/**
 * `/cfr/[title]/[part]` -- CFR Part landing.
 *
 * For Parts whose ingestion has produced inline `reference_section` rows
 * (e.g. once the regs ingest pipeline lands), surfaces the per-section TOC.
 * Today (no inline section rows seeded yet for CFR), renders an umbrella card
 * pointing at the eCFR Part URL.
 */

import { getReferenceByDocument, listAllSectionsForReference } from '@ab/bc-study';
import { CITATION_URL_TEMPLATES, type ReferenceKind, ROUTES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { buildSourceLinks } from '../../../../lib/source-links';
import type { PageServerLoad } from './$types';

const NUM_SHAPE = /^\d+$/;
const PART_SHAPE = /^[a-z0-9-]+$/i;

export const load: PageServerLoad = async ({ params }) => {
	if (!NUM_SHAPE.test(params.title)) throw error(404, 'Invalid CFR title.');
	if (!PART_SHAPE.test(params.part)) throw error(404, 'Invalid CFR part.');

	const documentSlug = `${params.title}cfr${params.part}`;
	const ref = await getReferenceByDocument(documentSlug).catch(() => null);
	if (!ref) throw error(404, `${params.title} CFR Part ${params.part} not seeded.`);

	const allSections = await listAllSectionsForReference(ref.id);
	const titleNum = Number.parseInt(params.title, 10);
	const partNum = Number.parseInt(params.part, 10);

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	return {
		uri: `airboss-ref:regs/cfr-${params.title}/${params.part}`,
		sourceLinks,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
			subjects: [...ref.subjects],
		},
		sections: allSections.map((s) => ({
			id: s.id,
			code: s.code,
			title: s.title,
			level: s.level,
			href: ROUTES.FLIGHTBAG_CFR_SECTION(params.title, params.part, s.code),
		})),
		// Always available -- eCFR is the canonical authoritative source even
		// when our inline ingest is in flight.
		ecfrUrl:
			Number.isFinite(titleNum) && Number.isFinite(partNum) ? CITATION_URL_TEMPLATES.CFR_PART(titleNum, partNum) : null,
		links: {
			homeHref: ROUTES.FLIGHTBAG_HOME,
		},
	};
};
