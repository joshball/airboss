import type { LayoutServerLoad } from './$types';

/**
 * Pass appearance + theme cookies down so the root layout can hydrate the
 * pre-hydration markers without a flash. Flightbag has no auth, no per-app
 * cookies beyond the shared theme set.
 */
export const load: LayoutServerLoad = (event) => ({
	appearance: event.locals.appearance,
	theme: event.locals.theme,
});
