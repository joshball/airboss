/**
 * IA first-run -- no goal, no plan, no decks.
 *
 * Brand-new learner lands on `/study` and sees ONE primary CTA: "Set your
 * first goal". Per study-app-ia-cleanup test plan IAC-1.1.
 *
 * The wide-coverage soft-disable assertions (Learn / Insights nav
 * tooltipped "Set a goal to unlock") arrive in a later phase when the
 * five-section nav lands; this spec asserts only the Phase 1 surface:
 * the Home CTA + page-anchor visibility.
 */

import { expect } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';
import { test } from './fixtures/fresh-user';

test.describe('IA first-run', () => {
	test('home shows only "Set your first goal" CTA for a fresh user', async ({ page, freshUser }) => {
		expect(freshUser.email).toContain('@airboss.test');
		await page.goto(ROUTES.STUDY);
		await expect(page.getByTestId('page-anchor')).toBeVisible();

		const cta = page.getByTestId('first-run-set-goal-cta');
		await expect(cta).toBeVisible();
		await expect(cta).toContainText(/set your first goal/i);

		// The goal+plan "Start today's session" CTA is NOT present in this state.
		await expect(page.getByTestId('home-cta-primary')).toHaveCount(0);
	});
});
