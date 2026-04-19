import { ROUTES } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Phase 4 will replace this with the memory dashboard. For now, land people
// on the browse page so nav hits always resolve to something real.
export const load: PageServerLoad = async () => {
	redirect(302, ROUTES.MEMORY_BROWSE);
};
