/**
 * Audit emitter for better-auth events.
 *
 * Closes the chunk-3 review convergent finding "no audit emission on auth
 * events" (security MAJOR + backend MAJOR). Sign-in success, sign-in failure,
 * and sign-out all need to land in `audit.audit_log` so the hangar admin
 * surface can answer "who signed in last hour", "is this email being brute
 * forced", and "did the admin actually log out before the role change".
 *
 * Why a separate module instead of inlining in `libs/auth/src/server.ts`:
 *
 *   - `@ab/audit -> @ab/auth -> @ab/db/@ab/constants/@ab/utils`. The dep
 *     direction is one-way; `@ab/auth` cannot import `@ab/audit`.
 *   - This module exports a plain `AuthEventEmitter` interface and a default
 *     DB-backed implementation. `@ab/auth/server.ts` accepts the interface
 *     (duck-typed locally) via the `authEventEmitter` factory option, and
 *     each app's `$lib/server/auth.ts` wires `createAuthEventEmitter()` into
 *     it. The interface lives here so the BC owns the schema-shape; the
 *     auth lib only knows the contract.
 *
 * Schema mapping (per `libs/constants/src/audit.ts`):
 *
 *   sign-in success   -> targetType=AUTH_LOGIN,        actorId=user.id,  op=ACTION
 *   sign-in failure   -> targetType=AUTH_LOGIN_FAILED, actorId=null,     op=ACTION
 *   sign-out          -> targetType=AUTH_LOGOUT,       actorId=user.id,  op=ACTION
 *
 * Failed sign-ins intentionally do not record the typed-wrong email -- a
 * verbose audit log of guessed emails is itself a user-enumeration leak
 * (chunk-3 review security finding cross-references this).
 *
 * Pure types + the `AUTH_LOGIN_FAILED_OUTCOMES` discriminator live in
 * `./auth-events-types.ts` so the runtime barrel (`@ab/audit`) can re-export
 * them without dragging `@ab/db/connection` into the browser bundle.
 */

import { AUDIT_TARGETS } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { AuthEventContext, AuthEventEmitter } from './auth-events-types';
import { auditWrite } from './log';
import { AUDIT_OPS } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Strip `null`/`undefined` so the metadata jsonb stays clean. */
function compactCtx(ctx: AuthEventContext): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	if (ctx.ip != null && ctx.ip !== '') out.ip = ctx.ip;
	if (ctx.userAgent != null && ctx.userAgent !== '') out.userAgent = ctx.userAgent;
	if (ctx.sessionId != null && ctx.sessionId !== '') out.sessionId = ctx.sessionId;
	return out;
}

/**
 * Build an `AuthEventEmitter` that writes to `audit.audit_log` via
 * `auditWrite`. Apps wire this into `createAuth`'s `authEventEmitter` option:
 *
 *   import { createAuth } from '@ab/auth';
 *   import { createAuditAuthEventEmitter } from '@ab/audit/server';
 *
 *   return createAuth({
 *     ...,
 *     authEventEmitter: createAuditAuthEventEmitter(),
 *   });
 *
 * The optional `db` parameter mirrors `auditWrite`'s contract -- caller may
 * pass a transaction scope so the audit row commits or rolls back alongside
 * the operation it records. The auth-lib hooks always run outside the
 * caller's transaction (better-auth manages its own DB writes), so passing a
 * tx is unusual; the default is the shared `@ab/db` connection.
 */
export function createAuditAuthEventEmitter(db: Db = defaultDb): AuthEventEmitter {
	return {
		async onSignInSuccess({ userId, ctx }) {
			await auditWrite(
				{
					actorId: userId,
					op: AUDIT_OPS.ACTION,
					targetType: AUDIT_TARGETS.AUTH_LOGIN,
					targetId: userId,
					metadata: compactCtx(ctx),
				},
				db,
			);
		},
		async onSignInFailure({ outcome, status, ctx }) {
			await auditWrite(
				{
					actorId: null,
					op: AUDIT_OPS.ACTION,
					targetType: AUDIT_TARGETS.AUTH_LOGIN_FAILED,
					targetId: null,
					metadata: { outcome, status, ...compactCtx(ctx) },
				},
				db,
			);
		},
		async onSignOut({ userId, ctx }) {
			await auditWrite(
				{
					actorId: userId,
					op: AUDIT_OPS.ACTION,
					targetType: AUDIT_TARGETS.AUTH_LOGOUT,
					targetId: userId,
					metadata: compactCtx(ctx),
				},
				db,
			);
		},
	};
}
