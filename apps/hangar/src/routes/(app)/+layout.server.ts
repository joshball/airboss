import { requireRole } from '@ab/auth';
import { HOST_PREFIXES, ROLES, siblingOrigin } from '@ab/constants';
import type { LayoutServerLoad } from './$types';

/**
 * (app) role gate. The root layout already bounces anonymous users to
 * /login; this load guarantees the request carries a signed-in
 * AUTHOR | OPERATOR | ADMIN user, which is the authoring-set contract
 * for every hangar surface.
 *
 * Per the dual-gate rule in `libs/auth/src/auth.ts`, every form action
 * that writes MUST still call `requireRole(...)` itself -- form POSTs
 * don't walk the layout load.
 *
 * Also derives the cross-subdomain flightbag origin so the shared
 * `AppHeader` flightbag link can target the matching env's flightbag
 * app without a hardcoded URL.
 */
export const load: LayoutServerLoad = async (event) => {
	const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	return {
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
		},
		flightbagOrigin: siblingOrigin(event.url, HOST_PREFIXES.FLIGHTBAG),
	};
};
