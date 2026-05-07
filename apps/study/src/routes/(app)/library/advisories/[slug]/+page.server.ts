/**
 * `/library/advisories/[slug]` -- per-bulletin detail.
 *
 * Loader is a thin adapter: forward the slug to the BC aggregator and translate
 * `AdvisoriesViewNotFoundError` to a SvelteKit 404. The view-shape computation
 * lives in `libs/bc/study/src/advisories.ts`.
 */

import { requireAuth } from '@ab/auth';
import { AdvisoriesViewNotFoundError, getAdvisoriesView } from '@ab/bc-study/server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const slug = event.params.slug;
	try {
		const view = await getAdvisoriesView({ view: 'advisories-detail', slug });
		return {
			bulletin: view.bulletin,
			kindCopy: view.kindCopy,
		};
	} catch (e) {
		if (e instanceof AdvisoriesViewNotFoundError) {
			throw error(404, e.message);
		}
		throw e;
	}
};
