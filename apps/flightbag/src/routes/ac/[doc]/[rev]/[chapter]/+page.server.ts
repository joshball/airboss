/**
 * `/ac/[doc]/[rev]/[chapter]` -- AC chapter overview.
 *
 * Lists the sections under one AC chapter (`1.1`, `1.2`, ...). When the
 * chapter row carries inline body content, renders that body alongside the
 * section list. Mirrors the handbook chapter route's shape.
 */

import { getHandbookChapter, getReferenceByDocument, listChapterSections, listReferences } from '@ab/bc-study';
import { REFERENCE_KINDS, ROUTES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const DOC_SHAPE = /^[a-z0-9.-]+$/i;
const REV_SHAPE = /^[a-z]$/i;
const CHAPTER_SHAPE = /^[a-z0-9]+$/i;

export const load: PageServerLoad = async ({ params }) => {
	if (!DOC_SHAPE.test(params.doc)) throw error(404, 'Invalid AC doc number.');
	if (!REV_SHAPE.test(params.rev)) throw error(404, 'Invalid AC revision letter.');
	if (!CHAPTER_SHAPE.test(params.chapter)) throw error(404, 'Invalid AC chapter.');

	const documentSlug = `ac-${params.doc.toLowerCase()}`;
	const targetRev = params.rev.toUpperCase();

	const allRefs = await listReferences({}, undefined);
	const ref =
		allRefs.find(
			(r) => r.kind === REFERENCE_KINDS.AC && r.documentSlug === documentSlug && r.edition.endsWith(targetRev),
		) ?? (await getReferenceByDocument(documentSlug).catch(() => null));
	if (!ref) throw error(404, `AC ${params.doc}${targetRev} not found.`);

	const chapter = await getHandbookChapter(ref.id, params.chapter).catch(() => null);
	if (!chapter) throw error(404, `Chapter ${params.chapter} not found in ${ref.title}.`);

	const sections = await listChapterSections(chapter.id);

	return {
		uri: `airboss-ref:ac/${params.doc}/${params.rev}/section-${params.chapter}`,
		reference: {
			id: ref.id,
			edition: ref.edition,
			title: ref.title,
			acHref: ROUTES.FLIGHTBAG_AC(params.doc, params.rev),
		},
		chapter: {
			id: chapter.id,
			code: chapter.code,
			title: chapter.title,
			contentMd: chapter.contentMd,
			sourceLocator: chapter.sourceLocator,
		},
		sections: sections.map((s) => {
			// AC section codes are `1.1`, `12.3`. URL only carries the trailing
			// section number (`1`, `3`) since the chapter is already in the path.
			const trail = s.code.split('.').slice(1).join('.');
			return {
				id: s.id,
				code: s.code,
				title: s.title,
				href: ROUTES.FLIGHTBAG_AC_SECTION(params.doc, params.rev, params.chapter, trail),
			};
		}),
	};
};
