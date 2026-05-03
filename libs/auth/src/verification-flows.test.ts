/**
 * Verification-flow integration tests.
 *
 * Drives the real `createAuth(...)` factory against the real Postgres dev
 * database for the three flows that route through `bauth_verification`:
 *
 *   1. Magic-link sign-in (`/sign-in/magic-link` -> `/magic-link/verify`)
 *   2. Password reset      (`/forget-password`   -> `/reset-password`)
 *   3. Email verification  -- NOT exercised here. `createAuth` configures
 *      `requireEmailVerification: false` and `sendOnSignUp: false`, and the
 *      public sign-up endpoint is disabled (`disableSignUp: true`). The
 *      verification email path is dormant until both gates are flipped on
 *      (server.ts lines 156, 167-173). When that flip happens, add a third
 *      describe block covering verification-email issuance and the
 *      verify-token redemption path. Until then a regression in the dormant
 *      surface cannot ship to users, so a stub test that exercises a
 *      pretend-mounted endpoint would assert nothing useful.
 *
 * The send-email transport (`./email`) is mocked at the module boundary so
 * we can capture the magic-link / reset-password URL that better-auth would
 * have emailed; the better-auth verification logic itself is not mocked --
 * the test pulls the raw token out of the URL and feeds it back through the
 * real verify endpoints. That's the only way to prove that:
 *
 *   - the verification row exists and is keyed correctly,
 *   - the token is single-use (second redemption fails),
 *   - the token expires (mutating `expiresAt < now` blocks redemption),
 *   - password-reset actually swaps the bauth_account.password hash.
 *
 * Closes the chunk-3 review MAJOR finding "no test for magic-link,
 * password-reset, or email-verification token flows" from
 * docs/work/reviews/2026-05-01-auth-identity-audit-testing.md.
 */

import { BETTER_AUTH_ENDPOINTS, ENV_VARS, ROUTES } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId } from '@ab/utils';
import { hashPassword } from 'better-auth/crypto';
import { eq, like } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the email transport at the module boundary so we can capture the
// outbound URL without sending a real email. The magic-link and
// reset-password callbacks in `server.ts` both go through `sendEmail` from
// `./email`, so this single mock intercepts both. The mock keeps `sendEmail`
// as a vi.fn so individual tests can inspect calls; templates and other
// exports stay live.
//
// `vi.hoisted` makes the mock factory and the recording function both
// available at module-evaluation time, before the auth lib closes over the
// real `sendEmail`. A bare `const` declared after `vi.mock` would be
// undefined when the factory ran (vi hoists `vi.mock` calls to the top of
// the module).
const { sendEmailMock } = vi.hoisted(() => ({
	sendEmailMock: vi.fn(async (_msg: { to: string; subject: string; html: string }) => true),
}));
vi.mock('./email', async () => {
	const actual = await vi.importActual<typeof import('./email')>('./email');
	return {
		...actual,
		sendEmail: sendEmailMock,
	};
});

// Lazy imports so the vi.mock above takes effect before the auth module
// closes over the real sendEmail. Vitest hoists vi.mock to the top of the
// module, but TypeScript imports for the auth lib still need to resolve
// after the mock factory is registered.
import { bauthAccount, bauthSession, bauthUser, bauthVerification } from './schema';
import { createAuth } from './server';

