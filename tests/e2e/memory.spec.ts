import { expect, test } from '@playwright/test';
import { CARD_TYPES, DOMAINS, ROUTES } from '../../libs/constants/src';

/**
 * Generates a unique card front per test so parallel workers don't collide
 * on the dev DB. Keep the tag short -- front is displayed in many lists.
 */
function uniqueFront(tag: string): string {
	const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
	return `[e2e ${tag}] ${stamp}`;
}

test.describe('memory', () => {
	test('dashboard renders tiles and quick actions', async ({ page }) => {
		await page.goto(ROUTES.MEMORY);
		await expect(page.getByRole('heading', { name: 'Memory', exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: 'New card', exact: true })).toBeVisible();
		// `exact: true` to skip the StatTile aria-label "Reviewed today: 0, browse active cards"
		// which also matches the loose `name: 'Browse'`.
		await expect(page.getByRole('link', { name: 'Browse', exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Start review', exact: true })).toBeVisible();
	});

	test('creates a card via /memory/new and lands on detail', async ({ page }) => {
		const front = uniqueFront('create');
		const back = 'Back text for e2e-created card.';

		await page.goto(ROUTES.MEMORY_NEW);
		await expect(page.getByRole('heading', { name: 'New card' })).toBeVisible();
		// The page's on-mount effect auto-focuses Front. Wait for that to settle
		// before typing so the fill doesn't race the focus flush.
		await expect(page.getByLabel('Front (question)')).toBeFocused();

		await page.getByLabel('Front (question)').fill(front);
		await page.getByLabel('Back (answer)').fill(back);
		await page.locator('select[name="domain"]').selectOption(DOMAINS.REGULATIONS);
		// cardType has no true default selection in the DOM; select explicitly.
		await page.locator('select[name="cardType"]').selectOption(CARD_TYPES.BASIC);
		await page.getByRole('button', { name: /^save$/i }).click();

		await expect(page).toHaveURL(/\/memory\/crd_[a-z0-9]+/i, { timeout: 10_000 });
		await expect(page.getByRole('heading', { name: 'Card detail' })).toBeVisible();
		await expect(page.getByText(front, { exact: true })).toBeVisible();
		await expect(page.getByText(back, { exact: true })).toBeVisible();
	});

	test('validation blocks empty submit', async ({ page }) => {
		await page.goto(ROUTES.MEMORY_NEW);
		// Browser-native required validation keeps us on the same page.
		await page.getByRole('button', { name: /^save$/i }).click();
		await expect(page).toHaveURL((url) => url.pathname === ROUTES.MEMORY_NEW);
	});

	test('created card is findable in /memory/browse', async ({ page }) => {
		const front = uniqueFront('browse');

		await page.goto(ROUTES.MEMORY_NEW);
		await expect(page.getByLabel('Front (question)')).toBeFocused();
		await page.getByLabel('Front (question)').fill(front);
		await page.getByLabel('Back (answer)').fill('for browse test');
		await page.locator('select[name="domain"]').selectOption(DOMAINS.WEATHER);
		await page.locator('select[name="cardType"]').selectOption(CARD_TYPES.BASIC);
		await page.getByRole('button', { name: /^save$/i }).click();

		await expect(page).toHaveURL(/\/memory\/crd_[a-z0-9]+/i, { timeout: 10_000 });

		await page.goto(ROUTES.MEMORY_BROWSE);
		await expect(page.getByRole('heading', { name: 'Browse' })).toBeVisible();

		// Narrow via the search input so we don't rely on pagination order.
		const search = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i)).first();
		if (await search.isVisible().catch(() => false)) {
			await search.fill(front);
			await page.keyboard.press('Enter');
		}
		await expect(page.getByText(front).first()).toBeVisible();
	});

	test('review route loads (may be empty or show a due card)', async ({ page }) => {
		await page.goto(ROUTES.MEMORY_REVIEW);
		// Valid states: "All caught up." (no cards due), "Show answer" button (phase=front), or a rating button (phase=answer).
		// Scope away the InfoTip trigger ("Learn more about Show answer") which also matches /show answer/i.
		const caughtUp = page.getByRole('heading', { name: /all caught up/i });
		const showAnswer = page.locator('button:not([data-testid="infotip-trigger"])').filter({ hasText: /show answer/i }).first();
		const ratingBtn = page.locator('button[data-rating]').first();
		await expect(caughtUp.or(showAnswer).or(ratingBtn)).toBeVisible();
	});
});
