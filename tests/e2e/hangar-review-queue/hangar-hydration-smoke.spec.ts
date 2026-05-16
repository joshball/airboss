/**
 * Hangar-app browser-hydration smoke. Sibling to
 * `tests/e2e/browser-hydration-smoke.spec.ts` (which targets the study
 * surface) -- fences the hangar routes against two hydration-crash classes:
 *
 * 1. Bundle leak: no postgres.js fetch, no `Buffer is not defined`. The
 *    /roadmap surface imports `scripts/lib/wp-loader.ts` which uses
 *    `node:fs`; if a future refactor accidentally drags that import into a
 *    `.svelte` or non-`.server.ts` file, this smoke catches the leak.
 * 2. Reactivity loop: no `pageerror` of any kind. A `$effect` that reads
 *    and writes the same `$state` re-triggers itself forever and crashes
 *    hydration with `effect_update_depth_exceeded` (the /review walker bug
 *    fixed alongside this assertion). The error renders the SvelteKit 500
 *    boundary client-side after `goto()` returns 200, so an HTTP-status
 *    check alone misses it -- only a `pageerror` listener catches it.
 *
 * Lives under `hangar-review-queue/` because that is the only Playwright
 * project pointed at the hangar baseURL with seeded admin storage state.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../../libs/constants/src';

const SMOKE_ROUTES: readonly string[] = [
	ROUTES.HANGAR_ROADMAP,
	ROUTES.HANGAR_ROADMAP_DETAIL('tracking-system-overhaul'),
	ROUTES.HANGAR_REVIEW,
];

for (const route of SMOKE_ROUTES) {
	test(`${route}: no postgres.js, no Buffer error, no hydration crash`, async ({ page }) => {
		const postgresLoads: string[] = [];
		const consoleErrors: string[] = [];
		const pageErrors: string[] = [];

		page.on('request', (req) => {
			const url = req.url();
			if (/\/postgres\.js(\?|$)/.test(url)) {
				postgresLoads.push(url);
			}
		});
		page.on('console', (msg) => {
			if (msg.type() === 'error') consoleErrors.push(msg.text());
		});
		page.on('pageerror', (err) => {
			pageErrors.push(err.message);
		});

		const response = await page.goto(route, { waitUntil: 'networkidle' });
		expect(response?.status()).toBe(200);

		// Beat for deferred / dynamic imports + hydration to land.
		await page.waitForTimeout(1500);

		expect(postgresLoads, `expected no postgres.js fetch on ${route}, got:\n  ${postgresLoads.join('\n  ')}`).toEqual(
			[],
		);
		const bufferErrors = consoleErrors.filter((e) => /Buffer is not defined/i.test(e));
		expect(bufferErrors, `expected no Buffer ReferenceError on ${route}, got:\n  ${bufferErrors.join('\n  ')}`).toEqual(
			[],
		);
		expect(pageErrors, `expected no uncaught page error on ${route}, got:\n  ${pageErrors.join('\n  ')}`).toEqual([]);
	});
}
