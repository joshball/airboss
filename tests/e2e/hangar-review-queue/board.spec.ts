// /review board e2e -- covers test-plan section 4 (first visit), section 5
// (filters), and the URL-persistence + loader-refresh contracts.
//
// Drag-and-drop frontmatter writes (test-plan section 6) are not driven
// here: a real drag mutates spec.md files under docs/work-packages/ via
// writeFrontmatterField, which would dirty the working tree under every
// test run. The board's ?/move action is unit-tested in
// apps/hangar/src/routes/(app)/review/+page.server.ts neighbours
// (spec-actions.test.ts, walker-actions.test.ts) -- the e2e suite focuses
// on the read-only filter / URL / refresh paths and the kbd alternate
// (Move-to popover) without flipping any authored frontmatter.

import { expect, test } from '@playwright/test';
import { REVIEW_BOARD_QUERY_PARAMS, ROUTES } from '../../../libs/constants/src';

test.describe('review board: first visit + columns', () => {
	test('seeded board renders the four default columns and a populated bucket card', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW);
		await expect(page.getByRole('heading', { level: 1, name: /^Hangar Review$/ })).toBeVisible();
		// All four default columns surface as section regions inside the
		// `Review board columns` aria-label.
		const columns = page.getByRole('region', { name: /columns/i }).first();
		await expect(columns).toBeVisible();
		// Backlog should hold at least one bucket card (WP Specs -- unread)
		// because the dev-seed loader populated review_item rows for the
		// existing WPs in this repo. The bucket title is authored verbatim.
		await expect(page.getByText(/WP Specs --? unread/i).first()).toBeVisible();
	});

	test('header surfaces filter chips, kind selector, status selector, and search input', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW);
		const toolbar = page.getByRole('toolbar', { name: /board filters/i });
		await expect(toolbar).toBeVisible();
		await expect(toolbar.getByRole('button', { name: /^All$/ })).toBeVisible();
		await expect(toolbar.getByRole('button', { name: /^Reviews$/ })).toBeVisible();
		await expect(toolbar.getByRole('button', { name: /^Tasks$/ })).toBeVisible();
		await expect(toolbar.getByRole('searchbox', { name: /search title or ref/i })).toBeVisible();
	});
});

test.describe('review board: filters + URL persistence', () => {
	test('clicking a top filter chip updates the URL search param', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW);
		const tasksChip = page.getByRole('button', { name: /^Tasks$/ });
		await tasksChip.click();
		await expect(tasksChip).toHaveAttribute('aria-pressed', 'true');
		// URL persistence runs in a `$effect` that reads the filter state
		// after the click; expect the URL to reflect the chip.
		await expect.poll(() => new URL(page.url()).searchParams.get(REVIEW_BOARD_QUERY_PARAMS.TOP)).toBe('tasks');
	});

	test('typing in the search box filters the visible card set and persists in the URL', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW);
		const search = page.getByRole('searchbox', { name: /search title or ref/i });
		await search.fill('hangar-review-queue');
		// The result-count line is hidden from AT (aria-hidden), but its strong
		// child reflects the filtered count synchronously in the DOM.
		await expect.poll(() => new URL(page.url()).searchParams.get(REVIEW_BOARD_QUERY_PARAMS.TEXT)).toBe(
			'hangar-review-queue',
		);
		// At least one matching item / bucket should remain visible.
		await expect(page.getByText(/hangar-review-queue/i).first()).toBeVisible();
	});

	test('Clear filters returns the board to the default view', async ({ page }) => {
		await page.goto(`${ROUTES.HANGAR_REVIEW}?${REVIEW_BOARD_QUERY_PARAMS.TOP}=tasks`);
		const toolbar = page.getByLabel('Board filters');
		await expect(toolbar.getByRole('button', { name: /^Tasks$/ })).toHaveAttribute('aria-pressed', 'true');
		await toolbar.getByRole('button', { name: /clear filters/i }).click();
		await expect(toolbar.getByRole('button', { name: /^All$/ })).toHaveAttribute('aria-pressed', 'true');
		await expect.poll(() => new URL(page.url()).searchParams.get(REVIEW_BOARD_QUERY_PARAMS.TOP)).toBeNull();
	});
});

test.describe('review board: loader refresh', () => {
	test('Refresh button posts to ?/runLoader and surfaces a success toast', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW);
		const refresh = page.getByRole('button', { name: /^Refresh$/ });
		await Promise.all([
			page.waitForResponse(
				(res) => res.request().method() === 'POST' && res.url().includes('?/runLoader'),
				{ timeout: 60_000 },
			),
			refresh.click(),
		]);
		// Success toast carries an "added", "updated", "removed" line.
		await expect(page.getByRole('status').filter({ hasText: /added/i }).first()).toBeVisible({
			timeout: 10_000,
		});
	});
});
