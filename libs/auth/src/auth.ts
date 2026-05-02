import { QUERY_PARAMS, ROLE_VALUES, ROUTES, type Role } from '@ab/constants';
import { error, type RequestEvent, redirect } from '@sveltejs/kit';

/**
 * Session shape stored in locals by hooks.server.ts.
 *
 * `expiresAt` is intentionally NOT included: better-auth's session validation
 * already enforces expiry on every request, and no caller in airboss reads it
 * off `event.locals.session`. If a future flow needs "re-auth before sensitive
 * write" semantics, add a `requireFreshSession(event, maxAgeSeconds)` helper
 * here and re-introduce the field with that single consumer in mind.
 */
export interface AuthSession {
	id: string;
	userId: string;
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
 * Validate an unknown role string against `ROLE_VALUES`. Returns a typed `Role`
 * for known values, `null` for `null` / `undefined` / unknown strings.
 *
 * Use at the hook boundary when hydrating `event.locals.user.role` from
 * better-auth: the `bauth_user.role` column is plain `text` (better-auth manages
 * writes to that table, so we don't add a CHECK there ourselves), so a stray
 * DB write or third-party integration could land any string. Without this guard
 * the `role: (raw as Role) ?? null` cast launders unknown values into the
 * `Role` type and downstream `=== ROLES.ADMIN` comparisons silently disagree
 * with `requireRole`'s `includes` check.
 */
export function parseRole(raw: unknown): Role | null {
	if (typeof raw !== 'string') return null;
	return (ROLE_VALUES as readonly string[]).includes(raw) ? (raw as Role) : null;
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
 * Preserves the pathname + query string as `redirectTo` so a bounced request
 * lands back where the user was trying to go. Fragments are never sent to the
 * server (browsers strip them), and SvelteKit now forbids reading
 * `event.url.hash` on the server -- any fragment must be restored client-side
 * if needed.
 *
 * Uses 303 (See Other) so POST -> redirect -> GET is unambiguous per RFC 7231;
 * matches the login action's own success redirect.
 */
export function requireAuth(event: RequestEvent): AuthUser {
	const user = event.locals.user;
	if (!user) {
		const { pathname, search } = event.url;
		const original = `${pathname}${search}`;
		const redirectTo = encodeURIComponent(original);
		redirect(303, `${ROUTES.LOGIN}?${QUERY_PARAMS.REDIRECT_TO}=${redirectTo}`);
	}
	return user;
}

/**
 * Guard: require one of the specified roles.
 *
 * Reads user from locals (set by hooks.server.ts). If the user is not
 * authenticated, redirects to `/login` first (via `requireAuth`); otherwise
 * throws 403 (`error(...)`) if the user has no role or the role does not
 * match any of the supplied set.
 */
export function requireRole(event: RequestEvent, ...roles: Role[]): AuthUser {
	const user = requireAuth(event);
	if (!user.role || !(roles as readonly string[]).includes(user.role)) {
		error(403, 'Forbidden');
	}
	return user;
}
