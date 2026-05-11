/**
 * `/library/regulations/[kind]` -- legacy regulations bucket landing.
 *
 * The flightbag doesn't host a per-bucket landing yet; redirect to the
 * flightbag catalog so the user lands somewhere sensible.
 */

import { parseRegulationKind } from '@ab/aviation';
import { HOST_PREFIXES, ROUTES, siblingOrigin } from '@ab/constants';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	const kind = parseRegulationKind(params.kind);
	if (!kind) throw error(404, `Unknown regulations kind: ${params.kind}`);
	const flightbag = siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG);
	throw redirect(301, `${flightbag}${ROUTES.FLIGHTBAG_HOME}`);
};
