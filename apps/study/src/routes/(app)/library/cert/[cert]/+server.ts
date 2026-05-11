/**
 * `/library/cert/[cert]` -- legacy cert-spine view.
 *
 * The flightbag catalog doesn't filter by cert today; redirect to the
 * landing with a `?cert=` query so a future filter surface can pick it up.
 */

import { HOST_PREFIXES, ROUTES, siblingOrigin } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	const flightbag = siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG);
	const cert = encodeURIComponent(params.cert);
	throw redirect(301, `${flightbag}${ROUTES.FLIGHTBAG_HOME}?cert=${cert}`);
};
