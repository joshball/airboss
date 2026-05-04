import { expect, test as setup } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DEV_ACCOUNTS, DEV_DB_URL, DEV_PASSWORD, DEV_SEED_LEARNER_EMAIL, ENV_VARS, ROUTES } from '../../libs/constants/src';

const STORAGE = 'tests/e2e/.auth/learner.json';

setup('authenticate learner', async ({ page }) => {
	await mkdir(dirname(STORAGE), { recursive: true });

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
		// silently break the storage-state capture.
		page.waitForURL((url) => url.pathname === ROUTES.STUDY || url.pathname === ROUTES.DASHBOARD),
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
	if (!process.env[ENV_VARS.DATABASE_URL]) {
		process.env[ENV_VARS.DATABASE_URL] = DEV_DB_URL;
	}
	const { seedErrataFixtures } = await import('./seed-errata');
	const inserted = await seedErrataFixtures();
	expect(inserted).toBeGreaterThanOrEqual(3);
});
