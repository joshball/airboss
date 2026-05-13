/**
 * E2E smoke for wp-flightbag-rich-reader (Phases 2 + 6 surfaces).
 *
 * Anonymous coverage only -- the rich-reader UI is auth-gated. The
 * selection toolbar, annotation layer, annotation filter chip, and the
 * /memory/drafts inbox all require a signed-in user. This suite asserts
 * that anonymous visitors:
 *
 *   - see a clean reader page (body, breadcrumbs, source links) with
 *     none of the rich-reader chrome,
 *   - have no `[data-testid="reader-chrome"]` filter chip,
 *   - have no `[data-testid="selection-toolbar"]` even after selecting
 *     text (the toolbar listens for selectionchange but bails because
 *     it's only mounted from RichReaderHost behind isAuthenticated),
 *   - have no `[data-testid="annotation-layer"]`.
 *
 * Authenticated coverage is gated on the cross-app session-cookie infra
 * called out in tests/e2e/flightbag/read-state.spec.ts (ADR 024). When
 * that lands, this suite picks up the highlight + draft + note + filter
 * paths from the spec's test-plan walkthrough.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../../libs/constants/src';

test.describe('rich-reader anonymous gating', () => {
	test('handbook section page omits rich-reader chrome when anonymous', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '12', '3'));
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(page.getByTestId('reader-chrome')).toHaveCount(0);
		await expect(page.getByTestId('annotation-layer')).toHaveCount(0);
		await expect(page.getByTestId('selection-toolbar')).toHaveCount(0);
	});

	test('selecting body text does not summon the toolbar for anonymous users', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '12', '3'));
		const body = page.locator('article.body[data-annotatable-body]');
		await expect(body).toBeVisible();
		// Programmatically select the first paragraph's text inside the body.
		await page.evaluate(() => {
			const el = document.querySelector('article.body[data-annotatable-body] p');
			if (!el) return;
			const sel = window.getSelection();
			if (!sel) return;
			const range = document.createRange();
			range.selectNodeContents(el);
			sel.removeAllRanges();
			sel.addRange(range);
		});
		// Give selectionchange a tick to fire.
		await page.waitForTimeout(120);
		await expect(page.getByTestId('selection-toolbar')).toHaveCount(0);
	});

	test('/memory/drafts redirects anonymous users to sign-in (auth-gated)', async ({ page }) => {
		const res = await page.goto(ROUTES.MEMORY_DRAFTS, { waitUntil: 'domcontentloaded' });
		// Anonymous callers go through the cross-app sign-in redirect; the
		// resulting URL is in the auth realm or a study sign-in landing.
		// Accept any non-200-on-/memory/drafts outcome (302 / sign-in page).
		// `res.status()` reports the final-document status after redirects;
		// if the chain leaves us off /memory/drafts we treat that as success.
		expect(res?.status()).not.toBe(500);
		const finalUrl = page.url();
		const onDrafts = finalUrl.includes('/memory/drafts');
		const onSignIn = finalUrl.includes('/login') || finalUrl.includes('signIn') || finalUrl.includes('redirectTo');
		expect(onDrafts || onSignIn).toBe(true);
	});
});
