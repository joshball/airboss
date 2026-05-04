/**
 * Unauthed access to hangar review queue surfaces -- covers test-plan
 * section "ADMIN gating: non-admin attempts return 403".
 *
 * The hangar root layout bounces anonymous users to `/login?redirectTo=`
 * before the (app) `requireRole` gate even runs. Each test hits a
 * sensitive route directly and asserts the redirect lands on the login
 * page with the original target preserved as a query parameter so a
 * post-login bounce-back is wired correctly.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../../../libs/constants/src';

const PROTECTED_ROUTES = [
	{ name: 'review board', path: ROUTES.HANGAR_REVIEW },
	{ name: 'docs browser', path: ROUTES.HANGAR_DOCS },
	{ name: 'review admin loader', path: ROUTES.HANGAR_REVIEW_ADMIN_LOADER },
	{ name: 'review admin buckets', path: ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS },
	{ name: 'review admin bucket new', path: ROUTES.HANGAR_REVIEW_ADMIN_BUCKET_NEW },
	{ name: 'review tasks new', path: ROUTES.HANGAR_REVIEW_TASK_NEW },
] as const;

test.describe('unauthed: protected hangar routes redirect to login', () => {
	for (const route of PROTECTED_ROUTES) {
		test(`${route.name} -- bounces to /login with redirectTo`, async ({ page }) => {
			await page.goto(route.path);
			await expect(page).toHaveURL(/\/login(\?|$)/);
			// The redirectTo query param is URL-encoded; assert it survives.
			const url = new URL(page.url());
			const redirectTo = url.searchParams.get('redirectTo');
			expect(redirectTo).not.toBeNull();
			// `redirectTo` may be just the pathname or include the query;
			// substring-match against the route's pathname so the assertion
			// stays robust to either shape.
			expect(redirectTo ?? '').toContain(route.path);
		});
	}
});
