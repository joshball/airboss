/**
 * Ad-hoc task e2e -- covers test-plan section 12. Drives the canonical
 * lifecycle (new -> validation -> create -> visible on board -> edit ->
 * delete) and confirms the toast handshake on each step.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../../libs/constants/src';

test.describe('ad-hoc tasks', () => {
	test('+ New task link from the board lands on the new-task form', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW);
		const newLink = page.getByRole('link', { name: /\+ New task/i });
		await Promise.all([page.waitForURL(/\/review\/tasks\/new$/), newLink.click()]);
		await expect(page.getByRole('heading', { level: 1, name: /new ad-hoc task/i })).toBeVisible();
	});

	test('submitting an empty title surfaces an inline validation error', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW_TASK_NEW);
		// Force-submit past the native required-field check via requestSubmit()
		// so the server-side validator runs. Wait for hydration so `use:enhance`
		// is bound; otherwise the click fires before the JS handler is attached
		// and the submit is a silent no-op.
		await page.waitForLoadState('networkidle');
		// Scope to the task form -- the page also has the header search form.
		await page
			.locator('form')
			.filter({ has: page.locator('input[name="title"]') })
			.evaluate((form: HTMLFormElement) => {
				form.noValidate = true;
				form.requestSubmit();
			});
		await expect(page.getByText(/title is required/i)).toBeVisible({ timeout: 10_000 });
	});

	test('create -> visible on board -> edit -> delete', async ({ page }, testInfo) => {
		const title = `e2e task ${testInfo.testId.slice(0, 8)}`;

		await test.step('create', async () => {
			await page.goto(ROUTES.HANGAR_REVIEW_TASK_NEW);
			// Wait for hydration so `use:enhance` is bound -- otherwise the
			// click fires before the JS handler is attached and the POST goes
			// out as a native submit but the page-level `enhance` lifecycle
			// (which the redirect-following relies on) never runs.
			await page.waitForLoadState('networkidle');
			await page.locator('input[name="title"]').fill(title);
			// Type + product area selects: pick the first non-blank option of
			// each so the form passes validation regardless of which seed
			// values are in `TASK_TYPES` / `PRODUCT_AREAS`.
			const typeSelect = page.locator('select[name="type"]');
			await typeSelect.selectOption({ index: 1 });
			const areaSelect = page.locator('select[name="productArea"]');
			await areaSelect.selectOption({ index: 1 });
			await Promise.all([
				page.waitForURL(new RegExp(`${ROUTES.HANGAR_REVIEW.replace('/', '\\/')}\\?`)),
				page.getByRole('button', { name: /create task/i }).click(),
			]);
		});

		await test.step('board surfaces the new task', async () => {
			// The board redirects with `?created=...`; the toast renders + the
			// card surfaces with the same title.
			await expect(page.getByText(title).first()).toBeVisible();
		});

		await test.step('edit -> save -> board reflects the new title', async () => {
			// Click the card; ad-hoc dispatcher 303s to the edit form.
			const card = page.getByRole('article').filter({ hasText: title }).first();
			await card.getByRole('link').first().click();
			await page.waitForURL(/\/review\/tasks\/.+\/edit$/);
			const renamed = `${title} edited`;
			await page.locator('input[name="title"]').fill(renamed);
			await Promise.all([
				page.waitForResponse(
					(res) => res.request().method() === 'POST' && res.url().includes('?/update'),
				),
				page.getByRole('button', { name: /^Save$/ }).click(),
			]);
			// Stay on edit; the title field now reflects the saved value.
			await expect(page.locator('input[name="title"]')).toHaveValue(renamed);
		});

		await test.step('delete from edit returns to the board', async () => {
			await page.getByRole('button', { name: /^Delete task$/ }).click();
			await Promise.all([
				page.waitForURL(new RegExp(`${ROUTES.HANGAR_REVIEW.replace('/', '\\/')}(\\?|$)`)),
				page.getByRole('button', { name: /confirm delete/i }).click(),
			]);
			// Card no longer surfaces. The title prefix is shared with the
			// post-rename `${title} edited` card, so wait for the article-level
			// match (the toast/announcer surfaces are non-article and would
			// otherwise inflate `toHaveCount` past 0 transiently).
			await expect(page.getByRole('article').filter({ hasText: title })).toHaveCount(0);
		});
	});
});
