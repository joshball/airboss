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
 * Guard: redirect to login if not authenticated.
 * Reads session from locals (set by hooks.server.ts).
 */
export function requireAuth(event: RequestEvent): AuthUser {
	const user = event.locals.user;
	if (!user) {
		const redirectTo = encodeURIComponent(event.url.pathname);
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
