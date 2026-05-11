/**
 * `/library` -- legacy study catalog. Redirects to the flightbag landing.
 *
 * Per ADR 023 (and `wp-flightbag-reader-ux` Phase 2), the canonical reference
 * browse + read surface lives in the flightbag app. The study app stops
 * hosting its duplicate reader; everything under `/library/*` is a 301 to
 * the equivalent flightbag URL. This handler covers the catalog landing.
 */

import { HOST_PREFIXES, ROUTES, siblingOrigin } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const flightbag = siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG);
	throw redirect(301, `${flightbag}${ROUTES.FLIGHTBAG_HOME}`);
};
