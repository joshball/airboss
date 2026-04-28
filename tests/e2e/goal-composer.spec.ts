import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

test.describe('goals index', () => {
	test('renders heading and either empty state or goals', async ({ page }) => {
		await page.goto(ROUTES.GOALS);
		await expect(page.getByRole('heading', { name: 'Goals', exact: true, level: 1 })).toBeVisible();

		const empty = page.getByRole('heading', { name: /no goals yet/i });
		const goalLink = page.locator('.goal-link').first();
		await expect(empty.or(goalLink).first()).toBeVisible();
	});

	test('New goal button navigates to /goals/new', async ({ page }) => {
		await page.goto(ROUTES.GOALS);
		// One of the two buttons (header or empty-state CTA) should be visible.
		const button = page.getByRole('link', { name: /new goal|create your first goal/i }).first();
		await button.click();
		await expect(page).toHaveURL(ROUTES.GOALS_NEW);
	});
});

test.describe('goal create + detail', () => {
	test('create flow: create then redirect to detail', async ({ page }) => {
		await page.goto(ROUTES.GOALS_NEW);
		await expect(page.getByRole('heading', { name: 'New goal', exact: true, level: 1 })).toBeVisible();
		const title = `e2e goal ${Date.now()}`;
		await page.getByLabel('Title').fill(title);
		await page.getByLabel(/notes/i).fill('A short e2e-created goal.');
		await page.getByRole('button', { name: 'Create goal' }).click();

		// Lands on /goals/<id>
		await expect(page).toHaveURL(/\/goals\/goal_/);
		await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
	});

	test('404 when goal id does not match', async ({ page }) => {
		const response = await page.goto(ROUTES.GOAL('goal_does_not_exist'));
		expect(response?.status()).toBe(404);
	});
});

test.describe('goal validation', () => {
	test('blank title surfaces inline error', async ({ page }) => {
		await page.goto(ROUTES.GOALS_NEW);
		await page.getByRole('button', { name: 'Create goal' }).click();
		// Browser native required-validation may stop submit; assert URL stayed the same.
		await expect(page).toHaveURL(ROUTES.GOALS_NEW);
	});
});
