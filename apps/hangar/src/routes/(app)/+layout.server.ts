import { requireRole } from '@ab/auth';
import { countReviewQueueOpen, getOrCreateBoard } from '@ab/bc-hangar';
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
	// The Review nav entry shows a badge of items still needing review;
	// computed per request via a single indexed COUNT(*) query so a hot
	// path keystroke / navigation doesn't fan out a full board load. The
	// board's own data load (run when the user navigates to /review) is
	// where the full item list comes from -- this number is the at-a-glance
	// summary the rest of the hangar surfaces show in their nav header.
	const board = await getOrCreateBoard();
	const reviewQueueCount = await countReviewQueueOpen(board.id);
	return {
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
		},
		flightbagOrigin: siblingOrigin(event.url, HOST_PREFIXES.FLIGHTBAG),
		reviewQueueCount,
	};
};
