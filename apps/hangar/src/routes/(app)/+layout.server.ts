import { requireRole } from '@ab/auth';
import { countReviewQueueOpen, getBoard } from '@ab/bc-hangar';
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
 *
 * Nav-badge contract: read the singleton review board via the read-only
 * `getBoard()` helper. We deliberately avoid `getOrCreateBoard()` here so
 * a non-admin user (AUTHOR / OPERATOR) never triggers admin-grade
 * default-column / default-kind seeding by being the first to hit any
 * authenticated page after a clean DB. If the board hasn't been seeded
 * yet, the badge shows `0`; once an admin loads `/review` (or the loader
 * runs), seeding lands and subsequent requests show the real count.
 */
export const load: LayoutServerLoad = async (event) => {
	const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	// Fetch the board (if seeded) and compute the open count concurrently.
	// Independent reads run in parallel rather than serialising; the count
	// can't dispatch without the board id, so it gates on the board read.
	const board = await getBoard();
	const reviewQueueCount = board === null ? 0 : await countReviewQueueOpen(board.id);
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
