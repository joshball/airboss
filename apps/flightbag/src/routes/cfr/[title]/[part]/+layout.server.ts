/**
 * Shared layout loader for `/cfr/[title]/[part]/*` (WP-FLIGHTBAG-READER-UX
 * Phase 4). Hoists the Part reference + sections list + read-set so the
 * landing and section pages share the rail.
 */

import { computeReadingOrder, getReferenceByDocument, listAllSectionsForReference } from '@ab/bc-study/server';
import { CITATION_URL_TEMPLATES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { loadReadSetForReference } from '../../../../lib/read-state';
import { buildSourceLinks } from '../../../../lib/source-links';
import type { LayoutServerLoad } from './$types';

const NUM_SHAPE = /^\d+$/;
const PART_SHAPE = /^[a-z0-9-]+$/i;

export const load: LayoutServerLoad = async (event) => {
	const { params } = event;
	if (!NUM_SHAPE.test(params.title)) throw error(404, 'Invalid CFR title.');
	if (!PART_SHAPE.test(params.part)) throw error(404, 'Invalid CFR part.');

	const documentSlug = `${params.title}cfr${params.part}`;
	const ref = await getReferenceByDocument(documentSlug).catch(() => null);
	if (!ref) throw error(404, `${params.title} CFR Part ${params.part} not seeded.`);

	const allSections = await listAllSectionsForReference(ref.id);
	const readingOrder = computeReadingOrder(allSections);
	const readSet = await loadReadSetForReference(event.locals.user?.id ?? null, ref.id);
	const titleNum = Number.parseInt(params.title, 10);
	const partNum = Number.parseInt(params.part, 10);

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as Parameters<typeof buildSourceLinks>[0]['kind'],
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	return {
		cfr: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
			subjects: [...ref.subjects],
			titleNum: Number.isFinite(titleNum) ? titleNum : null,
			partNum: Number.isFinite(partNum) ? partNum : null,
			titleParam: params.title,
			partParam: params.part,
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
		ecfrUrl:
			Number.isFinite(titleNum) && Number.isFinite(partNum) ? CITATION_URL_TEMPLATES.CFR_PART(titleNum, partNum) : null,
		isAuthenticated: event.locals.user !== null,
	};
};
