import { expect, test } from '@playwright/test';
import { DEV_ACCOUNTS, DEV_PASSWORD, ROUTES } from '../../../libs/constants/src';

test.describe('authentication', () => {
	test('protected route redirects to login with redirectTo', async ({ page }) => {
		const res = await page.goto(ROUTES.DASHBOARD);
		expect(res?.status()).toBe(200);
		await expect(page).toHaveURL((url) => {
			return url.pathname === ROUTES.LOGIN && url.searchParams.get('redirectTo') === ROUTES.DASHBOARD;
		});
		await expect(page.getByRole('heading', { name: 'airboss' })).toBeVisible();
	});

	test('root redirects through login to dashboard when unauthed', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.LOGIN);
	});

	test('bad password shows error, preserves email', async ({ page }) => {
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
		await expect(page.getByLabel('Email')).toHaveValue(learner.email);
	});

	test('happy login lands on dashboard', async ({ page }) => {
		const learner = DEV_ACCOUNTS.find((a) => a.role === 'learner');
		if (!learner) throw new Error('learner account missing');

		await page.goto(ROUTES.LOGIN);
		await page.getByLabel('Email').fill(learner.email);
		await page.getByLabel('Password').fill(DEV_PASSWORD);
		await page.getByRole('button', { name: /sign in/i }).click();

		await expect(page).toHaveURL((url) => url.pathname === ROUTES.DASHBOARD);
		await expect(page.getByRole('heading', { name: 'Learning Dashboard' })).toBeVisible();
	});

	test('safe redirectTo is honored after login', async ({ page }) => {
		const learner = DEV_ACCOUNTS.find((a) => a.role === 'learner');
		if (!learner) throw new Error('learner account missing');

		await page.goto(`${ROUTES.LOGIN}?redirectTo=${encodeURIComponent(ROUTES.MEMORY)}`);
		await page.getByLabel('Email').fill(learner.email);
		await page.getByLabel('Password').fill(DEV_PASSWORD);
		await page.getByRole('button', { name: /sign in/i }).click();

		await expect(page).toHaveURL((url) => url.pathname === ROUTES.MEMORY);
		await expect(page.getByRole('heading', { name: 'Memory' })).toBeVisible();
	});

	test('unsafe redirectTo falls back to home', async ({ page }) => {
		const learner = DEV_ACCOUNTS.find((a) => a.role === 'learner');
		if (!learner) throw new Error('learner account missing');

		await page.goto(`${ROUTES.LOGIN}?redirectTo=${encodeURIComponent('//evil.example.com/x')}`);
		await page.getByLabel('Email').fill(learner.email);
		await page.getByLabel('Password').fill(DEV_PASSWORD);
		await page.getByRole('button', { name: /sign in/i }).click();

		// Fallback target is ROUTES.HOME, which itself redirects to dashboard.
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.DASHBOARD);
	});
});
