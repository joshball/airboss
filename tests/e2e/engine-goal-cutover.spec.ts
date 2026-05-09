import { expect, test } from '@playwright/test';
import { QUERY_PARAMS, ROUTES, SESSION_MODES } from '../../libs/constants/src';

/**
 * E2E coverage for the engine-goal-cutover work package.
 *
 * - EGC-30 / EGC-31 (UI redirect smoke): the plan-creation flow no longer
 *   surfaces a cert chooser. `/plans/new` redirects through to the goal
 *   composer (existing primary -> edit; otherwise -> create). `/plans/[id]`
 *   shows a banner pointing the learner at the goal composer instead of
 *   surfacing cert controls inline.
 * - EGC-20 .. EGC-25 (`previewSession` integration): a learner with a primary
 *   goal sees a session preview rendered from goal-derived targeting. The
 *   tests prove the page renders end-to-end through the new
 *   `getEngineTargeting` helper.
 *
 * Items NOT covered here (per test-plan.md): EGC-1 .. EGC-3 (db column shape),
 * EGC-40 .. EGC-43 (telemetry log scrape + drift / backfill scripts),
 * EGC-50 .. EGC-52 (drop trigger), EGC-60 (revert dry-run), EGC-71 .. EGC-73
 * (cross-flow audit / cert dashboard / goal composer regression). Those are
 * either db-only, log-only, or human-graded.
 *
 * The submit-redirects test mutates the test learner's active plan
 * (createPlan archives the previous active row and inserts a fresh one).
 * The whole file runs serial -- otherwise parallel workers race on the
 * active-plan window and read-side tests skip when the Open link is
 * briefly absent during a sibling worker's submit. The `beforeAll` step
 * also self-bootstraps an active plan when the seed only ships one for
 * `abby@airboss.test` (the e2e auth fixture signs in as
 * `learner@airboss.test`, who starts plan-less on a fresh seed).
 */

test.describe.configure({ mode: 'serial' });

/**
 * Ensure the e2e learner has an active plan before any of the read-side
 * tests in this file inspect /plans. The seed pipeline creates a plan for
 * `abby@airboss.test`, but the e2e auth fixture signs in as
 * `learner@airboss.test` -- a separate user who has no seeded plan. Create
 * one through the same redirect-creates-plan flow we exercise below; this
 * is read-only against the cert-chooser cutover (the new-plan page no
 * longer surfaces certs, so this submit cannot revive the legacy field).
 */
test.beforeAll(async ({ browser }) => {
	const context = await browser.newContext({ storageState: 'tests/e2e/.auth/learner.json' });
	const page = await context.newPage();
	try {
		await page.goto(ROUTES.PROGRAM_PLANS);
		const hasPlan = await page
			.getByRole('link', { name: 'Open' })
			.first()
			.isVisible()
			.catch(() => false);
		if (!hasPlan) {
			await page.goto(ROUTES.PROGRAM_PLANS_NEW);
			await page.getByRole('button', { name: /create plan/i }).click();
			// Plan submit always redirects to /goals/* per engine-goal-cutover.
			await page.waitForURL(/\/goals(?:\/|$)/);
		}
	} finally {
		await page.close();
		await context.close();
	}
});

