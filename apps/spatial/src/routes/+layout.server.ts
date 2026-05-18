import { studyLoginUrl } from '@ab/auth';
import type { LayoutServerLoad } from './$types';

/**
 * Spatial root layout load.
 *
 * Surfaces the appearance / theme cookies so the pre-hydration script's
 * pick is reflected client-side, plus a narrow user projection and the
 * cross-subdomain study sign-in URL. v1 is auth-optional: anonymous
 * visitors see the full viewer.
 */
export const load: LayoutServerLoad = (event) => {
	const user = event.locals.user;
	return {
		appearance: event.locals.appearance,
		theme: event.locals.theme,
		isAuthenticated: user !== null,
		user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
		signInUrl: studyLoginUrl(event),
	};
};
