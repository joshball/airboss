import { studyLoginUrl } from '@ab/auth';
import { appOrigins } from '@ab/constants';
import type { LayoutServerLoad } from './$types';

/**
 * Pass appearance + theme cookies down so the root layout can hydrate the
 * pre-hydration markers without a flash. Flightbag is auth-optional: the
 * AppHeader renders the account menu when `user` is set and a Sign in
 * button (linking to study) when it isn't.
 *
 * Also derives the cross-subdomain origins for every surface app so the
 * shared `AppHeader` brand dropdown can offer one-click app switching.
 */
export const load: LayoutServerLoad = (event) => {
	const user = event.locals.user;
	return {
		appearance: event.locals.appearance,
		theme: event.locals.theme,
		user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
		signInUrl: studyLoginUrl(event),
		appOrigins: appOrigins(event.url),
	};
};
