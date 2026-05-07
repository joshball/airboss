/**
 * Hangar-app browser-hydration smoke. Sibling to
 * `tests/e2e/browser-hydration-smoke.spec.ts` (which targets the study
 * surface) -- adds /roadmap and /roadmap/[wp_id] to the same regression
 * fence: no postgres.js fetch, no `Buffer is not defined`. The /roadmap
 * surface imports `scripts/lib/wp-loader.ts` which uses `node:fs`; if a
 * future refactor accidentally drags that import into a `.svelte` or non-
 * `.server.ts` file, this smoke catches the leak before it ships.
 *
 * Lives under `hangar-review-queue/` because that is the only Playwright
 * project pointed at the hangar baseURL with seeded admin storage state.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../../libs/constants/src';

const SMOKE_ROUTES: readonly string[] = [
	ROUTES.HANGAR_ROADMAP,
	ROUTES.HANGAR_ROADMAP_DETAIL('tracking-system-overhaul'),
];

for (const route of SMOKE_ROUTES) {
	test(`${route}: no postgres.js, no Buffer error`, async ({ page }) => {
		const postgresLoads: string[] = [];
		const errors: string[] = [];

		page.on('request', (req) => {
			const url = req.url();
			if (/\/postgres\.js(\?|$)/.test(url)) {
				postgresLoads.push(url);
			}
		});
		page.on('console', (msg) => {
			if (msg.type() === 'error') errors.push(msg.text());
		});
		page.on('pageerror', (err) => {
			errors.push(`pageerror: ${err.message}`);
		});

		const response = await page.goto(route, { waitUntil: 'networkidle' });
		expect(response?.status()).toBe(200);

		// Beat for deferred / dynamic imports to land.
		await page.waitForTimeout(1500);

		expect(postgresLoads, `expected no postgres.js fetch on ${route}, got:\n  ${postgresLoads.join('\n  ')}`).toEqual(
			[],
		);
		const bufferErrors = errors.filter((e) => /Buffer is not defined/i.test(e));
		expect(bufferErrors, `expected no Buffer ReferenceError on ${route}, got:\n  ${bufferErrors.join('\n  ')}`).toEqual(
			[],
		);
	});
}
