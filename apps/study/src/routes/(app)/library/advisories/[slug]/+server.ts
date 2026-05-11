/**
 * `/library/advisories/[slug]` -- legacy per-bulletin detail. 301s to the
 * flightbag SAFO / InFO reader for the matching bulletin.
 *
 * Slug shape is `safo-23001` / `info-23001`; the flightbag URL strips the
 * kind prefix (`/safo/<id>`, `/info/<id>`).
 */

import { HOST_PREFIXES, ROUTES, siblingOrigin } from '@ab/constants';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	const slug = params.slug.toLowerCase();
	const flightbag = siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG);
	let path: string;
	if (slug.startsWith('safo-')) {
		path = ROUTES.FLIGHTBAG_SAFO(slug.slice('safo-'.length));
	} else if (slug.startsWith('info-')) {
		path = ROUTES.FLIGHTBAG_INFO(slug.slice('info-'.length));
	} else {
		throw error(404, `Unknown advisory slug: ${slug}`);
	}
	throw redirect(301, `${flightbag}${path}`);
};
