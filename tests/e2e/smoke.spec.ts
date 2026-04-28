import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

/**
 * Routes with a stable heading we can verify via role/name. MEMORY_REVIEW is
 * handled separately below because it renders a card-review UI with no heading
 * when there are due cards.
 */
const AUTHED_ROUTES: ReadonlyArray<{ path: string; heading: RegExp }> = [
	{ path: ROUTES.DASHBOARD, heading: /^dashboard$/i },
	{ path: ROUTES.MEMORY, heading: /^memory$/i },
	{ path: ROUTES.MEMORY_NEW, heading: /new card/i },
	{ path: ROUTES.MEMORY_BROWSE, heading: /browse/i },
	{ path: ROUTES.REPS, heading: /decision reps/i },
	{ path: ROUTES.REPS_NEW, heading: /scenario/i },
	{ path: ROUTES.REPS_BROWSE, heading: /browse|scenarios/i },
	{ path: ROUTES.CALIBRATION, heading: /calibration/i },
];

test.describe('smoke: authed routes load', () => {
	for (const { path, heading } of AUTHED_ROUTES) {
		test(`${path} loads with a heading`, async ({ page }) => {
			const res = await page.goto(path);
			expect(res?.status(), `expected 2xx for ${path}`).toBeLessThan(400);
			await expect(page).toHaveURL((url) => url.pathname === path, { timeout: 3_000 });
			await expect(page.locator('h1, h2').filter({ hasText: heading }).first()).toBeVisible();
		});
	}

	test(`${ROUTES.MEMORY_REVIEW} loads (empty state or review UI)`, async ({ page }) => {
		const res = await page.goto(ROUTES.MEMORY_REVIEW);
		expect(res?.status()).toBeLessThan(400);
		const caughtUp = page.getByRole('heading', { name: /all caught up/i });
		const ratingBtn = page.locator('button[data-rating]').first();
		// Either review-complete heading or a rating button visible once a card
		// is revealed. Both are valid "loaded" states. Scope away the
		// InfoTip trigger ("Learn more about Show answer") which also matches.
		const showAnswer = page
			.locator('button:not([data-testid="infotip-trigger"])')
			.filter({ hasText: /show answer/i })
			.first();
		await expect(caughtUp.or(showAnswer).or(ratingBtn)).toBeVisible();
	});

	test('no console errors on dashboard load', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(String(err)));
		page.on('console', (msg) => {
			if (msg.type() === 'error') errors.push(msg.text());
		});
		await page.goto(ROUTES.DASHBOARD);
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
		// SvelteKit/Vite inject HMR-only inline scripts in dev that aren't on
		// our hashed CSP allow-list. The pre-hydration script (the one we own)
		// has its hash baked into svelte.config.js, so it never trips this. In
		// production builds CSP is satisfied because the only inline script is
		// %theme-pre-hydration%. Filter the dev-only CSP noise so the test still
		// catches real runtime errors.
		const realErrors = errors.filter((e) => !/Content Security Policy/i.test(e));
		expect(realErrors, `unexpected console errors: ${realErrors.join('\n')}`).toEqual([]);
	});
});
