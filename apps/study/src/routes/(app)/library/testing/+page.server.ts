/**
 * `/library/testing` -- top-level testing standards index (ACS + PTS).
 *
 * Lists each `LIBRARY_TESTING_KIND` bucket (ACS, PTS) with the number of
 * active publications inside, plus the publication cards themselves so the
 * page renders in one server round-trip. Buckets with zero references render
 * as muted cards so the structure stays visible while seeding catches up.
 *
 * The view payload is built by `getTestingView({ view: 'testing-landing' })`;
 * the loader is a thin adapter that authenticates the request and returns
 * the BC payload.
 */

import { requireAuth } from '@ab/auth';
import { getTestingView } from '@ab/bc-study/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const view = await getTestingView({ view: 'testing-landing' });
	return {
		buckets: view.buckets,
		publications: view.publications,
	};
};
