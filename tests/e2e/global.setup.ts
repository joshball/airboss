import { expect, test as setup } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DEV_ACCOUNTS, DEV_DB_URL_E2E, DEV_PASSWORD, DEV_SEED_LEARNER_EMAIL, ENV_VARS, ROUTES } from '../../libs/constants/src';
import { clearAuthRateLimit } from './fixtures/auth-rate-limit';

const STORAGE = 'tests/e2e/.auth/learner.json';

setup('authenticate learner', async ({ page }) => {
	// Cold-compile of `/study` (the post-login redirect target) can spend
	// 25-45s on a fresh dev server when this setup races against parallel
	// projects also pulling vite to compile new routes (the chromium-unauthed
	// auth specs all chain into `/study`, `/insights`, `/memory`). The 30s
	// default test timeout is consistently insufficient on cold runs --
	// extend so this load-bearing setup doesn't gate 19 dependent specs on
	// a dev-server warmup race.
	setup.setTimeout(90_000);
	await mkdir(dirname(STORAGE), { recursive: true });
	await clearAuthRateLimit();

	// Abby is the canonical dev-seed learner -- all seeded plans/sessions/
	// reviews/personal cards own to her, so e2e specs that read from those
	// fixtures need to be signed in as Abby. The older `learner@airboss.test`
	// account exists but has no seed content attached.
	const learner = DEV_ACCOUNTS.find((a) => a.email === DEV_SEED_LEARNER_EMAIL);
	if (!learner) throw new Error(`DEV_ACCOUNTS missing the seed learner '${DEV_SEED_LEARNER_EMAIL}'`);

	await page.goto(ROUTES.LOGIN);
	await page.getByLabel('Email').fill(learner.email);
	await page.getByLabel('Password').fill(DEV_PASSWORD);
	await Promise.all([
		// Post-login the (app) root redirects to the Study home surface, not
		// the legacy /dashboard route (which is now the "Stats" power-user
		// view). Match both pathnames so a future redirect change doesn't
		// silently break the storage-state capture. The explicit 60s budget
		// covers the dev-server cold-compile of `/study` -- the implicit
		// `navigationTimeout` of 15s is too tight on a fresh worker.
		page.waitForURL((url) => url.pathname === ROUTES.STUDY || url.pathname === ROUTES.DASHBOARD, {
			timeout: 60_000,
		}),
		page.getByRole('button', { name: /sign in/i }).click(),
	]);

	// Confirm we landed on a known authenticated surface. Study home renders
	// the "Study" H1; the older /dashboard surface still uses "Dashboard".
	// Accept either so the storage-state capture stays stable across the
	// home redirect target.
	await expect(page.getByRole('heading', { name: /^(study|learning dashboard|dashboard)$/i, level: 1 })).toBeVisible();

	await page.context().storageState({ path: STORAGE });
});

// Errata fixtures for the handbook amendment panel spec. The dev-seed
// pipeline doesn't run the apply-errata Python flow, so the table is empty
// without this hook. See R6.12a in the apply-errata-and-afh-mosaic WP.
setup('seed handbook errata fixtures', async () => {
	// First run resolves a postgres connection on the e2e DB and walks every
	// referenced AFH section row -- on a cold connection pool against a
	// freshly-provisioned database this consistently exceeds the 30s default
	// test budget. Extend so the seed has room to complete the lookups.
	setup.setTimeout(90_000);
	// Force the e2e DB (`airboss_e2e`) -- the same database the playwright
	// webServer entries point every spawned vite process at. Bun auto-loads
	// `.env` from cwd which sets `DATABASE_URL` to the developer's working
	// DB; without this hard override the seed lands there, the webserver
	// reads from the e2e DB, and the amendment-panel spec finds no rows.
	process.env[ENV_VARS.DATABASE_URL] = DEV_DB_URL_E2E;
	const { seedErrataFixtures } = await import('./seed-errata');
	const inserted = await seedErrataFixtures();
	expect(inserted).toBeGreaterThanOrEqual(3);
});
