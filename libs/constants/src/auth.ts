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
	/** Trigger a password-reset email. Body: `{ email, redirectTo? }`. */
	REQUEST_PASSWORD_RESET: '/request-password-reset',
	/** Legacy alias for the password-reset request endpoint. Better-auth keeps both. */
	FORGET_PASSWORD: '/forget-password',
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

/**
 * Rate-limit policy for the better-auth surface.
 *
 * Storage is database-backed (per work package `auth-rate-limit`) so the
 * limit survives a process restart and is shared across instances behind a
 * load balancer. The window/max defaults below apply to every
 * `/api/auth/*` endpoint; tighter custom rules clamp the high-cost paths
 * (sign-in, magic-link request, password-reset request) where
 * credential-stuffing or email-flood traffic would otherwise be cheap.
 *
 * Counts are bucketed per-IP. The login form actions must propagate the
 * real client IP via `x-forwarded-for` so the rate-limit bucket isn't
 * shared by every user behind one synthetic Request.
 */
export const AUTH_RATE_LIMIT = {
	/** Default window length in seconds for any `/api/auth/*` endpoint. */
	WINDOW_SECONDS: 60,
	/** Default cap of requests per window per IP for any `/api/auth/*` endpoint. */
	MAX_REQUESTS: 30,
	/**
	 * Sign-in (`/sign-in/email`) is the brute-force surface.
	 * 5 attempts / 60 s lets a real user fat-finger their password a few times
	 * but kills a credential-stuffing script.
	 */
	SIGN_IN_WINDOW_SECONDS: 60,
	SIGN_IN_MAX_REQUESTS: 5,
	/**
	 * Magic-link request (`/sign-in/magic-link`) and password-reset trigger
	 * (`/forget-password`, `/request-password-reset`) both send email on
	 * success. Cap at 3 per 5 minutes per IP so an attacker can't flood a
	 * victim's inbox or burn through the SMTP quota.
	 */
	EMAIL_TRIGGER_WINDOW_SECONDS: 60 * 5,
	EMAIL_TRIGGER_MAX_REQUESTS: 3,
	/** Drizzle table name for the rate-limit storage. Prefixed `bauth_` like the rest of the better-auth tables. */
	TABLE_NAME: 'bauth_rate_limit',
} as const;
