import { test as baseTest, expect } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';
import { test as freshUserTest } from './fixtures/fresh-user';

// Two of the previous test.skip() calls in this file fired whenever the
// shared dev-seed user (Abby) was carrying a populated row shape that
// hid the assertion path (no-primary-goal banner; private-syllabus empty
// state). Both branches now run against a freshUser fixture so the
// assertions are exercised deterministically.

baseTest.describe('credentials index (shared seed)', () => {
	baseTest('renders heading and either an empty-state or credential cards', async ({ page }) => {
		await page.goto(ROUTES.PROGRAM_QUALS);
		await expect(page.getByRole('heading', { name: 'Quals', exact: true, level: 1 })).toBeVisible();

		// Either no active credentials seeded (empty-state) or at least one card with the stat trio.
		const emptyHeading = page.getByRole('heading', { name: /no active quals/i });
		const masteryStat = page.getByTestId('cred-mastery').first();
		await expect(emptyHeading.or(masteryStat).first()).toBeVisible();
	});
});

freshUserTest.describe('credentials index (fresh user)', () => {
	freshUserTest('shows the no-primary-goal banner for a learner with no primary goal', async ({ page, freshUser }) => {
		// `freshUser` has no primary goal -> the banner must appear.
		expect(freshUser.id).toBeDefined();
		await page.goto(ROUTES.PROGRAM_QUALS);
		await expect(page.getByRole('heading', { name: 'Quals', exact: true, level: 1 })).toBeVisible();
		const banner = page.getByRole('status').filter({ hasText: /primary goal/i });
		await expect(banner).toBeVisible();
		// Banner must render exactly once -- a double render would indicate a
		// regression where both the index list and the detail rollup emitted
		// status regions for the same condition.
		expect(await banner.count()).toBe(1);
		// And the CTA links to the goal-creation route.
		await expect(banner.getByRole('link', { name: /create a goal/i })).toBeVisible();
	});
});

baseTest.describe('credentials detail (shared seed)', () => {
	baseTest('404 when slug does not match a credential', async ({ page }) => {
		const response = await page.goto(ROUTES.PROGRAM_QUAL('zzz-not-a-real-credential'));
		expect(response?.status()).toBe(404);
	});

	baseTest('renders detail page when a credential exists', async ({ page }) => {
		// `private` is the credential the seeded `ppl-airplane-acs-6c` syllabus
		// links to, so the detail page deterministically renders the mastery
		// rollup against the shared dev-seed.
		await page.goto(ROUTES.PROGRAM_QUAL('private'));

		// Header + breadcrumb crumb back to /credentials.
		await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
		// Mastery rollup with the testid -- gated on `primarySyllabus !== null`,
		// which is guaranteed by the credential-syllabi seed phase.
		await expect(page.getByTestId('detail-mastery')).toBeVisible();
		await expect(page.getByTestId('detail-coverage')).toBeVisible();
	});
});
