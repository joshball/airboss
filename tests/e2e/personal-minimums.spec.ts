/**
 * Personal-minimums editor e2e (personal-minimums-as-typed-contract WP).
 *
 * Uses the fresh-user fixture so every test starts from a clean
 * personal-minimums state (no record) -- the empty-state form, the initial
 * save, the edit flow, inline validation, and the revision history are all
 * exercised deterministically.
 */

import { expect } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';
import { test } from './fixtures/fresh-user';

test.describe('personal minimums editor', () => {
	test('empty state pre-seeds the form, and an initial save renders the record', async ({ page, freshUser }) => {
		expect(freshUser.id).toBeDefined();
		await page.goto(ROUTES.STUDY_PERSONAL_MINIMUMS);

		await expect(page.getByRole('heading', { name: 'Personal minimums', exact: true })).toBeVisible();
		// Empty state: the form is the surface, pre-seeded with the FAA baseline.
		const form = page.getByTestId('pmin-form');
		await expect(form).toBeVisible();
		await expect(page.getByTestId('pmin-input-ceilingFt')).toHaveValue('1500');
		await expect(page.getByTestId('pmin-input-visibilitySm')).toHaveValue('5');

		await form.getByRole('button', { name: 'Save' }).click();

		// Read mode renders the saved record + the success banner.
		await expect(page.getByTestId('pmin-record')).toBeVisible();
		await expect(page.getByTestId('pmin-value-ceilingFt')).toHaveText('1500 ft AGL');
		await expect(page.getByText(/effective immediately/i)).toBeVisible();
	});

	test('editing the active record creates a new revision', async ({ page, freshUser }) => {
		expect(freshUser.id).toBeDefined();
		await page.goto(ROUTES.STUDY_PERSONAL_MINIMUMS);
		await page.getByTestId('pmin-form').getByRole('button', { name: 'Save' }).click();
		await expect(page.getByTestId('pmin-record')).toBeVisible();

		// Open the edit form, change the ceiling, save.
		await page.getByRole('link', { name: 'Edit' }).click();
		const ceiling = page.getByTestId('pmin-input-ceilingFt');
		await ceiling.fill('3000');
		await page.getByTestId('pmin-form').getByRole('button', { name: 'Save' }).click();

		await expect(page.getByTestId('pmin-value-ceilingFt')).toHaveText('3000 ft AGL');
	});

	test('inline validation rejects crosswind greater than wind total', async ({ page, freshUser }) => {
		expect(freshUser.id).toBeDefined();
		await page.goto(ROUTES.STUDY_PERSONAL_MINIMUMS);

		await page.getByTestId('pmin-input-windTotalKt').fill('20');
		await page.getByTestId('pmin-input-crosswindTotalKt').fill('25');
		await page.getByTestId('pmin-form').getByRole('button', { name: 'Save' }).click();

		// The save does not produce a record; the inline error surfaces.
		await expect(page.getByTestId('pmin-error-crosswindTotalKt')).toHaveText(/must be <= windTotalKt/i);
		await expect(page.getByTestId('pmin-record')).toHaveCount(0);
	});

	test('history page lists every revision newest-first', async ({ page, freshUser }) => {
		expect(freshUser.id).toBeDefined();
		await page.goto(ROUTES.STUDY_PERSONAL_MINIMUMS);

		// Initial save.
		await page.getByTestId('pmin-form').getByRole('button', { name: 'Save' }).click();
		await expect(page.getByTestId('pmin-record')).toBeVisible();

		// Second revision.
		await page.getByRole('link', { name: 'Edit' }).click();
		await page.getByTestId('pmin-input-ceilingFt').fill('2500');
		await page.getByTestId('pmin-form').getByRole('button', { name: 'Save' }).click();
		await expect(page.getByTestId('pmin-value-ceilingFt')).toHaveText('2500 ft AGL');

		await page.goto(ROUTES.STUDY_PERSONAL_MINIMUMS_HISTORY);
		const rows = page.getByTestId('pmin-history-row');
		await expect(rows).toHaveCount(2);
		// Newest-first: the active 2500 ft revision leads.
		await expect(rows.first()).toContainText('Active');
	});
});
