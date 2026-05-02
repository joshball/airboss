/**
 * `/library/regulations` -- top-level regulations & policy index.
 *
 * Lists each `LIBRARY_REGULATIONS_KIND` bucket with the number of active
 * references inside. Buckets with zero references render as muted cards so
 * the structure stays visible while seeding catches up. The view payload is
 * built by `getRegulationsView({ view: 'landing' })`; the loader is a thin
 * adapter that authenticates the request and returns the BC payload.
 */

import { requireAuth } from '@ab/auth';
import { getRegulationsView } from '@ab/bc-study';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const view = await getRegulationsView({ view: 'landing' });
	return { buckets: view.buckets };
};
