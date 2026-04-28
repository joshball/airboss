/**
 * Avionics surface constants.
 *
 * Per-app cookie / storage keys for the glass-cockpit trainer at
 * `avionics.airboss.test`. Auth (cross-subdomain `bauth_session_token`)
 * and theme (cookie at `Domain=.airboss.test`) are shared across every
 * surface; everything in this file is avionics-only and scoped to the
 * `avionics.airboss.test` subdomain.
 */

import { SIM_AIRCRAFT_IDS, type SimAircraftId } from './sim';

/**
 * Per-app cookie that records the learner's selected aircraft id.
 * Scoped to `Domain=avionics.airboss.test`, not cross-subdomain --
 * sim and avionics may diverge on which aircraft they consider
 * "current" (sim pins per-scenario, avionics pins per-user).
 */
export const AVIONICS_AIRCRAFT_COOKIE = 'avionics_selected_aircraft' as const;

/** Browser storage keys used by the avionics chrome. */
export const AVIONICS_STORAGE_KEYS = {
	/**
	 * Sessionstorage flag for the unauthenticated sign-in banner.
	 * Cleared on tab close so the banner reappears on the next session
	 * start. Mirrors sim's `AUTH_BANNER_DISMISSED` shape.
	 */
	AUTH_BANNER_DISMISSED: 'airboss.avionics.authBannerDismissed',
} as const;

/**
 * Aircraft that are user-selectable on the avionics surface today.
 *
 * The aircraft selector page lists every entry from the sim BC's
 * `AIRCRAFT_REGISTRY` for affordance, but only ids in this allow-list
 * write to the `AVIONICS_AIRCRAFT_COOKIE`. Other registry members are
 * shown as "coming soon" until their FDM has been validated against
 * the avionics PFD instrument shapes.
 *
 * The C172 ships first because the PFD's airspeed-arc bands have been
 * tuned against its V-speeds. PA28 (and any future aircraft) lands by
 * adding its id here -- no other code change is required.
 */
export const AVIONICS_SELECTABLE_AIRCRAFT: readonly SimAircraftId[] = [SIM_AIRCRAFT_IDS.C172] as const;
