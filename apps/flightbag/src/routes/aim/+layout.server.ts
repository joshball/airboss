/**
 * Shared layout loader for `/aim/*` (WP-FLIGHTBAG-READER-UX Phase 4).
 *
 * Loads the AIM reference + reading order + read-set once at the layout
 * level so child page-server loaders inherit via `parent()` -- the rail
 * shows the same data on the landing, every chapter, and every section
 * without re-fetching.
 */

import { computeReadingOrder, getReferenceByDocument, listAllSectionsForReference } from '@ab/bc-study/server';
import { error } from '@sveltejs/kit';
import { loadReadSetForReference } from '../../lib/read-state';
import { buildSourceLinks } from '../../lib/source-links';
import type { LayoutServerLoad } from './$types';

const AIM_SLUG = 'aim';

export const load: LayoutServerLoad = async (event) => {
	const ref = await getReferenceByDocument(AIM_SLUG).catch(() => null);
	if (!ref) throw error(404, 'AIM not seeded.');

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
		aim: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
		},
		readingOrder: readingOrder.map((entry) => ({
			sectionId: entry.sectionId,
			parentId: entry.parentId,
			parentChapterCode: entry.parentChapterCode,
			code: entry.code,
			title: entry.title,
			depth: entry.depth,
			wordCount: entry.wordCount,
		})),
		readSectionIds: [...readSet],
		sourceLinks,
		isAuthenticated: event.locals.user !== null,
	};
};
