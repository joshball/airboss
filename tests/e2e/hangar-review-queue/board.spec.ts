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
		// Wait for hydration: the chip's onclick handler is wired in
		// `+page.svelte`, so click events only update `topFilter` (and
		// therefore `aria-pressed`) after Svelte's runtime has bound the
		// listener. Polling on `aria-pressed` after a click handles the
		// race without coupling to a hydration sentinel.
		const tasksChip = page.getByRole('button', { name: /^Tasks$/ });
		await expect(tasksChip).toHaveAttribute('aria-pressed', 'false');
		await expect
			.poll(
				async () => {
					await tasksChip.click();
					return await tasksChip.getAttribute('aria-pressed');
				},
				{ timeout: 10_000 },
			)
			.toBe('true');
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
		await page.waitForLoadState('networkidle');
		const toolbar = page.getByLabel('Board filters');
		await expect(toolbar.getByRole('button', { name: /^Tasks$/ })).toHaveAttribute('aria-pressed', 'true');
		const clearBtn = toolbar.getByRole('button', { name: /clear filters/i });
		const allBtn = toolbar.getByRole('button', { name: /^All$/ });
		// Poll the click against `aria-pressed` to absorb the hydration race --
		// the chip's onclick is bound after Svelte's runtime mounts, so a
		// single click can fire before the listener attaches.
		await expect
			.poll(
				async () => {
					await clearBtn.click();
					return await allBtn.getAttribute('aria-pressed');
				},
				{ timeout: 10_000 },
			)
			.toBe('true');
		await expect.poll(() => new URL(page.url()).searchParams.get(REVIEW_BOARD_QUERY_PARAMS.TOP)).toBeNull();
	});
});

test.describe('review board: loader refresh', () => {
	test('Refresh button posts to ?/runLoader and surfaces a success toast', async ({ page }) => {
		// The Refresh button drives the same WP/bug rescan as the admin
		// loader page (see `admin.spec.ts`); under parallel webServer load
		// the action consistently exceeds the 30s default per-test budget
		// AND the 15s per-action click budget. Extend both.
		test.setTimeout(120_000);
		await page.goto(ROUTES.HANGAR_REVIEW);
		const refresh = page.getByRole('button', { name: /^Refresh$/ });
		// `noWaitAfter` detaches the click from its scheduled-navigation wait
		// so the `waitForResponse` below is the single source of truth.
		await Promise.all([
			page.waitForResponse(
				(res) => res.request().method() === 'POST' && res.url().includes('?/runLoader'),
				{ timeout: 90_000 },
			),
			refresh.click({ noWaitAfter: true, timeout: 90_000 }),
		]);
		// Success toast carries an "added", "updated", "removed" line.
		await expect(page.getByRole('status').filter({ hasText: /added/i }).first()).toBeVisible({
			timeout: 10_000,
		});
	});
});
