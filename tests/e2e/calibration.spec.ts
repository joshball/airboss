import { test as baseTest, expect } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';
import { test as freshUserTest } from './fixtures/fresh-user';

// `loads with heading and one of the two valid layouts` runs against the
// shared dev-seed (Abby), whose review history populates the calibration
// page, so the assertion exercises the populated layout.
//
// `empty state links to review + rep session` previously called
// `test.skip(...)` whenever the seeded user had data; that branch never ran
// in CI because Abby's seed always fills it. The freshUser fixture sidesteps
// the coupling: each fixture user has zero confidence ratings, so the page
// renders the empty state deterministically and the CTAs are always
// asserted against.

baseTest.describe('calibration (shared seed)', () => {
	baseTest('loads with heading and one of the two valid layouts', async ({ page }) => {
		await page.goto(ROUTES.CALIBRATION);
		await expect(page.getByRole('heading', { name: 'Calibration', exact: true })).toBeVisible();

		// Either empty-state ("Not enough data yet") with CTAs to start a review,
		// or the populated layout with "By confidence level" and "By domain".
		const emptyHeading = page.getByRole('heading', { name: /not enough data/i });
		const bucketHeading = page.getByRole('heading', { name: /by confidence level/i });

		await expect(emptyHeading.or(bucketHeading).first()).toBeVisible();
	});
});

freshUserTest.describe('calibration (fresh user)', () => {
	freshUserTest('empty state links to review + rep session', async ({ page, freshUser }) => {
		// `freshUser` ensures login + zero confidence-rated reviews/SIRs, so the
		// calibration page deterministically renders the empty-state path.
		expect(freshUser.id).toBeDefined();
		await page.goto(ROUTES.CALIBRATION);
		await expect(page.getByRole('heading', { name: 'Calibration', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: /not enough data/i })).toBeVisible();
		await expect(page.getByRole('link', { name: /start a review/i })).toBeVisible();
		await expect(page.getByRole('link', { name: /start a rep session/i })).toBeVisible();
	});
});
