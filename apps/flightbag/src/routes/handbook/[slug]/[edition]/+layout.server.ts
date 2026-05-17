/**
 * Shared layout for `/handbook/[slug]/[edition]/*` (WP-FLIGHTBAG-READER-UX
 * Phase 4).
 *
 * Loads the whole-handbook reading order + read-set once at the layout
 * level. Child page-server loaders inherit via `parent()` -- the rail
 * shows the same data on the landing page, every chapter, and every
 * section without re-fetching.
 *
 * The actual TOC entry construction stays per-page (because the active
 * sectionId changes), but the underlying reading-order + read-set rows
 * come from this loader.
 */

import { parseHandbookSlug } from '@ab/aviation';
import { computeReadingOrder, getReferenceByDocument, listAllSectionsForReference } from '@ab/bc-study/server';
import { ROUTES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { loadReadSetForReference } from '../../../../lib/read-state';
import { buildSourceLinks } from '../../../../lib/source-links';
import { shortHandbookEdition } from '../../../reader-url';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const { params } = event;
	const documentSlug = parseHandbookSlug(params.slug);
	if (!documentSlug) throw error(404, 'Handbook not found.');

	const ref = await getReferenceByDocument(documentSlug).catch(() => null);
	if (!ref) throw error(404, `No handbook found for ${params.slug}`);

	const shortEdition = shortHandbookEdition(ref.edition);
	if (params.edition !== shortEdition && params.edition !== ref.edition) {
		throw error(404, `Edition ${params.edition} not found for ${ref.title}`);
	}

	const allSections = await listAllSectionsForReference(ref.id);
	const readingOrder = computeReadingOrder(allSections);
	const readSet = await loadReadSetForReference(event.locals.user?.id ?? null, ref.id);

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as Parameters<typeof buildSourceLinks>[0]['kind'],
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	return {
		handbook: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			shortEdition,
			title: ref.title,
			publisher: ref.publisher,
			subjects: [...ref.subjects],
			href: ROUTES.FLIGHTBAG_HANDBOOK(ref.documentSlug, shortEdition),
		},
		readingOrder: readingOrder.map((entry) => ({
			sectionId: entry.sectionId,
			parentId: entry.parentId,
			parentChapterCode: entry.parentChapterCode,
			code: entry.code,
			title: entry.title,
			depth: entry.depth,
			level: entry.level,
			wordCount: entry.wordCount,
		})),
		readSectionIds: [...readSet],
		sourceLinks,
		isAuthenticated: event.locals.user !== null,
	};
};
