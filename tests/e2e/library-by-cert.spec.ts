/**
 * Wave 4 e2e for the library-by-cert route family.
 *
 * Smoke-tests every new route surface added by Waves 3a/3b -- one assertion
 * per route confirming it loads under the dev seed and exposes its
 * canonical landing element. Where a route accepts a parameter, both the
 * happy-path value and one bogus value (404 expected) are exercised.
 *
 * Pattern mirrors `tests/e2e/handbook-reader.spec.ts`: relies on the
 * `tests/e2e/global.setup.ts` storage state (`abby@airboss.test`) for auth.
 *
 * Routes covered:
 *   - /library                                          (landing, three-spine)
 *   - /library/cert/private                             (PPL primary refs)
 *   - /library/cert/cfi                                 (CFI + carryover)
 *   - /library/cert/bogus                               (404)
 *   - /library/topic/weather                            (weather refs)
 *   - /library/topic/bogus                              (404)
 *   - /library/regulations                              (index)
 *   - /library/regulations/14-cfr                       (14 CFR bucket)
 *   - /library/regulations/14-cfr/91                    (Part 91 group)
 *   - /library/regulations/aim                          (AIM bucket)
 *   - /library/regulations/ac/91                        (AC series 91)
 *   - /library/handbook/phak                            (PHAK TOC)
 *   - /library/handbook/phak/<chap>/<sec>               (PHAK leaf reader)
 *   - /library/aircraft/<slug>                          (POH umbrella)
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

// PHAK leaf-reader anchors -- mirrors tests/e2e/handbook-reader.spec.ts so
// the canonical readable section stays the same across e2e suites.
const PHAK_DOC = 'phak';
const PHAK_CHAPTER_12 = '12';
const PHAK_SECTION_9 = '9';
const PHAK_SECTION_9_TITLE = 'Atmospheric Stability';

test.describe('library-by-cert: landing page', () => {
	test('/library renders with cert/topic/regulations spines', async ({ page }) => {
		await page.goto(ROUTES.LIBRARY);
		await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible();

		// Three spine headings render -- each section landmark is labelled
		// by its own h2 (cert/topic/regulations). The aircraft spine is
		// conditional on POH rows existing in the seed.
		await expect(page.getByRole('heading', { name: 'By cert', level: 2 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'By topic', level: 2 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Regulations & policy', level: 2 })).toBeVisible();
	});
});

test.describe('library-by-cert: cert spine', () => {
	test('/library/cert/private renders PPL primary refs', async ({ page }) => {
		await page.goto(ROUTES.LIBRARY_CERT('private'));
		await expect(page.getByRole('heading', { level: 1 })).toContainText(/Library -- Private/i);
		// PHAK is the canonical PPL reference and is seeded with
		// primary_cert=private. Cards on the cert page render via
		// LibraryCard with `progress={null}` so they're unlinked tiles
		// keyed by their title heading -- not anchor tags.
		await expect(
			page.getByRole('heading', { name: "Pilot's Handbook of Aeronautical Knowledge", exact: true }),
		).toBeVisible();
	});

	test('/library/cert/cfi renders carryover sidebar with Private group', async ({ page }) => {
		await page.goto(ROUTES.LIBRARY_CERT('cfi'));
		await expect(page.getByRole('heading', { level: 1 })).toContainText(/Library -- CFI/i);
		// Carryover heading appears whenever the credential DAG yields any
		// inherited refs. CFI -> Commercial -> Private, so at minimum the
		// Private carryover group renders.
		await expect(page.getByRole('heading', { name: 'Carryover from prerequisites', level: 2 })).toBeVisible();
		await expect(page.getByText(/Carried over from Private/i).first()).toBeVisible();
	});

	test('/library/cert/bogus 404s', async ({ page }) => {
		const response = await page.goto('/library/cert/bogus');
		expect(response?.status()).toBe(404);
	});
});

test.describe('library-by-cert: topic spine', () => {
	test('/library/topic/weather renders weather refs', async ({ page }) => {
		await page.goto(ROUTES.LIBRARY_TOPIC('weather'));
		await expect(page.getByRole('heading', { level: 1 })).toContainText(/Weather/i);
		// AvWx is the canonical weather handbook in the seed. Cards on the
		// topic page render via LibraryCard with `progress={null}` so we
		// match by the card's title heading rather than an anchor href.
		await expect(page.getByRole('heading', { name: 'Aviation Weather Handbook', exact: true })).toBeVisible();
	});

	test('/library/topic/bogus 404s', async ({ page }) => {
		const response = await page.goto('/library/topic/bogus');
		expect(response?.status()).toBe(404);
	});
});

test.describe('library-by-cert: regulations spine', () => {
	test('/library/regulations index renders bucket cards', async ({ page }) => {
		await page.goto(ROUTES.LIBRARY_REGULATIONS);
		await expect(page.getByRole('heading', { name: /Regulations & policy/i, level: 1 })).toBeVisible();
		// 14 CFR bucket card links into the per-kind page.
		await expect(page.locator(`a[href="${ROUTES.LIBRARY_REGULATIONS_KIND('14-cfr')}"]`).first()).toBeVisible();
	});

	test('/library/regulations/14-cfr renders Part list including Part 91', async ({ page }) => {
		await page.goto(ROUTES.LIBRARY_REGULATIONS_KIND('14-cfr'));
		await expect(page.getByRole('heading', { name: /14 CFR/i, level: 1 })).toBeVisible();
		// Part 91 group link surfaces.
		await expect(page.locator(`a[href="${ROUTES.LIBRARY_REGULATIONS_GROUP('14-cfr', '91')}"]`).first()).toBeVisible();
	});

	test('/library/regulations/14-cfr/91 renders the Part 91 page', async ({ page }) => {
		const response = await page.goto(ROUTES.LIBRARY_REGULATIONS_GROUP('14-cfr', '91'));
		// Forward-compatible: spec accepts either an umbrella card or a
		// section list. Both shapes share an h1 derived from the group label.
		expect(response?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('/library/regulations/aim renders the AIM bucket', async ({ page }) => {
		await page.goto(ROUTES.LIBRARY_REGULATIONS_KIND('aim'));
		await expect(page.getByRole('heading', { name: /AIM/i, level: 1 })).toBeVisible();
	});

	test('/library/regulations/ac/91 renders ACs in series 91', async ({ page }) => {
		const response = await page.goto(ROUTES.LIBRARY_REGULATIONS_GROUP('ac', '91'));
		expect(response?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});
});

test.describe('library-by-cert: handbook reader', () => {
	test('/library/handbook/phak renders the PHAK TOC', async ({ page }) => {
		await page.goto(ROUTES.LIBRARY_HANDBOOK(PHAK_DOC));
		await expect(page.getByRole('heading', { level: 1 })).toContainText(/Pilot's Handbook of Aeronautical Knowledge/i);
	});

	test('/library/handbook/phak/12/9 renders the leaf reader', async ({ page }) => {
		await page.goto(ROUTES.LIBRARY_HANDBOOK_SECTION(PHAK_DOC, PHAK_CHAPTER_12, PHAK_SECTION_9));
		await expect(page.getByRole('heading', { level: 1 })).toContainText(new RegExp(PHAK_SECTION_9_TITLE, 'i'));
	});
});

test.describe('library-by-cert: aircraft spine', () => {
	test('/library/aircraft/<seeded-poh> renders the umbrella card', async ({ page }) => {
		// Find a real POH slug from the landing page rather than hardcoding a
		// brand-specific value; the seed's POH inventory may evolve, but the
		// landing page always exposes whatever's seeded as `aircraft-card`s.
		await page.goto(ROUTES.LIBRARY);
		const aircraftLinks = page.locator('a.aircraft-card');
		const count = await aircraftLinks.count();
		test.skip(count === 0, 'no POH/AFM rows seeded -- aircraft spine has nothing to load');

		const href = await aircraftLinks.first().getAttribute('href');
		expect(href, 'aircraft card should expose an href').not.toBeNull();
		if (href === null) return;

		const response = await page.goto(href);
		expect(response?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});
});
