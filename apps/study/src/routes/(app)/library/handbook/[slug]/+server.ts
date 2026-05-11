/**
 * `/library/handbook/[slug]` -- legacy study handbook landing. 301s to the
 * flightbag handbook landing for the latest non-superseded edition.
 *
 * Per ADR 023 + `wp-flightbag-reader-ux` Phase 2, the flightbag owns the
 * canonical reader URL space. This handler resolves the slug to a real
 * reference row server-side (so we know the edition tag), then redirects
 * to `/handbook/<slug>/<short-edition>` on the flightbag origin.
 */

import { parseHandbookSlug } from '@ab/aviation';
import { getReferenceByDocument } from '@ab/bc-study/server';
import { HOST_PREFIXES, ROUTES, siblingOrigin } from '@ab/constants';
import { error, redirect } from '@sveltejs/kit';
import { shortHandbookEdition } from '../../../../../lib/library-redirect';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const documentSlug = parseHandbookSlug(event.params.slug);
	if (!documentSlug) throw error(404, 'Handbook not found.');
	const ref = await getReferenceByDocument(documentSlug).catch(() => null);
	if (!ref) throw error(404, 'Handbook not found.');
	const edition = shortHandbookEdition(ref.edition);
	const flightbag = siblingOrigin(event.url, HOST_PREFIXES.FLIGHTBAG);
	throw redirect(301, `${flightbag}${ROUTES.FLIGHTBAG_HANDBOOK(documentSlug, edition)}`);
};
