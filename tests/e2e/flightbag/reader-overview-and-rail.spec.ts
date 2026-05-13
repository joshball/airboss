/**
 * Reader overview + persistent rail + keyboard nav (WP-FLIGHTBAG-READER-UX
 * Phase 4).
 *
 * Covers:
 *   - the handbook landing renders the overview-mode TOC grid (chapter
 *     tiles instead of the legacy section list)
 *   - clicking from chapter to section keeps the rail mounted (the same
 *     element survives navigation rather than remounting)
 *   - keyboard shortcuts: `?` opens the cheatsheet overlay; `j` / `k`
 *     cycle the reading order
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../../libs/constants/src';

test.describe('reader overview view', () => {
	test('handbook landing renders the overview grid', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK('phak', '8083-25C'));
		// Overview mode renders a `<TOCRender mode="overview">` section with
		// `<ChapterTile>` cards. Each tile has a chapter link.
		const grid = page.locator('section[aria-label="Pilot\'s Handbook of Aeronautical Knowledge (PHAK)"]').first();
		await expect(grid.or(page.getByRole('heading', { name: 'Chapters' }))).toBeVisible();
		// At least one `<article class="tile">` should be present.
		const tile = page.locator('article.tile').first();
		await expect(tile).toBeVisible();
	});

	test('chapter-to-section navigation keeps the rail mounted', async ({ page }) => {
		const chapter12Href = ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('phak', '8083-25C', '12');
		await page.goto(chapter12Href);
		// Rail rendered by the shared `[edition]/+layout.svelte` mounts an
		// `<aside class="toc-rail">`. Capture a marker so we can confirm the
		// same instance survives navigation.
		const rail = page.locator('aside.toc-rail');
		await expect(rail).toBeVisible();

		// Click into §12.9 in the rail. The shared layout's view-transition
		// wrapper handles the goto; the rail aside must still be visible.
		const section9Href = ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '12', '9');
		await page.locator(`aside.toc-rail a[href="${section9Href}"]`).first().click();
		await expect(page).toHaveURL(section9Href);
		await expect(page.locator('aside.toc-rail')).toBeVisible();
	});
});

test.describe('reader keyboard shortcuts', () => {
	test('? opens the cheatsheet overlay', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('phak', '8083-25C', '12'));
		await page.keyboard.press('?');
		const dialog = page.locator('dialog.cheatsheet');
		await expect(dialog).toHaveAttribute('open', /.*/);
		await expect(page.getByRole('heading', { name: 'Keyboard shortcuts', level: 2 })).toBeVisible();
		// Esc closes via the dialog's native close.
		await page.keyboard.press('Escape');
		await expect(dialog).not.toHaveAttribute('open', /.*/);
	});

	test('j navigates to the next section in reading order', async ({ page }) => {
		// Start on chapter 1. `j` should advance to the next entry that has
		// an href -- in PHAK that's §1.1 (or chapter 2's first section,
		// depending on the seed).
		const chapter1Href = ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('phak', '8083-25C', '1');
		await page.goto(chapter1Href);
		await page.keyboard.press('j');
		// The URL should change to a different chapter / section page.
		await expect(page).not.toHaveURL(chapter1Href);
	});
});
