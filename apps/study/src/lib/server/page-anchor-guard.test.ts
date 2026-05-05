/**
 * Page-anchor static guard test (study-app-ia-cleanup Phase 4 CI guard).
 *
 * The full `(app)` route tree must surface `data-testid="page-anchor"`
 * on every `+page.svelte`. This test is the CI keystone: if a new route
 * lands without the testid, the build fails here, before any e2e suite
 * runs. The Playwright `ia-flow.spec.ts` is the runtime sweep; this is
 * the static safety net.
 *
 * Adding a new (app) route? Surface the page-anchor via either:
 *   1. A `<PageHeader>` (or `<ReferencePage>` / `<HelpLayout>`) -- they
 *      land the testid for you.
 *   2. A direct `<h1 data-testid="page-anchor">` in the page or any
 *      `_panels/*.svelte` it mounts.
 *
 * If a page is intentionally headless (modal-only, redirect-only),
 * filter it via `KNOWN_HEADLESS` below with a comment explaining why.
 */

import { describe, expect, it } from 'vitest';
import { auditPageAnchors } from './page-anchor-guard';

const ROUTES_ROOT = new URL('../../routes/(app)', import.meta.url).pathname;

/**
 * Routes that legitimately do not surface a page-anchor h1. Intentionally
 * empty today -- every `(app)` route should anchor. Adding to this list
 * requires a comment justifying why the page has no primary heading.
 */
const KNOWN_HEADLESS: ReadonlyArray<string> = [];

describe('page-anchor static guard', () => {
	it('every (app) +page.svelte surfaces data-testid="page-anchor"', () => {
		const results = auditPageAnchors(ROUTES_ROOT);
		const missing = results
			.filter((r) => !r.hasAnchor)
			.filter((r) => !KNOWN_HEADLESS.some((tail) => r.path.endsWith(tail)));
		expect(
			missing,
			`Pages missing data-testid="page-anchor":\n${missing.map((m) => `  - ${m.path}`).join('\n')}`,
		).toEqual([]);
	});

	it('audit found a non-trivial number of pages (sanity check the walker)', () => {
		const results = auditPageAnchors(ROUTES_ROOT);
		// `(app)` shipped 50+ routes by Phase 4. Anything radically smaller
		// means the walker silently skipped a directory.
		expect(results.length, 'page audit walked too few files').toBeGreaterThan(40);
	});
});
