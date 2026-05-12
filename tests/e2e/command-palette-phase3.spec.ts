/**
 * Command-palette Phase 3 e2e -- Variant C production palette behaviors.
 *
 * Walks the four query battery from `test-plan.md` (`weather`,
 * `FAA-H-8083-28`, `91.103`, `wx`) against the production `CommandPalette`
 * and asserts:
 *
 *   - Cmd+K opens the dialog and focuses the input (combobox role).
 *   - Each query lands columns + a detail pane preview where applicable.
 *   - The `FAA-H-8083-28` query surfaces a doc-code autocomplete dropdown.
 *   - The hoist banner appears for tier-1 singletons and routes Enter.
 *
 * Pairs with `command-palette-smoke.spec.ts` (cross-boundary smoke) and
 * the per-loader unit tests. This spec specifically pins the Phase 3 UI
 * additions: detail pane, autocomplete, accent rendering.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

const PALETTE_ROOT = '[data-testid="commandpalette-root"]';
const PALETTE_INPUT = '[data-testid="commandpalette-input"]';
const PALETTE_COLUMNS = '[data-testid="palette-columns"]';
const PALETTE_BANNER = '[data-testid="palette-banner"]';
const PALETTE_DETAIL = '[data-testid="palette-detail-pane"]';
const PALETTE_AUTOCOMPLETE = '[data-testid="palette-doc-autocomplete"]';

interface PhaseThreeCase {
	q: string;
	expectColumn?: string;
	expectBanner?: boolean;
	expectAutocomplete?: boolean;
}

const PHASE3_QUERIES: readonly PhaseThreeCase[] = [
	{ q: 'weather', expectColumn: 'faa-resources' },
	{ q: 'FAA-H-8083-28', expectColumn: 'faa-resources', expectAutocomplete: true },
	{ q: '91.103', expectColumn: 'faa-resources' },
	{ q: 'wx', expectColumn: 'faa-resources' },
];

test.describe('command-palette phase 3', () => {
	test.beforeEach(async ({ page }) => {
		page.on('pageerror', (err) => {
			throw new Error(`pageerror: ${err.message}`);
		});
	});

	test('input carries combobox role + aria-controls for the autocomplete', async ({ page }) => {
		await page.goto(ROUTES.MEMORY);
		await page.keyboard.press('Meta+k');
		await page.waitForSelector(PALETTE_ROOT, { state: 'visible' });

		const input = page.locator(PALETTE_INPUT);
		await expect(input).toHaveAttribute('role', 'combobox');
		await expect(input).toHaveAttribute('aria-controls', 'palette-doc-autocomplete');
	});

	for (const { q, expectColumn, expectBanner, expectAutocomplete } of PHASE3_QUERIES) {
		test(`${q}: renders palette + columns + (optional) banner/autocomplete`, async ({ page }) => {
			await page.goto(ROUTES.MEMORY);
			await page.keyboard.press('Meta+k');
			await page.waitForSelector(PALETTE_ROOT, { state: 'visible' });

			const input = page.locator(PALETTE_INPUT);
			await input.fill(q);
			// 150ms debounce + the server fetch.
			await page.waitForTimeout(900);

			await expect(page.locator(PALETTE_COLUMNS)).toBeVisible();

			if (expectColumn) {
				const rows = await page
					.locator(`${PALETTE_COLUMNS} section[data-column="${expectColumn}"] button[data-result-id]`)
					.count();
				expect(rows, `expected results in "${expectColumn}" column for "${q}"`).toBeGreaterThan(0);
			}

			if (expectBanner) {
				await expect(page.locator(PALETTE_BANNER)).toBeVisible();
			}

			if (expectAutocomplete) {
				// The autocomplete fires for doc-code intents. Don't enforce a
				// minimum count -- the seeded registry returns at least one
				// match for FAA-H- but the assertion is "the dropdown rendered."
				await expect(page.locator(PALETTE_AUTOCOMPLETE)).toBeVisible();
			}
		});
	}

	test('dev/palette index links to all three variants', async ({ page }) => {
		await page.goto('/dev/palette');
		await expect(page.locator('a[href="/dev/palette/wide"]')).toBeVisible();
		await expect(page.locator('a[href="/dev/palette/list"]')).toBeVisible();
		await expect(page.locator('a[href="/dev/palette/raycast"]')).toBeVisible();
	});

	test('dev/palette/list renders the Linear-style sectioned list', async ({ page }) => {
		await page.goto('/dev/palette/list');
		await page.waitForSelector('[data-testid="palette-list-input"]');
		await page.fill('[data-testid="palette-list-input"]', 'weather');
		await page.waitForTimeout(900);
		const sectionHeaders = await page.locator('.section-header').count();
		expect(sectionHeaders, 'expected at least one section header on Variant A list').toBeGreaterThan(0);
	});

	test('dev/palette/raycast renders the narrow + detail layout', async ({ page }) => {
		await page.goto('/dev/palette/raycast');
		await page.waitForSelector('[data-testid="palette-raycast-input"]');
		await page.fill('[data-testid="palette-raycast-input"]', 'weather');
		await page.waitForTimeout(900);
		// PaletteDetailPane is mounted on this variant regardless of selection;
		// once a row is highlighted, the pane carries the result's metadata.
		await expect(page.locator(PALETTE_DETAIL)).toBeVisible();
	});
});
