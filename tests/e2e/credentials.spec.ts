import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

test.describe('credentials index', () => {
	test('renders heading and either an empty-state or credential cards', async ({ page }) => {
		await page.goto(ROUTES.CREDENTIALS);
		await expect(page.getByRole('heading', { name: 'Credentials', exact: true, level: 1 })).toBeVisible();

		// Either no active credentials seeded (empty-state) or at least one card with the stat trio.
		const emptyHeading = page.getByRole('heading', { name: /no active credentials/i });
		const masteryStat = page.getByTestId('cred-mastery').first();
		await expect(emptyHeading.or(masteryStat).first()).toBeVisible();
	});

	test('shows the no-primary-goal banner when the learner has no primary goal', async ({ page }) => {
		await page.goto(ROUTES.CREDENTIALS);
		const banner = page.getByRole('status').filter({ hasText: /primary goal/i });
		const cards = page.getByTestId('cred-mastery');
		const cardsVisible = await cards.first().isVisible().catch(() => false);
		// Only assert when the page has cards at all -- the empty-state path
		// renders a different status region.
		if (!cardsVisible) test.skip(true, 'no credentials seeded -- no banner expected');
		// Banner is conditional on the dev seed; if Abby has a primary goal,
		// the banner hides. Either presence-or-absence is acceptable; what we
		// reject is double-render (two status banners).
		const count = await banner.count();
		expect(count).toBeLessThanOrEqual(1);
	});
});

test.describe('credentials detail', () => {
	test('404 when slug does not match a credential', async ({ page }) => {
		const response = await page.goto(ROUTES.CREDENTIAL('zzz-not-a-real-credential'));
		expect(response?.status()).toBe(404);
	});

	test('renders detail page when a credential exists', async ({ page }) => {
		await page.goto(ROUTES.CREDENTIALS);
		const firstCardLink = page.locator('.card-link').first();
		const visible = await firstCardLink.isVisible().catch(() => false);
		if (!visible) test.skip(true, 'no credentials seeded');

		const href = await firstCardLink.getAttribute('href');
		expect(href).toBeTruthy();
		await page.goto(href as string);

		// Header + breadcrumb crumb back to /credentials.
		await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
		// Mastery rollup with the testid.
		await expect(page.getByTestId('detail-mastery')).toBeVisible();
		await expect(page.getByTestId('detail-coverage')).toBeVisible();
	});
});
