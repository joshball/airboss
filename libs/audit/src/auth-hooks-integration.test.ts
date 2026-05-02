/**
 * Better-auth audit hook integration test.
 *
 * Drives the real `createAuth(...)` factory wired with the real
 * `createAuditAuthEventEmitter()` against the real Postgres dev database.
 * The test sends sign-in success, sign-in failure, and sign-out requests
 * through the auth handler and asserts each one lands the expected row in
 * `audit.audit_log`. End-to-end, no mocks: a unit test that asserts on the
 * emitter's input would tell us nothing about whether better-auth ever
 * actually fires the hook for the `/sign-in/email` path.
 *
 * Closes the chunk-3 review convergent finding "no audit emission on auth
 * events" -- the security and backend reviewers both flagged that login /
 * logout traffic leaves zero record in the audit log.
 */

import { bauthAccount, bauthRateLimit, bauthSession, bauthUser, createAuth } from '@ab/auth';
import { AUDIT_TARGETS, BETTER_AUTH_ENDPOINTS, ENV_VARS, ROUTES } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId } from '@ab/utils';
import { hashPassword } from 'better-auth/crypto';
import { eq, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuditAuthEventEmitter } from './auth-events';
import { auditLog } from './schema';

// Stable but unique ip + email per suite run so parallel tests don't share
// rate-limit buckets or trip unique-email constraints.
const SUITE_IP = `198.51.100.${Math.floor(Math.random() * 250) + 2}`;
const SUITE_TAG = `auditfx-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const TEST_EMAIL = `${SUITE_TAG}@airboss.test`;
const TEST_PASSWORD = 'audit-hook-test-password-1234';

function makeAuth() {
	const secret = process.env[ENV_VARS.BETTER_AUTH_SECRET];
	if (!secret) {
		throw new Error(`${ENV_VARS.BETTER_AUTH_SECRET} env var must be set for the audit-hook integration test`);
	}
	// Disable rate limiting so the failure-path test can hammer sign-in with
	// the wrong password without hitting 429 before we can assert on 401
	// classification.
	return createAuth({
		secret,
		isDev: true,
		rateLimitEnabled: false,
		authEventEmitter: createAuditAuthEventEmitter(),
	});
}

interface SignInBody {
	email?: string;
	password?: string;
}

async function signIn(authInstance: ReturnType<typeof createAuth>, body: SignInBody): Promise<Response> {
	return authInstance.handler(
		new Request(`http://localhost${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-forwarded-for': SUITE_IP, 'user-agent': 'vitest-suite/1.0' },
			body: JSON.stringify(body),
		}),
	);
}

async function signOut(authInstance: ReturnType<typeof createAuth>, cookieHeader: string): Promise<Response> {
	return authInstance.handler(
		new Request(`http://localhost${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.SIGN_OUT}`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				cookie: cookieHeader,
				'x-forwarded-for': SUITE_IP,
				'user-agent': 'vitest-suite/1.0',
			},
		}),
	);
}

let userId = '';

