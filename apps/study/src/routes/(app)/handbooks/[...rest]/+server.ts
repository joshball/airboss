/**
 * Permanent redirect from the legacy `/handbooks/*` tree to the flightbag.
 *
 * Pre-pivot the study app served handbooks at `/handbooks/<slug>/<chapter>/<section>`;
 * post-pivot the URL space lives in the flightbag, served on its own
 * subdomain. This catch-all 308s to the equivalent flightbag origin so any
 * stale bookmark or cached link still lands on real content.
 *
 * The legacy heartbeat POST endpoint (`/handbooks/<doc>/<ch>/<sec>/heartbeat`)
 * doesn't have a flightbag counterpart at the same URL shape -- the flightbag
 * heartbeat is path-keyed on the section id (`/api/section/<id>/heartbeat`).
 * Stale heartbeat POSTs are silently dropped by the redirect: the browser
 * follows to a 404 on the flightbag side, the ticker's first-failed-POST
 * stop kicks in, and the page either reloads (acquiring the new endpoint) or
 * the tab is already discarded.
 *
 * Logs each hit at `info` so on-call has telemetry for "is anyone still
 * landing on the legacy URL?". When this log goes quiet for a release cycle,
 * the catch-all can be removed.
 */

import { HOST_PREFIXES, ROUTES, siblingOrigin } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const log = createLogger('study:legacy-handbooks-redirect');
const PERMANENT_REDIRECT = 308;

const handler: RequestHandler = ({ params, url, locals }) => {
	const flightbag = siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG);
	// `params.rest` is the path tail after `/handbooks/`. Empty -> flightbag
	// home. Non-empty -> `/handbook/<tail>` on the flightbag (note the
	// singular `handbook` -- the flightbag's handbook landing template uses
	// the singular form, matching `ROUTES.FLIGHTBAG_HANDBOOK`).
	const tail = params.rest ? `/handbook/${params.rest}` : ROUTES.FLIGHTBAG_HOME;
	const target = `${flightbag}${tail}${url.search}`;
	log.info('legacy handbooks redirect', {
		requestId: locals.requestId,
		userId: locals.user?.id ?? null,
		metadata: { from: url.pathname, to: target },
	});
	throw redirect(PERMANENT_REDIRECT, target);
};

export const GET: RequestHandler = handler;
export const POST: RequestHandler = handler;
export const PUT: RequestHandler = handler;
export const PATCH: RequestHandler = handler;
export const DELETE: RequestHandler = handler;
export const HEAD: RequestHandler = handler;
