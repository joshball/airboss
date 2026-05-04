/**
 * Permanent redirect from the legacy `/handbooks` tree to the new `/library`
 * tree. Lands as a `+server.ts` catch-all (rather than a `+page.server.ts`)
 * so the heartbeat POST endpoint at the old path
 * (`/handbooks/<doc>/<ch>/<sec>/heartbeat`) is also redirected -- a
 * `+page.server.ts` only intercepts GET page loads.
 *
 * Status 308 (Permanent Redirect) preserves the request method so an
 * in-flight POST from a stale page bundle still hits the heartbeat handler
 * after the browser follows.
 *
 * Logs each hit at `info` so on-call has telemetry for "is anyone still
 * landing on the legacy URL?" -- per `feedback_no_legacy_in_airboss`, every
 * compatibility shim wants a planned retirement signal. When this log goes
 * quiet for a release cycle, the catch-all can be removed.
 */

import { ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const log = createLogger('study:legacy-handbooks-redirect');
const PERMANENT_REDIRECT = 308;

const handler: RequestHandler = ({ params, url, locals }) => {
	const tail = params.rest ? `/${params.rest}` : '';
	const target = `${ROUTES.LIBRARY}${tail}${url.search}`;
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
