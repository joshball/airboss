import { expect, test } from '@playwright/test';
import { DIFFICULTIES, DOMAINS, ROUTES } from '../../libs/constants/src';

function uniqueTitle(tag: string): string {
	const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
	return `[e2e ${tag}] ${stamp}`;
}

test.describe('reps', () => {
	test('dashboard renders', async ({ page }) => {
		await page.goto(ROUTES.REPS);
		await expect(page.getByRole('heading', { name: 'Decision Reps' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'New scenario' })).toBeVisible();
	});

	test('new scenario form renders required fields', async ({ page }) => {
		await page.goto(ROUTES.REPS_NEW);
		await expect(page.getByLabel('Title')).toBeVisible();
		await expect(page.locator('textarea[name="situation"]')).toBeVisible();
		await expect(page.locator('textarea[name="teachingPoint"]')).toBeVisible();
		await expect(page.locator('select[name="domain"]')).toBeVisible();
		await expect(page.locator('select[name="difficulty"]')).toBeVisible();
		// Default option count is 2 (SCENARIO_OPTIONS_MIN).
		await expect(page.locator('input[name="options[0][text]"]')).toBeVisible();
		await expect(page.locator('input[name="options[1][text]"]')).toBeVisible();
	});

	test('add/remove option buttons respect min/max', async ({ page }) => {
		await page.goto(ROUTES.REPS_NEW);
		// In Vite dev, Svelte's onclick handlers attach only after module graph
		// has streamed in; wait for network to settle so the first click isn't
		// lost to pre-hydration DOM.
		await page.waitForLoadState('networkidle');

		const optionArticles = page.locator('fieldset article');
		await expect(optionArticles).toHaveCount(2);

		await page.getByRole('button', { name: /add option/i }).click();
		await expect(optionArticles).toHaveCount(3);

		await page.getByRole('button', { name: /remove option 3/i }).click();
		await expect(optionArticles).toHaveCount(2);
	});

	test('creates a scenario and lands on browse', async ({ page }) => {
		const title = uniqueTitle('rep');
		await page.goto(ROUTES.REPS_NEW);
		// Wait for hydration -- bind:value on the domain/difficulty selects
		// can otherwise overwrite selectOption calls that race with it.
		await page.waitForLoadState('networkidle');

		await page.getByLabel('Title').fill(title);
		await page.locator('textarea[name="situation"]').fill(
			'You are climbing through 800 AGL after takeoff from a 5,000-ft runway when the engine runs rough and loses partial power.',
		);

		await page.locator('input[name="options[0][text]"]').fill('Land straight ahead.');
		await page.locator('textarea[name="options[0][outcome]"]').fill('Controlled off-airport landing; aircraft damaged but occupants safe.');
		// Option 0 is correct by default, so no whyNot needed there.

		await page.locator('input[name="options[1][text]"]').fill('Turn back to the runway.');
		await page.locator('textarea[name="options[1][outcome]"]').fill('Stall/spin accident likely.');
		await page.locator('textarea[name="options[1][whyNot]"]').fill('The impossible turn kills pilots at this altitude.');

		await page.locator('textarea[name="teachingPoint"]').fill(
			'Below roughly 1,000 AGL, commit to landing straight ahead -- the turn-back has a long history of killing pilots.',
		);
		await page.locator('select[name="domain"]').selectOption(DOMAINS.EMERGENCY_PROCEDURES);
		await page.locator('select[name="difficulty"]').selectOption(DIFFICULTIES.INTERMEDIATE);

		await page.getByRole('button', { name: /save scenario/i }).click();

		await expect(page).toHaveURL((url) => url.pathname === ROUTES.REPS_BROWSE, { timeout: 10_000 });
		await expect(page.getByText(title).first()).toBeVisible();
	});

	test('reps session route is reachable when scenarios exist', async ({ page }) => {
		await page.goto(ROUTES.REPS);
		const startLink = page.getByRole('link', { name: /start session/i });
		if (await startLink.isVisible().catch(() => false)) {
			await startLink.click();
			await expect(page).toHaveURL((url) => url.pathname === ROUTES.REPS_SESSION);
			// The session page renders either a rep card (h2 title) or a
			// "Session complete" heading; either is a valid smoke outcome.
			await expect(page.locator('h1, h2').first()).toBeVisible();
		} else {
			// Empty state path: the disabled-looking button is a real button.
			const btn = page.getByRole('button', { name: /start session/i });
			await expect(btn).toBeDisabled();
		}
	});
});
