/**
 * Database-backed rate-limit integration test.
 *
 * Drives the real `createAuth(...)` factory against the real Postgres dev
 * database -- the same factory the SvelteKit apps use. The test:
 *
 *   1. Creates a fresh better-auth instance, hammers the sign-in endpoint
 *      from a single client IP until it hits 429.
 *   2. Asserts the rate-limit counter is persisted in `bauth_rate_limit`.
 *   3. Builds a brand-new better-auth instance with the same DB and secret
 *      (this simulates a process restart -- in-memory state is gone but
 *      database rows survive).
 *   4. Sends one more request from the same IP and asserts it is still
 *      rate-limited. This is the database-backed proof; an in-memory
 *      implementation would forget the bucket and admit the request.
 *
 * Why this matters: the work-package spec rejects memory-only rate limiting
 * because (a) it resets every redeploy and (b) a multi-instance deploy
 * fragments the limit per-process. A test that survives a "restart" closes
 * both gaps in one shot.
 */

import { AUTH_RATE_LIMIT, BETTER_AUTH_ENDPOINTS, ENV_VARS, ROUTES } from '@ab/constants';
import { db } from '@ab/db';
import { eq, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bauthAccount, bauthRateLimit, bauthSession, bauthUser } from './schema';
import { createAuth } from './server';

// Stable IP per suite run -- random so parallel test runs don't share a
// rate-limit bucket and cross-pollute each other.
const SUITE_IP = `198.51.100.${Math.floor(Math.random() * 250) + 2}`;

// Fresh email per run avoids unique-constraint trips across re-runs.
const SUITE_TAG = `rl-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const TEST_EMAIL = `${SUITE_TAG}@airboss.test`;
const TEST_PASSWORD = 'rate-limit-test-password-1234';

function makeAuth() {
	const secret = process.env[ENV_VARS.BETTER_AUTH_SECRET];
	if (!secret) {
		throw new Error(`${ENV_VARS.BETTER_AUTH_SECRET} env var must be set for the rate-limit integration test`);
	}
	// Force-enable in tests; better-auth's default disables rate-limit
	// outside production. baseURL stays on the dev study port so trustedOrigins
	// resolution doesn't error inside better-auth's init path.
	return createAuth({ secret, isDev: true, rateLimitEnabled: true });
}

/**
 * Send a sign-in request through the better-auth router for `ip`. We use
 * `x-forwarded-for` because the test-mode default in better-auth's getIp
 * is `127.0.0.1` for everyone -- forwarding a unique IP per suite run lets
 * parallel tests own independent rate-limit buckets.
 */
async function signIn(authInstance: ReturnType<typeof createAuth>, ip: string, password: string): Promise<Response> {
	const headers = new Headers({
		'content-type': 'application/json',
		'x-forwarded-for': ip,
	});
	return authInstance.handler(
		new Request(`http://localhost${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL}`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ email: TEST_EMAIL, password }),
		}),
	);
}

describe('database-backed rate-limit on sign-in', () => {
	let auth: ReturnType<typeof createAuth>;

	beforeAll(async () => {
		auth = makeAuth();
		// Seed a real user so signInEmail returns 401 (bad password) instead
		// of 400 (validation) -- we want the rate-limit middleware itself to
		// gate the response, not the body parser.
		await auth.api.signUpEmail({
			body: {
				email: TEST_EMAIL,
				password: TEST_PASSWORD,
				name: 'Rate Limit Test',
				firstName: 'Rate',
				lastName: 'Limit',
			},
		});
		// Clear any prior rate-limit rows for this IP (defensive -- the random
		// IP makes a clash unlikely, but the suite must be deterministic).
		await db.delete(bauthRateLimit).where(like(bauthRateLimit.key, `%${SUITE_IP}%`));
	});

	afterAll(async () => {
		// Clean the rate-limit rows and the seeded user so the dev DB stays
		// tidy across runs. Order matters: child rows (account, session)
		// must go before the user row to satisfy foreign-key constraints.
		await db.delete(bauthRateLimit).where(like(bauthRateLimit.key, `%${SUITE_IP}%`));
		const users = await db.select().from(bauthUser).where(eq(bauthUser.email, TEST_EMAIL));
		for (const u of users) {
			await db.delete(bauthSession).where(eq(bauthSession.userId, u.id));
			await db.delete(bauthAccount).where(eq(bauthAccount.userId, u.id));
		}
		await db.delete(bauthUser).where(eq(bauthUser.email, TEST_EMAIL));
	});

	it('429s after the configured max sign-in attempts and persists the counter to Postgres', async () => {
		const max = AUTH_RATE_LIMIT.SIGN_IN_MAX_REQUESTS;
		// Send `max` requests with a wrong password. Every one should reach
		// the auth handler (no 429 yet) and return 401 -- we want the
		// rate-limit middleware itself, not the body parser, to gate the
		// next call.
		for (let i = 0; i < max; i++) {
			const res = await signIn(auth, SUITE_IP, 'definitely-wrong');
			expect(res.status).not.toBe(429);
		}

		// The (max+1)th attempt must be rate-limited.
		const blocked = await signIn(auth, SUITE_IP, 'definitely-wrong');
		expect(blocked.status).toBe(429);

		// Database must hold a counter row keyed by IP+path. Better-auth's
		// key shape is `{ip}:{normalized-path}` (see core/utils/ip.ts), so a
		// LIKE on the IP fragment is enough to find the row regardless of
		// future key-format tweaks.
		const rows = await db
			.select()
			.from(bauthRateLimit)
			.where(like(bauthRateLimit.key, `%${SUITE_IP}%`));
		expect(rows.length).toBeGreaterThan(0);
		const signInRow = rows.find((r) => r.key.includes(BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL));
		expect(signInRow, 'sign-in rate-limit row should exist in bauth_rate_limit').toBeDefined();
		// Counter must reflect every attempt we made, including the one
		// that triggered the 429 response.
		expect(signInRow?.count).toBeGreaterThanOrEqual(max);
	});

	it('rate-limit state survives a process restart (proof of database persistence)', async () => {
		// Pre-condition: the DB row from the previous test still exists.
		const before = await db
			.select()
			.from(bauthRateLimit)
			.where(like(bauthRateLimit.key, `%${SUITE_IP}%`));
		expect(before.length).toBeGreaterThan(0);

		// Simulate a process restart: build a brand-new better-auth instance.
		// In a memory-backed implementation this would clear all buckets and
		// the next request would be allowed; in the database-backed
		// implementation the next request must still be 429 because the
		// counter on disk hasn't moved.
		const fresh = makeAuth();
		const res = await signIn(fresh, SUITE_IP, 'still-wrong');
		expect(res.status).toBe(429);
	});
});
