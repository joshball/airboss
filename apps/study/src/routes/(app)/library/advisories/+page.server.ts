/**
 * `/library/advisories` -- SAFO + InFO bulletin landing page.
 *
 * Loader is a thin adapter: call the `getAdvisoriesView` BC aggregator and
 * return the landing payload. The view-shape computation lives in
 * `libs/bc/study/src/advisories.ts`.
 */

import { requireAuth } from '@ab/auth';
import { getAdvisoriesView } from '@ab/bc-study/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const view = await getAdvisoriesView({ view: 'advisories-landing' });
	return {
		buckets: view.buckets,
	};
};
