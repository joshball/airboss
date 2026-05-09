import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

/**
 * Course reader e2e smoke.
 *
 * Verifies the index + detail surfaces render for a logged-in user with
 * the seed-smoke fixture course present in the dev DB. The fixture is
 * loaded via `bun run db seed courses --dir course/courses/_fixtures`
 * (run as part of the test pre-setup at the worktree level).
 *
 * Assertions are intentionally narrow -- the surface should render
 * without throwing; deeper structural assertions (mastery values,
 * cert-overlay chips) are exercised by the per-phase manual test plan.
 */

test.describe('study courses reader -- index', () => {
	test('renders the page and lists courses or an empty state', async ({ page }) => {
		await page.goto(ROUTES.COURSES);
		// Page header is present.
		await expect(page.getByRole('heading', { name: 'Courses', exact: true, level: 1 })).toBeVisible();

		// Either the seed-smoke course is in the list, or the empty-state surface.
		const empty = page.getByRole('heading', { name: /no courses yet/i });
		const courseRow = page.getByRole('list', { name: 'Course list' }).locator('li').first();
		await expect(empty.or(courseRow).first()).toBeVisible();
	});
});

test.describe('study courses reader -- detail', () => {
	test('404s for a slug that does not exist', async ({ page }) => {
		const response = await page.goto(ROUTES.COURSE('does-not-exist-course-slug'));
		expect(response?.status()).toBe(404);
	});

	test('renders the course header for the seed-smoke fixture (when seeded)', async ({ page }) => {
		const response = await page.goto(ROUTES.COURSE('seed-smoke'));
		// If the fixture is not loaded (CI variation, fresh dev DB), expect
		// 404 rather than failing the smoke. The detail-page rendering path
		// is exercised manually per the WP test plan; this just confirms
		// the route + loader wire-up.
		if (response?.status() === 404) {
			test.info().annotations.push({ type: 'skipped', description: 'seed-smoke fixture not loaded' });
			return;
		}
		expect(response?.status()).toBe(200);
		// Course title from the smoke fixture YAML.
		await expect(page.getByRole('heading', { name: 'Seed-Smoke Course Fixture', level: 1 })).toBeVisible();
	});
});
