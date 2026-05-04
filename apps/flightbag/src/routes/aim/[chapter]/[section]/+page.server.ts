/**
 * `/aim/[chapter]/[section]` -- AIM section index.
 *
 * Lists paragraphs (`1-1-1`, `1-1-2`, ...) under one AIM section. Resolves
 * the section row by `(referenceId, code)` and walks `parent_id` to gather
 * paragraph children.
 */

import { getReferenceByDocument, listAllSectionsForReference, listChapterSections } from '@ab/bc-study';
import { type ReferenceKind, ROUTES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { buildSourceLinks } from '../../../../lib/source-links';
import type { PageServerLoad } from './$types';

const AIM_SLUG = 'aim';
const NUM_SHAPE = /^\d+$/;

export const load: PageServerLoad = async ({ params }) => {
	if (!NUM_SHAPE.test(params.chapter)) throw error(404, 'Invalid AIM chapter.');
	if (!NUM_SHAPE.test(params.section)) throw error(404, 'Invalid AIM section.');

	const ref = await getReferenceByDocument(AIM_SLUG).catch(() => null);
	if (!ref) throw error(404, 'AIM not seeded.');

	const sectionCode = `${params.chapter}-${params.section}`;
	const allSections = await listAllSectionsForReference(ref.id);
	const sectionRow = allSections.find((s) => s.code === sectionCode);
	if (!sectionRow) throw error(404, `AIM section ${sectionCode} not found.`);

	const paragraphs = await listChapterSections(sectionRow.id);

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	return {
		uri: `airboss-ref:aim/${sectionCode}`,
		sourceLinks,
		reference: {
			id: ref.id,
			title: ref.title,
		},
		section: {
			id: sectionRow.id,
			code: sectionRow.code,
			title: sectionRow.title,
		},
		paragraphs: paragraphs.map((p) => {
			// Paragraph code is `1-1-7`; strip chapter+section prefix for the URL.
			const parts = p.code.split('-');
			const paragraph = parts[2] ?? '';
			return {
				id: p.id,
				code: p.code,
				title: p.title,
				href: ROUTES.FLIGHTBAG_AIM_PARAGRAPH(params.chapter, params.section, paragraph),
			};
		}),
		links: {
			chapterHref: ROUTES.FLIGHTBAG_AIM_CHAPTER(params.chapter),
			aimHref: ROUTES.FLIGHTBAG_AIM,
		},
	};
};
