/**
 * /docs browser e2e -- covers test-plan sections 1 (baseline rendering)
 * and 2 (full-text search). The setup spec (`hangar/global.setup.ts`)
 * already populates the FTS index via the admin loader, so these tests
 * see a non-empty index from the first nav.
 *
 * The DocsSearchBox uses an ARIA combobox + listbox pattern (input has
 * role="combobox", popover hits have role="option"); selectors target
 * those roles so a markup tweak that preserves accessibility doesn't
 * break the suite.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../../libs/constants/src';

const ADR_011_PATH = 'docs/decisions/011-knowledge-graph-learning-system/decision.md';
const CLAUDE_PATH = 'CLAUDE.md';
const PIVOT_PATH = 'docs/platform/PIVOT.md';

test.describe('docs browser: baseline rendering', () => {
	test('two-pane layout, file tree + content render at /docs', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_DOCS);
		await expect(page.getByRole('heading', { level: 1, name: /^Docs$/ })).toBeVisible();
		// File tree rail and DocsSearchBox topbar both render.
		await expect(page.getByRole('complementary', { name: /docs file tree/i })).toBeVisible();
		await expect(page.getByRole('combobox', { name: /search docs/i })).toBeVisible();
	});

	test('clicking a deep-linked path renders the file with breadcrumbs + frontmatter rail', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_DOCS_PATH(ADR_011_PATH));
		// Article body renders -- the markdown article element carries the
		// authored title as its aria-label.
		const article = page.locator('article').first();
		await expect(article).toBeVisible();
		const articleText = (await article.innerText()).trim();
		expect(articleText.length).toBeGreaterThan(500);
		// Breadcrumb nav surfaces the Docs root link. Scope to the breadcrumbs
		// landmark -- the banner also exposes a `Docs` link, and we only care
		// here that the breadcrumb is rendered for this deep-linked file.
		await expect(page.getByTestId('breadcrumbs-root').getByRole('link', { name: /^Docs$/ })).toBeVisible();
		// Frontmatter rail renders with at least one of the curated keys.
		const rail = page.getByRole('complementary', { name: /frontmatter/i });
		// ADR 011 has a `status` line in its frontmatter; the rail surfaces it.
		await expect(rail).toBeVisible();
		await expect(rail.getByText(/status/i).first()).toBeVisible();
	});
});

test.describe('docs browser: full-text search', () => {
	test('typing a multi-word phrase surfaces hits with snippets', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_DOCS);
		await page.waitForLoadState('networkidle');
		const search = page.getByRole('combobox', { name: /search docs/i });
		await search.click();
		await search.fill('discovery-first pedagogy');
		// Listbox opens once a request returns. Wait on the popover by id.
		const listbox = page.locator('#docs-search-results');
		await expect(listbox).toBeVisible({ timeout: 10_000 });
		const options = listbox.getByRole('option');
		await expect(options.first()).toBeVisible();
		// Expect at least the ADR 011 path to surface for this exact phrase.
		const optionTexts = await options.allInnerTexts();
		const joined = optionTexts.join('\n');
		expect(joined).toMatch(/decisions\/011/i);
	});

	test('a query with no matches shows the empty state inside the popover', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_DOCS);
		// Wait for hydration so `oninput` is bound; otherwise `fill` triggers
		// the input event before the Svelte handler attaches and `open`
		// never flips true.
		await page.waitForLoadState('networkidle');
		const search = page.getByRole('combobox', { name: /search docs/i });
		await search.click();
		await search.fill('zzqxzzqxzzqx');
		const listbox = page.locator('#docs-search-results');
		await expect(listbox).toBeVisible({ timeout: 10_000 });
		await expect(listbox.getByText(/no matches/i)).toBeVisible();
	});

	test('clicking a search hit navigates to its doc and the search clears', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_DOCS);
		await page.waitForLoadState('networkidle');
		const search = page.getByRole('combobox', { name: /search docs/i });
		await search.click();
		await search.fill('PIVOT');
		const listbox = page.locator('#docs-search-results');
		await expect(listbox).toBeVisible({ timeout: 10_000 });
		// Click the option whose href matches PIVOT.md (multiple hits land for
		// the literal string; pick the canonical doc by anchor href).
		const pivotLink = listbox.getByRole('link', { name: new RegExp(PIVOT_PATH, 'i') }).first();
		await Promise.all([page.waitForURL(`**${ROUTES.HANGAR_DOCS_PATH(PIVOT_PATH)}`), pivotLink.click()]);
		// The docs path renderer drops a docs-page wrapper around the article.
		await expect(page.locator('article').first()).toBeVisible();
		// Returning to /docs after navigation closes the popover.
		await page.goto(ROUTES.HANGAR_DOCS);
		await expect(page.locator('#docs-search-results')).not.toBeVisible();
	});

	test('CLAUDE.md is reachable as a top-level repo doc', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_DOCS_PATH(CLAUDE_PATH));
		// CLAUDE.md is large + carries a top-level H1 with the project name.
		await expect(page.locator('article').first()).toBeVisible();
		const text = (await page.locator('article').first().innerText()).trim();
		expect(text.length).toBeGreaterThan(2_000);
	});
});
