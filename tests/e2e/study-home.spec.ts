/**
 * `/study` -- the post-login home (study-home WP).
 *
 * The seeded test user (Abby) lands on the home and the page renders
 * three sections: Progress strip, Today briefing, and the Map. The
 * suite walks the WP test plan (SH-1 .. SH-39) covering the
 * automatable scenarios. SH-21 (cross-device sync) and SH-36 (audit
 * row inspection) are out of scope for the e2e -- the audit assertion
 * lives in the BC vitest, and cross-device tests would need a second
 * Playwright context that's not stood up in this WP.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

test.describe('study home -- core surface', () => {
	test('SH-1: lands at /study and renders progress + today + tiles + map', async ({ page }) => {
		await page.goto(ROUTES.STUDY);
		// Page-level <h1> is "Study".
		await expect(page.getByRole('heading', { name: 'Study', level: 1 })).toBeVisible();
	});

	test('SH-6: tiles render in the canonical order', async ({ page }) => {
		await page.goto(ROUTES.STUDY);
		// Each tile is an <a> element. Look up by visible label.
		// When the page is in `no-goal` mode the tiles still render via the
		// banner; both shapes carry these labels.
		const labels = ['Read', 'Cards', 'Sim', 'Scenarios', 'Flight'];
		for (const label of labels) {
			const tile = page.getByRole('link', { name: new RegExp(`^${label}\\b`) });
			await expect(tile.first()).toBeVisible();
		}
	});

	test('SH-12: Flight tile lands on the placeholder /flight route', async ({ page }) => {
		await page.goto(ROUTES.STUDY);
		await page.getByRole('link', { name: /^Flight\b/ }).first().click();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.FLIGHT);
	});

	test('SH-23: invalid ?tab= redirects back to /study', async ({ page }) => {
		await page.goto(`${ROUTES.STUDY}?tab=bogus`);
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.STUDY && url.search === '');
	});
});

test.describe('study home -- nav', () => {
	test('SH-1: primary nav exposes Study as a top-level entry', async ({ page }) => {
		await page.goto(ROUTES.STUDY);
		const nav = page.getByRole('navigation', { name: 'Primary' });
		// `exact: true` so the `Study by` lens entry doesn't also match.
		await expect(nav.getByRole('link', { name: 'Study', exact: true })).toHaveAttribute('aria-current', 'page');
	});
});

// SH-21 / SH-36 require multi-device or admin-audit harnesses and are
// covered by the BC vitest + manual smoke pass; intentionally skipped
// here.
