import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

/**
 * `dashboard.spec.ts` covers the post-login surface that ROUTES.DASHBOARD
 * resolves to. Post-IA-cleanup (Phase 3) the surface lives at `/insights`
 * with H1 "Insights"; the legacy "Dashboard" / "Stats" naming was retired
 * along with the standalone Memory / Reps / Calibration nav entries (now
 * consolidated under the Learn + Insights sections).
 */
test.describe('dashboard', () => {
	test('renders Insights heading', async ({ page }) => {
		await page.goto(ROUTES.DASHBOARD);
		await expect(page.getByRole('heading', { name: 'Insights', level: 1 })).toBeVisible();
	});

	test('primary nav exposes all surfaces', async ({ page }) => {
		await page.goto(ROUTES.DASHBOARD);
		const nav = page.getByRole('navigation', { name: 'Primary' });
		// Post-IA-cleanup nav: Study / Learn / Program / Insights / Reference.
		// Insights is the active surface here, so it carries `aria-current`.
		await expect(nav.getByRole('link', { name: 'Insights', exact: true })).toHaveAttribute('aria-current', 'page');
		await expect(nav.getByRole('link', { name: 'Study', exact: true })).toBeVisible();
		await expect(nav.getByRole('link', { name: 'Learn', exact: true })).toBeVisible();
		await expect(nav.getByRole('link', { name: 'Program', exact: true })).toBeVisible();
		await expect(nav.getByRole('link', { name: 'Reference', exact: true })).toBeVisible();
		// Flightbag link lives in the header's right cluster (Help / search /
		// glossary / Flightbag / theme / account) per the shared `AppHeader`
		// rollout. It points at the cross-subdomain flightbag app derived
		// from the live request URL so dev and prod both work without a
		// hardcoded origin.
		const banner = page.getByRole('banner');
		const flightbag = banner.getByRole('link', { name: 'Flightbag' });
		await expect(flightbag).toBeVisible();
		const flightbagHref = await flightbag.getAttribute('href');
		expect(flightbagHref).toMatch(/^https?:\/\/flightbag\./);
	});

	test('root path redirects to study home', async ({ page }) => {
		// Post-WP study-home: `/` redirects to `/study` (the new post-login
		// home). `/insights` is the rebranded former dashboard surface.
		await page.goto('/');
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.STUDY);
	});

	test('nav links navigate to their surfaces', async ({ page }) => {
		await page.goto(ROUTES.DASHBOARD);
		const nav = page.getByRole('navigation', { name: 'Primary' });

		await nav.getByRole('link', { name: 'Study', exact: true }).click();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.STUDY);

		await nav.getByRole('link', { name: 'Learn', exact: true }).click();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.LEARN);

		await nav.getByRole('link', { name: 'Program', exact: true }).click();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.PROGRAM);

		await nav.getByRole('link', { name: 'Reference', exact: true }).click();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.REFERENCE);

		await nav.getByRole('link', { name: 'Insights', exact: true }).click();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.INSIGHTS);
	});

	test('logout clears session and returns to login', async ({ page }) => {
		await page.goto(ROUTES.DASHBOARD);
		await expect(page.getByRole('heading', { name: 'Insights', level: 1 })).toBeVisible();

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
