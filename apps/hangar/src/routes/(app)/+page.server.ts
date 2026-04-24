import { ROUTES } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Hangar root redirects to the /sources flow diagram. Post wp-hangar-sources-v1
 * this is the primary admin landing; the interactive reference-system pipeline
 * is the first thing the operator sees.
 */
export const load: PageServerLoad = async () => {
	redirect(302, ROUTES.HANGAR_SOURCES);
};
