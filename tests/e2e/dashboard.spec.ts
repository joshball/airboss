import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

test.describe('dashboard', () => {
	test('renders Dashboard heading', async ({ page }) => {
		await page.goto(ROUTES.DASHBOARD);
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
	});

	test('primary nav exposes all surfaces', async ({ page }) => {
		await page.goto(ROUTES.DASHBOARD);
		const nav = page.getByRole('navigation', { name: 'Primary' });
		// Post-study-home WP: the legacy "Dashboard" nav label was renamed to
		// "Stats" while keeping its URL. The Study-home page is the new
		// post-login home.
		await expect(nav.getByRole('link', { name: 'Stats' })).toHaveAttribute('aria-current', 'page');
		// Memory is a `<details><summary>` disclosure group. `<summary>` has no
		// stable cross-browser ARIA role (Chromium exposes it without role),
		// so locate it by tag/text instead of role.
		await expect(nav.locator('summary').filter({ hasText: 'Memory' })).toBeVisible();
		await expect(nav.getByRole('link', { name: 'Reps' })).toBeVisible();
		await expect(nav.getByRole('link', { name: 'Calibration' })).toBeVisible();
		// Flightbag link moved out of the Primary nav and into the header's
		// right cluster (Help/Flightbag/theme/account) per the shared
		// `AppHeader` rollout. It points at the cross-subdomain flightbag app
		// derived from the live request URL so dev and prod both work without
		// a hardcoded origin. Assert it's reachable from the page banner with
		// an absolute href that resolves to the flightbag subdomain.
		const banner = page.getByRole('banner');
		const flightbag = banner.getByRole('link', { name: 'Flightbag' });
		await expect(flightbag).toBeVisible();
		const flightbagHref = await flightbag.getAttribute('href');
		expect(flightbagHref).toMatch(/^https?:\/\/flightbag\./);
	});

	test('root path redirects to study home', async ({ page }) => {
		// Post-WP study-home: `/` redirects to `/study` (the new post-login
		// home). `/dashboard` is preserved at its URL as the "Stats" view.
		await page.goto('/');
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.STUDY);
	});

	test('nav links navigate to their surfaces', async ({ page }) => {
		await page.goto(ROUTES.DASHBOARD);
		const nav = page.getByRole('navigation', { name: 'Primary' });

		// Memory is a `<details>` menu; expand the summary first then click
		// the Overview menu item that targets ROUTES.MEMORY. `<summary>` is
		// not reliably exposed via role in Chromium, so click by tag/text.
		await nav.locator('summary').filter({ hasText: 'Memory' }).click();
		await nav.getByRole('menuitem', { name: 'Overview' }).click();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.MEMORY);

		await nav.getByRole('link', { name: 'Reps' }).click();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.REPS);

		await nav.getByRole('link', { name: 'Calibration' }).click();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.CALIBRATION);

		await nav.getByRole('link', { name: 'Stats' }).click();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.DASHBOARD);
	});

	test('logout clears session and returns to login', async ({ page }) => {
		await page.goto(ROUTES.DASHBOARD);
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

		// Logout is POST-only (no UI button today). Build a form in the page
		// and submit it so cookies flow through the same browser context.
		await page.evaluate((logoutPath) => {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = logoutPath;
			document.body.appendChild(form);
			form.submit();
		}, ROUTES.LOGOUT);

		await page.waitForURL((url) => url.pathname === ROUTES.LOGIN);

		// Confirm the session is gone: visiting a protected route sends us back.
		await page.goto(ROUTES.DASHBOARD);
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.LOGIN);
	});
});
