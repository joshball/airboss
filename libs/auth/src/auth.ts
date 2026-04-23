import { ROUTES, type Role } from '@ab/constants';
import { error, type RequestEvent, redirect } from '@sveltejs/kit';

/** Session shape stored in locals by hooks.server.ts. */
export interface AuthSession {
	id: string;
	userId: string;
	expiresAt: Date;
}

/** User shape stored in locals by hooks.server.ts. */
export interface AuthUser {
	id: string;
	email: string;
	name: string;
	firstName: string;
	lastName: string;
	emailVerified: boolean;
	role: Role | null;
	image: string | null;
	banned: boolean | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * DUAL-GATE AUTH CONTRACT -- DO NOT REMOVE.
 *
 * Every protected route in `apps/study/src/routes/(app)/**` runs `requireAuth`
 * TWICE: once in `(app)/+layout.server.ts` (layout gate) and once in every
 * `+page.server.ts` load + every form action (per-page gate).
 *
 * Why the per-page gate is load-bearing and cannot be dropped on the theory
 * that "the layout already checked":
 *
 *   1. Form-action POSTs do not walk the layout load. SvelteKit dispatches
 *      actions directly; the layout guard never runs for a POST to
 *      `/plans/123?/archive`. Without the per-page `requireAuth` call, an
 *      unauthenticated request can hit the action, the BC sees
 *      `locals.user = undefined`, and either 500s or -- worse -- pulls a
 *      user id from form data.
 *   2. Session invalidation between the layout load and the action. A user
 *      signing out in another tab can turn a once-valid `locals.user` into
 *      undefined mid-flow; the per-page call catches it.
 *   3. Routes outside `(app)` that are independently protected (admin,
 *      verified-email-only flows) need their own explicit guard -- the
 *      layout path doesn't cover them.
 *
 * Always capture the returned user: `const user = requireAuth(event);`.
 * Passing through `event.locals.user!` is a code smell: use the helper's
 * return value so the no-user branch stays provably unreachable.
 */

/**
 * Guard: redirect to login if not authenticated.
 * Reads session from locals (set by hooks.server.ts).
 *
 * Preserves the full original URL (pathname + query string + hash) as the
 * `redirectTo` param so a bounced request lands back exactly where the user
 * was trying to go. `event.url.pathname` alone strips `?flight-phase=...`
 * and similar query state.
 */
export function requireAuth(event: RequestEvent): AuthUser {
	const user = event.locals.user;
	if (!user) {
		const { pathname, search, hash } = event.url;
		const original = `${pathname}${search}${hash}`;
		const redirectTo = encodeURIComponent(original);
		redirect(302, `${ROUTES.LOGIN}?redirectTo=${redirectTo}`);
	}
	return user;
}

/**
 * Guard: require one of the specified roles.
 * Reads user from locals (set by hooks.server.ts).
 */
export function requireRole(event: RequestEvent, ...roles: Role[]): AuthUser {
	const user = requireAuth(event);
	if (!user.role || !(roles as readonly string[]).includes(user.role)) {
		error(403, 'Forbidden');
	}
	return user;
}

/**
 * Chokepoint for flows that require a verified email address. Not wired into
 * any route today -- no current route demands `emailVerified === true` -- but
 * declared here so the first admin / sensitive-write route adds one line
 * instead of writing the check from scratch. Use after `requireAuth`:
 *
 *   const user = requireAuth(event);
 *   requireVerifiedEmail(user);
 *
 * Throws a 403 `error(...)` rather than a redirect because a verified-email
 * wall is typically an admin surface -- bouncing to login would be the wrong
 * UX. Callers can catch and render a "please verify your email" page if they
 * prefer.
 */
export function requireVerifiedEmail(user: AuthUser): AuthUser {
	if (!user.emailVerified) {
		error(403, 'Email verification required');
	}
	return user;
}
