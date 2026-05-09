import { expect, test } from '@playwright/test';
import { DEV_ACCOUNTS, DEV_PASSWORD, ROUTES } from '../../../libs/constants/src';
import { clearAuthRateLimit } from '../fixtures/auth-rate-limit';

test.describe('authentication', () => {
	// Every assertion in this file that follows a sign-in submit has to bounce
	// through a cold-compile of the post-login surface (`/study`, `/insights`,
	// `/memory`). On a fresh dev worker that round trip routinely runs 25-45s,
	// well past the 30s default test budget. Extend the per-test budget for
	// the whole describe so a vite warmup race doesn't masquerade as an auth
	// regression. The action/navigation timeouts on individual sign-in flows
	// are bumped inline below for the same reason.
	test.describe.configure({ timeout: 90_000 });

	// The auth spec drives 4+ real sign-in flows in serial. Better-auth's
	// `/sign-in/email` rate limit is 5/minute/IP, and every test in this
	// suite hits the dev server from `127.0.0.1` -- without a per-test
	// reset the last few tests in the file (and every later spec that
	// needs to authenticate, e.g. the fresh-user fixture) hit 429 and stay
	// stuck on /login. Clearing the bucket between tests keeps each test
	// independent.
	test.beforeEach(async () => {
		await clearAuthRateLimit();
	});
	test('protected route redirects to login with redirectTo', async ({ page }) => {
		// `/insights` is one of the cold-compile-heavy routes (rolled up in
		// PR #653); the implicit 15s navigationTimeout is too tight on a
		// fresh worker. Allow the goto a generous budget while leaving the
		// downstream URL/heading expects on the snappy 5s default -- the
		// real assertion is "we got bounced to /login", not "the page came
		// back instantly".
		const res = await page.goto(ROUTES.DASHBOARD, { timeout: 60_000 });
		expect(res?.status()).toBe(200);
		await expect(page).toHaveURL((url) => {
			return url.pathname === ROUTES.LOGIN && url.searchParams.get('redirectTo') === ROUTES.DASHBOARD;
		});
		await expect(page.getByRole('heading', { name: /Sign in to airboss study/i })).toBeVisible();
	});

	test('root redirects through login to dashboard when unauthed', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.LOGIN);
	});

	test('bad password shows error and clears email on 401', async ({ page }) => {
		const learner = DEV_ACCOUNTS.find((a) => a.role === 'learner');
		if (!learner) throw new Error('learner account missing');

		// Use a real user with a wrong password rather than an unknown email --
		// same user-visible failure path, but avoids an ERROR-level "User not
		// found" log from better-auth on every test run.
		await page.goto(ROUTES.LOGIN);
		await page.getByLabel('Email').fill(learner.email);
		await page.getByLabel('Password').fill('wrong-password');
		await page.getByRole('button', { name: /sign in/i }).click();

		await expect(page.getByRole('alert')).toBeVisible();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.LOGIN);
		// The login action deliberately blanks the echoed email on a 401 so the
		// form does not double as a low-cost user-enumeration assistant. See
		// `apps/study/src/routes/login/+page.server.ts` for the comment that
		// drives this behaviour. A typo on a 400 (validation) still echoes; a
		// credential-check failure does not.
		await expect(page.getByLabel('Email')).toHaveValue('');
	});

	test('happy login lands on study home', async ({ page }) => {
		const learner = DEV_ACCOUNTS.find((a) => a.role === 'learner');
		if (!learner) throw new Error('learner account missing');

		await page.goto(ROUTES.LOGIN);
		await page.getByLabel('Email').fill(learner.email);
		await page.getByLabel('Password').fill(DEV_PASSWORD);
		// The click waits for the post-submit navigation to settle. POST /login
		// 303s through GET / 302s into /study, and on a cold dev worker the
		// /study compile alone burns >15s. Override the action timeout so the
		// click can park on the redirect chain long enough to land.
		await page.getByRole('button', { name: /sign in/i }).click({ timeout: 60_000 });

		// Post-login the (app) root redirects to the Study home (study-home WP).
		// `/dashboard` survives at its existing URL as the "Stats" power-user
		// view; the primary landing surface is `/study`. Allow extra time on
		// toHaveURL so we wait past the cold-compile redirect chain.
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.STUDY, { timeout: 30_000 });
		// `/study` mounts a single visible "Study" H1 (via PageHeader). Use
		// `exact: true` to pin to it (the Study lens entry "Study by ..." in
		// the secondary nav also contains "study").
		await expect(page.getByRole('heading', { name: 'Study', level: 1, exact: true })).toBeVisible();
	});

	test('safe redirectTo is honored after login', async ({ page }) => {
		const learner = DEV_ACCOUNTS.find((a) => a.role === 'learner');
		if (!learner) throw new Error('learner account missing');

		await page.goto(`${ROUTES.LOGIN}?redirectTo=${encodeURIComponent(ROUTES.MEMORY)}`);
		await page.getByLabel('Email').fill(learner.email);
		await page.getByLabel('Password').fill(DEV_PASSWORD);
		// See the cold-compile note on the happy-login test -- `/memory` is
		// the redirect target here and it pulls the same vite warmup tax.
		await page.getByRole('button', { name: /sign in/i }).click({ timeout: 60_000 });

		await expect(page).toHaveURL((url) => url.pathname === ROUTES.MEMORY, { timeout: 30_000 });
		await expect(page.getByRole('heading', { name: 'Memory' })).toBeVisible();
	});

	test('unsafe redirectTo falls back to study home', async ({ page }) => {
		const learner = DEV_ACCOUNTS.find((a) => a.role === 'learner');
		if (!learner) throw new Error('learner account missing');

		await page.goto(`${ROUTES.LOGIN}?redirectTo=${encodeURIComponent('//evil.example.com/x')}`);
		await page.getByLabel('Email').fill(learner.email);
		await page.getByLabel('Password').fill(DEV_PASSWORD);
		// Same cold-compile rationale as happy-login -- the fallback target
		// `/study` has to compile before the click resolves.
		await page.getByRole('button', { name: /sign in/i }).click({ timeout: 60_000 });

		// Fallback target is ROUTES.HOME ("/"), which itself redirects to
		// /study (study-home WP).
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.STUDY, { timeout: 30_000 });
	});
});