describe('better-auth + audit hooks integration', () => {
	let auth: ReturnType<typeof createAuth>;

	beforeAll(async () => {
		auth = makeAuth();
		// Seed the user directly so we can sign in without going through the
		// disabled public sign-up endpoint.
		userId = generateAuthId();
		const accountId = generateAuthId();
		const passwordHash = await hashPassword(TEST_PASSWORD);
		const now = new Date();
		await db.insert(bauthUser).values({
			id: userId,
			email: TEST_EMAIL,
			name: 'Audit Hook Test',
			firstName: 'Audit',
			lastName: 'Hook',
			emailVerified: false,
			createdAt: now,
			updatedAt: now,
		});
		await db.insert(bauthAccount).values({
			id: accountId,
			userId,
			accountId: userId,
			providerId: 'credential',
			password: passwordHash,
			createdAt: now,
			updatedAt: now,
		});
		// Defensive: scrub stale rate-limit + audit rows that match this run.
		await db.delete(bauthRateLimit).where(like(bauthRateLimit.key, `%${SUITE_IP}%`));
		await db.delete(auditLog).where(eq(auditLog.actorId, userId));
	});

	afterAll(async () => {
		await db.delete(auditLog).where(eq(auditLog.actorId, userId));
		await db.delete(bauthSession).where(eq(bauthSession.userId, userId));
		await db.delete(bauthAccount).where(eq(bauthAccount.userId, userId));
		await db.delete(bauthUser).where(eq(bauthUser.id, userId));
		await db.delete(bauthRateLimit).where(like(bauthRateLimit.key, `%${SUITE_IP}%`));
	});

	it('records AUTH_LOGIN on a successful sign-in via the better-auth handler', async () => {
		const res = await signIn(auth, { email: TEST_EMAIL, password: TEST_PASSWORD });
		expect(res.status, await res.text().catch(() => '<unreadable>')).toBe(200);

		const rows = await db.select().from(auditLog).where(eq(auditLog.actorId, userId));
		const loginRow = rows.find((r) => r.targetType === AUDIT_TARGETS.AUTH_LOGIN);
		expect(loginRow, 'AUTH_LOGIN row should exist').toBeDefined();
		expect(loginRow?.targetId).toBe(userId);
		expect(loginRow?.metadata).toMatchObject({ ip: SUITE_IP, userAgent: 'vitest-suite/1.0' });
		// session id should be populated -- newSession is set by setSessionCookie.
		const md = loginRow?.metadata as Record<string, unknown>;
		expect(typeof md.sessionId).toBe('string');
		expect(md.sessionId).toMatch(/.+/);
	});

	it('records AUTH_LOGIN_FAILED with outcome=invalid-credentials on a 401', async () => {
		const res = await signIn(auth, { email: TEST_EMAIL, password: 'definitely-wrong' });
		expect(res.status).toBe(401);

		// Failure rows have actor_id null by design; filter by ip + outcome.
		const rows = await db.select().from(auditLog).where(eq(auditLog.targetType, AUDIT_TARGETS.AUTH_LOGIN_FAILED));
		const failureRow = rows.find((r) => {
			const md = r.metadata as Record<string, unknown>;
			return md.ip === SUITE_IP && md.outcome === 'invalid-credentials';
		});
		expect(failureRow, 'AUTH_LOGIN_FAILED row for this run should exist').toBeDefined();
		expect(failureRow?.actorId).toBeNull();
		expect(failureRow?.targetId).toBeNull();
		expect(failureRow?.metadata).toMatchObject({
			outcome: 'invalid-credentials',
			status: 401,
			ip: SUITE_IP,
		});
		if (failureRow) await db.delete(auditLog).where(eq(auditLog.id, failureRow.id));
	});

	it('records AUTH_LOGOUT with the actor id captured before the session is deleted', async () => {
		// Sign in fresh so we have a session cookie to send to /sign-out.
		const signInRes = await signIn(auth, { email: TEST_EMAIL, password: TEST_PASSWORD });
		expect(signInRes.status).toBe(200);
		const setCookie = signInRes.headers.get('set-cookie');
		expect(setCookie, 'sign-in must return Set-Cookie').toBeTruthy();
		// Crude cookie-jar: take name=value pairs from each Set-Cookie header.
		// Better-auth's handler concatenates multiple Set-Cookie via append,
		// joined here by the standard Headers#get serialization.
		const cookieHeader = (setCookie ?? '')
			.split(/,(?=[^,;]+=)/)
			.map((part) => part.split(';')[0]?.trim() ?? '')
			.filter((p) => p.length > 0)
			.join('; ');
		expect(cookieHeader.length).toBeGreaterThan(0);

		// Wipe the AUTH_LOGIN row from this nested sign-in so the assertion
		// below picks up only the new AUTH_LOGOUT.
		const before = await db.select().from(auditLog).where(eq(auditLog.actorId, userId));

		const res = await signOut(auth, cookieHeader);
		expect(res.status).toBe(200);

		const after = await db.select().from(auditLog).where(eq(auditLog.actorId, userId));
		const logoutRow = after
			.filter((r) => !before.some((b) => b.id === r.id))
			.find((r) => r.targetType === AUDIT_TARGETS.AUTH_LOGOUT);
		expect(logoutRow, 'AUTH_LOGOUT row should exist').toBeDefined();
		expect(logoutRow?.targetId).toBe(userId);
		expect(logoutRow?.metadata).toMatchObject({ ip: SUITE_IP, userAgent: 'vitest-suite/1.0' });
	});
});
