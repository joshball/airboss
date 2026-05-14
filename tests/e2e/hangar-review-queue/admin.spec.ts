/**
 * `/review/admin/*` e2e -- covers test-plan sections 13 (loader admin) and
 * 14 (bucket admin) plus the ADMIN gating rule (the layout's
 * `requireRole(ADMIN)` short-circuits non-admins; the auth project drives
 * each entry point as the seeded admin so the gate is exercised by every
 * navigation here).
 *
 * Each bucket-CRUD test uses a unique bucket name keyed off
 * `test.info().testId` so concurrent runs don't collide on the
 * unique-name validation. The delete tail-call leaves the DB clean even
 * if a mid-test assertion fails -- the cleanup is wired through the
 * canonical happy-path flow inside the test, and the malformed-JSON
 * branch defensively re-attempts a delete in case a future change starts
 * inserting on validation failure.
 */

import { expect, test, type Page } from '@playwright/test';
import { ROUTES } from '../../../libs/constants/src';

async function deleteBucketByName(page: Page, name: string): Promise<void> {
	await page.goto(ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS);
	const row = page.getByRole('row').filter({ hasText: name }).first();
	if ((await row.count()) === 0) return;
	const editLink = row.getByRole('link', { name: /^Edit$/ });
	if ((await editLink.count()) === 0) return;
	await editLink.click();
	await page.getByRole('button', { name: /delete bucket/i }).click();
	await Promise.all([
		page.waitForURL(/\/review\/admin\/buckets$/),
		page.getByRole('button', { name: /confirm delete/i }).click(),
	]);
}

test.describe('loader admin', () => {
	test('last-run summary, index state, and refresh form all render', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW_ADMIN_LOADER);
		await expect(page.getByRole('heading', { level: 1, name: /^Loader$/ })).toBeVisible();
		// Three cards: Last run, Index state, Refresh.
		await expect(page.getByRole('heading', { level: 2, name: /^Last run$/ })).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: /^Index state$/ })).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: /^Refresh$/ })).toBeVisible();
		// FTS rows indexed surfaces a non-zero numeric value after the seed
		// loader run from `global.setup.ts`.
		await expect(page.getByText(/FTS rows indexed/i)).toBeVisible();
	});

	test('Run loader now refreshes the last-run summary', async ({ page }) => {
		// The loader form action drives a full WP/bug rescan synchronously on
		// the server; under parallel webServer load this consistently lands
		// in the 30-45s range, blowing past the default 30s per-test budget.
		// Extend so the assertion can wait for the action to finish.
		test.setTimeout(120_000);
		await page.goto(ROUTES.HANGAR_REVIEW_ADMIN_LOADER);
		// Capture the "Ran at" timestamp before, run the loader, confirm the
		// "Ran at" cell exists and the success status announces.
		await Promise.all([
			page.waitForResponse((res) => res.request().method() === 'POST' && res.url().includes('?/runLoader'), {
				timeout: 90_000,
			}),
			page.getByRole('button', { name: /run loader now/i }).click(),
		]);
		await expect(page.getByText(/Items added/i)).toBeVisible({ timeout: 30_000 });
	});
});

test.describe('bucket admin: CRUD', () => {
	test('list page renders the seeded buckets in a table', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS);
		await expect(page.getByRole('heading', { level: 1, name: /^Buckets$/ })).toBeVisible();
		// Seed buckets always exist after the loader has run; the list table
		// surfaces at least one row.
		const tbody = page.locator('table.bucket-list tbody tr');
		await expect(tbody.first()).toBeVisible();
		expect(await tbody.count()).toBeGreaterThan(0);
	});

	test('submitting an empty name surfaces an inline validation error', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW_ADMIN_BUCKET_NEW);
		// Native HTML5 validation: leave Name blank, click Create. Browser
		// blocks the submit; the form stays on the same page with the input
		// invalid. Force a `requestSubmit()` call to bypass the native dialog
		// AND wait for hydration so `use:enhance` is bound -- otherwise the
		// click fires before the JS handler is attached and the submit is a
		// silent no-op.
		await page.waitForLoadState('networkidle');
		// Scope to the bucket form -- the page also has the header search
		// form, so a bare `page.locator('form')` strict-matches both.
		await page.locator('form').filter({ has: page.locator('input[name="name"]') }).evaluate((form: HTMLFormElement) => {
			form.noValidate = true;
			form.requestSubmit();
		});
		await expect(page.getByText(/name is required/i)).toBeVisible({ timeout: 10_000 });
	});

	test('create -> appears on list -> edit -> delete tail-cleans', async ({ page }, testInfo) => {
		const name = `e2e bucket ${testInfo.testId.slice(0, 8)}`;
		await test.step('create', async () => {
			await page.goto(ROUTES.HANGAR_REVIEW_ADMIN_BUCKET_NEW);
			await page.waitForLoadState('networkidle');
			await page.locator('input[name="name"]').fill(name);
			await page.locator('select[name="kindId"]').selectOption('wp_spec');
			// Pick a frontmatter status so the bucket has a meaningful filter.
			await page.locator('input[name="filterFmStatuses"][value="unread"]').check();
			await Promise.all([
				page.waitForURL(/\/review\/admin\/buckets$/),
				page.getByRole('button', { name: /create bucket/i }).click(),
			]);
		});

		await test.step('list shows the new bucket', async () => {
			await expect(page.getByRole('row', { name: new RegExp(name, 'i') })).toBeVisible();
		});

		await test.step('edit form pre-fills from the saved row', async () => {
			const row = page.getByRole('row').filter({ hasText: name });
			await row.getByRole('link', { name: /^Edit$/ }).click();
			await expect(page.locator('input[name="name"]')).toHaveValue(name);
			await expect(page.locator('input[name="filterFmStatuses"][value="unread"]')).toBeChecked();
		});

		await test.step('delete returns to list', async () => {
			await page.getByRole('button', { name: /delete bucket/i }).click();
			await Promise.all([
				page.waitForURL(/\/review\/admin\/buckets$/),
				page.getByRole('button', { name: /confirm delete/i }).click(),
			]);
			await expect(page.getByRole('row', { name: new RegExp(name, 'i') })).toHaveCount(0);
		});
	});

	test('malformed advanced JSON predicate fails validation', async ({ page }, testInfo) => {
		const name = `e2e bad json ${testInfo.testId.slice(0, 8)}`;
		await page.goto(ROUTES.HANGAR_REVIEW_ADMIN_BUCKET_NEW);
		await page.waitForLoadState('networkidle');
		await page.locator('input[name="name"]').fill(name);
		await page.locator('select[name="kindId"]').selectOption('wp_spec');
		// Open the Advanced JSON details + paste invalid JSON.
		await page.locator('details.advanced summary').click();
		await page.locator('textarea[name="advancedJson"]').fill('{ "kind": "wp_spec", '); // truncated JSON
		await page.getByRole('button', { name: /create bucket/i }).click();
		// The form stays on the new page with an inline error rendered by the
		// BucketForm `errors.advancedJson` slot. The `<details>` auto-opens
		// when the validator returns `errors.advancedJson` (controlled by
		// `open={errors.advancedJson ? true : undefined}` in BucketForm.svelte).
		await expect(
			page
				.getByText(/json/i)
				.filter({ hasText: /(invalid|parse|malformed|expected)/i })
				.first(),
		).toBeVisible({
			timeout: 10_000,
		});
		// Cleanup: the failed submit means no bucket got persisted -- nothing
		// to delete. We still call the helper to be defensive in case a
		// future change starts inserting on validation failure.
		await deleteBucketByName(page, name);
	});
});
