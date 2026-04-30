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
 */

import { ROUTES } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const PERMANENT_REDIRECT = 308;

const handler: RequestHandler = ({ params, url }) => {
	const tail = params.rest ? `/${params.rest}` : '';
	throw redirect(PERMANENT_REDIRECT, `${ROUTES.LIBRARY}${tail}${url.search}`);
};

export const GET: RequestHandler = handler;
export const POST: RequestHandler = handler;
export const PUT: RequestHandler = handler;
export const PATCH: RequestHandler = handler;
export const DELETE: RequestHandler = handler;
export const HEAD: RequestHandler = handler;
