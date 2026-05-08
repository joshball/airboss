/**
 * E2E smoke for phase 6 read-state UI.
 *
 * Without auth, the read-state UI must not render: no "Read N of M sections"
 * indicator on the chapter page, no per-chapter progress on the handbook
 * landing, no checkmarks on the TOC, no "you've read this" line on the
 * section header. The page itself must still work (links, body rendering,
 * source links).
 *
 * Authenticated coverage requires cross-app session-cookie test infra that
 * doesn't exist yet (per ADR 024); a follow-up e2e will add it once the
 * entitlement primitive lands and the session-handoff pattern from study to
 * flightbag is wired.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../../libs/constants/src';

test.describe('flightbag read-state UI (anonymous)', () => {
	test('handbook landing has no per-chapter or overall progress when anonymous', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK('phak', '8083-25C'));
		await expect(page.getByRole('heading', { level: 2, name: /Chapters/i })).toBeVisible();
		// "Read N of N sections" indicator is gated on isAuthenticated; should
		// not be present anonymously.
		await expect(page.getByLabel('Handbook reading progress')).toHaveCount(0);
	});

	test('chapter page has no Read N of M indicator when anonymous', async ({ page }) => {
		// PHAK chapter pages are heavy (855-entry TOC + chapter preamble + section
		// list). The default `waitUntil: 'load'` waits for every subresource
		// (fonts, lazy-loaded figure dimension reservations, dev-server HMR
		// websocket handshake) which routinely trips the 15s navigation budget on
		// a cold-cache e2e run. Switch to `domcontentloaded` to match
		// `representative-pages.spec.ts` -- the assertions below only need the
		// SSR'd DOM, not a fully-warm page.
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('phak', '8083-25C', '12'), {
			waitUntil: 'domcontentloaded',
		});
		await expect(page.getByLabel('Chapter reading progress')).toHaveCount(0);
		// Sections list still renders. The chapter page wraps the per-section
		// `<ol>` in a `<section aria-label="Sections">` landmark; assert the
		// landmark and its sibling H2 ("Sections") are both present so a future
		// markup change to the inner list shape doesn't silently hide the
		// failure.
		const sectionsLandmark = page.locator('section[aria-label="Sections"]');
		await expect(sectionsLandmark).toBeVisible();
		await expect(sectionsLandmark.getByRole('heading', { level: 2, name: 'Sections' })).toBeVisible();
	});

	test('section page renders normally with no read-history line when anonymous', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '12', '3'));
		// Body rendered.
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		// "You've read this N times" line should NOT appear.
		await expect(page.locator('p.read-summary')).toHaveCount(0);
	});
});
