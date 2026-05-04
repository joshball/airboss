/**
 * `/aim/[chapter]/[section]/[paragraph]` -- AIM paragraph reader.
 *
 * Resolves the paragraph row by `(referenceId, code)` where code is the
 * hyphenated `1-1-7` shape. Validates the URI parses end-to-end so a
 * malformed deep-link is rejected before a DB query fires.
 */

import {
	computeReadingOrder,
	getReferenceByDocument,
	listAllSectionsForReference,
	listChapterSections,
} from '@ab/bc-study';
import { type ReferenceKind, ROUTES } from '@ab/constants';
import { isParseError, parseAimLocator, parseIdentifier } from '@ab/sources';
import { error } from '@sveltejs/kit';
import { computeSiblingNav } from '../../../../../lib/section-nav';
import { buildSourceLinks } from '../../../../../lib/source-links';
import { buildTOCEntries, totalReadingMinutes } from '../../../../../lib/toc';
import type { PageServerLoad } from './$types';

const AIM_SLUG = 'aim';
const NUM_SHAPE = /^\d+$/;

export const load: PageServerLoad = async ({ params }) => {
	if (!NUM_SHAPE.test(params.chapter)) throw error(404, 'Invalid AIM chapter.');
	if (!NUM_SHAPE.test(params.section)) throw error(404, 'Invalid AIM section.');
	if (!NUM_SHAPE.test(params.paragraph)) throw error(404, 'Invalid AIM paragraph.');

	const rawUri = `airboss-ref:aim/${params.chapter}-${params.section}-${params.paragraph}`;
	const parsed = parseIdentifier(rawUri);
	if (isParseError(parsed)) throw error(404, `Malformed AIM reference: ${parsed.message}`);
	const locator = parseAimLocator(parsed.locator);
	if (locator.kind === 'error') throw error(404, `Malformed AIM locator: ${locator.message}`);

	const ref = await getReferenceByDocument(AIM_SLUG).catch(() => null);
	if (!ref) throw error(404, 'AIM not seeded.');

	const paragraphCode = `${params.chapter}-${params.section}-${params.paragraph}`;
	const allSections = await listAllSectionsForReference(ref.id);
	const paragraphRow = allSections.find((s) => s.code === paragraphCode);
	if (!paragraphRow) throw error(404, `AIM paragraph ${paragraphCode} not found.`);

	const sectionCode = `${params.chapter}-${params.section}`;
	const sectionRow = allSections.find((s) => s.code === sectionCode);

	// Sibling paragraphs power the sticky TOC.
	const siblings = sectionRow ? await listChapterSections(sectionRow.id) : [];

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	const hrefForRow = (row: { code: string }): string | null => {
		const parts = row.code.split('-');
		// Chapter rows: code is "1"; section rows: "1-1"; paragraph rows: "1-1-7".
		if (parts.length === 1) {
			const ch = parts[0];
			if (!ch) return null;
			return ROUTES.FLIGHTBAG_AIM_CHAPTER(ch);
		}
		if (parts.length === 2) {
			const [ch, sec] = parts;
			if (!ch || !sec) return null;
			return ROUTES.FLIGHTBAG_AIM_SECTION(ch, sec);
		}
		if (parts.length === 3) {
			const [ch, sec, para] = parts;
			if (!ch || !sec || !para) return null;
			return ROUTES.FLIGHTBAG_AIM_PARAGRAPH(ch, sec, para);
		}
		return null;
	};
	const nav = computeSiblingNav(allSections, paragraphRow.id, hrefForRow);
	const readingOrder = computeReadingOrder(allSections);
	const tocEntries = buildTOCEntries(readingOrder, paragraphRow.id, hrefForRow);
	const tocTotalMinutes = totalReadingMinutes(readingOrder);

	return {
		uri: rawUri,
		sourceLinks,
		reference: {
			id: ref.id,
			title: ref.title,
		},
		paragraph: {
			id: paragraphRow.id,
			code: paragraphRow.code,
			title: paragraphRow.title,
			contentMd: paragraphRow.contentMd,
			sourceLocator: paragraphRow.sourceLocator,
			metadata: paragraphRow.metadata as Record<string, unknown>,
		},
		section: sectionRow
			? {
					id: sectionRow.id,
					code: sectionRow.code,
					title: sectionRow.title,
				}
			: null,
		siblings: siblings.map((p) => {
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
			aimHref: ROUTES.FLIGHTBAG_AIM,
			chapterHref: ROUTES.FLIGHTBAG_AIM_CHAPTER(params.chapter),
			sectionHref: ROUTES.FLIGHTBAG_AIM_SECTION(params.chapter, params.section),
		},
		nav,
		toc: {
			entries: tocEntries,
			totalMinutes: tocTotalMinutes,
		},
	};
};
