/**
 * Hangar e2e setup.
 *
 * Authenticates the canonical admin account against the hangar app and
 * persists the storage state for the dependent `hangar` Playwright project.
 * Runs once per `bun run test e2e` invocation; `reuseExistingServer: true`
 * means the dev server stays warm across local re-runs and the storage
 * state file survives until a fresh `setup` rewrites it.
 *
 * `joshua@ball.dev` is the seeded admin (DEV_ACCOUNTS[0]) -- author /
 * operator / admin gates all pass, the bucket + loader admin pages render,
 * and the Nav `Users` link surfaces. The tests rely on every gate being
 * satisfied; using a non-admin would force a different `chromium-hangar-*`
 * project per role tier, which the work-package test plan doesn't ask
 * for.
 *
 * After login we seed-trigger the loader once. The hangar review board's
 * `getOrCreateBoard()` lazily creates the board + columns + buckets on
 * first authenticated `/review` hit; running the loader from the admin
 * surface populates `review_item` rows so the board specs find at least
 * one WP card to drag. The seed is idempotent.
 */

import { expect, test as setup } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DEV_ACCOUNTS, DEV_PASSWORD, ROUTES } from '../../../libs/constants/src';
import { clearAuthRateLimit } from '../fixtures/auth-rate-limit';

const STORAGE = 'tests/e2e/.auth/hangar-admin.json';

// The seed task reads the storage state file written by the auth task.
// Without serial mode, fullyParallel runs them on different workers and
// seed opens its context against an empty/stale file before auth finishes
// signing in -- the loader page redirects to /login and the test times
// out at 30s waiting for a button that never renders.
setup.describe.configure({ mode: 'serial' });

setup('authenticate hangar admin', async ({ page }) => {
	await mkdir(dirname(STORAGE), { recursive: true });
	// Drop better-auth's `127.0.0.1` rate-limit bucket so the admin login
	// here doesn't collide with a previously-saturated bucket from the
	// auth spec or the learner setup. See `fixtures/auth-rate-limit.ts`
	// for the `5 attempts / minute / IP` cap that drives the issue.
	await clearAuthRateLimit();

	const admin = DEV_ACCOUNTS.find((a) => a.role === 'admin');
	if (!admin) throw new Error('DEV_ACCOUNTS missing an admin entry');

	await page.goto(ROUTES.LOGIN);
	await page.getByLabel('Email').fill(admin.email);
	await page.getByLabel('Password').fill(DEV_PASSWORD);
	await Promise.all([
		// Hangar login redirects to `/` (HANGAR_HOME). The (app) layout's
		// `requireRole(AUTHOR | OPERATOR | ADMIN)` accepts the admin and
		// renders the home surface.
		page.waitForURL((url) => url.pathname === ROUTES.HANGAR_HOME, { timeout: 15_000 }),
		page.getByRole('button', { name: /sign in/i }).click(),
	]);

	// Confirm we landed inside (app) -- the persistent app header carries
	// the brand link back to home and the Nav links out to Sources / Docs /
	// Review. A failed auth would have bounced us back to /login.
	await expect(page.getByRole('link', { name: /^Review/ }).first()).toBeVisible();

	await page.context().storageState({ path: STORAGE });
});

setup('seed hangar review items', async ({ browser }) => {
	// Boot a fresh context that mounts the admin session captured by the
	// previous `authenticate hangar admin` test. Without it the loader page
	// would redirect to /login (no auth) and the "Run loader now" button
	// would never resolve -- the previous failure mode this guards against.
	// Hand-rolling a context is the right shape here because the surrounding
	// `setup.use({ storageState })` would also apply to the auth test that
	// CREATES the file, which has a chicken-and-egg problem on a fresh run.
	const context = await browser.newContext({ storageState: STORAGE });
	const page = await context.newPage();
	try {
		await page.goto(ROUTES.HANGAR_REVIEW_ADMIN_LOADER);
		await Promise.all([
			page.waitForResponse((res) => res.request().method() === 'POST' && res.url().includes('?/runLoader'), {
				timeout: 60_000,
			}),
			// The loader scans every work-package + knowledge-node markdown
			// file under the repo and populates `hangar.review_item`; first
			// run on a fresh DB easily blows past playwright's default 5s
			// action timeout. Give the click a 60s budget that matches the
			// response-wait above.
			page.getByRole('button', { name: /run loader now/i }).click({ timeout: 60_000 }),
		]);
		// The "Last run" card flips from "No loader run since the hangar process started"
		// to a populated <dl> after the form action returns.
		await expect(page.getByText(/Items added/i)).toBeVisible({ timeout: 30_000 });
	} finally {
		await context.close();
	}
});
