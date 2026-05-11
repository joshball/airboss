/**
 * Shared layout loader for `/ac/[doc]/[rev]/*` (WP-FLIGHTBAG-READER-UX
 * Phase 4). Hoists the AC reference + reading order + read-set so the
 * landing, chapter, and section pages share the rail.
 */

import {
	computeReadingOrder,
	getReferenceByDocument,
	listAllSectionsForReference,
	listReferences,
} from '@ab/bc-study/server';
import { externalUrlForReference, REFERENCE_KINDS, type ReferenceKind } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { loadReadSetForReference } from '../../../../lib/read-state';
import { buildSourceLinks } from '../../../../lib/source-links';
import type { LayoutServerLoad } from './$types';

const DOC_SHAPE = /^[a-z0-9.-]+$/i;
const REV_SHAPE = /^[a-z]$/i;

export const load: LayoutServerLoad = async (event) => {
	const { params } = event;
	if (!DOC_SHAPE.test(params.doc)) throw error(404, 'Invalid AC doc number.');
	if (!REV_SHAPE.test(params.rev)) throw error(404, 'Invalid AC revision letter.');

	const documentSlug = `ac-${params.doc.toLowerCase()}`;
	const targetRev = params.rev.toUpperCase();

	const allRefs = await listReferences({}, undefined);
	let ref =
		allRefs.find(
			(r) => r.kind === REFERENCE_KINDS.AC && r.documentSlug === documentSlug && r.edition.endsWith(targetRev),
		) ?? null;
	if (!ref) {
		ref = await getReferenceByDocument(documentSlug).catch(() => null);
	}
	if (!ref) throw error(404, `AC ${params.doc}${targetRev} not found.`);

	const allSections = await listAllSectionsForReference(ref.id).catch(() => []);
	const readingOrder = computeReadingOrder(allSections);
	const readSet = await loadReadSetForReference(event.locals.user?.id ?? null, ref.id);

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	return {
		ac: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
			externalUrl: externalUrlForReference(ref.kind as ReferenceKind, ref.documentSlug, ref.edition, ref.url),
			docParam: params.doc,
			revParam: params.rev,
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
