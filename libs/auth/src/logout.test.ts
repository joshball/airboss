/**
 * Logout coverage.
 *
 * `clearSessionCookies` is the only exported surface of `logout.ts`, but the
 * end-to-end logout flow has two load-bearing parts that need test coverage:
 *
 *   1. The pure cookie-clearing surface -- `clearSessionCookies` deletes the
 *      two known better-auth cookie names with a Domain that matches what
 *      the set path used. Mismatched Domain on delete = the browser keeps
 *      the old cookie, so the sign-out request succeeds at the server but
 *      the browser still presents a session cookie on the next page load.
 *   2. The better-auth sign-out endpoint side -- hitting `/api/auth/sign-out`
 *      with a valid cookie must delete the `bauth_session` row. The audit
 *      side (AUTH_LOGOUT row in `audit.audit_log`) lives in the audit lib's
 *      own integration test (`libs/audit/src/auth-hooks-integration.test.ts`)
 *      because the dep direction is one-way -- `@ab/auth` cannot import
 *      `@ab/audit`. The session-row deletion check below pins the auth-side
 *      contract; the audit-side contract is pinned in the audit-side test.
 *
 * Closes the chunk-3 review MAJOR finding "logout.ts ships with zero unit
 * tests" (file: docs/work/reviews/2026-05-01-auth-identity-audit-testing.md).
 */

import { BETTER_AUTH_COOKIES, BETTER_AUTH_ENDPOINTS, ENV_VARS, ROUTES } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId } from '@ab/utils';
import type { Cookies } from '@sveltejs/kit';
import { hashPassword } from 'better-auth/crypto';
import { eq, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearSessionCookies } from './logout';
import { bauthAccount, bauthRateLimit, bauthSession, bauthUser } from './schema';
import { createAuth } from './server';

interface DeleteCall {
	name: string;
	options: { path?: string; domain?: string };
}

/**
 * Build a minimal Cookies stub that records `delete` invocations. The
 * production type carries set/get/serialize/getAll, but `clearSessionCookies`
 * only calls `delete`, so the rest stay no-ops.
 */
function makeCookies(): { cookies: Cookies; deletes: DeleteCall[] } {
	const deletes: DeleteCall[] = [];
	const cookies = {
		set: () => {},
		delete: (name: string, options: { path?: string; domain?: string }) => {
			deletes.push({ name, options });
		},
		get: () => undefined,
		getAll: () => [],
		serialize: () => '',
	} as unknown as Cookies;
	return { cookies, deletes };
}

describe('clearSessionCookies', () => {
	it('deletes both better-auth cookie names with path=/', () => {
		const { cookies, deletes } = makeCookies();
		clearSessionCookies(cookies, true, 'study.airboss.test');
		expect(deletes).toHaveLength(2);
		const names = deletes.map((d) => d.name).sort();
		expect(names).toEqual([BETTER_AUTH_COOKIES.SESSION_DATA, BETTER_AUTH_COOKIES.SESSION_TOKEN].sort());
		for (const d of deletes) {
			expect(d.options.path).toBe('/');
		}
	});

	it('attaches the dev cross-subdomain Domain when the host is under it', () => {
		const { cookies, deletes } = makeCookies();
		clearSessionCookies(cookies, true, 'study.airboss.test');
		// `.airboss.test` is the dev cross-subdomain domain. Both deletes must
		// carry it so the browser actually drops the cookie that was set with
		// the same Domain.
		expect(deletes.every((d) => d.options.domain === '.airboss.test')).toBe(true);
	});

	it('attaches the prod cross-subdomain Domain in non-dev', () => {
		const { cookies, deletes } = makeCookies();
		clearSessionCookies(cookies, false, 'study.air-boss.org');
		expect(deletes.every((d) => d.options.domain === '.air-boss.org')).toBe(true);
	});

	it('omits Domain for hosts outside the configured cross-subdomain (host-only delete)', () => {
		const { cookies, deletes } = makeCookies();
		// 127.0.0.1 is not under `.airboss.test`, so the cookie was set
		// host-only and the delete must match host-only too.
		clearSessionCookies(cookies, true, '127.0.0.1');
		expect(deletes.every((d) => d.options.domain === undefined)).toBe(true);
	});

	it('does not throw when host is null or undefined (defensive)', () => {
		const { cookies, deletes } = makeCookies();
		// SvelteKit typically populates url.host but the parameter is typed
		// `string | null | undefined` -- the function must handle both. The
		// resulting delete is host-only (no Domain), which is the safest
		// fallback.
		expect(() => clearSessionCookies(cookies, true, null)).not.toThrow();
		expect(() => clearSessionCookies(cookies, true, undefined)).not.toThrow();
		expect(deletes).toHaveLength(4);
		expect(deletes.every((d) => d.options.domain === undefined)).toBe(true);
	});

	it('still clears cookies when called with no active session (idempotent)', () => {
		// `clearSessionCookies` is intentionally stateless -- it deletes by
		// cookie name, so calling it from a logout endpoint that arrived with
		// no session cookie produces the same delete instructions. A regression
		// that early-returns when no session is "detected" would silently
		// leave a stale cookie behind in the rare race where the user hits
		// /logout twice in quick succession.
		const { cookies, deletes } = makeCookies();
		clearSessionCookies(cookies, true, 'study.airboss.test');
		clearSessionCookies(cookies, true, 'study.airboss.test');
		expect(deletes).toHaveLength(4);
	});
});

