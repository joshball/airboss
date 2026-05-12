/**
 * Pure types + constants for the better-auth audit emitter. Split out from
 * `auth-events.ts` so the runtime barrel can value-re-export the discriminator
 * and shape types without dragging `@ab/db/connection` into the browser.
 *
 * The DB-backed implementation (`createAuditAuthEventEmitter`) lives in
 * `auth-events.ts` and is exported from `@ab/audit/server`.
 */

/** Discriminator for failed sign-in audit rows. Closed set keeps queries cheap. */
export const AUTH_LOGIN_FAILED_OUTCOMES = {
	/** better-auth returned 401 (wrong password / unknown account / unverified). */
	INVALID_CREDENTIALS: 'invalid-credentials',
	/** better-auth returned 429 -- rate limit kicked in. */
	RATE_LIMITED: 'rate-limited',
	/** better-auth returned 403 -- account is banned. */
	BANNED: 'banned',
	/** better-auth returned 4xx other than the above. */
	BAD_REQUEST: 'bad-request',
	/** better-auth or downstream threw 5xx. */
	SERVER_ERROR: 'server-error',
} as const;

export type AuthLoginFailedOutcome = (typeof AUTH_LOGIN_FAILED_OUTCOMES)[keyof typeof AUTH_LOGIN_FAILED_OUTCOMES];

/** Per-event metadata captured into `audit_log.metadata`. */
export interface AuthEventContext {
	/** Source IP, derived from `x-forwarded-for` or socket peer. */
	ip?: string | null;
	/** Browser / client ua string. Truncated by the caller if needed. */
	userAgent?: string | null;
	/** Better-auth session id, only meaningful for success/logout. */
	sessionId?: string | null;
}

/**
 * Contract `@ab/auth/server.ts` consumes when wiring better-auth hooks. The
 * shape is intentionally narrow (three async methods) so the auth lib stays
 * unaware of the audit schema.
 */
export interface AuthEventEmitter {
	onSignInSuccess(input: { userId: string; ctx: AuthEventContext }): Promise<void>;
	onSignInFailure(input: { outcome: AuthLoginFailedOutcome; status: number; ctx: AuthEventContext }): Promise<void>;
	onSignOut(input: { userId: string | null; ctx: AuthEventContext }): Promise<void>;
}
