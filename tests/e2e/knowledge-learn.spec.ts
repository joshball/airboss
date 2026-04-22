import { expect, test } from '@playwright/test';
import { KNOWLEDGE_PHASES, QUERY_PARAMS, ROUTES } from '../../libs/constants/src';

/**
 * URL deep-linking for the guided-learn stepper. A learner who bookmarks or
 * shares a `?step=verify` URL must land on the Verify phase directly, and the
 * URL must persist across a hard reload.
 *
 * Uses the seeded KG node `proc-engine-failure-after-takeoff`, which is the
 * canonical fully-authored 7-phase example in the knowledge-seed dataset.
 */
const NODE_SLUG = 'proc-engine-failure-after-takeoff';

test.describe('knowledge learn stepper deep-linking', () => {
	test('?step=verify opens the Verify phase directly', async ({ page }) => {
		const url = `${ROUTES.KNOWLEDGE_LEARN(NODE_SLUG)}?${QUERY_PARAMS.STEP}=${KNOWLEDGE_PHASES.VERIFY}`;
		const res = await page.goto(url);
		expect(res?.status()).toBeLessThan(400);

		// Phase heading reflects the deep-linked step.
		await expect(page.getByRole('heading', { name: /verify/i, level: 2 })).toBeVisible();

		// Stepper button for Verify carries aria-current="step".
		const verifyButton = page.getByRole('button', { name: /verify/i });
		await expect(verifyButton).toHaveAttribute('aria-current', 'step');
	});

	test('URL persists across a hard reload', async ({ page }) => {
		const url = `${ROUTES.KNOWLEDGE_LEARN(NODE_SLUG)}?${QUERY_PARAMS.STEP}=${KNOWLEDGE_PHASES.DISCOVER}`;
		await page.goto(url);
		await expect(page.getByRole('heading', { name: /discover/i, level: 2 })).toBeVisible();
		await page.reload();
		await expect(page).toHaveURL(new RegExp(`${QUERY_PARAMS.STEP}=${KNOWLEDGE_PHASES.DISCOVER}`));
		await expect(page.getByRole('heading', { name: /discover/i, level: 2 })).toBeVisible();
	});

	test('clicking a phase button updates the URL via replaceState', async ({ page }) => {
		await page.goto(ROUTES.KNOWLEDGE_LEARN(NODE_SLUG));
		// Default lands on Context (first phase in KNOWLEDGE_PHASE_ORDER).
		await expect(page.getByRole('heading', { name: /context/i, level: 2 })).toBeVisible();

		// Navigate to Reveal; URL should reflect the named slug.
		await page.getByRole('button', { name: /reveal/i }).click();
		await expect(page).toHaveURL(new RegExp(`${QUERY_PARAMS.STEP}=${KNOWLEDGE_PHASES.REVEAL}`));
		await expect(page.getByRole('heading', { name: /reveal/i, level: 2 })).toBeVisible();
	});
});
