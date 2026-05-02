/**
 * Local, duck-typed mirror of `@ab/audit`'s `AuthEventEmitter` interface.
 *
 * `@ab/auth` cannot import `@ab/audit` -- the dep direction is one-way
 * (`@ab/audit -> @ab/auth -> @ab/db/@ab/constants/@ab/utils`). The audit
 * lib defines the canonical interface; this file restates the structural
 * shape so the auth lib can wire `betterAuth({ hooks })` against it.
 *
 * If `@ab/audit` ever widens the interface, this file must keep step --
 * the runtime types are checked by structural typing, not name.
 */

/** Status discriminator for failed sign-ins. Matches `AUTH_LOGIN_FAILED_OUTCOMES` in `@ab/audit`. */
export type AuthLoginFailedOutcome = 'invalid-credentials' | 'rate-limited' | 'banned' | 'bad-request' | 'server-error';

/** Per-event metadata recorded into `audit_log.metadata`. */
export interface AuthEventContext {
	ip?: string | null;
	userAgent?: string | null;
	sessionId?: string | null;
}

/** Three async methods the audit lib implements; the auth lib calls them from hooks. */
export interface AuthEventEmitter {
	onSignInSuccess(input: { userId: string; ctx: AuthEventContext }): Promise<void>;
	onSignInFailure(input: { outcome: AuthLoginFailedOutcome; status: number; ctx: AuthEventContext }): Promise<void>;
	onSignOut(input: { userId: string | null; ctx: AuthEventContext }): Promise<void>;
}
