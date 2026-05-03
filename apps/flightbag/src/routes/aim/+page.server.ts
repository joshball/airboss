/**
 * `/aim` -- Aeronautical Information Manual landing.
 *
 * Renders the chapter list for the AIM publication. Chapters in the
 * `reference_section` table are the level=`chapter` rows; sections (`1-1`)
 * and paragraphs (`1-1-7`) live underneath.
 */

import { getReferenceByDocument, listHandbookChapters } from '@ab/bc-study';
import { ROUTES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const AIM_SLUG = 'aim';

export const load: PageServerLoad = async () => {
	const ref = await getReferenceByDocument(AIM_SLUG).catch(() => null);
	if (!ref) throw error(404, 'AIM not seeded.');

	const chapters = await listHandbookChapters(ref.id);

	return {
		uri: 'airboss-ref:aim',
		reference: {
			id: ref.id,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
		},
		chapters: chapters.map((c) => ({
			id: c.id,
			code: c.code,
			title: c.title,
			href: ROUTES.FLIGHTBAG_AIM_CHAPTER(c.code),
		})),
	};
};
