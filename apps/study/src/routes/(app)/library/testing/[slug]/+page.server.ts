/**
 * `/library/testing/[slug]` -- one ACS / PTS publication detail.
 *
 * Loader looks up the reference by document slug and returns the BC detail
 * payload. The body of the publication is not ingested today (ACS/PTS rows
 * are umbrella references to FAA PDFs); the page renders the card chrome
 * plus an external link until the body lands.
 */

import { requireAuth } from '@ab/auth';
import { getTestingView, TestingViewNotFoundError } from '@ab/bc-study/server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const slug = event.params.slug;
	try {
		const view = await getTestingView({ view: 'testing-detail', slug });
		return {
			reference: view.reference,
			copy: view.copy,
			external: view.external,
		};
	} catch (e) {
		if (e instanceof TestingViewNotFoundError) {
			throw error(404, e.message);
		}
		throw e;
	}
};
