/**
 * Avionics surface constants.
 *
 * Per-app cookie / storage keys for the glass-cockpit trainer at
 * `avionics.airboss.test`. Auth (cross-subdomain `bauth_session_token`)
 * and theme (cookie at `Domain=.airboss.test`) are shared across every
 * surface; everything in this file is avionics-only and scoped to the
 * `avionics.airboss.test` subdomain.
 */

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
