/**
 * `/library/handbook/[slug]` -- chapter list for a single handbook.
 *
 * Defaults to the latest non-superseded edition; honors `?edition=` to pin a
 * historical edition (citations on a node that pre-dates a re-ingestion). Per
 * ADR 026, "current edition" lives in `sources_registry.editions`: when the
 * registry's current edition for this slug differs from the loaded row's
 * `edition`, the banner shows the registry's current label.
 */

import { requireAuth } from '@ab/auth';
import { parseHandbookSlug } from '@ab/aviation';
import { faaPagesFromMetadata } from '@ab/bc-study';
import { getHandbookProgress, getReferenceByDocument, listHandbookChapters } from '@ab/bc-study/server';
import { QUERY_PARAMS } from '@ab/constants';
import { type SourceId, sourceIdForReference } from '@ab/sources';
import { getCurrentEdition } from '@ab/sources/server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const documentSlug = parseHandbookSlug(event.params.slug);
	if (!documentSlug) throw error(404, 'Handbook not found.');
	const editionParam = event.url.searchParams.get(QUERY_PARAMS.EDITION) ?? undefined;

	const ref = await getReferenceByDocument(documentSlug, { edition: editionParam }).catch(() => null);
	if (!ref) throw error(404, 'Handbook not found.');

	const [chapters, progress, current] = await Promise.all([
		listHandbookChapters(ref.id),
		getHandbookProgress(user.id, ref.id),
		getCurrentEdition(sourceIdForReference(ref) as SourceId).catch(() => null),
	]);
	const supersededByEdition = current !== null && current.editionLabel !== ref.edition ? current.editionLabel : null;

	return {
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			supersededByEdition,
		},
		chapters: chapters.map((c) => {
			const pages = faaPagesFromMetadata(c.metadata);
			return {
				id: c.id,
				code: c.code,
				title: c.title,
				ordinal: c.ordinal,
				faaPageStart: pages?.start ?? null,
				faaPageEnd: pages?.end ?? null,
				hasFigures: c.hasFigures,
				hasTables: c.hasTables,
			};
		}),
		progress,
	};
};