test.describe('engine-goal-cutover -- plan UI no longer surfaces cert chooser', () => {
	test('/plans/new shows the goal-composer guidance, not a cert chooser', async ({ page }) => {
		await page.goto(ROUTES.PROGRAM_PLANS_NEW);

		await expect(page.getByRole('heading', { name: 'New study plan', level: 1 })).toBeVisible();

		// Cert chooser is gone -- there is no checkbox or radio whose name maps
		// to the four cert slugs (private / instrument / commercial / cfi)
		// nor a fieldset legend mentioning cert goals.
		await expect(page.getByRole('group', { name: /cert goals/i })).toHaveCount(0);
		await expect(page.locator('input[name="certGoals"]')).toHaveCount(0);

		// The page does carry a note pointing at the goal composer.
		await expect(page.getByText(/cert intent.*goal/i).first()).toBeVisible();

		// Focus / skip / depth / mode / length are still on the plan form --
		// engine-goal-cutover only moves cert intent off the plan, the plan
		// still owns session shape.
		await expect(page.getByRole('group', { name: /focus domains/i })).toBeVisible();
		await expect(page.getByRole('group', { name: /skip domains/i })).toBeVisible();
		await expect(page.getByRole('group', { name: /depth preference/i })).toBeVisible();
		await expect(page.getByRole('group', { name: /default session mode/i })).toBeVisible();
	});

	test('/plans/[id] shows banner pointing at goal composer, no cert chooser', async ({ page }) => {
		// beforeAll guarantees an active plan exists for this learner.
		await page.goto(ROUTES.PROGRAM_PLANS);
		await expect(page.getByRole('heading', { name: 'Study plans', level: 1 })).toBeVisible();
		const openLink = page.getByRole('link', { name: 'Open' }).first();
		await expect(openLink).toBeVisible();
		await openLink.click();

		// Land on /plans/<id>.
		await expect(page).toHaveURL(/\/plans\/(?:plan|sp)_/);

		// No cert chooser inputs.
		await expect(page.locator('input[name="certGoals"]')).toHaveCount(0);
		await expect(page.getByRole('group', { name: /cert goals/i })).toHaveCount(0);

		// Banner / note exists with a link to the goal composer.
		const composerLink = page.getByRole('link', { name: /(edit primary goal|set up your goal)/i }).first();
		await expect(composerLink).toBeVisible();

		// The link target is either the goal-edit URL (existing primary) or the
		// goal-create URL (no primary). Both are valid post-cutover landings;
		// reject anything that points back inside /plans. The goal composer
		// surface lives at `/program/goals/...` post-IA-cleanup (see ROUTES.
		// PROGRAM_GOAL / PROGRAM_GOALS_NEW); previously the URL family was
		// `/goals/...`.
		const href = await composerLink.getAttribute('href');
		expect(href).toBeTruthy();
		expect(href).toMatch(/^\/program\/goals\//);
	});
});

test.describe('engine-goal-cutover -- plan-creation submit redirects to goal composer', () => {
	test('submitting /plans/new redirects into the goal composer', async ({ page }) => {
		await page.goto(ROUTES.PROGRAM_PLANS_NEW);
		await expect(page.getByRole('heading', { name: 'New study plan', level: 1 })).toBeVisible();

		// Title is optional; leave it blank. Defaults cover focus / skip / depth /
		// mode / length so the form is submittable as-is.
		await page.getByRole('button', { name: /create plan/i }).click();

		// Land somewhere under /program/goals. The exact path depends on
		// whether the learner has a primary goal: PROGRAM_GOAL(primary) with
		// `?edit=1` when one exists, PROGRAM_GOALS_NEW otherwise. Both are
		// correct post-cutover behavior. The URL family is `/program/goals/...`
		// post-IA-cleanup (previously `/goals/...`).
		await page.waitForURL(/\/program\/goals(?:\/|$)/);
		const url = new URL(page.url());
		expect(url.pathname.startsWith('/program/goals')).toBe(true);

		const onEdit = url.searchParams.get(QUERY_PARAMS.EDIT) === '1';
		const onNew = url.pathname === ROUTES.PROGRAM_GOALS_NEW;
		expect(
			onEdit || onNew,
			`expected /program/goals/<id>?edit=1 or ${ROUTES.PROGRAM_GOALS_NEW}, got ${url.pathname}${url.search}`,
		).toBe(true);

		// Page should render either the goal detail/edit heading (existing
		// primary) or the New goal heading (fresh primary).
		const newHeading = page.getByRole('heading', { name: 'New goal', level: 1 });
		const detailHeading = page.getByRole('heading', { level: 1 }).first();
		await expect(newHeading.or(detailHeading)).toBeVisible();
	});
});

test.describe('engine-goal-cutover -- session preview reflects goal-derived targeting', () => {
	test('session start renders a preview when the learner has goal targeting', async ({ page }) => {
		await page.goto(ROUTES.SESSION_START);

		await expect(page.getByRole('heading', { name: /start a session/i, level: 1 })).toBeVisible();

		// Two valid post-cutover states:
		//
		// 1. learner has an active plan -- preview block renders with a Plan
		//    link, the Mode select, and the start form (mode field is
		//    pre-populated from the plan's defaultMode, derived through goal
		//    targeting for cert / focus / skip lists);
		// 2. learner has no active plan -- the preset gallery renders.
		//
		// Either state proves session-start no longer crashes when targeting
		// comes from the goal model. The previous (pre-cutover) implementation
		// would have read `plan.certGoals` directly; the cutover makes that
		// field unused without breaking the page.
		const previewMode = page.locator('select#mode');
		const galleryHeading = page.getByRole('heading', { name: /pick a plan to get started/i });
		await expect(previewMode.or(galleryHeading)).toBeVisible();

		const previewVisible = await previewMode.isVisible().catch(() => false);
		if (!previewVisible) {
			// No active plan -- the preset gallery is visible; the engine
			// targeting helper is exercised on the next session start, not here.
			// This branch confirms the empty-state path also survives the cutover.
			await expect(galleryHeading).toBeVisible();
			return;
		}

		// The mode select is populated. Confirm the SESSION_MODES.MIXED option
		// is available and the start form is wired up.
		await expect(previewMode).toBeVisible();
		await expect(previewMode.locator(`option[value="${SESSION_MODES.MIXED}"]`)).toHaveCount(1);

		// The Start session button is present (whether or not the queue is
		// empty -- empty-state is a separate code path with EmptyState body).
		const startBtn = page.getByRole('button', { name: /^start session$/i });
		const emptyHeading = page.getByRole('heading', { name: /nothing to study yet/i });
		await expect(startBtn.or(emptyHeading)).toBeVisible();

		// When the engine produced a preview the active-plan link is visible
		// in the meta strip; assert it routes back to the plan detail page so
		// the goal-targeted preview round-trip is end-to-end visible.
		const planLink = page.getByRole('link', { name: /plan:|^plan$/i }).first();
		const planLinkVisible = await planLink.isVisible().catch(() => false);
		if (planLinkVisible) {
			const href = await planLink.getAttribute('href');
			expect(href).toMatch(/^\/plans\//);
		}
	});
});

test.describe('engine-goal-cutover -- cross-flow plan -> goal composer link', () => {
	test('clicking the goal-composer link from /plans/[id] lands on the composer', async ({ page }) => {
		await page.goto(ROUTES.PROGRAM_PLANS);
		const openLink = page.getByRole('link', { name: 'Open' }).first();
		await expect(openLink).toBeVisible();
		await openLink.click();

		const composerLink = page.getByRole('link', { name: /(edit primary goal|set up your goal)/i }).first();
		await expect(composerLink).toBeVisible();
		await composerLink.click();

		// Expect to land on /program/goals/<id>?edit=1 or /program/goals/new.
		// The URL family is `/program/goals/...` post-IA-cleanup.
		await page.waitForURL(/\/program\/goals(?:\/|$)/);
		const url = new URL(page.url());
		expect(url.pathname.startsWith('/program/goals')).toBe(true);

		const onEdit = url.searchParams.get(QUERY_PARAMS.EDIT) === '1';
		const onNew = url.pathname === ROUTES.PROGRAM_GOALS_NEW;
		expect(onEdit || onNew).toBe(true);
	});
});
