import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

test.describe('handbook lens', () => {
	test('index renders heading and lists handbooks or empty state', async ({ page }) => {
		await page.goto(ROUTES.LENS_HANDBOOK);
		await expect(page.getByRole('heading', { name: 'Handbook lens', exact: true, level: 1 })).toBeVisible();

		const empty = page.getByRole('heading', { name: /no handbooks ingested/i });
		const card = page.locator('.card-link').first();
		await expect(empty.or(card).first()).toBeVisible();
	});

	test('404 when handbook slug does not match', async ({ page }) => {
		const response = await page.goto(ROUTES.LENS_HANDBOOK_DOC('nope-not-a-handbook'));
		expect(response?.status()).toBe(404);
	});
});

test.describe('weakness lens', () => {
	test('index renders heading and either buckets or empty state', async ({ page }) => {
		await page.goto(ROUTES.LENS_WEAKNESS);
		await expect(page.getByRole('heading', { name: 'Weakness lens', exact: true, level: 1 })).toBeVisible();

		const empty = page.getByRole('heading', { name: /no weakness signal yet/i });
		const severityPill = page.locator('.severity-pill').first();
		await expect(empty.or(severityPill).first()).toBeVisible();
	});

	test('404 when severity bucket name is not a valid value', async ({ page }) => {
		const response = await page.goto(ROUTES.LENS_WEAKNESS_BUCKET('extreme'));
		expect(response?.status()).toBe(404);
	});

	test('valid severity bucket loads', async ({ page }) => {
		await page.goto(ROUTES.LENS_WEAKNESS_BUCKET('mild'));
		await expect(page.getByRole('heading', { name: 'Mild', exact: true, level: 1 })).toBeVisible();
	});
});

test.describe('lens redirect', () => {
	test('/lens redirects to /lens/handbook', async ({ page }) => {
		await page.goto('/lens');
		await expect(page).toHaveURL(ROUTES.LENS_HANDBOOK);
	});
});
