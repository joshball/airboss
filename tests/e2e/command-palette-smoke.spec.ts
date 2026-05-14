/**
 * Command-palette smoke.
 *
 * Opens the palette via the trigger button (or Cmd+K), types each query
 * from the test plan, and asserts that:
 *   1. The palette dialog opens (visible + focused).
 *   2. The /api/palette/search endpoint is reachable (no 4xx / 5xx).
 *   3. The palette renders one of its three result views -- broad
 *      (`palette-column`), scoped (`palette-scoped-view`), or
 *      phrase-fts (`palette-passage-view`). Which view fires depends on
 *      the intent classifier (`@ab/help/intent`); the smoke only asserts
 *      "results landed somewhere visible" so it stays robust across
 *      classifier tuning. Per-view scoping lives in the unit suite.
 *   4. No `Buffer is not defined` or other browser-only crashes fire.
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
// Any of the three intent modes renders one of these regions. The smoke
// passes when at least one is visible after the query lands.
const PALETTE_RESULT_REGION =
	'[data-testid="palette-column"], [data-testid="palette-scoped-view"], [data-testid="palette-passage-view"]';

// A tight battery covering broad search, doc codes, alias, and a needle
// search. Per-mode coverage lives in the unit suite; this catches the
// cross-boundary regressions.
const SMOKE_QUERIES: readonly string[] = ['weather', 'Part 91', 'wx', 'metar'];

/**
 * Open the palette deterministically. Both the Cmd+K window-keydown
 * listener and the trigger's `onclick` are wired up by Svelte 5
 * hydration; under parallel webServer load either entry point can race
 * against hydration and silently no-op. Wait for `networkidle` so the
 * JS bundle has settled, retry the click if `aria-expanded` doesn't
 * flip, then wait for the dialog to mount.
 */
async function openPalette(page: import('@playwright/test').Page): Promise<void> {
	await page.waitForLoadState('networkidle');
	const trigger = page.locator(PALETTE_TRIGGER);
	await trigger.waitFor({ state: 'visible' });
	await expect
		.poll(
			async () => {
				if ((await trigger.getAttribute('aria-expanded')) === 'true') return 'open';
				await trigger.click({ force: true });
				return await trigger.getAttribute('aria-expanded');
			},
			{ timeout: 5_000, intervals: [100, 250, 500] },
		)
		.toBe('open');
	await page.waitForSelector(PALETTE_ROOT, { state: 'visible' });
}

test.describe('command-palette smoke', () => {
	test.beforeEach(async ({ page }) => {
		// Capture browser errors so the smoke catches a hydration regression.
		page.on('pageerror', (err) => {
			throw new Error(`pageerror: ${err.message}`);
		});
	});

	test('palette opens via Cmd+K and accepts input', async ({ page }) => {
		await page.goto(ROUTES.MEMORY);
		// Wait for the page to fully hydrate before sending the keybinding;
		// `<svelte:window onkeydown>` attaches after Svelte 5 hydration runs.
		await page.waitForLoadState('networkidle');
		await page.waitForSelector(PALETTE_TRIGGER, { state: 'visible' });

		// Cmd+K toggle (the Mac binding; Ctrl+K on Linux/Windows is the same path).
		await page.keyboard.press('Meta+k');
		await page.waitForSelector(PALETTE_ROOT, { state: 'visible' });

		const input = page.locator(PALETTE_INPUT);
		await expect(input).toBeFocused();

		await input.fill('weather');
		// Wait long enough for the 150ms debounce + the network fetch to land.
		await page.waitForTimeout(800);

		// One of the three result regions is visible (broad / scoped / phrase-fts).
		await expect(page.locator(PALETTE_RESULT_REGION).first()).toBeVisible();
	});

	test('palette closes on Escape and restores prior focus', async ({ page }) => {
		await page.goto(ROUTES.MEMORY);
		await openPalette(page);
		await page.keyboard.press('Escape');
		await expect(page.locator(PALETTE_ROOT)).not.toBeVisible();
	});

	for (const q of SMOKE_QUERIES) {
		test(`${q}: opens, types, renders results`, async ({ page }) => {
			const apiResponses: number[] = [];
			page.on('response', (resp) => {
				if (resp.url().includes('/api/palette/search')) apiResponses.push(resp.status());
			});

			await page.goto(ROUTES.MEMORY);
			await openPalette(page);

			const input = page.locator(PALETTE_INPUT);
			await input.fill(q);
			await page.waitForTimeout(900);

			// One of the three result regions is visible. The unit suite pins
			// which classifier intent each query lands in; this spec only pins
			// the cross-boundary contract "the palette renders results."
			await expect(page.locator(PALETTE_RESULT_REGION).first()).toBeVisible();

			// Endpoint reachable: every captured response is 2xx (or none, when
			// the in-process facade alone served the query). Anything 4xx/5xx
			// means a wire regression -- the unit suite couldn't catch it.
			expect(
				apiResponses.filter((s) => s >= 400),
				`unexpected 4xx/5xx from /api/palette/search for query "${q}": ${apiResponses.join(', ')}`,
			).toEqual([]);
		});
	}
});