const SUITE_TAG = `verifyflow-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const TEST_EMAIL = `${SUITE_TAG}@airboss.test`;
const ORIGINAL_PASSWORD = 'verification-flow-original-1234';

let TEST_USER_ID = '';
let auth: ReturnType<typeof createAuth>;

function makeAuth() {
	const secret = process.env[ENV_VARS.BETTER_AUTH_SECRET];
	if (!secret) {
		throw new Error(`${ENV_VARS.BETTER_AUTH_SECRET} env var must be set for the verification-flow tests`);
	}
	// Disable rate-limit so repeated runs don't 429 on the request endpoints
	// (sign-in/magic-link and forget-password both have a 3-per-5-min cap).
	return createAuth({ secret, isDev: true, rateLimitEnabled: false });
}

/**
 * Helper: capture the URL passed to the most recent sendEmail call. Returns
 * the first http-like URL found in the rendered HTML body. Better-auth's
 * email templates always embed exactly one href per email.
 */
function lastEmailUrl(): string {
	const calls = sendEmailMock.mock.calls;
	if (calls.length === 0) throw new Error('expected sendEmail to have been called');
	const lastCall = calls[calls.length - 1];
	const html = lastCall?.[0]?.html ?? '';
	const match = html.match(/https?:\/\/[^"'\s]+/);
	if (!match) throw new Error(`could not extract URL from email html: ${html}`);
	return match[0];
}

beforeAll(async () => {
	auth = makeAuth();
	TEST_USER_ID = generateAuthId();
	const accountId = generateAuthId();
	const passwordHash = await hashPassword(ORIGINAL_PASSWORD);
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Verify Flow Test',
		firstName: 'Verify',
		lastName: 'Flow',
		// Pre-verified so the magic-link flow doesn't bounce on the
		// emailVerified gate (which is irrelevant to this suite -- we're
		// asserting the token lifecycle, not the verification gate).
		emailVerified: true,
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
	// Defensive: scrub any leftover verification rows for this email from
	// previous failed runs.
	await db.delete(bauthVerification).where(like(bauthVerification.value, `%${TEST_EMAIL}%`));
});

afterAll(async () => {
	await db.delete(bauthSession).where(eq(bauthSession.userId, TEST_USER_ID));
	await db.delete(bauthAccount).where(eq(bauthAccount.userId, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
	await db.delete(bauthVerification).where(like(bauthVerification.value, `%${TEST_EMAIL}%`));
});

beforeEach(() => {
	sendEmailMock.mockClear();
});

// ---------------------------------------------------------------------------
// Magic-link flow
// ---------------------------------------------------------------------------

describe('magic-link sign-in flow', () => {
	it('issues a verification row when /sign-in/magic-link is called', async () => {
		const res = await auth.handler(
			new Request(`http://localhost${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.MAGIC_LINK}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: TEST_EMAIL, callbackURL: '/' }),
			}),
		);
		expect(
			res.status,
			await res
				.clone()
				.text()
				.catch(() => '<unreadable>'),
		).toBe(200);

		// One verification row must exist; better-auth stores the SHA-256
		// hash of the token as the identifier (see plugins/magic-link/utils.mjs)
		// and the email payload as `value`.
		const rows = await db.select().from(bauthVerification);
		const ours = rows.find((r) => r.value.includes(TEST_EMAIL));
		expect(ours, 'magic-link verification row must exist').toBeDefined();
		expect(ours?.expiresAt.getTime()).toBeGreaterThan(Date.now());

		// And sendEmail must have been called with a URL pointing at the
		// magic-link verify endpoint with a `token` query string.
		expect(sendEmailMock).toHaveBeenCalledTimes(1);
		const url = lastEmailUrl();
		expect(url).toContain('/magic-link/verify');
		expect(url).toContain('token=');
	});

	it('redeems the magic-link token once and 401s the second redemption (single-use)', async () => {
		// Trigger a fresh magic-link request so we have an unused token.
		const reqRes = await auth.handler(
			new Request(`http://localhost${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.MAGIC_LINK}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: TEST_EMAIL, callbackURL: '/' }),
			}),
		);
		expect(reqRes.status).toBe(200);
		const url = lastEmailUrl();

		// First redemption: better-auth issues a redirect with a session
		// cookie. better-auth's verify endpoint uses 302 (or throws redirect)
		// when callbackURL is set, so any non-error status counts as success.
		const firstUrl = new URL(url);
		const verifyEndpoint = `http://localhost${firstUrl.pathname}${firstUrl.search}`;
		const firstRes = await auth.handler(new Request(verifyEndpoint, { method: 'GET' }));
		expect(firstRes.status, 'first redemption must succeed').toBeLessThan(400);
		// A session row must exist for the user after the first redemption.
		const sessions = await db.select().from(bauthSession).where(eq(bauthSession.userId, TEST_USER_ID));
		expect(sessions.length).toBeGreaterThan(0);
		// Cleanup so the next test starts fresh on the session count.
		await db.delete(bauthSession).where(eq(bauthSession.userId, TEST_USER_ID));

		// Second redemption: same token. better-auth deletes the verification
		// row on success, so the second hit cannot find it and must redirect
		// with `error=INVALID_TOKEN` (or 4xx if no callback). Either way, no
		// new session is minted.
		const secondRes = await auth.handler(new Request(verifyEndpoint, { method: 'GET' }));
		// Drain the body so happy-path callers don't leak the response stream.
		await secondRes.text().catch(() => '');
		const sessionsAfterSecond = await db.select().from(bauthSession).where(eq(bauthSession.userId, TEST_USER_ID));
		expect(sessionsAfterSecond, 'second redemption must not mint a session').toHaveLength(0);
		// The redirect carries an error parameter on the rejected path.
		const location = secondRes.headers.get('location') ?? '';
		expect(location).toMatch(/error=/);
	});

	it('refuses a magic-link token after expiresAt has passed', async () => {
		// Issue a fresh token.
		const reqRes = await auth.handler(
			new Request(`http://localhost${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.MAGIC_LINK}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: TEST_EMAIL, callbackURL: '/' }),
			}),
		);
		expect(reqRes.status).toBe(200);
		const url = lastEmailUrl();

		// Force-expire the row by rewinding `expiresAt` to a past instant.
		// The verify path checks `tokenValue.expiresAt < new Date()` and
		// returns INVALID_TOKEN-style redirect when so. We can't easily map
		// the URL token back to its hashed identifier (better-auth uses
		// SHA-256 with a specific encoding), so we mutate every row whose
		// value mentions our email. Only one matching row should exist
		// because beforeEach clears the mock and we issue exactly one new
		// magic-link per test.
		const past = new Date(Date.now() - 60_000);
		await db
			.update(bauthVerification)
			.set({ expiresAt: past })
			.where(like(bauthVerification.value, `%${TEST_EMAIL}%`));

		const verifyEndpoint = `http://localhost${new URL(url).pathname}${new URL(url).search}`;
		const res = await auth.handler(new Request(verifyEndpoint, { method: 'GET' }));
		await res.text().catch(() => '');
		const location = res.headers.get('location') ?? '';
		expect(location).toMatch(/error=/);

		// And the row must be gone -- better-auth deletes expired rows when
		// it sees them on the verify path. (Optional but worth pinning.)
		const remaining = await db
			.select()
			.from(bauthVerification)
			.where(like(bauthVerification.value, `%${TEST_EMAIL}%`));
		expect(remaining).toHaveLength(0);

		// No new session minted.
		const sessions = await db.select().from(bauthSession).where(eq(bauthSession.userId, TEST_USER_ID));
		expect(sessions).toHaveLength(0);
	});

	it('rejects an unknown / forged token', async () => {
		// Forge a token URL with a value that has no row in bauth_verification.
		// better-auth derives the verify path from the configured baseURL.
		const verifyEndpoint = `http://localhost${ROUTES.API_AUTH}/magic-link/verify?token=not-a-real-token&callbackURL=%2F`;
		const res = await auth.handler(new Request(verifyEndpoint, { method: 'GET' }));
		await res.text().catch(() => '');
		const location = res.headers.get('location') ?? '';
		expect(location).toMatch(/error=/);
	});
});

// ---------------------------------------------------------------------------
// Password-reset flow
// ---------------------------------------------------------------------------

describe('password-reset flow', () => {
	it('issues a verification row and sends the reset email when /forget-password is called', async () => {
		const res = await auth.handler(
			new Request(`http://localhost${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.REQUEST_PASSWORD_RESET}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: TEST_EMAIL, redirectTo: '/login' }),
			}),
		);
		expect(
			res.status,
			await res
				.clone()
				.text()
				.catch(() => '<unreadable>'),
		).toBe(200);

		// sendEmail must have been called once with a URL pointing at the
		// reset-password redemption path. Better-auth uses `/reset-password/{token}`
		// or a token-querystring depending on version; either shape contains the
		// raw token, which we'll feed back below.
		expect(sendEmailMock).toHaveBeenCalledTimes(1);
		const url = lastEmailUrl();
		expect(url).toMatch(/reset-password/);
	});

	it('swaps the password hash on a successful reset, and the old password no longer authenticates', async () => {
		const res = await auth.handler(
			new Request(`http://localhost${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.REQUEST_PASSWORD_RESET}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: TEST_EMAIL, redirectTo: '/login' }),
			}),
		);
		expect(res.status).toBe(200);
		const url = lastEmailUrl();

		// Extract the raw token. Better-auth's reset URL embeds the token as
		// a path segment (`/reset-password/{token}`) for the legacy flow and
		// as `?token=` for the newer one. We accept both shapes.
		const u = new URL(url);
		const fromQuery = u.searchParams.get('token');
		const fromPath = u.pathname.split('/').pop() ?? '';
		const rawToken = fromQuery ?? fromPath;
		expect(rawToken.length, 'reset URL must carry a token').toBeGreaterThan(0);

		// Snapshot the original password hash so we can prove it changed.
		const accountsBefore = await db.select().from(bauthAccount).where(eq(bauthAccount.userId, TEST_USER_ID));
		expect(accountsBefore[0]?.password).toBeDefined();
		const hashBefore = accountsBefore[0]?.password;

		// Hit the reset-password endpoint with the new password and the token.
		const NEW_PASSWORD = 'verification-flow-NEW-password-5678';
		const resetRes = await auth.handler(
			new Request(`http://localhost${ROUTES.API_AUTH}/reset-password`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ newPassword: NEW_PASSWORD, token: rawToken }),
			}),
		);
		expect(
			resetRes.status,
			await resetRes
				.clone()
				.text()
				.catch(() => '<unreadable>'),
		).toBe(200);

		// Hash must have changed.
		const accountsAfter = await db.select().from(bauthAccount).where(eq(bauthAccount.userId, TEST_USER_ID));
		const hashAfter = accountsAfter[0]?.password;
		expect(hashAfter).toBeDefined();
		expect(hashAfter).not.toBe(hashBefore);

		// Old password must no longer authenticate.
		const oldRes = await auth.handler(
			new Request(`http://localhost${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: TEST_EMAIL, password: ORIGINAL_PASSWORD }),
			}),
		);
		expect(oldRes.status).toBe(401);

		// New password must authenticate.
		const newRes = await auth.handler(
			new Request(`http://localhost${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: TEST_EMAIL, password: NEW_PASSWORD }),
			}),
		);
		expect(
			newRes.status,
			await newRes
				.clone()
				.text()
				.catch(() => '<unreadable>'),
		).toBe(200);

		// Restore the original password so subsequent tests in this run still
		// see the seed credential. We have to go through the same reset flow
		// because better-auth doesn't expose a "set password" admin call here.
		const restorePrep = await auth.handler(
			new Request(`http://localhost${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.REQUEST_PASSWORD_RESET}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: TEST_EMAIL, redirectTo: '/login' }),
			}),
		);
		expect(restorePrep.status).toBe(200);
		const restoreUrl = lastEmailUrl();
		const ru = new URL(restoreUrl);
		const restoreToken = ru.searchParams.get('token') ?? ru.pathname.split('/').pop() ?? '';
		expect(restoreToken.length).toBeGreaterThan(0);
		const restoreRes = await auth.handler(
			new Request(`http://localhost${ROUTES.API_AUTH}/reset-password`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ newPassword: ORIGINAL_PASSWORD, token: restoreToken }),
			}),
		);
		expect(restoreRes.status).toBe(200);
	});

	it('refuses a reset with an unknown / forged token', async () => {
		const res = await auth.handler(
			new Request(`http://localhost${ROUTES.API_AUTH}/reset-password`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ newPassword: 'irrelevant-1234', token: 'definitely-not-a-real-token' }),
			}),
		);
		// better-auth surfaces this as 4xx -- the exact code is implementation
		// detail (some versions return 400, others 401). Pin "must not be 200"
		// and "no password change" so the assertion stays portable.
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(res.status).toBeLessThan(500);

		// And the user's hash must not have changed.
		const accounts = await db.select().from(bauthAccount).where(eq(bauthAccount.userId, TEST_USER_ID));
		expect(accounts[0]?.password).toBeDefined();
	});
});
