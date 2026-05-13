/**
 * E2e coverage for the N-deep course tree renderer + navigation
 * (course-tree-arbitrary-depth WP, Phase D).
 *
 * Two suites:
 *
 *  - 3-level fixture (`three-level-tree-fixture`): walks the nested
 *    outline + step reader landing + prev/next end-to-end. Mirrors
 *    test-plan.md T5.2 / T5.4 / T5.6 / T6.2.
 *  - weather-comprehensive regression: the 2-level course renders
 *    cleanly through the same renderer (no breakage for pre-WP
 *    content). Mirrors T5.1 / T6.1.
 *
 * The 3-level fixture is seeded by `tests/e2e/global.setup.ts` via
 * `seed-3-level-fixture.ts` -- the seed pipeline normally skips
 * `_fixtures/` so an explicit opt-in is needed for these specs.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';
import { THREE_LEVEL_FIXTURE_SLUG } from './seed-3-level-fixture';

test.describe('course tree -- 3-level fixture (Phase D)', () => {
	test('CT-1: course landing renders the nested outline (section -> lesson -> leaves)', async ({ page }) => {
		await page.goto(ROUTES.COURSE(THREE_LEVEL_FIXTURE_SLUG));

		// Section heading from the fixture (one section, ordinal 1).
		await expect(page.getByRole('heading', { name: /Frontal Scenarios/i, level: 2 })).toBeVisible();
		// Lesson heading (one lesson nested under the section).
		await expect(page.getByRole('heading', { name: /Scenario 1/i, level: 3 })).toBeVisible();
		// Both leaf step titles.
		await expect(page.getByText('Reading the surface analysis')).toBeVisible();
		await expect(page.getByText('Recognising airmass character')).toBeVisible();
	});

	test('CT-2: section URL renders a landing UI with child list', async ({ page }) => {
		// The fixture section is coded `s1`. The reader accepts non-leaf rows.
		await page.goto(ROUTES.COURSE_STEP(THREE_LEVEL_FIXTURE_SLUG, 's1'));
		// Page title is the section title.
		await expect(page.getByRole('heading', { name: /Frontal Scenarios/i, level: 1 })).toBeVisible();
		// Landing UI lists children; the lesson `s1.1` is the only child of `s1`.
		await expect(page.getByText('Scenario 1 - Cold-front passage')).toBeVisible();
	});

	test('CT-3: lesson URL renders a landing UI with leaf children', async ({ page }) => {
		await page.goto(ROUTES.COURSE_STEP(THREE_LEVEL_FIXTURE_SLUG, 's1.1'));
		// Page title is the lesson title.
		await expect(page.getByRole('heading', { name: /Scenario 1 - Cold-front passage/i, level: 1 })).toBeVisible();
		// Children list shows the two leaf substeps.
		await expect(page.getByText('Reading the surface analysis')).toBeVisible();
		await expect(page.getByText('Recognising airmass character')).toBeVisible();
		// Breadcrumb chain includes the parent section.
		await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText(/Frontal Scenarios/i);
	});

	test('CT-4: leaf URL renders the legacy step reader with breadcrumb + prev/next', async ({ page }) => {
		await page.goto(ROUTES.COURSE_STEP(THREE_LEVEL_FIXTURE_SLUG, 's1.1.1'));
		await expect(page.getByRole('heading', { name: /Reading the surface analysis/i, level: 1 })).toBeVisible();
		// Breadcrumb shows ancestor chain: Course -> Section -> Lesson.
		const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
		await expect(breadcrumb).toContainText(/Three-Level Tree Fixture/i);
		await expect(breadcrumb).toContainText(/Frontal Scenarios/i);
		await expect(breadcrumb).toContainText(/Scenario 1 - Cold-front passage/i);
		// Prev/next nav present at page bottom; "next" link points at the
		// second leaf in document order.
		const nav = page.getByRole('navigation', { name: 'Step navigation' });
		await expect(nav).toBeVisible();
		await expect(nav.getByRole('link', { name: /Next/i })).toContainText(/Recognising airmass character/i);
	});

	test('CT-5: prev/next walks every leaf in document order', async ({ page }) => {
		// Start at the first leaf.
		await page.goto(ROUTES.COURSE_STEP(THREE_LEVEL_FIXTURE_SLUG, 's1.1.1'));
		await expect(page.getByRole('heading', { name: /Reading the surface analysis/i, level: 1 })).toBeVisible();

		// First leaf: prev absent, next -> "Recognising airmass character".
		const nav = page.getByRole('navigation', { name: 'Step navigation' });
		await expect(nav.getByRole('link', { name: /Prev/i })).toHaveCount(0);
		await nav.getByRole('link', { name: /Next/i }).click();

		// Second (and last) leaf in fixture: next absent, prev links back.
		await expect(page.getByRole('heading', { name: /Recognising airmass character/i, level: 1 })).toBeVisible();
		await expect(nav.getByRole('link', { name: /Next/i })).toHaveCount(0);
		await expect(nav.getByRole('link', { name: /Prev/i })).toContainText(/Reading the surface analysis/i);
	});

	test('CT-6: next on a lesson landing enters the lesson first leaf', async ({ page }) => {
		await page.goto(ROUTES.COURSE_STEP(THREE_LEVEL_FIXTURE_SLUG, 's1.1'));
		const nav = page.getByRole('navigation', { name: 'Step navigation' });
		await nav.getByRole('link', { name: /Next/i }).click();
		await expect(page.getByRole('heading', { name: /Reading the surface analysis/i, level: 1 })).toBeVisible();
	});
});

test.describe('course tree -- weather-comprehensive regression', () => {
	// The seeded `weather-comprehensive` course is a 2-level tree (sections
	// with direct leaf steps, no lesson interiors). It must render through
	// the new recursive renderer with no breakage.
	const WEATHER_COMP_SLUG = 'weather-comprehensive';

	test('CT-7: landing page renders the section outline + leaves are clickable', async ({ page }) => {
		await page.goto(ROUTES.COURSE(WEATHER_COMP_SLUG));
		// The course renders at least one section heading at h2.
		const sectionHeadings = page.getByRole('heading', { level: 2 });
		await expect(sectionHeadings.first()).toBeVisible();
		// Click the first leaf link inside the first section card.
		const firstLeaf = page.locator('.leaf-link').first();
		await expect(firstLeaf).toBeVisible();
		const href = await firstLeaf.getAttribute('href');
		expect(href).toMatch(new RegExp(`^/courses/${WEATHER_COMP_SLUG}/`));
	});

	test('CT-8: a leaf step renders the legacy reader with breadcrumb + prev/next', async ({ page }) => {
		await page.goto(ROUTES.COURSE(WEATHER_COMP_SLUG));
		const firstLeaf = page.locator('.leaf-link').first();
		await firstLeaf.click();
		// Breadcrumb chain present and includes the course title.
		await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText(/Weather/i);
		// Prev/next nav is rendered (one direction may be absent at the
		// start of the course, but the nav element itself exists).
		await expect(page.getByRole('navigation', { name: 'Step navigation' })).toBeVisible();
	});
});
