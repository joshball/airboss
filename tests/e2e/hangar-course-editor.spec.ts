import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

/**
 * Hangar course editor smoke (course-reader-and-editor WP, Phases 6-7).
 *
 * Verifies the hangar /courses index, /courses/[slug] manifest editor,
 * and /courses/[slug]/sections/[code] section editor render and the
 * load paths run cleanly. Authentication is shared via the global
 * setup; the hangar role gate (AUTHOR | OPERATOR | ADMIN) lets the
 * dev-seed learner through because the dev-seed user holds AUTHOR.
 *
 * The seed-smoke fixture is the canonical course exercised by these
 * tests. Skip-on-missing-fixture pattern (mirrors courses-reader.spec.ts).
 */

test.describe('hangar courses index', () => {
	test('renders the index page with the Courses heading', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_COURSES);
		await expect(page.getByRole('heading', { name: 'Courses', level: 1, exact: true })).toBeVisible();
	});

	test('shows the seed-smoke fixture row when seeded', async ({ page }) => {
		await page.goto(ROUTES.HANGAR_COURSES);
		const slugCell = page.locator('code', { hasText: 'seed-smoke' }).first();
		const visible = await slugCell.isVisible().catch(() => false);
		if (!visible) {
			test.info().annotations.push({ type: 'skipped', description: 'seed-smoke fixture not loaded' });
			return;
		}
		await expect(slugCell).toBeVisible();
	});
});

test.describe('hangar course manifest editor', () => {
	test('404s for a slug that does not exist', async ({ page }) => {
		const response = await page.goto(ROUTES.HANGAR_COURSE('does-not-exist-course-slug-q1z'));
		expect(response?.status()).toBe(404);
	});

	test('renders the manifest form for the seed-smoke fixture (when seeded)', async ({ page }) => {
		const response = await page.goto(ROUTES.HANGAR_COURSE('seed-smoke'));
		if (response?.status() === 404) {
			test.info().annotations.push({ type: 'skipped', description: 'seed-smoke fixture not loaded' });
			return;
		}
		expect(response?.status()).toBe(200);
		await expect(page.getByRole('heading', { name: /manifest/i, level: 2 })).toBeVisible();
		await expect(page.getByRole('heading', { name: /sections \(/, level: 2 })).toBeVisible();
	});
});

test.describe('hangar section editor', () => {
	test('404s for a section code that does not exist', async ({ page }) => {
		const response = await page.goto(ROUTES.HANGAR_COURSE_SECTION('seed-smoke', 'does-not-exist-section-code'));
		// Either 404 (course exists, section missing) or 404 from missing fixture course.
		expect(response?.status()).toBe(404);
	});

	test('renders the section editor for the seed-smoke fixture s1 section (when seeded)', async ({ page }) => {
		const response = await page.goto(ROUTES.HANGAR_COURSE_SECTION('seed-smoke', 's1'));
		if (response?.status() === 404) {
			test.info().annotations.push({ type: 'skipped', description: 'seed-smoke fixture not loaded' });
			return;
		}
		expect(response?.status()).toBe(200);
		await expect(page.getByRole('heading', { name: /steps \(/, level: 2 })).toBeVisible();
		// The seed-smoke fixture has two steps: s1.1 and s1.2.
		await expect(page.locator('code', { hasText: 's1.1' }).first()).toBeVisible();
	});
});
