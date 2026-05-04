/**
 * Placeholder server load for the Flight tile target.
 *
 * The real flight-logging surface ships in WP 2 (`flight-evidence-and-cfi-feedback`).
 * The page is auth-gated like every other `(app)` route; no other data is
 * loaded -- the body is a static banner.
 */

import { requireAuth } from '@ab/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	return {};
};
