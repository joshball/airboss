import type { LayoutServerLoad } from './$types';

/**
 * Hydrate the appearance/theme cookies from `event.locals` to the client
 * so the picker reflects the persisted preference and the route-aware
 * resolver can compute the effective selection client-side.
 *
 * Sim has no auth, so this is the only thing the root layout needs.
 */
export const load: LayoutServerLoad = (event) => {
	return {
		appearance: event.locals.appearance,
		theme: event.locals.theme,
	};
};
