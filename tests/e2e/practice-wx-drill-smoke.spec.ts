/**
 * E2E smoke for `/practice/wx/drill`.
 *
 * Walks the full token-walk loop on the smallest possible session: pick
 * METAR as the only product, 5-item count, tier 3, click Start drill,
 * answer the first prompt with the right value, expect a rationale,
 * advance, eventually finish the session, expect the summary screen.
 *
 * The session uses the existing dev-seed user (Abby). The drill route
 * pulls from the live catalog + scenarios so no extra seed is needed.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

test.describe('/practice/wx/drill', () => {
	test('runs a 5-item session and shows the summary', async ({ page }) => {
		await page.goto(ROUTES.PRACTICE_WX_DRILL);
		await expect(page.getByRole('heading', { name: 'Weather drill' })).toBeVisible();

		// Setup: METAR product is selected by default; pick 5-item count.
		// The chip is SSR-present and clickable before Svelte attaches its
		// `onclick`, so a single click can land pre-hydration and no-op.
		// Retry click + assert until the selection sticks.
		const itemCount5 = page.getByTestId('item-count-5');
		await expect(async () => {
			await itemCount5.click();
			await expect(itemCount5).toHaveClass(/on/, { timeout: 1_000 });
		}).toPass({ timeout: 10_000 });

		// Start the drill.
		await page.getByTestId('start-drill').click();
		await expect(page.getByTestId('drill-session')).toBeVisible();

		// Walk through up to 10 prompts; either quiz or visible-card mode.
		// Use a generic, accept-anything answer ("decode"); the grader will
		// mark some right, some wrong -- the test cares about flow, not accuracy.
		for (let step = 0; step < 10; step += 1) {
			const visibleNext = page.getByTestId('visible-next');
			const answerInput = page.getByTestId('answer-input');
			const summary = page.getByTestId('drill-summary');

			// Advancing a prompt triggers a state transition: the next prompt,
			// the next visible card, or the summary mounts. Wait for the page
			// to settle into exactly one of those before branching -- a bare
			// `isVisible()` snapshot races the transition and can miss the
			// summary on the final step.
			await expect(summary.or(answerInput).or(visibleNext).first()).toBeVisible({ timeout: 10_000 });

			if (await summary.isVisible().catch(() => false)) break;

			if (await visibleNext.isVisible().catch(() => false)) {
				await visibleNext.click();
				continue;
			}

			await answerInput.fill('decode');
			await page.getByTestId('submit-answer').click();

			// Rationale appears, then click next.
			await expect(page.getByTestId('rationale')).toBeVisible({ timeout: 5_000 });
			await page.getByTestId('rationale-next').click();
		}

		await expect(page.getByTestId('drill-summary')).toBeVisible({ timeout: 10_000 });
		// Drill-again button is the recovery path; ensure it's wired.
		await expect(page.getByTestId('drill-again')).toBeVisible();
	});
});
