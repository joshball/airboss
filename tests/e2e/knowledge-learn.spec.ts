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

		// Stepper button for Verify carries aria-current="step". Match by the
		// stepper's class (.steps) to scope to the stepper buttons, then by
		// .step-name text which is the phase's plain label.
		const verifyButton = page.locator('ol.steps button.step', { has: page.locator('.step-name', { hasText: 'Verify' }) });
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
		// Anchor on Context explicitly via `?step=context`. The default
		// (no-param) load falls back to `progress.lastPhase` for resume,
		// which prior tests in this suite have advanced past. The
		// replaceState behavior under test is independent of which phase
		// we start from.
		await page.goto(`${ROUTES.KNOWLEDGE_LEARN(NODE_SLUG)}?${QUERY_PARAMS.STEP}=${KNOWLEDGE_PHASES.CONTEXT}`);
		await expect(page.getByRole('heading', { name: /context/i, level: 2 })).toBeVisible();

		// Wait for hydration to complete before clicking. Server renders the
		// stepper buttons immediately, but Svelte 5's `onclick` handlers
		// (which call `selectPhase` -> updates `currentPhase` $state ->
		// triggers the URL-sync $effect) are wired up only after the client
		// bundle hydrates. Without this wait, Playwright's `.click()` can
		// dispatch the event before the handler is attached and the click
		// silently no-ops -- the button receives focus, no state changes,
		// the URL stays at `?step=context`, and the test fails on the URL
		// expect. `networkidle` is the simplest signal that the SvelteKit
		// runtime has finished its initial fetch/parse cycle and the
		// component is interactive.
		await page.waitForLoadState('networkidle');

		// Navigate to Reveal; URL should reflect the named slug. Match by the
		// `.step-name` span text inside the stepper button to isolate the
		// click target from any "reveal" content inside the phase body.
		const revealButton = page.locator('ol.steps button.step', { has: page.locator('.step-name', { hasText: 'Reveal' }) });
		await revealButton.click();
		await expect(page).toHaveURL(new RegExp(`${QUERY_PARAMS.STEP}=${KNOWLEDGE_PHASES.REVEAL}`));
		await expect(page.getByRole('heading', { name: /reveal/i, level: 2 })).toBeVisible();
	});
});
