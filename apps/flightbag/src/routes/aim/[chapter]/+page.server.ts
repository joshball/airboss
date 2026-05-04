/**
 * `/aim/[chapter]` -- AIM chapter index.
 *
 * Lists the sections (`1-1`, `1-2`, ...) under one AIM chapter. AIM
 * `reference_section` rows are coded with hyphenated identifiers; the chapter
 * row is `1`, sections are `1-1`, paragraphs are `1-1-7`.
 */

import { getHandbookChapter, getReferenceByDocument, listChapterSections } from '@ab/bc-study';
import { type ReferenceKind, ROUTES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { buildSourceLinks } from '../../../lib/source-links';
import type { PageServerLoad } from './$types';

const AIM_SLUG = 'aim';
const CHAPTER_SHAPE = /^\d+$/;

export const load: PageServerLoad = async ({ params }) => {
	if (!CHAPTER_SHAPE.test(params.chapter)) throw error(404, 'Invalid AIM chapter.');

	const ref = await getReferenceByDocument(AIM_SLUG).catch(() => null);
	if (!ref) throw error(404, 'AIM not seeded.');

	const chapter = await getHandbookChapter(ref.id, params.chapter).catch(() => null);
	if (!chapter) throw error(404, `AIM chapter ${params.chapter} not found.`);

	const sections = await listChapterSections(chapter.id);

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	return {
		uri: `airboss-ref:aim/${params.chapter}`,
		sourceLinks,
		reference: {
			id: ref.id,
			title: ref.title,
			edition: ref.edition,
		},
		chapter: {
			id: chapter.id,
			code: chapter.code,
			title: chapter.title,
		},
		sections: sections.map((s) => {
			// AIM section codes are `1-1`, `1-2` -- strip the chapter prefix to
			// derive the section component for the URL helper.
			const [, sectionPart = ''] = s.code.split('-');
			return {
				id: s.id,
				code: s.code,
				title: s.title,
				href: ROUTES.FLIGHTBAG_AIM_SECTION(params.chapter, sectionPart),
			};
		}),
	};
};
