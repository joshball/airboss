/**
 * `/library/regulations/[kind]/[group]/[section]` -- legacy per-section reader.
 * 301s to the flightbag section URL.
 *
 * Only CFR + AIM kinds have a per-section flightbag URL; AC + NTSB redirect to
 * the parent group landing (which itself is a redirect to the catalog).
 */

import { parseRegulationGroup, parseRegulationKind, parseRegulationSection } from '@ab/aviation';
import { HOST_PREFIXES, LIBRARY_REGULATIONS_KINDS, ROUTES, siblingOrigin } from '@ab/constants';
import { error, redirect } from '@sveltejs/kit';
import { flightbagPathForRegulationGroup } from '../../../../../../../lib/library-redirect';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	const kind = parseRegulationKind(params.kind);
	if (!kind) throw error(404, `Unknown regulations kind: ${params.kind}`);
	const group = parseRegulationGroup(kind, params.group);
	if (!group) throw error(404, `Invalid group slug: ${params.group}`);
	const parsedSection = parseRegulationSection(params.section);
	if (!parsedSection) throw error(404, `Invalid section slug: ${params.section}`);
	const flightbag = siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG);

	// `parseRegulationSection` splits `91.107` -> { chapterCode: '91', sectionCode: '107' };
	// the flightbag CFR section URL takes the joined form back (`91.107`).
	const sectionParam =
		parsedSection.sectionCode === ''
			? parsedSection.chapterCode
			: `${parsedSection.chapterCode}.${parsedSection.sectionCode}`;

	let path: string;
	switch (kind) {
		case LIBRARY_REGULATIONS_KINDS.CFR_14:
			path = ROUTES.FLIGHTBAG_CFR_SECTION('14', group, sectionParam);
			break;
		case LIBRARY_REGULATIONS_KINDS.CFR_49:
			path = ROUTES.FLIGHTBAG_CFR_SECTION('49', group, sectionParam);
			break;
		case LIBRARY_REGULATIONS_KINDS.AIM:
			// AIM section has shape `chapter-section`; the legacy section param
			// is just the section number, group is the chapter.
			path = ROUTES.FLIGHTBAG_AIM_SECTION(group, sectionParam);
			break;
		case LIBRARY_REGULATIONS_KINDS.AC:
		case LIBRARY_REGULATIONS_KINDS.NTSB:
			path = flightbagPathForRegulationGroup(kind, group);
			break;
	}

	throw redirect(301, `${flightbag}${path}`);
};
