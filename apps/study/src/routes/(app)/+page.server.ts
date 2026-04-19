import { ROUTES } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Root of the (app) layout isn't a destination yet -- send people to the
	// Memory surface, which is the only product currently shipped.
	redirect(302, ROUTES.MEMORY);
};
