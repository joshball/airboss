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
		await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
		await expect(nav.getByRole('link', { name: 'Memory' })).toBeVisible();
		await expect(nav.getByRole('link', { name: 'Reps' })).toBeVisible();
		await expect(nav.getByRole('link', { name: 'Calibration' })).toBeVisible();
	});

	test('root path redirects to dashboard', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.DASHBOARD);
	});

	test('nav links navigate to their surfaces', async ({ page }) => {
		await page.goto(ROUTES.DASHBOARD);
		const nav = page.getByRole('navigation', { name: 'Primary' });

		await nav.getByRole('link', { name: 'Memory' }).click();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.MEMORY);

		await nav.getByRole('link', { name: 'Reps' }).click();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.REPS);

		await nav.getByRole('link', { name: 'Calibration' }).click();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.CALIBRATION);

		await nav.getByRole('link', { name: 'Dashboard' }).click();
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
