import { requireRole } from '@ab/auth';
import { ROLES, ROUTES } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Hangar layout guard + identity anchor.
 *
 * Every request to hangar (except `/login` and the `/api/auth/*` endpoints
 * handled in `hooks.server.ts`) lands here first. Unauthenticated users get
 * bounced to `/login`. Authenticated users whose role isn't in the authoring
 * set get a 403. The rule lives at the root layout -- not in an `(app)`
 * group -- because hangar has no "public" routes beyond login; gating every
 * other page is the correct default.
 *
 * Per the dual-gate contract in `libs/auth/src/auth.ts`, every form action
 * that writes MUST still call `requireRole(...)` itself -- form POSTs don't
 * walk the layout load.
 */
export const load: LayoutServerLoad = async (event) => {
	// Login page is reachable without a session.
	if (event.url.pathname === ROUTES.LOGIN) {
		return { user: null };
	}

	// Unauthenticated users get bounced with a redirect-back path so login
	// returns them where they were trying to go. `requireRole` would 403
	// instead, which is wrong for "not signed in yet."
	if (!event.locals.user) {
		const { pathname, search } = event.url;
		const original = `${pathname}${search}`;
		const redirectTo = encodeURIComponent(original);
		redirect(302, `${ROUTES.LOGIN}?redirectTo=${redirectTo}`);
	}

	const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	return {
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
		},
	};
};
