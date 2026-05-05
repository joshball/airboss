/**
 * IA redirect coverage (study-app-ia-cleanup Phase 3).
 *
 * Every legacy path renamed by Phase 2 + Phase 3 returns 301 and points
 * at its current canonical home. The hooks-level redirect runs before
 * auth so an unauthenticated request still gets the 301 (the auth
 * gate fires only after the canonical path resolves).
 *
 * The pure resolver behind these redirects has its own unit-test
 * coverage in `apps/study/src/lib/server/legacy-redirects.test.ts`;
 * this spec proves the SvelteKit handle wiring.
 */

import { expect, test } from '@playwright/test';

interface RedirectCase {
	from: string;
	to: string;
}

const REDIRECTS: ReadonlyArray<RedirectCase> = [
	// Insights family.
	{ from: '/dashboard', to: '/insights' },
	{ from: '/dashboard/', to: '/insights' },
	{ from: '/calibration', to: '/insights/calibration' },
	{ from: '/lens', to: '/insights/lens' },
	{ from: '/lens/handbook', to: '/insights/lens/handbook' },
	{ from: '/lens/handbook/phak', to: '/insights/lens/handbook/phak' },
	{ from: '/lens/weakness', to: '/insights/lens/weakness' },
	{ from: '/lens/weakness/severe', to: '/insights/lens/weakness/severe' },
	// Reference family.
	{ from: '/knowledge', to: '/reference/knowledge' },
	{ from: '/knowledge/vfr-weather-minimums', to: '/reference/knowledge/vfr-weather-minimums' },
	{ from: '/knowledge/vfr-weather-minimums/learn', to: '/reference/knowledge/vfr-weather-minimums/learn' },
	{ from: '/glossary', to: '/reference/glossary' },
	{ from: '/glossary/abc123', to: '/reference/glossary/abc123' },
	// Phase 2 program family (redirects only land in Phase 3).
	{ from: '/credentials', to: '/program/quals' },
	{ from: '/credentials/ppl', to: '/program/quals/ppl' },
	{ from: '/credentials/ppl/areas/i', to: '/program/quals/ppl/areas/i' },
	{ from: '/goals', to: '/program/goals' },
	{ from: '/goals/g_abc', to: '/program/goals/g_abc' },
	{ from: '/plans', to: '/program/plans' },
	{ from: '/plans/p_abc', to: '/program/plans/p_abc' },
];

test.describe('IA legacy redirects', () => {
	for (const { from, to } of REDIRECTS) {
		test(`${from} -> ${to} (301)`, async ({ request, baseURL }) => {
			const res = await request.get(from, { maxRedirects: 0 });
			expect(res.status(), `expected 301 for ${from}`).toBe(301);
			const location = res.headers()['location'];
			expect(location, `expected Location header on 301 for ${from}`).toBeDefined();
			// Compare the path portion -- some hosts upper-case the host
			// but the path contract is what we own. `URL` parses both
			// absolute and relative locations.
			const target = new URL(location ?? '', baseURL ?? 'http://localhost');
			expect(target.pathname, `wrong target for ${from}`).toBe(to);
		});
	}

	test('preserves the query string through the redirect', async ({ request, baseURL }) => {
		const res = await request.get('/dashboard?from=email', { maxRedirects: 0 });
		expect(res.status()).toBe(301);
		const target = new URL(res.headers()['location'] ?? '', baseURL ?? 'http://localhost');
		expect(target.pathname).toBe('/insights');
		expect(target.search).toBe('?from=email');
	});
});
