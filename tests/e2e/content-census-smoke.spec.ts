/**
 * `/content` census dashboard smoke -- Phase 1 of the
 * `hangar-content-census` work package.
 *
 * Runs in the `hangar-review-queue` Playwright project: that is the only
 * project pointed at the hangar baseURL with the seeded admin storage
 * state. The `playwright.config.ts` `testMatch` for that project includes
 * this top-level `content-census-smoke.spec.ts` explicitly.
 *
 * Covers:
 *   - `/content` renders 14 corpus rows, each with a count + drill-down link.
 *   - `/content/wx-catalog` renders the inventory, the gap view, and visible
 *     what/why explanation text.
 *   - A Phase-2 `census`-mode corpus shows a real inventory + metrics and an
 *     honest, labelled Layer-2 (Phase-3) placeholder for its gap view.
 *   - A stub corpus page shows the honest "pending" placeholder, not fakes.
 *   - The /content <-> /roadmap cross-link is present.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

test.describe('content census overview', () => {
	test('renders all 14 corpus rows with counts and drill-down links', async ({ page }) => {
		await page.goto(ROUTES.CONTENT_CENSUS);
		await expect(page.getByRole('heading', { level: 1, name: /^Content census$/ })).toBeVisible();
		// One body row per corpus -- the registry holds exactly 14.
		const rows = page.locator('section[aria-label="Corpora"] tbody tr');
		await expect(rows).toHaveCount(14);
		// The wx-catalog row links into its drill-down.
		await expect(page.getByRole('link', { name: 'Encoded-text catalog' })).toHaveAttribute(
			'href',
			ROUTES.CONTENT_CENSUS_CORPUS('wx-catalog'),
		);
	});

	test('intro prose explains the three census layers', async ({ page }) => {
		await page.goto(ROUTES.CONTENT_CENSUS);
		// The three layers are listed inside the "How to read this census"
		// section; scope to it so the assertion does not collide with the
		// "Derived state" table column header.
		const intro = page.locator('section[aria-label="How to read this census"]');
		await expect(intro.getByText(/Derived state/)).toBeVisible();
		await expect(intro.getByText(/Authored intent/)).toBeVisible();
		await expect(intro.getByText(/Explanation/)).toBeVisible();
	});

	test('cross-links to the roadmap dashboard', async ({ page }) => {
		await page.goto(ROUTES.CONTENT_CENSUS);
		await expect(page.getByRole('link', { name: /^Roadmap$/ }).first()).toHaveAttribute(
			'href',
			ROUTES.HANGAR_ROADMAP,
		);
	});
});

test.describe('wx-catalog reference drill-down', () => {
	test('renders inventory, gap view, and visible what/why explanation text', async ({ page }) => {
		await page.goto(ROUTES.CONTENT_CENSUS_CORPUS('wx-catalog'));
		await expect(page.getByRole('heading', { level: 1, name: /^Encoded-text catalog$/ })).toBeVisible();

		// Inventory: 155 example rows.
		const inventoryRows = page.locator('section[aria-label="Inventory"] tbody tr');
		await expect(inventoryRows).toHaveCount(155);

		// Gap view section with the three known gaps.
		await expect(page.getByRole('heading', { level: 2, name: /^Gap view$/ })).toBeVisible();
		await expect(page.getByText(/AIRMET/).first()).toBeVisible();

		// Explanatory-surface: the what/why labels are visible on the page.
		await expect(page.getByText('What it measures.').first()).toBeVisible();
		await expect(page.getByText('Why it matters.').first()).toBeVisible();

		// The generator-coverage metric reports the real 20 / 155 figure.
		await expect(page.getByText('20 / 155').first()).toBeVisible();
	});

	test('overview links the governing documents', async ({ page }) => {
		await page.goto(ROUTES.CONTENT_CENSUS_CORPUS('wx-catalog'));
		await expect(page.getByRole('heading', { level: 2, name: /^Governing documents$/ })).toBeVisible();
		await expect(page.getByRole('link', { name: /ADR 018/ })).toBeVisible();
	});
});

test.describe('census-mode corpus drill-down', () => {
	test('a Phase-2 corpus shows a real inventory, metrics, and a Layer-2 placeholder', async ({ page }) => {
		await page.goto(ROUTES.CONTENT_CENSUS_CORPUS('knowledge-nodes'));
		await expect(page.getByRole('heading', { level: 1, name: /^Knowledge nodes$/ })).toBeVisible();

		// The "Layer 1 census" mode tag, not a "pending" tag.
		await expect(page.getByText(/^Layer 1 census$/)).toBeVisible();

		// Real inventory: one row per knowledge node. The graph grows over
		// time, so assert a floor (well above zero) rather than pinning an
		// exact count that drifts with every new node.
		const inventoryRows = page.locator('section[aria-label="Inventory"] tbody tr');
		await expect(inventoryRows.first()).toBeVisible();
		expect(await inventoryRows.count()).toBeGreaterThan(50);

		// Real metrics carry the explanatory triad.
		await expect(page.getByRole('heading', { level: 2, name: /^Metrics$/ })).toBeVisible();
		await expect(page.getByText('What it measures.').first()).toBeVisible();

		// The gap view is an honest, labelled Phase-3 placeholder -- not fabricated gaps.
		await expect(page.getByRole('heading', { level: 2, name: /^Gap view$/ })).toBeVisible();
		await expect(page.getByText(/deferred to Phase 3/i)).toBeVisible();
	});
});

// The "stub corpus placeholder honesty" test was removed in content-census
// Phase 2 (PR #1032): every corpus in `CORPUS_REGISTRY` now ships a real
// Layer-1 adapter, and `/content/[corpus]` 404s any unknown slug, so the
// `stubCensus` pending-placeholder UI is unreachable through the route. The
// fallback adapter is retained in `@ab/content-census/server` as a defensive
// default if a future corpus is registered before its adapter lands.
