import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

/**
 * Goal-composer Courses block e2e (course-reader-and-editor WP, Phase 5).
 *
 * Verifies the new add/remove/setWeight actions and the "Courses ({N})"
 * block render on `/program/goals/[id]`. Defensive about missing fixtures:
 * skips the deeper assertions when the seed-smoke course is not loaded
 * in the e2e DB (matches the pattern in courses-reader.spec.ts).
 */

const SEED_SMOKE_COURSE_TITLE = 'Seed-Smoke Course Fixture';

async function createGoal(page: import('@playwright/test').Page, title: string): Promise<string> {
	await page.goto(ROUTES.PROGRAM_GOALS_NEW);
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Title').fill(title);
	await page.getByLabel(/notes/i).fill('e2e goal-composer-courses');
	await page.getByRole('button', { name: 'Create goal' }).click();
	await expect(page).toHaveURL(/\/program\/goals\/goal_/);
	const url = page.url();
	const match = url.match(/\/program\/goals\/(goal_[A-Za-z0-9]+)/);
	if (!match) throw new Error(`could not extract goal id from ${url}`);
	return match[1];
}

test.describe('goal composer -- courses block', () => {
	test('renders the Courses block with at minimum an empty state or rows', async ({ page }) => {
		const goalId = await createGoal(page, `e2e courses block ${Date.now()}`);
		await page.goto(ROUTES.PROGRAM_GOAL(goalId));
		await expect(page.getByRole('heading', { name: /Courses \(/, level: 2 })).toBeVisible();
	});

	test('add then remove flow against the seed-smoke fixture (when seeded)', async ({ page }) => {
		const goalId = await createGoal(page, `e2e courses add-remove ${Date.now()}`);
		await page.goto(ROUTES.PROGRAM_GOAL(goalId));

		// The "Add course" select is only rendered when at least one
		// active course is available outside the goal. If the seed-smoke
		// fixture is not present and no other active course exists, the
		// picker is hidden -- skip the deeper assertions.
		const addSelect = page.locator('select[name="courseId"]');
		if ((await addSelect.count()) === 0) {
			test.info().annotations.push({ type: 'skipped', description: 'no active courses available for picker' });
			return;
		}

		// Look for the seed-smoke course option -- skip if not seeded.
		const optionLocator = addSelect.locator('option', { hasText: SEED_SMOKE_COURSE_TITLE });
		if ((await optionLocator.count()) === 0) {
			test.info().annotations.push({ type: 'skipped', description: 'seed-smoke fixture not loaded' });
			return;
		}

		// Add: select the seed-smoke course and submit.
		await addSelect.selectOption({ label: SEED_SMOKE_COURSE_TITLE });
		await page
			.locator('form[action="?/addCourse"]')
			.getByRole('button', { name: 'Add' })
			.click();

		// After the action the page reloads with the course in the list.
		await expect(page.getByRole('link', { name: SEED_SMOKE_COURSE_TITLE })).toBeVisible();
		// And the Courses (N) header shows N >= 1.
		const header = page.getByRole('heading', { name: /Courses \(\d+\)/, level: 2 });
		await expect(header).toBeVisible();
		const headerText = await header.textContent();
		expect(headerText).toMatch(/Courses \([1-9]\d*\)/);

		// Remove: click the Remove button on the seed-smoke row.
		const row = page.locator('li.row', { hasText: SEED_SMOKE_COURSE_TITLE });
		await row.locator('form[action="?/removeCourse"] button[type="submit"]').click();

		// The course no longer appears in the courses-in-goal list.
		await expect(page.getByRole('link', { name: SEED_SMOKE_COURSE_TITLE })).toHaveCount(0);
	});

	test('setCourseWeight updates the weight value (when seeded)', async ({ page }) => {
		const goalId = await createGoal(page, `e2e courses weight ${Date.now()}`);
		await page.goto(ROUTES.PROGRAM_GOAL(goalId));

		const addSelect = page.locator('select[name="courseId"]');
		if ((await addSelect.count()) === 0) {
			test.info().annotations.push({ type: 'skipped', description: 'no active courses available for picker' });
			return;
		}
		const optionLocator = addSelect.locator('option', { hasText: SEED_SMOKE_COURSE_TITLE });
		if ((await optionLocator.count()) === 0) {
			test.info().annotations.push({ type: 'skipped', description: 'seed-smoke fixture not loaded' });
			return;
		}

		await addSelect.selectOption({ label: SEED_SMOKE_COURSE_TITLE });
		await page
			.locator('form[action="?/addCourse"]')
			.getByRole('button', { name: 'Add' })
			.click();
		await expect(page.getByRole('link', { name: SEED_SMOKE_COURSE_TITLE })).toBeVisible();

		// Update weight to 2.5 on the seed-smoke row.
		const row = page.locator('li.row', { hasText: SEED_SMOKE_COURSE_TITLE });
		const weightInput = row.locator('form[action="?/setCourseWeight"] input[name="weight"]');
		await weightInput.fill('2.5');
		await row.locator('form[action="?/setCourseWeight"] button[type="submit"]').click();

		// Reload to confirm persistence.
		await page.goto(ROUTES.PROGRAM_GOAL(goalId));
		const reloadedRow = page.locator('li.row', { hasText: SEED_SMOKE_COURSE_TITLE });
		const reloadedWeight = reloadedRow.locator('form[action="?/setCourseWeight"] input[name="weight"]');
		await expect(reloadedWeight).toHaveValue('2.5');
	});
});
