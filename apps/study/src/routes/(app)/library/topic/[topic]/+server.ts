/**
 * `/library/topic/[topic]` -- legacy topic-filtered library view.
 *
 * The flightbag catalog doesn't have per-topic deep-link filters today;
 * forward the legacy URL to the flightbag landing with a `?topic=` query
 * the catalog can pick up when it grows the filter surface.
 */

import { HOST_PREFIXES, ROUTES, siblingOrigin } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	const flightbag = siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG);
	const topic = encodeURIComponent(params.topic);
	throw redirect(301, `${flightbag}${ROUTES.FLIGHTBAG_HOME}?topic=${topic}`);
};
