/**
 * IA goal-to-session focused flow (study-app-ia-cleanup Phase 2).
 *
 * Abby has a seeded primary goal + active plan, so the goal-detail CTA
 * reads "Start studying" and lands on the session entry. The seed user
 * email is captured by the global setup; this spec runs against her
 * `tests/e2e/.auth/learner.json` storage state by default.
 *
 * Failure modes the test guards against:
 *
 * - The CTA testid changes (`goal-detail-start-cta`) without a matching
 *   spec update. Playwright's `getByTestId` makes that loud.
 * - The "Start studying" / "Build my plan" branch flips because the loader
 *   forgot to read `data.activePlan`.
 * - The session entry redirect lands somewhere unexpected.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

test.describe('IA flow -- goal detail to session', () => {
	test('Start studying CTA on goal detail reaches the session entry', async ({ page }) => {
		// Land on the consolidated /program surface; the loader redirects to
		// Abby's primary goal detail (default tab when a goal exists).
		await page.goto(ROUTES.PROGRAM);
		await expect(page).toHaveURL(/\/program\/goals\/[^/]+/);

		// CTA reads "Start studying" because Abby has an active plan. The
		// test asserts the visible text + the testid so a future copy
		// rewrite still surfaces here.
		const cta = page.getByTestId('goal-detail-start-cta');
		await expect(cta).toBeVisible();
		await expect(cta).toContainText(/start studying/i);

		// Click lands on the session entry. The exact URL depends on the
		// engine's session-routing pipeline (legacy `/session/start` vs.
		// review-session redirect); accept either path family.
		await cta.getByRole('link').click();
		await page.waitForURL((url) => /\/session(?:\/|$)|\/sessions(?:\/|$)|\/memory\/review/.test(url.pathname));
		await expect(page.getByTestId('page-anchor')).toBeVisible();
	});
});
