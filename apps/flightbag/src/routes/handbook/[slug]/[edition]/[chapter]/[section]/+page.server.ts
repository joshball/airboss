/**
 * `/handbook/[slug]/[edition]/[chapter]/[section]` -- handbook section reader.
 *
 * Resolves the `(reference, chapter, section)` tuple via the BC's
 * `getHandbookSection` view. Validates the URI parses end-to-end so a
 * malformed deep link is rejected before a DB query fires.
 */

import { parseHandbookChapter, parseHandbookSection, parseHandbookSlug } from '@ab/aviation';
import { faaPagesFromMetadata } from '@ab/bc-study';
import {
	computeReadingOrder,
	getHandbookSection,
	getReadState,
	getReferenceByDocument,
	listAllSectionsForReference,
} from '@ab/bc-study/server';
import { type ReferenceKind, ROUTES, readingMinutesForWords } from '@ab/constants';
import { isParseError, parseHandbooksLocator, parseIdentifier } from '@ab/sources';
import { error } from '@sveltejs/kit';
import { loadReadSetForReference } from '../../../../../../lib/read-state';
import { computeSiblingNav } from '../../../../../../lib/section-nav';
import { buildSourceLinks } from '../../../../../../lib/source-links';
import { buildTOCEntries, totalReadingMinutes } from '../../../../../../lib/toc';
import { shortHandbookEdition } from '../../../../../reader-url';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { params } = event;
	const documentSlug = parseHandbookSlug(params.slug);
	if (!documentSlug) throw error(404, 'Handbook not found.');
	const chapterCode = parseHandbookChapter(params.chapter);
	if (!chapterCode) throw error(404, 'Section not found.');
	const sectionCode = parseHandbookSection(params.section);
	if (!sectionCode) throw error(404, 'Section not found.');

	const ref = await getReferenceByDocument(documentSlug).catch(() => null);
	if (!ref) throw error(404, `No handbook found for ${params.slug}`);

	const shortEdition = shortHandbookEdition(ref.edition);
	if (params.edition !== shortEdition && params.edition !== ref.edition) {
		throw error(404, `Edition ${params.edition} not found for ${ref.title}`);
	}

	// Validate the canonical URI shape (which uses the short edition) parses
	// end-to-end so a malformed deep link is rejected before the DB query.
	const rawUri = `airboss-ref:handbooks/${documentSlug}/${shortEdition}/${chapterCode}/${sectionCode}`;
	const parsed = parseIdentifier(rawUri);
	if (isParseError(parsed)) throw error(404, `Malformed handbook reference: ${parsed.message}`);
	const locator = parseHandbooksLocator(parsed.locator);
	if (locator.kind === 'error') throw error(404, `Malformed handbook locator: ${locator.message}`);

	const view = await getHandbookSection(ref.id, chapterCode, sectionCode).catch(() => null);
	if (!view) throw error(404, `Section ${chapterCode}.${sectionCode} not found in ${ref.title}`);

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	// Reading-order nav: pull every section under the reference so prev/next
	// can wrap across chapter boundaries (last-of-§1 -> first-of-§2 etc.).
	const allSections = await listAllSectionsForReference(ref.id);
	const nav = computeSiblingNav(allSections, view.section.id, (row) => {
		// Chapter rows route to the chapter overview; section rows to the section
		// reader. Sub-section rows (deeper than `chapter.section`) don't have a
		// dedicated reader route in handbooks today, so they're skipped from
		// the prev/next walk.
		if (row.parentId === null) {
			return ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(ref.documentSlug, shortEdition, row.code);
		}
		const parts = row.code.split('.');
		if (parts.length !== 2) return null;
		const [ch, sec] = parts;
		if (!ch || !sec) return null;
		return ROUTES.FLIGHTBAG_HANDBOOK_SECTION(ref.documentSlug, shortEdition, ch, sec);
	});

	// Whole-doc TOC -- powers the persistent left-rail drawer. Each entry maps
	// to its reader URL via the same dispatch as the prev/next walk.
	const readingOrder = computeReadingOrder(allSections);
	const tocEntries = buildTOCEntries(readingOrder, view.section.id, (entry) => {
		if (entry.parentId === null) {
			return ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(ref.documentSlug, shortEdition, entry.code);
		}
		const parts = entry.code.split('.');
		if (parts.length !== 2) return null;
		const [ch, sec] = parts;
		if (!ch || !sec) return null;
		return ROUTES.FLIGHTBAG_HANDBOOK_SECTION(ref.documentSlug, shortEdition, ch, sec);
	});
	const tocTotalMinutes = totalReadingMinutes(readingOrder);

	const sectionEntry = readingOrder.find((e) => e.sectionId === view.section.id);
	const sectionMinutes = sectionEntry ? readingMinutesForWords(sectionEntry.wordCount) : 0;

	// Per-user read state -- powers the TOC drawer's checkmarks. Anonymous
	// callers get an empty set; the drawer falls through to the no-progress
	// shape without rendering any check glyphs.
	const readSet = await loadReadSetForReference(event.locals.user?.id ?? null, ref.id);

	// Fetch the per-section read-state row for the section header's
	// "you've read this N times; last on X" line. Anonymous callers get null.
	const userId = event.locals.user?.id ?? null;
	const sectionReadState = userId ? await getReadState(userId, view.section.id) : null;

	return {
		uri: rawUri,
		sourceLinks,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			shortEdition,
			title: ref.title,
			handbookHref: ROUTES.FLIGHTBAG_HANDBOOK(ref.documentSlug, shortEdition),
			chapterHref: ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(ref.documentSlug, shortEdition, chapterCode),
		},
		chapter: {
			id: view.chapter.id,
			code: view.chapter.code,
			title: view.chapter.title,
		},
		section: (() => {
			const pages = faaPagesFromMetadata(view.section.metadata);
			return {
				id: view.section.id,
				code: view.section.code,
				title: view.section.title,
				contentMd: view.section.contentMd,
				sourceLocator: view.section.sourceLocator,
				faaPageStart: pages?.start ?? null,
				faaPageEnd: pages?.end ?? null,
				metadata: view.section.metadata as Record<string, unknown>,
			};
		})(),
		figures: view.figures.map((f) => ({
			id: f.id,
			ordinal: f.ordinal,
			caption: f.caption,
			assetPath: f.assetPath,
			width: f.width,
			height: f.height,
		})),
		siblings: view.siblings.map((s) => ({
			id: s.id,
			code: s.code,
			title: s.title,
			ordinal: s.ordinal,
			href: ROUTES.FLIGHTBAG_HANDBOOK_SECTION(
				ref.documentSlug,
				shortEdition,
				chapterCode,
				s.code.split('.').slice(1).join('.'),
			),
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
	};
};
