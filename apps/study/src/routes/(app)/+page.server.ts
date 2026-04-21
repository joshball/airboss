import { ROUTES } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Root of the (app) layout redirects to the Learning Dashboard. The root
	// URL stays as a redirect target (not a page) so a future product switcher
	// or profile home can slot in at `/` without rearranging the dashboard
	// route.
	redirect(302, ROUTES.DASHBOARD);
};
