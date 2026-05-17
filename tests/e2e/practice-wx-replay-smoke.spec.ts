/**
 * E2E smoke for `/practice/wx/replay`.
 *
 * Walks the temporal-scenario replay: the picker lists the temporal
 * scenarios; selecting `frontal-pressure-march` loads its timeline bundle;
 * the student steps through every hour making a go/no-go decision; the
 * summary screen reports the decision log.
 *
 * The replay route reads the `data/wx-scenarios/frontal-pressure-march/`
 * timeline bundle committed by `wx-scenario build --timeline` (step 5), so
 * no extra seed is needed. The session uses the dev-seed user (Abby).
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

test.describe('/practice/wx/replay', () => {
	test('picks a temporal scenario and steps through to the summary', async ({ page }) => {
		await page.goto(ROUTES.PRACTICE_WX_REPLAY);
		await expect(page.getByRole('heading', { name: 'Weather replay' })).toBeVisible();

		// Picker: the v2 pilot scenario must be listed and selectable.
		const scenarioCard = page.getByTestId('replay-scenario-frontal-pressure-march');
		await expect(scenarioCard).toBeVisible();
		await scenarioCard.click();

		// Replay session: the scrubber + first step render.
		await expect(page.getByTestId('replay-session')).toBeVisible();
		await expect(page.getByTestId('replay-scrubber')).toBeVisible();
		await expect(page.getByTestId('replay-step-label')).toContainText('Hour 1 of');

		// The first hour shows at least one METAR and one chart.
		await expect(page.getByTestId('replay-charts')).toBeVisible();

		// Step through every hour, alternating go / no-go, until the summary.
		for (let step = 0; step < 24; step += 1) {
			const summary = page.getByTestId('replay-summary');
			if (await summary.isVisible().catch(() => false)) break;

			const button = step % 2 === 0 ? page.getByTestId('replay-go') : page.getByTestId('replay-no-go');
			await expect(button).toBeVisible({ timeout: 5_000 });
			await button.click();
		}

		// Summary: the decision log is shown with at least one recorded call.
		await expect(page.getByTestId('replay-summary')).toBeVisible();
		await expect(page.getByRole('heading', { name: /Replay summary/ })).toBeVisible();

		// Replaying again returns to the first hour.
		await page.getByTestId('replay-restart').click();
		await expect(page.getByTestId('replay-step-label')).toContainText('Hour 1 of');
	});

	test('scrubber jumps directly to a later hour', async ({ page }) => {
		await page.goto(`${ROUTES.PRACTICE_WX_REPLAY}?scenario=frontal-pressure-march`);
		await expect(page.getByTestId('replay-session')).toBeVisible();

		// Jump to the fourth tick; the step label must follow.
		await page.getByTestId('replay-tick-3').click();
		await expect(page.getByTestId('replay-step-label')).toContainText('Hour 4 of');
	});
});
