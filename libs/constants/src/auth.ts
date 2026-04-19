/**
 * Better-auth related constants.
 * Endpoints, cookie names, and provider identifiers shared across the auth stack.
 */

/** Better-auth HTTP endpoints, appended to ROUTES.API_AUTH. */
export const BETTER_AUTH_ENDPOINTS = {
	SIGN_IN_EMAIL: '/sign-in/email',
	SIGN_OUT: '/sign-out',
	SIGN_UP_EMAIL: '/sign-up/email',
	MAGIC_LINK: '/sign-in/magic-link',
	VERIFY_EMAIL: '/verify-email',
} as const;

export type BetterAuthEndpoint = (typeof BETTER_AUTH_ENDPOINTS)[keyof typeof BETTER_AUTH_ENDPOINTS];

/** Cookie names better-auth writes during session management. */
export const BETTER_AUTH_COOKIES = {
	SESSION_TOKEN: 'better-auth.session_token',
	SESSION_DATA: 'better-auth.session_data',
} as const;

export type BetterAuthCookie = (typeof BETTER_AUTH_COOKIES)[keyof typeof BETTER_AUTH_COOKIES];

/** Provider identifiers used in bauth_account rows. */
export const BETTER_AUTH_PROVIDERS = {
	CREDENTIAL: 'credential',
} as const;

export type BetterAuthProvider = (typeof BETTER_AUTH_PROVIDERS)[keyof typeof BETTER_AUTH_PROVIDERS];

/** Drizzle adapter provider string for Postgres. */
export const DB_ADAPTER_PROVIDER = 'pg' as const;