// ---------------------------------------------------------------------------
// Integration: better-auth sign-out endpoint deletes the session row.
//
// This proves the auth-side half of the logout contract (session deletion).
// The audit-side half (AUTH_LOGOUT row) is pinned by
// `libs/audit/src/auth-hooks-integration.test.ts` because `@ab/auth` cannot
// import `@ab/audit` (one-way dep direction).
// ---------------------------------------------------------------------------

const SUITE_IP = `198.51.104.${Math.floor(Math.random() * 250) + 2}`;
const SUITE_TAG = `logout-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const TEST_EMAIL = `${SUITE_TAG}@airboss.test`;
const TEST_PASSWORD = 'logout-test-password-1234';
let TEST_USER_ID = '';

function makeAuth() {
	const secret = process.env[ENV_VARS.BETTER_AUTH_SECRET];
	if (!secret) {
		throw new Error(`${ENV_VARS.BETTER_AUTH_SECRET} env var must be set for the logout integration test`);
	}
	// Disable rate-limit so repeated runs don't 429 on the sign-in we use to
	// mint a session for the sign-out call.
	return createAuth({
		secret,
		isDev: true,
		rateLimitEnabled: false,
	});
}

async function signIn(authInstance: ReturnType<typeof createAuth>): Promise<Response> {
	return authInstance.handler(
		new Request(`http://localhost${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL}`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-forwarded-for': SUITE_IP,
				'user-agent': 'logout-suite/1.0',
			},
			body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
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
				'user-agent': 'logout-suite/1.0',
			},
		}),
	);
}

describe('better-auth sign-out endpoint deletes the session row', () => {
	let auth: ReturnType<typeof createAuth>;

	beforeAll(async () => {
		auth = makeAuth();
		TEST_USER_ID = generateAuthId();
		const accountId = generateAuthId();
		const passwordHash = await hashPassword(TEST_PASSWORD);
		const now = new Date();
		await db.insert(bauthUser).values({
			id: TEST_USER_ID,
			email: TEST_EMAIL,
			name: 'Logout Test',
			firstName: 'Logout',
			lastName: 'Test',
			emailVerified: false,
			createdAt: now,
			updatedAt: now,
		});
		await db.insert(bauthAccount).values({
			id: accountId,
			userId: TEST_USER_ID,
			accountId: TEST_USER_ID,
			providerId: 'credential',
			password: passwordHash,
			createdAt: now,
			updatedAt: now,
		});
		await db.delete(bauthRateLimit).where(like(bauthRateLimit.key, `%${SUITE_IP}%`));
	});

	afterAll(async () => {
		await db.delete(bauthSession).where(eq(bauthSession.userId, TEST_USER_ID));
		await db.delete(bauthAccount).where(eq(bauthAccount.userId, TEST_USER_ID));
		await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
		await db.delete(bauthRateLimit).where(like(bauthRateLimit.key, `%${SUITE_IP}%`));
	});

	it('deletes the bauth_session row when sign-out is called with a valid cookie', async () => {
		// Sign in first to mint a real session cookie.
		const signInRes = await signIn(auth);
		expect(
			signInRes.status,
			await signInRes
				.clone()
				.text()
				.catch(() => '<unreadable>'),
		).toBe(200);
		const setCookie = signInRes.headers.get('set-cookie');
		expect(setCookie).not.toBeNull();

		// Build a cookie header from the Set-Cookie response, taking the
		// name=value pair from each entry. Better-auth concatenates multiple
		// Set-Cookie headers via append; Headers#get joins them with `, `
		// which is split by the (?=name=) lookahead below.
		const cookieHeader = (setCookie ?? '')
			.split(/,(?=[^,;]+=)/)
			.map((part) => part.split(';')[0]?.trim() ?? '')
			.filter((p) => p.length > 0)
			.join('; ');
		expect(cookieHeader.length).toBeGreaterThan(0);

		// Pre-condition: a session row must exist for this user. If sign-in
		// somehow didn't create one, the assertion below would be trivially
		// true after sign-out -- pin both states.
		const sessionsBefore = await db.select().from(bauthSession).where(eq(bauthSession.userId, TEST_USER_ID));
		expect(sessionsBefore.length).toBeGreaterThan(0);

		const res = await signOut(auth, cookieHeader);
		expect(res.status).toBe(200);

		// The session row must be gone. Better-auth deletes it inside the
		// endpoint -- a regression that 200s without deleting (e.g. an
		// adapter swap that lost the delete on the auth provider) would
		// leave the row behind and a stale token would still resolve.
		const sessionsAfter = await db.select().from(bauthSession).where(eq(bauthSession.userId, TEST_USER_ID));
		expect(sessionsAfter).toHaveLength(0);
	});

	it('returns gracefully when sign-out is called with no session cookie', async () => {
		// A logout request that arrived without a session cookie (already
		// expired, double-tap on the logout button, etc.) must not throw and
		// must not 5xx -- better-auth's contract is to no-op the delete and
		// return a non-error status.
		const res = await signOut(auth, '');
		expect(res.status).toBeLessThan(500);
	});
});
