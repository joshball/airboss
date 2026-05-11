/**
 * `/library/handbook/[slug]/[chapter]` -- legacy study handbook chapter.
 * 301s to the flightbag chapter URL with the latest non-superseded edition.
 */

import { parseHandbookChapter, parseHandbookSlug } from '@ab/aviation';
import { getReferenceByDocument } from '@ab/bc-study/server';
import { HOST_PREFIXES, ROUTES, siblingOrigin } from '@ab/constants';
import { error, redirect } from '@sveltejs/kit';
import { shortHandbookEdition } from '../../../../../../lib/library-redirect';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const documentSlug = parseHandbookSlug(event.params.slug);
	if (!documentSlug) throw error(404, 'Handbook not found.');
	const chapterCode = parseHandbookChapter(event.params.chapter);
	if (!chapterCode) throw error(404, 'Chapter not found.');
	const ref = await getReferenceByDocument(documentSlug).catch(() => null);
	if (!ref) throw error(404, 'Handbook not found.');
	const edition = shortHandbookEdition(ref.edition);
	const flightbag = siblingOrigin(event.url, HOST_PREFIXES.FLIGHTBAG);
	throw redirect(301, `${flightbag}${ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(documentSlug, edition, chapterCode)}`);
};
