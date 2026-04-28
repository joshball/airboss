/**
 * E2E for the handbook amendment badge + diff panel (R6 of the
 * apply-errata-and-afh-mosaic work package).
 *
 * Drives a learner to a section that has applied errata, asserts the
 * "Amended" badge surfaces, clicks it open, and confirms the panel
 * contains the FAA source URL substring for the AFH MOSAIC addendum.
 *
 * The supporting `study.handbook_section_errata` rows are inserted by
 * `tests/e2e/seed-errata.ts` from `tests/e2e/global.setup.ts` before the
 * authenticated specs run. See R6.12a of the work package for the
 * fixture contract.
 */

import { expect, test } from '@playwright/test';
import { HANDBOOK_AMENDMENT_BADGE_LABEL, ROUTES } from '../../libs/constants/src';

const AFH_DOC = 'afh';
// AFH MOSAIC patches §02-02 (Preflight Assessment of the Aircraft) per the
// fixture markdown at handbooks/afh/FAA-H-8083-3C/02/02-preflight-assessment-of-the-aircraft.errata.md.
const AFH_CHAPTER = '2';
const AFH_SECTION = '2';
const AFH_MOSAIC_URL_FRAGMENT = 'AFH_Addendum_(MOSAIC).pdf';

test.describe('handbook amendment: badge + diff panel', () => {
	test('badge surfaces, click expands panel, FAA source URL visible', async ({ page }) => {
		await page.goto(ROUTES.HANDBOOK_SECTION(AFH_DOC, AFH_CHAPTER, AFH_SECTION));

		// Badge sits inside the page header, near the section title.
		const badge = page.getByTestId('amendment-panel-badge');
		await expect(badge).toBeVisible();
		await expect(badge).toContainText(HANDBOOK_AMENDMENT_BADGE_LABEL);
		await expect(badge).toHaveAttribute('aria-expanded', 'false');

		// Panel body is hidden by default.
		await expect(page.getByTestId('amendment-panel-body')).toHaveCount(0);

		// Click expands. Retry the click + visibility assertion as a unit so
		// a pre-hydration click doesn't leave the spec waiting on a body
		// that will never render. Once Svelte's runtime is bound, the toggle
		// fires on the first try; the retry is purely a hydration guard.
		const body = page.getByTestId('amendment-panel-body');
		await expect(async () => {
			await badge.click();
			await expect(body).toBeVisible({ timeout: 1_000 });
		}).toPass({ timeout: 5_000 });
		await expect(badge).toHaveAttribute('aria-expanded', 'true');

		// FAA source link to the MOSAIC PDF lives inside an ErrataEntry row.
		const sourceLink = body.locator(`a[href*="${AFH_MOSAIC_URL_FRAGMENT}"]`).first();
		await expect(sourceLink).toBeVisible();
		await expect(sourceLink).toHaveAttribute('target', '_blank');

		// At least one ErrataEntry article rendered.
		await expect(body.locator('article.errata-entry')).toHaveCount(1, { timeout: 5_000 });

		// Toggle closed. Hydration is settled by now (the open click
		// already fired against a hydrated runtime), so a single click
		// is enough.
		await badge.click();
		await expect(page.getByTestId('amendment-panel-body')).toHaveCount(0);
		await expect(badge).toHaveAttribute('aria-expanded', 'false');
	});

	test('sections without applied errata render no badge', async ({ page }) => {
		// Pick a PHAK section that's not on the MOSAIC patch list.
		await page.goto(ROUTES.HANDBOOK_SECTION('phak', '12', '9'));
		await expect(page.getByTestId('amendment-panel')).toHaveCount(0);
		await expect(page.getByTestId('amendment-panel-badge')).toHaveCount(0);
	});
});
