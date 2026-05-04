/**
 * `/handbook/[slug]/[edition]/[chapter]` -- chapter overview.
 *
 * For handbooks ingested at section granularity (PHAK / AFH / AvWX / IFH /
 * IPH / RMH / AIH / mountain-tips), surfaces the section list. For handbooks
 * whose ingest produced only a chapter-level body, renders that body inline
 * via the shared `<RenderedSection>` primitive.
 */

import { parseHandbookChapter, parseHandbookSlug } from '@ab/aviation';
import {
	computeReadingOrder,
	getHandbookChapter,
	getReferenceByDocument,
	listAllSectionsForReference,
	listChapterSections,
	listFiguresForSection,
} from '@ab/bc-study';
import { type ReferenceKind, ROUTES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { computeSiblingNav } from '../../../../../lib/section-nav';
import { buildSourceLinks } from '../../../../../lib/source-links';
import { buildTOCEntries, totalReadingMinutes } from '../../../../../lib/toc';
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
	// Always pull figures attached to the chapter row so the preamble can
	// inline its referenced figures even when child sections exist (the
	// preamble paragraph is a real read surface, not just a card).
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
			return ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(ref.documentSlug, shortEdition, row.code);
		}
		const parts = row.code.split('.');
		if (parts.length !== 2) return null;
		const [ch, sec] = parts;
		if (!ch || !sec) return null;
		return ROUTES.FLIGHTBAG_HANDBOOK_SECTION(ref.documentSlug, shortEdition, ch, sec);
	};
	const nav = computeSiblingNav(allSections, chapter.id, hrefForRow);

	const readingOrder = computeReadingOrder(allSections);
	const tocEntries = buildTOCEntries(readingOrder, chapter.id, hrefForRow);
	const tocTotalMinutes = totalReadingMinutes(readingOrder);

	return {
		uri: `airboss-ref:handbooks/${ref.documentSlug}/${shortEdition}/${chapterCode}`,
		sourceLinks,
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
			metadata: chapter.metadata as Record<string, unknown>,
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
		nav,
		toc: {
			entries: tocEntries,
			totalMinutes: tocTotalMinutes,
		},
	};
};
