/**
 * `/ac/[doc]/[rev]/[chapter]/[section]` -- AC section reader.
 *
 * Resolves the section row by `(referenceId, code)` where the AC code shape
 * is `<chapter>.<section>`. Renders the section body with a sticky sibling
 * TOC.
 */

import {
	computeReadingOrder,
	getHandbookSection,
	listAllSectionsForReference,
	listReferences,
} from '@ab/bc-study/server';
import { REFERENCE_KINDS, type ReferenceKind, ROUTES, readingMinutesForWords } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { computeSiblingNav } from '../../../../../../lib/section-nav';
import { loadSectionAnnotationContext } from '../../../../../../lib/server/section-annotations';
import { buildSourceLinks } from '../../../../../../lib/source-links';
import { buildTOCEntries, totalReadingMinutes } from '../../../../../../lib/toc';
import type { PageServerLoad } from './$types';

const DOC_SHAPE = /^[a-z0-9.-]+$/i;
const REV_SHAPE = /^[a-z]$/i;
// Lower-kebab: numbered chapters (`1`, `12`) plus hyphenated appendix codes
// (`appendix-a`). No leading/trailing/double hyphen.
const CHAPTER_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const SECTION_SHAPE = /^[a-z0-9]+(?:\.[a-z0-9]+)?$/i;

export const load: PageServerLoad = async (event) => {
	const { params } = event;
	if (!DOC_SHAPE.test(params.doc)) throw error(404, 'Invalid AC doc number.');
	if (!REV_SHAPE.test(params.rev)) throw error(404, 'Invalid AC revision letter.');
	if (!CHAPTER_SHAPE.test(params.chapter)) throw error(404, 'Invalid AC chapter.');
	if (!SECTION_SHAPE.test(params.section)) throw error(404, 'Invalid AC section.');

	const documentSlug = `ac-${params.doc.toLowerCase()}`;
	const targetRev = params.rev.toUpperCase();

	const allRefs = await listReferences({}, undefined);
	const ref = allRefs.find(
		(r) => r.kind === REFERENCE_KINDS.AC && r.documentSlug === documentSlug && r.edition.endsWith(targetRev),
	);
	if (!ref) throw error(404, `AC ${params.doc}${targetRev} not found.`);

	const view = await getHandbookSection(ref.id, params.chapter, params.section).catch(() => null);
	if (!view) throw error(404, `Section ${params.chapter}.${params.section} not found in ${ref.title}.`);

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
	const nav = computeSiblingNav(allSections, view.section.id, hrefForRow);
	const readingOrder = computeReadingOrder(allSections);
	const tocEntries = buildTOCEntries(readingOrder, view.section.id, hrefForRow);
	const tocTotalMinutes = totalReadingMinutes(readingOrder);

	const sectionEntry = readingOrder.find((e) => e.sectionId === view.section.id);
	const sectionMinutes = sectionEntry ? readingMinutesForWords(sectionEntry.wordCount) : 0;

	const annotationContext = await loadSectionAnnotationContext(event.locals.user?.id ?? null, view.section.id);

	return {
		uri: `airboss-ref:ac/${params.doc}/${params.rev}/section-${params.chapter}`,
		sourceLinks,
		reference: {
			id: ref.id,
			edition: ref.edition,
			title: ref.title,
			acHref: ROUTES.FLIGHTBAG_AC(params.doc, params.rev),
			chapterHref: ROUTES.FLIGHTBAG_AC_CHAPTER(params.doc, params.rev, params.chapter),
		},
		chapter: {
			id: view.chapter.id,
			code: view.chapter.code,
			title: view.chapter.title,
		},
		section: {
			id: view.section.id,
			code: view.section.code,
			title: view.section.title,
			contentMd: view.section.contentMd,
			sourceLocator: view.section.sourceLocator,
			metadata: view.section.metadata as Record<string, unknown>,
		},
		figures: view.figures.map((f) => ({
			id: f.id,
			ordinal: f.ordinal,
			caption: f.caption,
			assetPath: f.assetPath,
			width: f.width,
			height: f.height,
		})),
		siblings: view.siblings.map((s) => {
			const trail = s.code.split('.').slice(1).join('.');
			return {
				id: s.id,
				code: s.code,
				title: s.title,
				href: ROUTES.FLIGHTBAG_AC_SECTION(params.doc, params.rev, params.chapter, trail),
			};
		}),
		nav,
		toc: {
			entries: tocEntries,
			totalMinutes: tocTotalMinutes,
		},
		readingTime: {
			sectionMinutes,
		},
		isAuthenticated: event.locals.user !== null,
		annotationContext,
	};
};
