/**
 * `/handbook/[slug]/[edition]/[chapter]` -- chapter overview.
 *
 * For handbooks ingested at section granularity (PHAK / AFH / AvWX / IFH /
 * IPH / RMH / AIH / mountain-tips), surfaces the section list. For handbooks
 * whose ingest produced only a chapter-level body, renders that body inline
 * via the shared `<RenderedSection>` primitive.
 */

import { parseHandbookChapter, parseHandbookSlug } from '@ab/aviation';
import { getHandbookChapter, getReferenceByDocument, listChapterSections, listFiguresForSection } from '@ab/bc-study';
import { ROUTES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { shortHandbookEdition } from '../../../../reader-url';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const documentSlug = parseHandbookSlug(params.slug);
	if (!documentSlug) throw error(404, 'Handbook not found.');
	const chapterCode = parseHandbookChapter(params.chapter);
	if (!chapterCode) throw error(404, 'Chapter not found.');

	const ref = await getReferenceByDocument(documentSlug).catch(() => null);
	if (!ref) throw error(404, `No handbook found for ${params.slug}`);

	const shortEdition = shortHandbookEdition(ref.edition);
	if (params.edition !== shortEdition && params.edition !== ref.edition) {
		throw error(404, `Edition ${params.edition} not found for ${ref.title}`);
	}

	const chapter = await getHandbookChapter(ref.id, chapterCode).catch(() => null);
	if (!chapter) throw error(404, `Chapter ${chapterCode} not found in ${ref.title}`);

	const sections = await listChapterSections(chapter.id);
	const figures = sections.length === 0 ? await listFiguresForSection(chapter.id) : [];

	return {
		uri: `airboss-ref:handbooks/${ref.documentSlug}/${shortEdition}/${chapterCode}`,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			shortEdition,
			title: ref.title,
			handbookHref: ROUTES.FLIGHTBAG_HANDBOOK(ref.documentSlug, shortEdition),
		},
		chapter: {
			id: chapter.id,
			code: chapter.code,
			title: chapter.title,
			contentMd: chapter.contentMd,
			sourceLocator: chapter.sourceLocator,
			faaPageStart: chapter.faaPageStart,
			faaPageEnd: chapter.faaPageEnd,
		},
		sections: sections.map((s) => ({
			id: s.id,
			code: s.code,
			title: s.title,
			ordinal: s.ordinal,
			href: ROUTES.FLIGHTBAG_HANDBOOK_SECTION(
				ref.documentSlug,
				shortEdition,
				chapter.code,
				s.code.split('.').slice(1).join('.'),
			),
		})),
		figures: figures.map((f) => ({
			id: f.id,
			ordinal: f.ordinal,
			caption: f.caption,
			assetPath: f.assetPath,
			width: f.width,
			height: f.height,
		})),
	};
};
