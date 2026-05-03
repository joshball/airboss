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
 *   5. Confirms a second IP can still sign in independently while the first
 *      IP is at 429 (per-IP isolation).
 *   6. Confirms that mutating `lastRequest` on the row to simulate window
 *      expiry resets the bucket on the next request from the same IP.
 *   7. Confirms a successful sign-in returns 200, creates a `bauth_session`
 *      row, and that better-auth does not increment the failure counter
 *      beyond the failed attempts that preceded it (counter advances by one
 *      per request -- successes count -- so the assertion pins the actual
 *      semantics, not a hopeful one).
 *
 * Why this matters: the work-package spec rejects memory-only rate limiting
 * because (a) it resets every redeploy, (b) a multi-instance deploy fragments
 * the limit per-process, and (c) a regression that keys the bucket on path
 * only (not IP+path) would lock every legitimate user out the moment one
 * attacker hits the cap. The seven cases above pin every load-bearing edge.
 */

import { AUTH_RATE_LIMIT, BETTER_AUTH_ENDPOINTS, ENV_VARS, ROUTES } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId } from '@ab/utils';
import { hashPassword } from 'better-auth/crypto';
import { eq, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bauthAccount, bauthRateLimit, bauthSession, bauthUser } from './schema';
import { createAuth } from './server';

// Stable IPs per suite run -- random so parallel test runs don't share a
// rate-limit bucket and cross-pollute each other. Each test uses its own IP
// so the buckets stay independent and one test's accumulated count cannot
// shift another test's assertions.
//   SUITE_IP        original trip-and-restart pair (existing failure tests)
//   ISOLATION_IP_A  trips its own bucket then asserts isolation
//   ISOLATION_IP_B  must remain admitted while ISOLATION_IP_A is at 429
//   WINDOW_IP       window-expiry test (mutates this row's lastRequest only)
//   SUCCESS_IP      sign-in-success path (fresh bucket, never tripped)
const RAND_OCTET = () => Math.floor(Math.random() * 250) + 2;
const SUITE_IP = `198.51.100.${RAND_OCTET()}`;
const ISOLATION_IP_A = `198.51.101.${RAND_OCTET()}`;
const ISOLATION_IP_B = `198.51.101.${RAND_OCTET()}`;
const WINDOW_IP = `198.51.102.${RAND_OCTET()}`;
const SUCCESS_IP = `198.51.103.${RAND_OCTET()}`;

const ALL_TEST_IPS = [SUITE_IP, ISOLATION_IP_A, ISOLATION_IP_B, WINDOW_IP, SUCCESS_IP] as const;

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
 *
 * `email` defaults to the seeded user; pass an alternative when a test wants
 * to exercise the success path with the real password while still routing
 * through a path-and-ip-keyed rate-limit bucket.
 */
async function signIn(
	authInstance: ReturnType<typeof createAuth>,
	ip: string,
	password: string,
	email: string = TEST_EMAIL,
): Promise<Response> {
	const headers = new Headers({
		'content-type': 'application/json',
		'x-forwarded-for': ip,
	});
	return authInstance.handler(
		new Request(`http://localhost${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL}`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ email, password }),
		}),
	);
}

/**
 * Find the sign-in rate-limit row for an IP. Better-auth keys the row as
 * `{ip}:{path}` so a LIKE on the IP fragment locates it regardless of future
 * key-format tweaks.
 */
async function findSignInRow(ip: string) {
	const rows = await db
		.select()
		.from(bauthRateLimit)
		.where(like(bauthRateLimit.key, `%${ip}%`));
	return rows.find((r) => r.key.includes(BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL));
}

