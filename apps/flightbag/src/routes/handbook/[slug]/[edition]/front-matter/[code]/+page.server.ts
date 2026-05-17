/**
 * `/handbook/[slug]/[edition]/front-matter/[code]` -- handbook front-matter
 * reader.
 *
 * Front-matter rows (Cover, Preface, Acknowledgments, Introduction, Major
 * Enhancements, Table of Contents) are depth-0 peers of the real chapters,
 * seeded with `level='front-matter'` and code `0.N`. There is no chapter `0`
 * row, so the chapter/section reader can't reach them -- this dedicated leaf
 * route renders the front-matter body the same way a section reader does.
 *
 * `[code]` carries the full row code (`0.2`); the loader resolves the row by
 * `(referenceId, code, level='front-matter')` via `getHandbookFrontMatter`.
 */

import { parseHandbookSlug } from '@ab/aviation';
import { faaPagesFromMetadata } from '@ab/bc-study';
import {
	computeReadingOrder,
	getHandbookFrontMatter,
	getReadState,
	getReferenceByDocument,
	listAllSectionsForReference,
	listFiguresForSection,
} from '@ab/bc-study/server';
import { type ReferenceKind, ROUTES, readingMinutesForWords } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { handbookHrefFor } from '../../../../../../lib/handbook-href';
import { loadReadSetForReference } from '../../../../../../lib/read-state';
import { computeSiblingNav } from '../../../../../../lib/section-nav';
import { loadSectionAnnotationContext } from '../../../../../../lib/server/section-annotations';
import { buildSourceLinks } from '../../../../../../lib/source-links';
import { buildTOCEntries, totalReadingMinutes } from '../../../../../../lib/toc';
import { shortHandbookEdition } from '../../../../../reader-url';
import type { PageServerLoad } from './$types';

// Front-matter codes are `0.N` -- the literal `0` chapter ordinal plus the
// per-page index. Reject anything else before a DB query fires.
const FRONT_MATTER_CODE_SHAPE = /^0\.[0-9]+$/;

export const load: PageServerLoad = async (event) => {
	const { params } = event;
	const documentSlug = parseHandbookSlug(params.slug);
	if (!documentSlug) throw error(404, 'Handbook not found.');
	if (!FRONT_MATTER_CODE_SHAPE.test(params.code)) throw error(404, 'Front-matter page not found.');

	const ref = await getReferenceByDocument(documentSlug).catch(() => null);
	if (!ref) throw error(404, `No handbook found for ${params.slug}`);

	const shortEdition = shortHandbookEdition(ref.edition);
	if (params.edition !== shortEdition && params.edition !== ref.edition) {
		throw error(404, `Edition ${params.edition} not found for ${ref.title}`);
	}

	const section = await getHandbookFrontMatter(ref.id, params.code).catch(() => null);
	if (!section) throw error(404, `Front-matter page ${params.code} not found in ${ref.title}`);

	// Front-matter rows are leaves, but pull any figures bound to the row so a
	// cover image / diagram still renders inline.
	const figures = await listFiguresForSection(section.id);

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	// Reading-order nav: pull every section under the reference so prev/next
	// walks the whole book (front-matter -> chapters). The shared resolver
	// routes each row to its reader URL.
	const allSections = await listAllSectionsForReference(ref.id);
	const nav = computeSiblingNav(allSections, section.id, (row) => handbookHrefFor(ref.documentSlug, shortEdition, row));

	const readingOrder = computeReadingOrder(allSections);
	const tocEntries = buildTOCEntries(readingOrder, section.id, (entry) =>
		handbookHrefFor(ref.documentSlug, shortEdition, entry),
	);
	const tocTotalMinutes = totalReadingMinutes(readingOrder);

	const sectionEntry = readingOrder.find((e) => e.sectionId === section.id);
	const sectionMinutes = sectionEntry ? readingMinutesForWords(sectionEntry.wordCount) : 0;

	// Per-user read state -- powers the TOC drawer checkmarks + the header's
	// "you've read this N times" line. Anonymous callers get empty/null.
	const userId = event.locals.user?.id ?? null;
	const readSet = await loadReadSetForReference(userId, ref.id);
	const sectionReadState = userId ? await getReadState(userId, section.id) : null;
	const annotationContext = await loadSectionAnnotationContext(userId, section.id);

	const uri = `airboss-ref:handbooks/${ref.documentSlug}/${shortEdition}/${section.code}`;

	return {
		uri,
		sourceLinks,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			shortEdition,
			title: ref.title,
			handbookHref: ROUTES.FLIGHTBAG_HANDBOOK(ref.documentSlug, shortEdition),
		},
		section: (() => {
			const pages = faaPagesFromMetadata(section.metadata);
			return {
				id: section.id,
				code: section.code,
				title: section.title,
				contentMd: section.contentMd,
				sourceLocator: section.sourceLocator,
				faaPageStart: pages?.start ?? null,
				faaPageEnd: pages?.end ?? null,
				metadata: section.metadata as Record<string, unknown>,
			};
		})(),
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
			readSectionIds: [...readSet],
		},
		readingTime: {
			sectionMinutes,
		},
		readState: sectionReadState
			? {
					openedCount: sectionReadState.openedCount,
					lastReadAt: sectionReadState.lastReadAt?.toISOString() ?? null,
					totalSecondsVisible: sectionReadState.totalSecondsVisible,
				}
			: null,
		isAuthenticated: event.locals.user !== null,
		annotationContext,
	};
};
