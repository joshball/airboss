import { HOST_PREFIXES, ROUTES, siblingOrigin } from '@ab/constants';
import type { LayoutServerLoad } from './$types';

/**
 * Hydrate the appearance/theme cookies from `event.locals` to the client
 * so the picker reflects the persisted preference and the route-aware
 * resolver can compute the effective selection client-side.
 *
 * Also surfaces whether the visitor is authenticated, plus the
 * cross-subdomain study sign-in URL. The unauthenticated banner in the
 * root layout reads both so it can render server-side (no flash) and
 * link to study without a hardcoded origin -- the origin is derived
 * from the live request URL, so dev (`*.airboss.test`) and prod
 * (`*.air-boss.org`) both work without separate config.
 */
export const load: LayoutServerLoad = (event) => {
	const studyOrigin = siblingOrigin(event.url, HOST_PREFIXES.STUDY);
	return {
		appearance: event.locals.appearance,
		theme: event.locals.theme,
		isAuthenticated: event.locals.user !== null,
		studyLoginUrl: `${studyOrigin}${ROUTES.LOGIN}`,
	};
};
