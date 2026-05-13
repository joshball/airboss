import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

// Browser-hydration smoke: catches the regression class that produced the
// `/memory` ReferenceError: Buffer is not defined crash (PRs #656, #659,
// #661, #663, #664). The leak vector is server-only code -- specifically
// the `postgres` driver -- being pulled into the client bundle through a
// runtime-barrel value re-export. happy-dom polyfills `Buffer` so vitest
// passes through the regression silently; the only honest signal is a
// real browser network trace.
//
// What this asserts, per route:
//   1. The page loaded (status 200 after auth; not a redirect chain failure).
//   2. The browser never fetched `postgres.js` from Vite's deps optimizer
//      (the canonical leak chunk -- if it loads, server-only code reached
//      the client bundle).
//   3. No `Buffer is not defined` was logged to the console / pageerror.
//
// Pair with `scripts/check-browser-globals.ts`, which catches the same
// regression class statically. The static lint and this runtime smoke
// are belt-and-suspenders -- the static check catches the obvious leak
// shapes; the smoke catches anything the static walker misses (e.g.
// future barrels, transitive paths through node_modules).

// /library was historically a hydration-crash site (the `postgres` driver
// leak per PRs #656, #659, #661, #663, #664). Per ADR 023 + WP-FLIGHTBAG-
// READER-UX Phase 2 the route is now a 301 to flightbag (a sibling origin),
// so this study-side smoke can't navigate it -- the equivalent flightbag
// pages are covered by flightbag/representative-pages.spec.ts.
const SMOKE_ROUTES: readonly string[] = [ROUTES.MEMORY, ROUTES.MEMORY_REVIEW, ROUTES.LEARN, ROUTES.REPS];

for (const route of SMOKE_ROUTES) {
	test(`${route}: no postgres.js, no Buffer error`, async ({ page }) => {
		const postgresLoads: string[] = [];
		const errors: string[] = [];

		page.on('request', (req) => {
			const url = req.url();
			// Match any path that ends in `/postgres.js` -- the optimized
			// deps file is `node_modules/.vite/deps/postgres.js` plus a
			// cache-buster query string. If the chunk is fetched at all,
			// the leak is back.
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

		// Give deferred imports / dynamic imports a beat to land. Without
		// this, a leak triggered by a post-mount `await import()` could
		// slip past the assertion.
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
