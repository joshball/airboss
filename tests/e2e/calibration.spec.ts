import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

test.describe('calibration', () => {
	test('loads with heading and one of the two valid layouts', async ({ page }) => {
		await page.goto(ROUTES.CALIBRATION);
		await expect(page.getByRole('heading', { name: 'Calibration', exact: true })).toBeVisible();

		// Either empty-state ("Not enough data yet") with CTAs to start a review,
		// or the populated layout with "By confidence level" and "By domain".
		const emptyHeading = page.getByRole('heading', { name: /not enough data/i });
		const bucketHeading = page.getByRole('heading', { name: /by confidence level/i });

		await expect(emptyHeading.or(bucketHeading).first()).toBeVisible();
	});

	test('empty state links to review + rep session', async ({ page }) => {
		await page.goto(ROUTES.CALIBRATION);
		const emptyHeading = page.getByRole('heading', { name: /not enough data/i });
		if (!(await emptyHeading.isVisible().catch(() => false))) {
			test.skip(true, 'learner already has calibration data -- empty-state CTAs not present');
		}
		await expect(page.getByRole('link', { name: /start a review/i })).toBeVisible();
		await expect(page.getByRole('link', { name: /start a rep session/i })).toBeVisible();
	});
});
