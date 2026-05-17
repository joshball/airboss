import { expect, test } from '@playwright/test';
import { QUERY_PARAMS, ROUTES } from '../../libs/constants/src';

/**
 * Drill Phase 3b smoke: the `/practice/wx/mastery` dashboard.
 *
 * The page renders entirely from two sources of truth:
 *
 *   1. The on-disk catalog `course/knowledge/weather/encoded-text-catalog/
 *      catalog.json` -- the "all families" set, one row per token family per
 *      product.
 *   2. The per-user mastery ledger from `@ab/bc-wx-practice/server` -- the
 *      sparse overlay. While Drill Phase 3 is in flight, the loader returns
 *      an empty array (graceful empty state, not a stub), so this smoke
 *      exercises the catalog-driven "never seen" view across every product.
 *
 * Once Drill Phase 3 ships, the smoke is extended to seed real mastery rows
 * via the BC seeder and assert state-chip filtering against them. The
 * current assertions are stable against both states: the page must render
 * tabs, the heatmap, controls, and a working drill-weak-button regardless of
 * how many mastery rows the ledger returns.
 */

test.describe('practice / wx mastery', () => {
	test('renders dashboard with product tabs and heatmap', async ({ page }) => {
		await page.goto(ROUTES.PRACTICE_WX_MASTERY);
		await expect(page.getByRole('heading', { name: 'Weather mastery', level: 1 })).toBeVisible();

		// All five product tabs render with attempted / total counts.
		for (const product of ['metar', 'taf', 'pirep', 'fb', 'airmet']) {
			await expect(page.getByTestId(`product-tab-${product}`)).toBeVisible();
		}

		// METAR is the default product. Its tab carries aria-current.
		const metarTab = page.getByTestId('product-tab-metar');
		await expect(metarTab).toHaveAttribute('aria-current', 'page');

		// Heatmap cells render -- one per catalog family. METAR has dozens
		// of families, so the count is well above zero.
		const heatmapCells = page.getByTestId('heatmap-cell');
		await expect(heatmapCells.first()).toBeVisible();
		expect(await heatmapCells.count()).toBeGreaterThan(10);

		// Legend renders all four states (active / passive / demoted / never
		// seen). Scope to the "State counts" <dl> -- the bare label text also
		// appears on the state-filter chips, so an unscoped getByText is
		// ambiguous in strict mode.
		const legend = page.getByLabel('State counts');
		await expect(legend.getByText('Active', { exact: true })).toBeVisible();
		await expect(legend.getByText('Passive', { exact: true })).toBeVisible();
		await expect(legend.getByText('Demoted', { exact: true })).toBeVisible();
		await expect(legend.getByText('Never seen', { exact: true })).toBeVisible();
	});

	test('switching product reloads the page and tabs follow', async ({ page }) => {
		await page.goto(ROUTES.PRACTICE_WX_MASTERY);
		// Capture the initial heatmap cell count for METAR.
		const initialCount = await page.getByTestId('heatmap-cell').count();

		// Click TAF.
		await page.getByTestId('product-tab-taf').click();
		await page.waitForURL((url) => url.searchParams.get(QUERY_PARAMS.PRODUCT) === 'taf');

		// TAF is now the active tab.
		await expect(page.getByTestId('product-tab-taf')).toHaveAttribute('aria-current', 'page');

		// The TAF catalog has fewer families than METAR -- the cell count
		// must change to prove the page actually rebuilt against a new
		// catalog slice rather than just toggling a class.
		const tafCount = await page.getByTestId('heatmap-cell').count();
		expect(tafCount).not.toBe(initialCount);
	});

	test('state filter chips toggle the visible rows via the URL', async ({ page }) => {
		// Until Drill Phase 3 lands the user has zero mastery rows, so every
		// family is "never seen." The empty-filtered surface is the natural
		// path through the filter logic: deselect "never seen" -> grid is
		// hidden and the empty-filtered banner renders.
		await page.goto(ROUTES.PRACTICE_WX_MASTERY);
		// Without mastery data the page shows the "you have not been quizzed
		// yet" empty state by design -- the assertion proves the state
		// derivation works.
		await expect(page.getByTestId('mastery-empty')).toBeVisible();

		// Click the never-seen chip to deselect it. The URL must carry the
		// chip choice so the load is deterministic on reload.
		await page.getByTestId('state-chip-never-seen').click();
		await page.waitForURL((url) => url.searchParams.has(QUERY_PARAMS.STATE));
		const params = new URLSearchParams(new URL(page.url()).search);
		expect(params.get(QUERY_PARAMS.STATE)).not.toContain('never-seen');
	});

	test('drill weak families button navigates to the drill route', async ({ page }) => {
		await page.goto(ROUTES.PRACTICE_WX_MASTERY);
		const button = page.getByTestId('drill-weak-button');
		await expect(button).toBeVisible();
		// Without mastery data the weak-families set is empty -- the button
		// must still resolve to the drill route with the current product.
		const href = await button.getAttribute('href');
		expect(href).toMatch(/^\/practice\/wx\/drill\?/);
		expect(href).toContain(`${QUERY_PARAMS.PRODUCT}=metar`);
	});

	test('empty-state CTA points at the drill route for the active product', async ({ page }) => {
		await page.goto(`${ROUTES.PRACTICE_WX_MASTERY}?${QUERY_PARAMS.PRODUCT}=taf`);
		const cta = page.getByTestId('empty-start-drill');
		await expect(cta).toBeVisible();
		const href = await cta.getAttribute('href');
		expect(href).toMatch(/^\/practice\/wx\/drill\?/);
		expect(href).toContain(`${QUERY_PARAMS.PRODUCT}=taf`);
	});

	test('sort chips set the sort query param', async ({ page }) => {
		await page.goto(ROUTES.PRACTICE_WX_MASTERY);
		await page.getByTestId('sort-chip-ratio').click();
		await page.waitForURL((url) => url.searchParams.get(QUERY_PARAMS.SORT) === 'ratio');
		await expect(page.getByTestId('sort-chip-ratio')).toHaveAttribute('data-active', 'true');
	});
});
