import { studyLoginUrl } from '@ab/auth';
import {
	AVIONICS_AIRCRAFT_COOKIE,
	appOrigins,
	HOST_PREFIXES,
	SIM_AIRCRAFT_IDS,
	type SimAircraftId,
	siblingOrigin,
} from '@ab/constants';
import type { LayoutServerLoad } from './$types';

const VALID_AIRCRAFT_IDS = new Set<string>(Object.values(SIM_AIRCRAFT_IDS));

function resolveSelectedAircraftId(raw: string | undefined): SimAircraftId {
	if (raw && VALID_AIRCRAFT_IDS.has(raw)) {
		return raw as SimAircraftId;
	}
	return SIM_AIRCRAFT_IDS.C172;
}

/**
 * Hydrate the appearance/theme cookies from `event.locals` to the client
 * so the picker reflects the persisted preference and the route-aware
 * resolver can compute the effective selection client-side.
 *
 * Also surfaces:
 * - `user` -- narrow projection so the shared `AppHeader` can render the
 *   account menu. Avionics is auth-optional; when `user` is null the
 *   header degrades to a Sign in button via `signInUrl`.
 * - `signInUrl` -- cross-subdomain study sign-in URL with a `redirectTo`
 *   pointing back at the visitor's current URL. The unauthenticated
 *   banner shares this URL with the AppHeader.
 * - `selectedAircraftId` from the per-app `avionics_selected_aircraft`
 *   cookie (`Domain=avionics.airboss.test`). Defaults to C172 when the
 *   cookie is missing or carries an unknown id. Validated against
 *   `SIM_AIRCRAFT_IDS` so a tampered cookie cannot widen the type.
 * - `flightbagOrigin` -- cross-subdomain flightbag link target.
 */
export const load: LayoutServerLoad = (event) => {
	const selectedAircraftId = resolveSelectedAircraftId(event.cookies.get(AVIONICS_AIRCRAFT_COOKIE));
	const user = event.locals.user;
	return {
		appearance: event.locals.appearance,
		theme: event.locals.theme,
		isAuthenticated: user !== null,
		user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
		signInUrl: studyLoginUrl(event),
		selectedAircraftId,
		// Cross-subdomain link target for the shared `AppHeader` flightbag link.
		flightbagOrigin: siblingOrigin(event.url, HOST_PREFIXES.FLIGHTBAG),
		appOrigins: appOrigins(event.url),
	};
};
