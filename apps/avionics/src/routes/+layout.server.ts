import {
	AVIONICS_AIRCRAFT_COOKIE,
	HOST_PREFIXES,
	ROUTES,
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
 * - `isAuthenticated` plus the cross-subdomain study sign-in URL so the
 *   unauthenticated banner in the root layout renders server-side (no
 *   flash) and links to study without a hardcoded origin.
 * - `selectedAircraftId` from the per-app `avionics_selected_aircraft`
 *   cookie (`Domain=avionics.airboss.test`). Defaults to C172 when the
 *   cookie is missing or carries an unknown id. Validated against
 *   `SIM_AIRCRAFT_IDS` so a tampered cookie cannot widen the type.
 */
export const load: LayoutServerLoad = (event) => {
	const studyOrigin = siblingOrigin(event.url, HOST_PREFIXES.STUDY);
	const selectedAircraftId = resolveSelectedAircraftId(event.cookies.get(AVIONICS_AIRCRAFT_COOKIE));
	return {
		appearance: event.locals.appearance,
		theme: event.locals.theme,
		isAuthenticated: event.locals.user !== null,
		studyLoginUrl: `${studyOrigin}${ROUTES.LOGIN}`,
		selectedAircraftId,
	};
};
