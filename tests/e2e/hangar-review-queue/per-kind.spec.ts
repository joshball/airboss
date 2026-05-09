/**
 * `/review/[kind]/[itemId]` per-kind dispatcher e2e -- covers test-plan
 * sections 7 (wp_spec tabs), 10 (reference_toc spot-check), 11
 * (knowledge_node single-decision view), and 12.4 (ad_hoc dispatcher 303s
 * to the task editor).
 *
 * The dispatcher route resolves the item by id and either renders the
 * per-kind view (`wp_spec`, `reference_toc`, `knowledge_node`) or 303s
 * elsewhere (`ad_hoc` -> `/review/tasks/[ref]/edit`). Each describe block
 * locates a sample item via the board's free-text search or kind-filter
 * dropdown so we don't deep-link by item id (which the loader regenerates
 * per dev container).
 *
 * Frontmatter-mutating actions (`?/markRead`, `?/flipReviewStatus`,
 * `?/markDone`) are NOT clicked: those write to repo files and would
 * dirty the working tree across runs. The unit suites
 * (`spec-actions.test.ts`, `walker-actions.test.ts`,
 * `toc-actions.test.ts`) cover the action-level behaviour. Here we just
 * confirm the per-kind view renders + the dispatcher routes are wired.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../../libs/constants/src';

test.describe('wp_spec view: tabs + frontmatter', () => {
	test('clicking a wp_spec card from the board lands on the spec view with tabs', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW);
		// Filter to the hangar-review-queue work package so we click a
		// deterministic card. Search by ref substring rather than title text.
		await page.getByRole('searchbox', { name: /search title or ref/i }).fill('hangar-review-queue');
		// Cards link out via `/review/items/[itemId]`; pick the first link
		// that carries `/review/items/` and matches the WP slug.
		const itemLink = page.locator(`a[href*="/review/items/"]`).first();
		await expect(itemLink).toBeVisible();
		await itemLink.click();
		// Server redirects items/<id> -> [kind]/<id>; the URL settles on the
		// kind-specific route.
		await page.waitForURL(/\/review\/(wp_spec|wp_test_plan|knowledge_node|reference_toc|ad_hoc)\//);
		// Tab list renders for wp_spec view.
		await expect(page.getByRole('tablist').first()).toBeVisible();
	});

	test('tabs surface for the hangar-review-queue spec and switching tabs updates the URL', async ({ page }) => {
		// Resolve the wp_spec URL via the dispatcher -- a deep-link by item
		// ref is not exposed, so we walk: board -> filter -> click first card.
		await page.goto(ROUTES.HANGAR_REVIEW);
		await page.getByRole('searchbox', { name: /search title or ref/i }).fill('hangar-review-queue');
		const itemLink = page.locator(`a[href*="/review/items/"]`).first();
		await Promise.all([page.waitForURL(/\/review\/wp_spec\//), itemLink.click()]);

		// Tab list contains: spec, tasks, test-plan, design, user-stories,
		// review (or "Notes" depending on file presence). Hangar-review-queue
		// has all five so each label renders.
		const tablist = page.getByRole('tablist').first();
		await expect(tablist).toBeVisible();
		const tasksTab = tablist.getByRole('tab', { name: /^Tasks$/ });
		await tasksTab.click();
		// URL persists `?tab=tasks` (spec tab is the default and gets stripped).
		await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe('tasks');

		// Switching to the test-plan tab reveals the table of test scenarios
		// authored in test-plan.md.
		await tablist.getByRole('tab', { name: /^Test Plan$/ }).click();
		await expect(page.locator('article').first()).toBeVisible();
		await expect(page.locator('article').first().getByText(/Hangar Review Queue/i).first()).toBeVisible();
	});

	test('walker-link card surfaces and points at the test-plan walker route', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW);
		await page.getByRole('searchbox', { name: /search title or ref/i }).fill('hangar-review-queue');
		const itemLink = page.locator(`a[href*="/review/items/"]`).first();
		await Promise.all([page.waitForURL(/\/review\/wp_spec\//), itemLink.click()]);
		// Sidebar holds an Actions card with a walker link. The href ends in
		// `/walker`; the link copy reads "Open" or "Resume" depending on
		// session state.
		const walkerLink = page.locator(`a[href$="/walker"]`).first();
		await expect(walkerLink).toBeVisible();
	});
});

test.describe('reference_toc view: TOC + outcome controls', () => {
	test('opening a reference_toc item renders Pass/Fail/Blocked outcome controls', async ({ page }) => {
		// The seeded "References -- missing TOC review" bucket is fed by
		// `hangar.reference` rows. Use the kind-filter dropdown to land on a
		// reference_toc card regardless of which references the loader
		// surfaced. The select carries an `option[value="reference_toc"]`
		// because the kind id is the value the BC writes.
		await page.goto(ROUTES.HANGAR_REVIEW);
		// Wait for hydration so the kind-filter `<select>` is bound to the
		// `kindFilter` rune; otherwise the change event fires before the
		// $effect that narrows visible cards runs, and the next `.first()`
		// pick lands on the wrong kind.
		await page.waitForLoadState('networkidle');
		await page
			.locator('select')
			.filter({ has: page.locator('option[value="reference_toc"]') })
			.first()
			.selectOption('reference_toc');
		// Scope the candidate to a card that's actually a reference_toc, not
		// just the first item link rendered (which may be a stale DOM node
		// from before the client-side filter narrowed the list).
		const candidate = page.locator(`article a[href*="/review/items/"]`).first();
		const candidateCount = await candidate.count();
		test.skip(candidateCount === 0, 'No reference_toc items in the seeded review_item set');
		await Promise.all([page.waitForURL(/\/review\/reference_toc\//), candidate.click()]);

		// The reference_toc view renders the reference title as the H1 and
		// surfaces Pass/Fail/Blocked outcome controls per TOC entry.
		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
		const outcomeButtons = page.getByRole('button', { name: /^(Pass|Fail|Blocked)$/ });
		expect(await outcomeButtons.count()).toBeGreaterThan(0);
	});
});

test.describe('knowledge_node view: discovery review', () => {
	test('opening a knowledge_node item renders the node body and review actions', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_REVIEW);
		await page
			.locator('select')
			.filter({ has: page.locator('option[value="knowledge_node"]') })
			.first()
			.selectOption('knowledge_node');
		const candidate = page.locator(`a[href*="/review/items/"]`).first();
		const candidateCount = await candidate.count();
		test.skip(candidateCount === 0, 'No knowledge_node items in the seeded review_item set');
		await Promise.all([page.waitForURL(/\/review\/knowledge_node\//), candidate.click()]);

		// The knowledge_node view renders the node markdown via
		// `MarkdownArticle` and surfaces a single-decision "Mark reviewed"
		// action. We don't click it (it writes frontmatter) -- just confirm
		// the surface renders.
		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
		const markBtn = page.getByRole('button', { name: /mark reviewed/i });
		await expect(markBtn.first()).toBeVisible();
	});
});

test.describe('ad_hoc dispatcher: 303 to task editor', () => {
	test('clicking an ad_hoc item card 303s straight to the task edit form', async ({ page }, testInfo) => {
		// Seed an ad-hoc task so the test is deterministic regardless of
		// loader state. Create -> the redirect lands the user on the board
		// with the new card; we re-click it from the board to exercise the
		// items-dispatcher -> ad_hoc redirect path.
		const title = `e2e dispatcher ${testInfo.testId.slice(0, 8)}`;
		await page.goto(ROUTES.HANGAR_REVIEW_TASK_NEW);
		await page.waitForLoadState('networkidle');
		await page.locator('input[name="title"]').fill(title);
		await page.locator('select[name="type"]').selectOption({ index: 1 });
		await page.locator('select[name="productArea"]').selectOption({ index: 1 });
		await Promise.all([
			page.waitForURL(new RegExp(`${ROUTES.HANGAR_REVIEW.replace('/', '\\/')}\\?`)),
			page.getByRole('button', { name: /create task/i }).click(),
		]);
		// Now the board shows the card. Click it -- the items dispatcher
		// resolves the ad_hoc kind and 303s to /review/tasks/<ref>/edit.
		const card = page.getByRole('article').filter({ hasText: title }).first();
		await Promise.all([page.waitForURL(/\/review\/tasks\/.+\/edit$/), card.getByRole('link').first().click()]);
		// Edit form prefills the saved title, confirming we're on the right
		// surface.
		await expect(page.locator('input[name="title"]')).toHaveValue(title);

		// Tail-clean: delete the task so subsequent runs don't accumulate
		// rows. The board's task list is purely DB-driven, so a stale e2e
		// row would otherwise bleed into other specs.
		await page.getByRole('button', { name: /^Delete task$/ }).click();
		await Promise.all([
			page.waitForURL(new RegExp(`${ROUTES.HANGAR_REVIEW.replace('/', '\\/')}(\\?|$)`)),
			page.getByRole('button', { name: /confirm delete/i }).click(),
		]);
	});
});
