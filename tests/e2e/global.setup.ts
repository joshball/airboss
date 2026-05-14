import { expect, test as setup } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
	DEV_ACCOUNTS,
	DEV_DB_URL_E2E,
	DEV_PASSWORD,
	DEV_SEED_LEARNER_EMAIL,
	ENV_VARS,
	ROUTES,
} from '../../libs/constants/src';
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

// 3-level course tree fixture (course-tree-arbitrary-depth WP, Phase D).
// The seed pipeline skips `_fixtures/` by default; this hook opts the
// 3-level fixture into the e2e DB so the n-deep renderer + prev/next
// spec at `tests/e2e/course-tree-n-deep.spec.ts` can drive a real
// browser through the nested outline.
setup('seed 3-level course fixture', async () => {
	setup.setTimeout(90_000);
	process.env[ENV_VARS.DATABASE_URL] = DEV_DB_URL_E2E;
	const { seedThreeLevelFixture } = await import('./seed-3-level-fixture');
	const result = await seedThreeLevelFixture();
	// Assert the rows are present, not that they were freshly upserted.
	// `stepsUpserted` is 0 on idempotent re-runs (content_hash unchanged);
	// `stepsSeeded` adds the skipped-but-present rows.
	expect(result.stepsSeeded).toBeGreaterThanOrEqual(4);
});
