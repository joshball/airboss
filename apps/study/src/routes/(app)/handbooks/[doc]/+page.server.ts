/**
 * `/handbooks/[doc]` -- chapter list for a single handbook.
 *
 * Defaults to the latest non-superseded edition; honors `?edition=` to pin a
 * historical edition (citations on a node that pre-dates a re-ingestion). If
 * the loaded edition's `superseded_by_id` is set, surfaces the "newer
 * edition available" banner with a link to the latest.
 */

import { requireAuth } from '@ab/auth';
import { getHandbookProgress, getReferenceByDocument, getReferenceById, listHandbookChapters } from '@ab/bc-study';
import { QUERY_PARAMS } from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const documentSlug = event.params.doc;
	const editionParam = event.url.searchParams.get(QUERY_PARAMS.EDITION) ?? undefined;

	const ref = await getReferenceByDocument(documentSlug, { edition: editionParam }).catch(() => null);
	if (!ref) throw error(404, `Handbook not found: ${documentSlug}`);

	const chapters = await listHandbookChapters(ref.id);
	const progress = await getHandbookProgress(user.id, ref.id);

	const latest = ref.supersededById ? await getReferenceById(ref.supersededById).catch(() => null) : null;

	return {
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			supersededByEdition: latest?.edition ?? null,
		},
		chapters: chapters.map((c) => ({
			id: c.id,
			code: c.code,
			title: c.title,
			ordinal: c.ordinal,
			faaPageStart: c.faaPageStart,
			faaPageEnd: c.faaPageEnd,
			hasFigures: c.hasFigures,
			hasTables: c.hasTables,
		})),
		progress,
	};
};
