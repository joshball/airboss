/**
 * `/handbook/[slug]/[edition]` -- whole-handbook chapter list.
 *
 * Resolves the reference row by `documentSlug` (DB has supersession built in
 * so the active edition wins). The URL carries the short URI-edition (e.g.
 * `8083-25C`) -- the DB stores the full edition (`FAA-H-8083-25C`) -- and
 * the bridge runs through `shortHandbookEdition` when emitting URLs.
 */

import { parseHandbookSlug } from '@ab/aviation';
import {
	computeReadingOrder,
	getReferenceByDocument,
	listAllSectionsForReference,
	listHandbookChapters,
} from '@ab/bc-study/server';
import { type ReferenceKind, ROUTES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { loadReadSetForReference } from '../../../../lib/read-state';
import { buildSourceLinks } from '../../../../lib/source-links';
import { shortHandbookEdition } from '../../../reader-url';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { params } = event;
	const documentSlug = parseHandbookSlug(params.slug);
	if (!documentSlug) throw error(404, 'Handbook not found.');

	const ref = await getReferenceByDocument(documentSlug).catch(() => null);
	if (!ref) throw error(404, `No handbook found for ${params.slug}`);

	// Reject the URL when the param edition doesn't match the active edition's
	// short form -- the URL's edition is part of the canonical citation, not a
	// free parameter.
	const shortEdition = shortHandbookEdition(ref.edition);
	if (params.edition !== shortEdition && params.edition !== ref.edition) {
		throw error(404, `Edition ${params.edition} not found for ${ref.title}`);
	}

	const chapters = await listHandbookChapters(ref.id);

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	// Per-user read set for the handbook landing aggregate. Computes both an
	// overall progress count and a per-chapter progress count by walking the
	// reading-order's `parentChapterCode` field.
	const allSections = await listAllSectionsForReference(ref.id);
	const readingOrder = computeReadingOrder(allSections);
	const readSet = await loadReadSetForReference(event.locals.user?.id ?? null, ref.id);
	const overallTotal = readingOrder.length;
	const overallRead = readingOrder.filter((e) => readSet.has(e.sectionId)).length;
	const perChapter = new Map<string, { read: number; total: number }>();
	for (const entry of readingOrder) {
		// Chapter row itself counts under its own code; its descendants carry
		// `parentChapterCode`.
		const chapterCode = entry.parentChapterCode ?? entry.code;
		const bucket = perChapter.get(chapterCode) ?? { read: 0, total: 0 };
		bucket.total += 1;
		if (readSet.has(entry.sectionId)) bucket.read += 1;
		perChapter.set(chapterCode, bucket);
	}

	return {
		uri: `airboss-ref:handbooks/${ref.documentSlug}/${shortEdition}`,
		sourceLinks,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			shortEdition,
			title: ref.title,
			publisher: ref.publisher,
			subjects: [...ref.subjects],
		},
		chapters: chapters.map((c) => {
			const progress = perChapter.get(c.code) ?? { read: 0, total: 0 };
			return {
				id: c.id,
				code: c.code,
				title: c.title,
				ordinal: c.ordinal,
				faaPageStart: c.faaPageStart,
				faaPageEnd: c.faaPageEnd,
				href: ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(ref.documentSlug, shortEdition, c.code),
				readProgress: progress,
			};
		}),
		readProgress: {
			read: overallRead,
			total: overallTotal,
		},
		isAuthenticated: event.locals.user !== null,
	};
};
