/**
 * Better-auth `hooks.before` / `hooks.after` middlewares that fan auth
 * lifecycle events out to an injected `AuthEventEmitter`.
 *
 * Closes the chunk-3 review convergent finding "no audit emission on auth
 * events" -- sign-in success, sign-in failure, and sign-out all need to land
 * in `audit.audit_log` so the hangar admin surface can answer "who signed in
 * last hour", "is this email being brute forced", and "did the admin
 * actually log out before the role change".
 *
 * Why hooks instead of writing audit rows from each app's login form
 * action: doing it in the auth lib closes the gap once (every app that calls
 * `createAuth` is covered automatically) AND covers paths the form action
 * never sees -- direct `auth.api.signInEmail` calls from server code, the
 * future magic-link sign-in path, and the future programmatic sign-out from
 * the admin "revoke session" surface. Form-action-side auditing would have
 * to be repeated at every entry point.
 *
 * Dep direction: `@ab/auth` cannot import `@ab/audit` (one-way: audit
 * depends on auth). The `AuthEventEmitter` interface is duck-typed locally
 * here so the auth lib stays unaware of the audit schema. Apps wire
 * `createAuditAuthEventEmitter()` from `@ab/audit` into `createAuth`'s
 * `authEventEmitter` option.
 *
 * Capture mechanics:
 *
 *   - Sign-in: better-auth populates `ctx.context.newSession` on success and
 *     leaves `ctx.context.returned` as an `APIError` on failure. The `after`
 *     hook reads both. Status comes from the returned APIError.
 *   - Sign-out: better-auth deletes the session row inside the endpoint, so
 *     the user id has to be captured BEFORE the deletion. The `before` hook
 *     resolves the session via the signed cookie and stashes the user id on
 *     a per-request map keyed by the shared `AuthContext` reference (the
 *     same object reaches both before and after hooks for one request --
 *     see `to-auth-endpoints.mjs` in better-auth). The `after` hook reads
 *     the captured id and emits the audit row only if the actual delete
 *     reported success (status < 400).
 */

import { BETTER_AUTH_ENDPOINTS } from '@ab/constants';
import { createAuthMiddleware, getIp, isAPIError } from 'better-auth/api';
import type { AuthEventContext, AuthEventEmitter, AuthLoginFailedOutcome } from './audit-events-contract';

/** Symbol-keyed slot on the per-request auth context that survives across hooks. */
const SIGN_OUT_USER_ID = Symbol('airboss.audit.signOutUserId');

interface CapturedAuthContext {
	[SIGN_OUT_USER_ID]?: string | null;
}

function recordSignOutUserId(ctxContext: object, userId: string | null): void {
	(ctxContext as CapturedAuthContext)[SIGN_OUT_USER_ID] = userId;
}

function readSignOutUserId(ctxContext: object): string | null | undefined {
	return (ctxContext as CapturedAuthContext)[SIGN_OUT_USER_ID];
}

/** Map a better-auth response status to our closed `AUTH_LOGIN_FAILED_OUTCOMES` set. */
function classifyLoginFailure(status: number): AuthLoginFailedOutcome {
	if (status === 429) return 'rate-limited';
	if (status === 403) return 'banned';
	if (status === 401) return 'invalid-credentials';
	if (status >= 500) return 'server-error';
	return 'bad-request';
}

interface BetterAuthHookContext {
	path: string;
	headers?: Headers;
	context: {
		options: unknown;
		newSession?: { session: { id: string }; user: { id: string } } | null;
		returned?: unknown;
		internalAdapter: {
			findSession(token: string): Promise<{ session: { id: string; userId: string } } | null>;
		};
		authCookies: { sessionToken: { name: string } };
		secret: string;
	};
	getSignedCookie(name: string, secret: string): Promise<string | undefined>;
}

