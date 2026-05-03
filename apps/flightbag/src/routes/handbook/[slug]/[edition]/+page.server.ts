/**
 * `/handbook/[slug]/[edition]` -- whole-handbook chapter list.
 *
 * Resolves the reference row by `documentSlug` (DB has supersession built in
 * so the active edition wins). The URL carries the short URI-edition (e.g.
 * `8083-25C`) -- the DB stores the full edition (`FAA-H-8083-25C`) -- and
 * the bridge runs through `shortHandbookEdition` when emitting URLs.
 */

import { parseHandbookSlug } from '@ab/aviation';
import { getReferenceByDocument, listHandbookChapters } from '@ab/bc-study';
import { ROUTES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { shortHandbookEdition } from '../../../reader-url';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
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

	return {
		uri: `airboss-ref:handbooks/${ref.documentSlug}/${shortEdition}`,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			shortEdition,
			title: ref.title,
			publisher: ref.publisher,
			subjects: [...ref.subjects],
		},
		chapters: chapters.map((c) => ({
			id: c.id,
			code: c.code,
			title: c.title,
			ordinal: c.ordinal,
			faaPageStart: c.faaPageStart,
			faaPageEnd: c.faaPageEnd,
			href: ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(ref.documentSlug, shortEdition, c.code),
		})),
	};
};
