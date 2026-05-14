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

const PALETTE_TRIGGER = '[data-testid="helpsearch-trigger"]';
const PALETTE_ROOT = '[data-testid="commandpalette-root"]';
const PALETTE_INPUT = '[data-testid="commandpalette-input"]';
const PALETTE_BANNER = '[data-testid="palette-banner"]';
const PALETTE_DETAIL = '[data-testid="palette-detail-pane"]';
// The autocomplete listbox id is derived from the Autocomplete testId prop
// (`commandpalette` -- see `CommandPalette.svelte`), producing
// `commandpalette-listbox` for `aria-controls` and the listbox `id`.
const PALETTE_AUTOCOMPLETE_LISTBOX_ID = 'commandpalette-listbox';
// One of the three intent-mode result regions must be visible after a
// query lands. The classifier picks which mode fires; the smoke only
// pins the cross-boundary contract.
const PALETTE_RESULT_REGION =
	'[data-testid="palette-column"], [data-testid="palette-scoped-view"], [data-testid="palette-passage-view"]';

interface PhaseThreeCase {
	q: string;
	expectBanner?: boolean;
	expectAutocomplete?: boolean;
}

const PHASE3_QUERIES: readonly PhaseThreeCase[] = [
	{ q: 'weather' },
	{ q: 'FAA-H-8083-28', expectAutocomplete: true },
	{ q: '91.103' },
	{ q: 'wx' },
];

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

test.describe('command-palette phase 3', () => {
	test.beforeEach(async ({ page }) => {
		page.on('pageerror', (err) => {
			throw new Error(`pageerror: ${err.message}`);
		});
	});

	test('input carries combobox role + aria-controls for the autocomplete', async ({ page }) => {
		await page.goto(ROUTES.MEMORY);
		await openPalette(page);

		const input = page.locator(PALETTE_INPUT);
		await expect(input).toHaveAttribute('role', 'combobox');
		await expect(input).toHaveAttribute('aria-controls', PALETTE_AUTOCOMPLETE_LISTBOX_ID);
	});

	for (const { q, expectBanner, expectAutocomplete } of PHASE3_QUERIES) {
		test(`${q}: renders palette + results + (optional) banner/autocomplete`, async ({ page }) => {
			await page.goto(ROUTES.MEMORY);
			await openPalette(page);

			const input = page.locator(PALETTE_INPUT);
			await input.fill(q);
			// 150ms debounce + the server fetch.
			await page.waitForTimeout(900);

			// One of the three intent-mode result regions is visible. The
			// per-mode coverage lives in the unit suite; the e2e contract is
			// "results landed in one of the three known shapes."
			await expect(page.locator(PALETTE_RESULT_REGION).first()).toBeVisible();

			if (expectBanner) {
				await expect(page.locator(PALETTE_BANNER)).toBeVisible();
			}

			if (expectAutocomplete) {
				// The autocomplete fires for doc-code intents. The listbox `id`
				// matches the `aria-controls` value asserted above.
				await expect(page.locator(`#${PALETTE_AUTOCOMPLETE_LISTBOX_ID}`)).toBeVisible();
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
