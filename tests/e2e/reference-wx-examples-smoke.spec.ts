import { expect, test } from '@playwright/test';
import { QUERY_PARAMS, ROUTES } from '../../libs/constants/src';

/**
 * Drill Phase 2 smoke for the browsable catalog page at
 * `/reference/wx/products/<slug>/examples`. Covers the METAR product, which
 * is the densest in the catalog (50+ examples across 40+ token families),
 * so chip filter, search, and decode-on-demand can each be exercised
 * against real data without needing per-product fixtures.
 */
test.describe('reference -- wx product examples (METAR)', () => {
	const url = ROUTES.REFERENCE_WX_PRODUCT_EXAMPLES('metar');

	test('renders the example list with at least 10 cards', async ({ page }) => {
		await page.goto(url);

		await expect(page.getByRole('heading', { level: 1 })).toContainText('METAR');

		const cards = page.locator('[data-testid^="example-card-"]');
		await expect(cards.first()).toBeVisible();
		const count = await cards.count();
		expect(count).toBeGreaterThanOrEqual(10);
	});

	test('clicking a token-family chip filters the list', async ({ page }) => {
		await page.goto(url);

		const chip = page.getByTestId('family-chip-wind-gust');
		await expect(chip).toBeVisible();

		const before = await page.locator('[data-testid^="example-card-"]').count();
		await chip.click();
		await page.waitForURL(new RegExp(`${QUERY_PARAMS.FAMILIES}=wind-gust`));

		const cards = page.locator('[data-testid^="example-card-"]');
		const after = await cards.count();
		expect(after).toBeGreaterThan(0);
		expect(after).toBeLessThan(before);

		// Every visible card must list `wind-gust` in its families row.
		for (let i = 0; i < after; i++) {
			const card = cards.nth(i);
			await expect(card).toContainText('wind-gust');
		}
	});

	test('expanding an example renders token-walk annotations', async ({ page }) => {
		await page.goto(url);

		const firstCard = page.locator('[data-testid^="example-card-"]').first();
		const slug = await firstCard.getAttribute('data-testid');
		expect(slug).toMatch(/^example-card-/);
		const exampleSlug = slug!.replace(/^example-card-/, '');

		await page.getByTestId(`example-decode-${exampleSlug}`).click();
		await page.waitForURL(new RegExp(`${QUERY_PARAMS.EXPAND}=`));

		const panel = page.getByTestId(`example-annotations-${exampleSlug}`);
		await expect(panel).toBeVisible();
		await expect(panel).toContainText('Token walk');
		// The annotation list contains at least one token + decode pair.
		await expect(panel.locator('code').first()).toBeVisible();
	});

	test('search filters by raw substring', async ({ page }) => {
		await page.goto(url);

		const before = await page.locator('[data-testid^="example-card-"]').count();
		await page.getByTestId('examples-search-input').fill('TSRA');
		await page.getByRole('button', { name: 'Search' }).click();
		await page.waitForURL(new RegExp(`${QUERY_PARAMS.SEARCH}=TSRA`));

		const cards = page.locator('[data-testid^="example-card-"]');
		const after = await cards.count();
		expect(after).toBeGreaterThan(0);
		expect(after).toBeLessThanOrEqual(before);
		// First match must contain the searched substring in its raw text block.
		await expect(cards.first().getByTestId(/example-raw-/)).toContainText('TSRA');
	});

	test('product detail page exposes Browse-examples and Drill buttons', async ({ page }) => {
		await page.goto(ROUTES.REFERENCE_WX_PRODUCT('metar'));

		const browse = page.getByTestId('wx-product-browse-examples');
		await expect(browse).toBeVisible();
		await expect(browse).toHaveAttribute('href', ROUTES.REFERENCE_WX_PRODUCT_EXAMPLES('metar'));

		const drill = page.getByTestId('wx-product-drill');
		await expect(drill).toBeVisible();
		await expect(drill).toHaveAttribute('href', ROUTES.PRACTICE_WX_DRILL);
	});
});
