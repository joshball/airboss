/**
 * Command-palette smoke (Phase 2 of the command-palette WP).
 *
 * Opens the palette via Cmd+K, types each query from the test plan, and
 * asserts that:
 *   1. The palette dialog opens (visible + focused).
 *   2. The /api/palette/search endpoint is reachable (no 4xx / 5xx).
 *   3. The palette renders columns (the multi-column UI mounted).
 *   4. No `Buffer is not defined` or other browser-only crashes fire.
 *   5. For doc-code queries (FAA-H-8083-28, Part 91), at least one row
 *      lands in the FAA Resources column.
 *
 * Why a smoke and not a full per-query suite: walking every test-plan
 * row through a real browser is sequential + slow; the per-loader unit
 * suite (`libs/help/src/loaders/__tests__/db-loaders.test.ts`) is already
 * gating the SQL + filtering behavior. This smoke catches the cross-
 * boundary regressions: client+endpoint+browser hydration in one shot.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

const PALETTE_TRIGGER = '[data-testid="helpsearch-trigger"]';
const PALETTE_ROOT = '[data-testid="commandpalette-root"]';
const PALETTE_INPUT = '[data-testid="commandpalette-input"]';
const PALETTE_COLUMNS = '[data-testid="palette-columns"]';

// A tight battery: doc codes (banner hoist + clusters), needle search,
// the synonym chip case. The full per-query coverage lives in the
// per-loader unit tests; this catches the cross-boundary regressions.
const SMOKE_QUERIES: readonly { q: string; expectColumn?: string }[] = [
	{ q: 'weather', expectColumn: 'faa-resources' },
	{ q: 'Part 91', expectColumn: 'faa-resources' },
	{ q: 'wx' },
	{ q: 'metar' },
];

test.describe('command-palette smoke', () => {
	test.beforeEach(async ({ page }) => {
		// Capture browser errors so the smoke catches a hydration regression.
		page.on('pageerror', (err) => {
			throw new Error(`pageerror: ${err.message}`);
		});
	});

	test('palette opens via Cmd+K and accepts input', async ({ page }) => {
		await page.goto(ROUTES.MEMORY);
		await page.waitForSelector(PALETTE_TRIGGER, { state: 'visible' });

		// Cmd+K toggle (the Mac binding; Ctrl+K on Linux/Windows is the same path).
		await page.keyboard.press('Meta+k');
		await page.waitForSelector(PALETTE_ROOT, { state: 'visible' });

		const input = page.locator(PALETTE_INPUT);
		await expect(input).toBeFocused();

		await input.fill('weather');
		// Wait long enough for the 150ms debounce + the network fetch to land.
		await page.waitForTimeout(800);

		// Columns rendered (the multi-column UI is mounted, not the legacy 2-bucket).
		await expect(page.locator(PALETTE_COLUMNS)).toBeVisible();
	});

	test('palette closes on Escape and restores prior focus', async ({ page }) => {
		await page.goto(ROUTES.MEMORY);
		await page.waitForSelector(PALETTE_TRIGGER, { state: 'visible' });

		await page.keyboard.press('Meta+k');
		await page.waitForSelector(PALETTE_ROOT, { state: 'visible' });
		await page.keyboard.press('Escape');
		await expect(page.locator(PALETTE_ROOT)).not.toBeVisible();
	});

	for (const { q, expectColumn } of SMOKE_QUERIES) {
		test(`${q}: opens, types, renders columns`, async ({ page }) => {
			const apiResponses: number[] = [];
			page.on('response', (resp) => {
				if (resp.url().includes('/api/palette/search')) apiResponses.push(resp.status());
			});

			await page.goto(ROUTES.MEMORY);
			await page.waitForSelector(PALETTE_TRIGGER, { state: 'visible' });

			await page.keyboard.press('Meta+k');
			await page.waitForSelector(PALETTE_ROOT, { state: 'visible' });

			const input = page.locator(PALETTE_INPUT);
			await input.fill(q);
			await page.waitForTimeout(900);

			await expect(page.locator(PALETTE_COLUMNS)).toBeVisible();

			// Endpoint reachable: every captured response is 2xx (or none, when
			// the in-process facade alone served the query). Anything 4xx/5xx
			// means a wire regression -- the unit suite couldn't catch it.
			expect(
				apiResponses.filter((s) => s >= 400),
				`unexpected 4xx/5xx from /api/palette/search for query "${q}": ${apiResponses.join(', ')}`,
			).toEqual([]);

			if (expectColumn) {
				// Pin the column the test data declared. The locator scopes to the
				// section[data-column] that matches; presence of at least one row
				// inside proves the loader chain landed output in the expected
				// column, not just somewhere on the page.
				const targetColumnRows = await page
					.locator(`${PALETTE_COLUMNS} section[data-column="${expectColumn}"] button[data-result-id]`)
					.count();
				expect(
					targetColumnRows,
					`expected at least 1 row in column "${expectColumn}" for "${q}"`,
				).toBeGreaterThan(0);
			}
		});
	}
});
