import { requireAuth } from '@ab/auth';
import { appOrigins, HOST_PREFIXES, siblingOrigin } from '@ab/constants';
import type { LayoutServerLoad } from './$types';

/**
 * (app) group guard + identity anchor.
 *
 * Runs `requireAuth` once at the layout level so every child route under the
 * app chrome is signed-in-only without each page re-running the guard. The
 * chrome (+layout.svelte) surfaces the returned `user` in the top-right
 * identity menu alongside the Sign out form action.
 *
 * We project a narrow view of `AuthUser` to the client -- id, name, email,
 * role. Anything sensitive stays on the server.
 *
 * Also derives the cross-subdomain flightbag origin so the top-nav
 * "Flightbag" link can target the matching env's flightbag app
 * (`*.airboss.test` in dev, `*.air-boss.org` in prod) without a
 * hardcoded URL.
 */
export const load: LayoutServerLoad = async (event) => {
	const user = requireAuth(event);
	return {
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
		},
		appearance: event.locals.appearance,
		theme: event.locals.theme,
		flightbagOrigin: siblingOrigin(event.url, HOST_PREFIXES.FLIGHTBAG),
		appOrigins: appOrigins(event.url),
	};
};
