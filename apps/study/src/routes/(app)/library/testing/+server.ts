/**
 * `/library/testing` -- legacy testing-standards index. Redirects to the
 * flightbag catalog (the ACS group lives there).
 */

import { HOST_PREFIXES, ROUTES, siblingOrigin } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const flightbag = siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG);
	throw redirect(301, `${flightbag}${ROUTES.FLIGHTBAG_HOME}`);
};
