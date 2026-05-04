/**
 * Test-plan walker e2e -- covers test-plan section 8 (walker rendering +
 * progress + pause) and the keyboard-shortcut surface from section 10.
 *
 * Does NOT click `Confirm finish` for the `pass` outcome on a real WP --
 * that would fire `?/finish` against `pass`, which writes
 * `review_status: done` to a real spec.md in the repo. Reviewer sets
 * step outcomes optimistically (the row's Pass/Fail/Blocked buttons post
 * `?/setOutcome` actions writing only to the DB session row, NOT to
 * frontmatter), then we Pause, which closes the session as
 * `in-progress`. The unit walker-actions.test.ts covers the finish-flip
 * behaviour at the action level.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../../libs/constants/src';

test.describe('test-plan walker: progress + pause', () => {
	test('walker page renders steps grouped by section heading', async ({ page }) => {
		// Route through the board -> spec -> walker so we work with whatever
		// review_item id the loader assigned.
		await page.goto(ROUTES.HANGAR_REVIEW);
		await page.getByRole('searchbox', { name: /search title or ref/i }).fill('hangar-review-queue');
		const itemLink = page.locator(`a[href*="/review/items/"]`).first();
		await Promise.all([page.waitForURL(/\/review\/wp_spec\//), itemLink.click()]);
		const walkerLink = page.locator(`a[href$="/walker"]`).first();
		await Promise.all([page.waitForURL(/\/walker$/), walkerLink.click()]);

		await expect(page.getByRole('heading', { level: 1, name: /Test-plan walker/i })).toBeVisible();
		// Walker steps render under section headings. The hangar-review-queue
		// test plan uses authored H2s ("1. Docs browser -- baseline rendering",
		// "2. Docs browser -- full-text search", ...), each of which becomes
		// a `<h2 class="section-title">` in the walker.
		const sectionTitles = page.locator('h2.section-title');
		await expect(sectionTitles.first()).toBeVisible();
		expect(await sectionTitles.count()).toBeGreaterThan(0);
	});

	test('keyboard shortcut hint surfaces in the progress aside', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW);
		await page.getByRole('searchbox', { name: /search title or ref/i }).fill('hangar-review-queue');
		const itemLink = page.locator(`a[href*="/review/items/"]`).first();
		await Promise.all([page.waitForURL(/\/review\/wp_spec\//), itemLink.click()]);
		const walkerLink = page.locator(`a[href$="/walker"]`).first();
		await Promise.all([page.waitForURL(/\/walker$/), walkerLink.click()]);
		const shortcuts = page.getByRole('complementary', { name: /keyboard shortcuts/i });
		await expect(shortcuts).toBeVisible();
		// `j`/`k`/`p`/`f`/`b`/`n` are listed via <kbd> elements.
		await expect(shortcuts.locator('kbd')).toHaveCount(6);
	});

	test('pause returns to the spec surface', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW);
		await page.getByRole('searchbox', { name: /search title or ref/i }).fill('hangar-review-queue');
		const itemLink = page.locator(`a[href*="/review/items/"]`).first();
		await Promise.all([page.waitForURL(/\/review\/wp_spec\//), itemLink.click()]);
		const walkerLink = page.locator(`a[href$="/walker"]`).first();
		await Promise.all([page.waitForURL(/\/walker$/), walkerLink.click()]);
		const pause = page.getByRole('button', { name: /^Pause$/ });
		await Promise.all([page.waitForURL(/\/review\/wp_spec\//), pause.click()]);
		// Back on the spec surface, the breadcrumb leads with "Review board".
		await expect(page.getByRole('link', { name: /^Review board$/ }).first()).toBeVisible();
	});
});
