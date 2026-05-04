import { ROUTES } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Root of the (app) layout redirects to the Study home (study-home WP).
	// Pre-WP this targeted `/dashboard`; that surface is preserved as the
	// "Stats" power-user view at the same URL. Keeping `/` as a redirect
	// (not a page) leaves room for a future product switcher to slot in
	// without rearranging the home route.
	redirect(302, ROUTES.STUDY);
};
