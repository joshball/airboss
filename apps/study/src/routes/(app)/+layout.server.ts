import { requireAuth } from '@ab/auth';
import type { LayoutServerLoad } from './$types';

/**
 * (app) group guard + identity anchor.
 *
 * Runs `requireAuth` once at the layout level so every child route under the
 * app chrome is signed-in-only without each page re-running the guard. The
 * chrome (+layout.svelte) surfaces the returned `user` in the top-right
 * identity menu alongside the Sign out form action.
 *
 * We project a narrow view of `AuthUser` to the client -- id, name, email,
 * role. Anything sensitive stays on the server.
 */
export const load: LayoutServerLoad = async (event) => {
	const user = requireAuth(event);
	return {
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
		},
	};
};
