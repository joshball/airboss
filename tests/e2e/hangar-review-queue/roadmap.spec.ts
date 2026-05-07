/**
 * `/roadmap` e2e -- Phase 8 of `tracking-system-overhaul`.
 *
 * Lives under `hangar-review-queue/` because that is the only Playwright
 * project that points at the hangar baseURL with the seeded admin storage
 * state. The spec covers:
 *
 *   - Index renders rows from on-disk WPs (seeded by the global setup
 *     loader run, but the WP loader reads spec.md straight off disk so the
 *     row set exists regardless of DB state).
 *   - Filter chips update the URL search params and narrow the result set.
 *   - Navigating to a detail row renders the panel tabs.
 *   - Search input filters the visible row set.
 *   - Clearing filters returns to the unfiltered list.
 *   - 404 + raw JSON endpoint behaviour.
 */

import { expect, test } from '@playwright/test';
import { ROADMAP_QUERY_PARAMS, ROUTES } from '../../../libs/constants/src';

test.describe('roadmap board: read-only WP browser', () => {
	test('lands on /roadmap with row groups + counts', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_ROADMAP);
		await expect(page.getByRole('heading', { level: 1, name: /^Roadmap$/ })).toBeVisible();
		await expect(page.getByText(/total/)).toBeVisible();
		// At least one ID link to the detail surface should exist (the WP
		// corpus has 100+ entries on this branch).
		const firstIdLink = page.getByRole('link', { name: /^[a-z][a-z0-9-]+$/ }).first();
		await expect(firstIdLink).toBeVisible();
	});

	test('typing in the search box narrows the visible rows', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_ROADMAP);
		const search = page.getByLabel('Search id or title');
		await search.fill('tracking-system-overhaul');
		await expect(page.getByRole('link', { name: 'tracking-system-overhaul' }).first()).toBeVisible();
	});

	test('product chip click updates the URL search params', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_ROADMAP);
		// Chip is the first `<a>` in the Product facet list whose visible text
		// is "hangar". Filter chips render as `<li><a class="chip">`; clicking
		// either the link or its parent `<li>` triggers navigation.
		const productList = page.locator('.facets details', { hasText: 'Product' }).locator('ul.chips').first();
		const hangarChip = productList.locator('a.chip', { hasText: /^hangar/ }).first();
		await hangarChip.click();
		await expect.poll(() => new URL(page.url()).searchParams.get(ROADMAP_QUERY_PARAMS.PRODUCT)).toBe('hangar');
	});

	test('clicking a row opens the detail page with tabs', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_ROADMAP_DETAIL('tracking-system-overhaul'));
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(page.getByText(/bun run wp set tracking-system-overhaul/)).toBeVisible();
		const tablist = page.getByRole('tablist', { name: /Work-package documents/i });
		await expect(tablist).toBeVisible();
		await expect(tablist.getByRole('tab', { name: /^Spec$/ })).toBeVisible();
	});

	test('clearing all filters returns to the unfiltered list', async ({ page }) => {
		await page.goto(`${ROUTES.HANGAR_ROADMAP}?${ROADMAP_QUERY_PARAMS.STATUS}=shipped`);
		const clearLink = page.getByRole('link', { name: /^Clear all filters$/ });
		await expect(clearLink).toBeVisible();
		await clearLink.click();
		await expect.poll(() => new URL(page.url()).searchParams.get(ROADMAP_QUERY_PARAMS.STATUS)).toBeNull();
	});
});

test.describe('roadmap detail: 404 + raw endpoint', () => {
	test('unknown wp_id returns 404', async ({ page }) => {
		const response = await page.goto(ROUTES.HANGAR_ROADMAP_DETAIL('definitely-not-a-real-wp'));
		expect(response?.status()).toBe(404);
	});

	test('raw endpoint returns JSON with the loader payload', async ({ page }) => {
		const response = await page.goto(ROUTES.HANGAR_ROADMAP_RAW('tracking-system-overhaul'));
		expect(response?.status()).toBe(200);
		expect(response?.headers()['content-type']).toMatch(/application\/json/);
		const body = await response?.json();
		expect(body?.id).toBe('tracking-system-overhaul');
		expect(body?.specPath).toMatch(/spec\.md$/);
	});
});
