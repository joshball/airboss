/**
 * `/ac/[doc]/[rev]/[chapter]` -- AC chapter overview.
 *
 * Lists the sections under one AC chapter (`1.1`, `1.2`, ...). When the
 * chapter row carries inline body content, renders that body alongside the
 * section list. Mirrors the handbook chapter route's shape.
 */

import {
	computeReadingOrder,
	getHandbookChapter,
	getReferenceByDocument,
	listAllSectionsForReference,
	listChapterSections,
	listFiguresForSection,
	listReferences,
} from '@ab/bc-study/server';
import { REFERENCE_KINDS, type ReferenceKind, ROUTES, readingMinutesForWords } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { computeSiblingNav } from '../../../../../lib/section-nav';
import { buildSourceLinks } from '../../../../../lib/source-links';
import { buildTOCEntries, totalReadingMinutes } from '../../../../../lib/toc';
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
	const figures = await listFiguresForSection(chapter.id);

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	const allSections = await listAllSectionsForReference(ref.id);
	const hrefForRow = (row: { parentId: string | null; code: string }): string | null => {
		if (row.parentId === null) {
			return ROUTES.FLIGHTBAG_AC_CHAPTER(params.doc, params.rev, row.code);
		}
		const parts = row.code.split('.');
		if (parts.length !== 2) return null;
		const [ch, sec] = parts;
		if (!ch || !sec) return null;
		return ROUTES.FLIGHTBAG_AC_SECTION(params.doc, params.rev, ch, sec);
	};
	const nav = computeSiblingNav(allSections, chapter.id, hrefForRow);
	const readingOrder = computeReadingOrder(allSections);
	const tocEntries = buildTOCEntries(readingOrder, chapter.id, hrefForRow);
	const tocTotalMinutes = totalReadingMinutes(readingOrder);

	const chapterMinutes = readingOrder
		.filter((e) => e.sectionId === chapter.id || e.parentChapterCode === chapter.code)
		.reduce((acc, e) => acc + readingMinutesForWords(e.wordCount), 0);

	return {
		uri: `airboss-ref:ac/${params.doc}/${params.rev}/section-${params.chapter}`,
		sourceLinks,
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
			metadata: chapter.metadata as Record<string, unknown>,
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
		figures: figures.map((f) => ({
			id: f.id,
			ordinal: f.ordinal,
			caption: f.caption,
			assetPath: f.assetPath,
			width: f.width,
			height: f.height,
		})),
		nav,
		toc: {
			entries: tocEntries,
			totalMinutes: tocTotalMinutes,
		},
		readingTime: {
			chapterMinutes,
		},
	};
};