function extractCtx(ctx: BetterAuthHookContext): AuthEventContext {
	const headers = ctx.headers ?? new Headers();
	// `getIp` accepts Headers directly; `options` is the better-auth options bag.
	const ip = getIp(headers, ctx.context.options as Parameters<typeof getIp>[1]);
	return {
		ip: ip ?? null,
		userAgent: headers.get('user-agent'),
	};
}

function isResponseObjectWithStatus(value: unknown): value is { status?: number; statusCode?: number } {
	return typeof value === 'object' && value !== null;
}

/** Pull HTTP status out of `ctx.context.returned`, which is either an APIError or the JSON body. */
function statusFromReturned(returned: unknown): number {
	if (isAPIError(returned)) {
		const err = returned as { statusCode?: number; status?: number };
		return err.statusCode ?? err.status ?? 500;
	}
	if (isResponseObjectWithStatus(returned)) {
		// Plugin paths sometimes return `{ status, body }`; tolerate that shape.
		return returned.status ?? returned.statusCode ?? 200;
	}
	return 200;
}

/**
 * Build `{ before, after }` better-auth hook middlewares that route auth
 * lifecycle events through `emitter`. Each emitter call is wrapped in a
 * try/catch -- a failed audit write must NOT 500 the user-facing sign-in or
 * sign-out request. We log via better-auth's logger so the admin can still
 * see the failure in the request log.
 */
export function createAuthAuditHooks(emitter: AuthEventEmitter) {
	const before = createAuthMiddleware(async (ctx) => {
		const hookCtx = ctx as unknown as BetterAuthHookContext & {
			context: BetterAuthHookContext['context'] & { logger: { error: (msg: string, ...args: unknown[]) => void } };
		};
		if (hookCtx.path !== BETTER_AUTH_ENDPOINTS.SIGN_OUT) return;
		// Resolve the session BEFORE the endpoint deletes it. If no cookie or
		// no row, recordSignOutUserId(null) so the after hook still fires an
		// audit row with actorId=null (records "logout requested with no
		// active session", which is itself useful telemetry).
		try {
			const token = await hookCtx.getSignedCookie(
				hookCtx.context.authCookies.sessionToken.name,
				hookCtx.context.secret,
			);
			if (!token) {
				recordSignOutUserId(hookCtx.context, null);
				return;
			}
			const session = await hookCtx.context.internalAdapter.findSession(token);
			recordSignOutUserId(hookCtx.context, session?.session.userId ?? null);
		} catch (err) {
			hookCtx.context.logger.error('audit-hook: sign-out user-id capture failed', err);
			recordSignOutUserId(hookCtx.context, null);
		}
	});

	const after = createAuthMiddleware(async (ctx) => {
		const hookCtx = ctx as unknown as BetterAuthHookContext & {
			context: BetterAuthHookContext['context'] & { logger: { error: (msg: string, ...args: unknown[]) => void } };
		};
		const path = hookCtx.path;
		if (path !== BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL && path !== BETTER_AUTH_ENDPOINTS.SIGN_OUT) return;

		const eventCtx = extractCtx(hookCtx);
		const status = statusFromReturned(hookCtx.context.returned);

		try {
			if (path === BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL) {
				if (status >= 200 && status < 300 && hookCtx.context.newSession?.user?.id) {
					await emitter.onSignInSuccess({
						userId: hookCtx.context.newSession.user.id,
						ctx: { ...eventCtx, sessionId: hookCtx.context.newSession.session.id },
					});
				} else if (status >= 400) {
					await emitter.onSignInFailure({
						outcome: classifyLoginFailure(status),
						status,
						ctx: eventCtx,
					});
				}
				return;
			}
			// path === SIGN_OUT
			if (status >= 200 && status < 300) {
				const userId = readSignOutUserId(hookCtx.context) ?? null;
				await emitter.onSignOut({ userId, ctx: eventCtx });
			}
		} catch (err) {
			// Audit write must not break the user-facing flow. Log and move on.
			hookCtx.context.logger.error('audit-hook: emit failed for path', path, err);
		}
	});

	return { before, after };
}
