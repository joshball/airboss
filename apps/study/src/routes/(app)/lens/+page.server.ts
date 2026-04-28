import { ROUTES } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// `/lens` lands on the handbook lens index by default. Direct entry to
// /lens isn't reached from the nav (the picker disambiguates), but a typed
// URL or a stale link should resolve sensibly rather than 404.
export const load: PageServerLoad = () => {
	throw redirect(303, ROUTES.LENS_HANDBOOK);
};
