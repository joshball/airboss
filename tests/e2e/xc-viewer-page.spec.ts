import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

/**
 * XC viewer page smoke (xc-viewer-v1 Phase F).
 *
 * Drives the real spatial app: the scenario picker + the viewer page.
 * Asserts the full four-layer composition renders end-to-end with no
 * hydration / console errors -- the load-bearing browser-correctness
 * gate the happy-dom component tests cannot give (happy-dom polyfills
 * `Buffer` / `process`, so a server-only leak passes vitest silently).
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-50, XC-51.
 */

const SCENARIO_SLUG = 'kmem-kmkl-kolv-frontal-march';

test('scenario picker lists the v1 scenario', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('console', (m) => {
		if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
	});

	const res = await page.goto(ROUTES.SPATIAL_XC_INDEX);
	expect(res?.status()).toBe(200);

	const card = page.locator(`a[href="${ROUTES.SPATIAL_XC_SCENARIO(SCENARIO_SLUG)}"]`);
	await expect(card).toBeVisible();

	expect(errors, errors.join(' || ')).toEqual([]);
});

test('viewer page renders all four layers end-to-end', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('console', (m) => {
		if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
	});

	const res = await page.goto(ROUTES.SPATIAL_XC_SCENARIO(SCENARIO_SLUG));
	expect(res?.status()).toBe(200);

	// The viewer shell + each layer is present.
	await expect(page.locator('[data-testid="xc-viewer"]')).toBeVisible();
	await expect(page.locator('[data-testid="basemap-layer"]')).toBeAttached();
	await expect(page.locator('[data-testid="airspace-layer"]')).toBeAttached();
	await expect(page.locator('[data-testid="airport-layer"]')).toBeAttached();
	await expect(page.locator('[data-testid="navaid-layer"]')).toBeAttached();
	await expect(page.locator('[data-testid="route-overlay"]')).toBeAttached();
	await expect(page.locator('[data-testid="airmet-layer"]')).toBeAttached();
	await expect(page.locator('[data-testid="wx-chip-layer"]')).toBeAttached();
	await expect(page.locator('[data-testid="performance-band"]')).toBeVisible();

	// Layer-2: 5 waypoints, 4 leg labels.
	await expect(page.locator('.route-waypoint')).toHaveCount(5);
	await expect(page.locator('[data-testid="leg-label"]')).toHaveCount(4);

	// Layer-3: 3 AIRMET polygons (from the wx-engine spike scenario).
	await expect(page.locator('[data-testid="airmet-polygon"]')).toHaveCount(3);

	// No hydration crash, no server-only leak.
	expect(errors, errors.join(' || ')).toEqual([]);
});

test('clicking a weather chip opens the waypoint detail drawer', async ({ page }) => {
	await page.goto(ROUTES.SPATIAL_XC_SCENARIO(SCENARIO_SLUG), { waitUntil: 'networkidle' });
	await expect(page.locator('[data-testid="xc-viewer"]')).toBeVisible();
	await expect(page.locator('[data-testid="waypoint-drawer"]')).toHaveCount(0);

	// Wait for Svelte hydration before driving an interaction. The chip's
	// `onclick` handler is bound at hydration; `toBeVisible` only proves
	// the server-rendered SVG is in the DOM. Poll until a click actually
	// opens the drawer (the layer-toggle checkbox is a reliable hydration
	// canary -- a server-rendered checkbox does nothing on click).
	const chip = page.locator('[data-testid="wx-chip"][data-waypoint-id="wp-kmem"]');
	await expect(chip).toBeVisible();

	await expect(async () => {
		await chip.click({ force: true });
		await expect(page.locator('[data-testid="waypoint-drawer"]')).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 10_000 });

	await page.keyboard.press('Escape');
	await expect(page.locator('[data-testid="waypoint-drawer"]')).toHaveCount(0);
});
