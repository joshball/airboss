/**
 * `/library/testing/[slug]` -- legacy ACS / PTS publication detail.
 * 301s to the flightbag ACS page.
 */

import { HOST_PREFIXES, ROUTES, siblingOrigin } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	const flightbag = siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG);
	throw redirect(301, `${flightbag}${ROUTES.FLIGHTBAG_ACS(params.slug)}`);
};
