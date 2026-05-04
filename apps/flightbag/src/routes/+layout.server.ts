import { studyLoginUrl } from '@ab/auth';
import type { LayoutServerLoad } from './$types';

/**
 * Pass appearance + theme cookies down so the root layout can hydrate the
 * pre-hydration markers without a flash. Flightbag is auth-optional: the
 * AppHeader renders the account menu when `user` is set and a Sign in
 * button (linking to study) when it isn't.
 */
export const load: LayoutServerLoad = (event) => {
	const user = event.locals.user;
	return {
		appearance: event.locals.appearance,
		theme: event.locals.theme,
		user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
		signInUrl: studyLoginUrl(event),
	};
};
