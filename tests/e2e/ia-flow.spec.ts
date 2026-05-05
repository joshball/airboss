/**
 * IA flow -- wide existence sweep.
 *
 * Walks the canonical study top-level routes and asserts each one renders
 * without console errors and exposes a `data-testid="page-anchor"`. The
 * flow is the proof-of-existence net; deep behavior tests live in their
 * own focused specs.
 *
 * Phase 1 stub (per study-app-ia-cleanup tasks.md 1.8): the FLOW only
 * contains the Home (`ROUTES.STUDY`). Subsequent phases append routes
 * (Program tabs, Insights, Reference) as those surfaces ship.
 */

import { expect, type Page, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

interface Stop {
	label: string;
	path: string;
	subAnchors?: ReadonlyArray<string>;
}

const FLOW: ReadonlyArray<Stop> = [{ label: 'home', path: ROUTES.STUDY }];

function attachErrorTrap(page: Page): { errors: string[] } {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push(`pageerror: ${err}`));
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
	});
	return { errors };
}

test.describe('IA flow -- existence sweep', () => {
	test('every top-level route renders without errors', async ({ page }) => {
		const { errors } = attachErrorTrap(page);
		for (const stop of FLOW) {
			const res = await page.goto(stop.path);
			expect(res?.status(), `expected 2xx for ${stop.path}`).toBeLessThan(400);
			await expect(page.getByTestId('page-anchor'), `page-anchor missing on ${stop.label}`).toBeVisible();
			for (const sub of stop.subAnchors ?? []) {
				await expect(page.getByTestId(sub), `sub-anchor ${sub} missing on ${stop.label}`).toBeVisible();
			}
		}
		expect(errors, `runtime errors during flow:\n${errors.join('\n')}`).toEqual([]);
	});
});
