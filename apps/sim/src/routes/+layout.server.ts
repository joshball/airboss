import { studyLoginUrl } from '@ab/auth';
import { HOST_PREFIXES, siblingOrigin } from '@ab/constants';
import type { LayoutServerLoad } from './$types';

/**
 * Hydrate the appearance/theme cookies from `event.locals` to the client
 * so the picker reflects the persisted preference and the route-aware
 * resolver can compute the effective selection client-side.
 *
 * Also surfaces:
 * - The signed-in user as a narrow projection so the shared `AppHeader`
 *   can render the account menu. Sim is auth-optional, so `user` is
 *   `null` for visitors -- AppHeader degrades to a Sign in button when
 *   `signInUrl` is set.
 * - `signInUrl` -- cross-subdomain study sign-in URL with a `redirectTo`
 *   pointing back at the visitor's current URL. The unauthenticated
 *   banner in the root layout shares this URL with the AppHeader.
 * - `flightbagOrigin` -- cross-subdomain flightbag link target for the
 *   shared `AppHeader` flightbag link.
 */
export const load: LayoutServerLoad = (event) => {
	const user = event.locals.user;
	return {
		appearance: event.locals.appearance,
		theme: event.locals.theme,
		isAuthenticated: user !== null,
		user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
		signInUrl: studyLoginUrl(event),
		// Cross-subdomain link target for the shared `AppHeader` flightbag link.
		flightbagOrigin: siblingOrigin(event.url, HOST_PREFIXES.FLIGHTBAG),
	};
};