describe('database-backed rate-limit on sign-in', () => {
	let auth: ReturnType<typeof createAuth>;

	beforeAll(async () => {
		auth = makeAuth();
		// Seed a real user directly via Drizzle so signInEmail returns 401
		// (bad password) instead of 400 (validation) -- we want the rate-limit
		// middleware itself to gate the response, not the body parser. Direct
		// insert avoids the public sign-up endpoint, which is disabled in
		// production (`disableSignUp: true` in `createAuth`).
		const userId = generateAuthId();
		const accountId = generateAuthId();
		const passwordHash = await hashPassword(TEST_PASSWORD);
		const now = new Date();
		await db.insert(bauthUser).values({
			id: userId,
			email: TEST_EMAIL,
			name: 'Rate Limit Test',
			firstName: 'Rate',
			lastName: 'Limit',
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
		// Clear any prior rate-limit rows for every IP this suite uses
		// (defensive -- the random IPs make a clash unlikely, but the suite
		// must be deterministic).
		for (const ip of ALL_TEST_IPS) {
			await db.delete(bauthRateLimit).where(like(bauthRateLimit.key, `%${ip}%`));
		}
		// Sweep stale rate-limit rows from previous failed runs of this
		// suite (review minor: partial-failure rows from previous runs need
		// to be reaped so the deterministic assertions hold).
		await db.delete(bauthRateLimit).where(like(bauthRateLimit.key, '%@airboss.test%'));
	});

	afterAll(async () => {
		// Clean the rate-limit rows for every IP and the seeded user so the
		// dev DB stays tidy across runs. Order matters: child rows (account,
		// session) must go before the user row to satisfy foreign-key
		// constraints.
		for (const ip of ALL_TEST_IPS) {
			await db.delete(bauthRateLimit).where(like(bauthRateLimit.key, `%${ip}%`));
		}
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
		const signInRow = await findSignInRow(SUITE_IP);
		expect(signInRow, 'sign-in rate-limit row should exist in bauth_rate_limit').toBeDefined();
		// Counter must reflect every attempt we made, including the one
		// that triggered the 429 response.
		expect(signInRow?.count).toBeGreaterThanOrEqual(max);
	});

	it('rate-limit state survives a process restart (proof of database persistence)', async () => {
		// Pre-condition: the DB row from the previous test still exists.
		const before = await findSignInRow(SUITE_IP);
		expect(before, 'rate-limit row from previous test must still exist').toBeDefined();

		// Simulate a process restart: build a brand-new better-auth instance.
		// In a memory-backed implementation this would clear all buckets and
		// the next request would be allowed; in the database-backed
		// implementation the next request must still be 429 because the
		// counter on disk hasn't moved.
		const fresh = makeAuth();
		const res = await signIn(fresh, SUITE_IP, 'still-wrong');
		expect(res.status).toBe(429);
	});

	it('isolates rate-limit buckets per IP -- one IP being blocked does not lock out another', async () => {
		const max = AUTH_RATE_LIMIT.SIGN_IN_MAX_REQUESTS;

		// Trip ISOLATION_IP_A's bucket: max wrong-password attempts then one
		// more for the 429. We use a fresh handler instance so any in-memory
		// caching (none today, but defensive) starts clean.
		const fresh = makeAuth();
		for (let i = 0; i < max; i++) {
			const res = await signIn(fresh, ISOLATION_IP_A, 'definitely-wrong');
			expect(res.status).not.toBe(429);
		}
		const blockedA = await signIn(fresh, ISOLATION_IP_A, 'definitely-wrong');
		expect(blockedA.status).toBe(429);

		// Now send one request from ISOLATION_IP_B with a wrong password.
		// If the rate-limit key were path-only (or a constant like 'global'),
		// this request would also 429. With per-IP keying, B has its own
		// untouched bucket and the request must reach the auth handler -- so
		// the response status is 401 (wrong password), not 429.
		const allowedB = await signIn(fresh, ISOLATION_IP_B, 'definitely-wrong');
		expect(allowedB.status).not.toBe(429);
		expect(allowedB.status).toBe(401);

		// Database must hold two distinct rows -- one keyed on each IP.
		const rowA = await findSignInRow(ISOLATION_IP_A);
		const rowB = await findSignInRow(ISOLATION_IP_B);
		expect(rowA, 'IP A row should exist').toBeDefined();
		expect(rowB, 'IP B row should exist').toBeDefined();
		// Rows must be distinct by id and key -- a regression that bucketed
		// every request into one synthetic key would still write a row, but
		// would write it to the same row both times.
		expect(rowA?.id).not.toBe(rowB?.id);
		expect(rowA?.key).not.toBe(rowB?.key);
	});

	it('resets the bucket when the configured window has passed (lastRequest mutation)', async () => {
		const max = AUTH_RATE_LIMIT.SIGN_IN_MAX_REQUESTS;

		// Trip WINDOW_IP's bucket so we have a row to mutate.
		const fresh = makeAuth();
		for (let i = 0; i < max; i++) {
			const res = await signIn(fresh, WINDOW_IP, 'definitely-wrong');
			expect(res.status).not.toBe(429);
		}
		const blocked = await signIn(fresh, WINDOW_IP, 'definitely-wrong');
		expect(blocked.status).toBe(429);

		// Pre-mutation: row exists and count is at the cap.
		const rowBefore = await findSignInRow(WINDOW_IP);
		expect(rowBefore, 'window-test row should exist after tripping').toBeDefined();
		const idBefore = rowBefore?.id;
		expect(idBefore).toBeDefined();
		expect(rowBefore?.count).toBeGreaterThanOrEqual(max);

		// Simulate window passage by rewinding `lastRequest`. Better-auth's
		// rate-limiter resets the bucket when `now - lastRequest > window*1000`
		// (see node_modules/better-auth/dist/api/rate-limiter/index.mjs --
		// `shouldRateLimit` returns false once the elapsed gap exceeds the
		// configured window). Mutating the column is faster and more
		// deterministic than sleeping.
		const windowMs = AUTH_RATE_LIMIT.SIGN_IN_WINDOW_SECONDS * 1000;
		// `lastRequest` is stored as a JS millisecond timestamp; subtract a
		// generous margin past the window so the comparison is unambiguous.
		const expiredTs = Date.now() - windowMs - 5000;
		if (idBefore == null) throw new Error('row id required for window mutation');
		await db.update(bauthRateLimit).set({ lastRequest: expiredTs }).where(eq(bauthRateLimit.id, idBefore));

		// Next request from the same IP must be admitted -- the bucket has
		// expired, so better-auth treats this as the first request in a new
		// window. The wrong password lands a 401 (not a 429).
		const reset = await signIn(fresh, WINDOW_IP, 'definitely-wrong');
		expect(reset.status).not.toBe(429);
		expect(reset.status).toBe(401);

		// The row must have been re-keyed into a new window: better-auth
		// resets `count` to 1 and updates `lastRequest` to `now`. Pin both.
		const rowAfter = await findSignInRow(WINDOW_IP);
		expect(rowAfter).toBeDefined();
		expect(rowAfter?.count).toBe(1);
		expect(rowAfter?.lastRequest).toBeGreaterThan(expiredTs);
	});

	it('admits a successful sign-in and creates a session row (success path coverage)', async () => {
		// Use a fresh IP so the success path runs in its own clean bucket --
		// a regression that 429s on the success branch (e.g. routing the body
		// parser through the rate-limit middleware after a status flip) would
		// surface as a 429 here. Counting semantics are pinned at the end:
		// better-auth advances `count` once per request inside the window
		// regardless of HTTP status, so the row's count after one success is
		// exactly 1. If a future better-auth upgrade switches to "count
		// failures only", this assertion will trip and we update it
		// deliberately rather than discover the change later.
		const fresh = makeAuth();

		// Warm the bucket with the right password. baseline = 0 (clean IP).
		const baselineRow = await findSignInRow(SUCCESS_IP);
		expect(baselineRow, 'success-IP bucket should be empty before the call').toBeUndefined();

		const res = await signIn(fresh, SUCCESS_IP, TEST_PASSWORD);
		expect(
			res.status,
			await res
				.clone()
				.text()
				.catch(() => '<unreadable>'),
		).toBe(200);

		// A session row for the seeded user must exist. The user id was
		// generated inside beforeAll so we look it up by email.
		const seeded = await db.select().from(bauthUser).where(eq(bauthUser.email, TEST_EMAIL));
		expect(seeded[0]?.id).toBeDefined();
		const userId = seeded[0]?.id;
		if (userId == null) throw new Error('seeded user id required for session lookup');
		const sessions = await db.select().from(bauthSession).where(eq(bauthSession.userId, userId));
		expect(sessions.length).toBeGreaterThan(0);

		// Pin better-auth's counting semantics: every request inside the
		// window advances `count` by 1, success or failure. The bucket on
		// SUCCESS_IP saw exactly one request, so count must be 1.
		const rowAfter = await findSignInRow(SUCCESS_IP);
		expect(rowAfter, 'success-path request must still write the rate-limit row').toBeDefined();
		expect(rowAfter?.count).toBe(1);
	});
});
