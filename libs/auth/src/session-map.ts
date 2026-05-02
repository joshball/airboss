import { type AuthUser, parseRole } from './auth';

/**
 * Minimal shape of `auth.api.getSession()` return value that this lib needs.
 *
 * better-auth's actual return type is generic over its plugin set; we only
 * read the union of fields populated by the `admin` plugin plus our two
 * `additionalFields` (firstName / lastName). Typing it locally keeps this
 * helper free of a direct better-auth import (the lib already pulls
 * better-auth in `server.ts`, so the dep is fine, but keeping the contract
 * explicit makes the test boundary easy to mock).
 *
 * `firstName` / `lastName` arrive as `unknown` because better-auth types
 * additionalFields as plain `Record<string, unknown>` on the session
 * payload; the cast happens once at this boundary so callers never have to
 * widen-then-narrow.
 */
export interface BetterAuthSessionPayload {
	session: {
		id: string;
		userId: string;
	} | null;
	user:
		| ({
				id: string;
				email: string;
				name: string;
				emailVerified: boolean;
				role?: string | null;
				image?: string | null;
				banned?: boolean | null;
				createdAt: Date;
				updatedAt: Date;
		  } & Record<string, unknown>)
		| null;
}

/**
 * Map a better-auth `getSession()` payload to the shared `AuthUser` shape
 * stored in `event.locals.user` by every app's `hooks.server.ts`.
 *
 * Returns `null` when the payload is null or has no user (anonymous request).
 * Routes `role` through `parseRole` so unknown strings collapse to `null` and
 * downstream `requireRole` checks fail closed.
 *
 * The `firstName` / `lastName` cast happens here once, at the trust boundary
 * between better-auth's `Record<string, unknown>` additionalFields and the
 * typed `AuthUser` consumed by the rest of the app.
 */
export function mapBetterAuthSession(payload: BetterAuthSessionPayload | null): AuthUser | null {
	const user = payload?.user;
	if (!user) return null;

	return {
		id: user.id,
		email: user.email,
		name: user.name,
		firstName: (user.firstName as string | undefined) ?? '',
		lastName: (user.lastName as string | undefined) ?? '',
		emailVerified: user.emailVerified,
		// Narrow better-auth's free-text role field to the closed `Role` union;
		// non-matching strings (legacy seed data, custom roles) collapse to null
		// so downstream `requireRole` checks fail closed.
		role: parseRole(user.role),
		image: user.image ?? null,
		banned: user.banned ?? null,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	};
}
