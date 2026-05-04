/**
 * E2E smoke for the flightbag reader.
 *
 * Drives the public-reader navigation end-to-end:
 *   1. Land on `/` and confirm the catalog renders the seeded buckets.
 *   2. Click into a handbook (PHAK), then a chapter, then a section.
 *   3. Visit an AIM paragraph deep link and confirm the body renders.
 *   4. Visit a CFR Part landing and confirm the eCFR fallback link.
 *
 * Runs against `apps/flightbag` standing alone -- no auth, no storage state.
 */

import { expect, test } from '@playwright/test';
import { ROUTES } from '../../../libs/constants/src';

test.describe('flightbag landing', () => {
	test('renders the catalog with all seeded buckets', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1, name: /Flightbag/i })).toBeVisible();

		// Each bucket the seed produces should land as its own H2.
		await expect(page.getByRole('heading', { level: 2, name: /Handbooks/i })).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: /AIM/i })).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: /^14 CFR/i })).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: /Advisory Circulars/i })).toBeVisible();

		// PHAK appears as a card in the Handbooks bucket.
		const phak = page.locator('a.card[data-slug="phak"]').first();
		await expect(phak).toBeVisible();
	});
});

test.describe('flightbag handbook reader', () => {
	test('PHAK landing -> chapter list -> section', async ({ page }) => {
		const phakLanding = ROUTES.FLIGHTBAG_HANDBOOK('phak', '8083-25C');
		await page.goto(phakLanding);
		await expect(page.getByRole('heading', { level: 1 })).toContainText(/PHAK|Pilot's Handbook/i);

		// Chapter 12 is "Weather Theory" in PHAK 25C; click into it.
		const chapter12Href = ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('phak', '8083-25C', '12');
		const chapterLink = page.locator(`a[href="${chapter12Href}"]`).first();
		await expect(chapterLink).toBeVisible();
		await chapterLink.click();
		await expect(page).toHaveURL(chapter12Href);

		// Click §9 (Atmospheric Stability).
		const section9Href = ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '12', '9');
		const sectionLink = page.locator(`a[href="${section9Href}"]`).first();
		await expect(sectionLink).toBeVisible();
		await sectionLink.click();
		await expect(page).toHaveURL(section9Href);

		// Section body should render with substantive content (the real
		// PHAK §12.9 body is several paragraphs).
		const renderedSection = page.locator('[data-testid="rendered-section"]').first();
		await expect(renderedSection).toBeVisible();
		const bodyText = (await renderedSection.locator('article.body').innerText()).trim();
		expect(bodyText.length, 'section body should be substantial').toBeGreaterThan(200);

		// Sticky TOC sidebar lists sibling sections; the active one carries
		// `class="active"`.
		const toc = page.locator('aside.toc');
		await expect(toc).toBeVisible();
		await expect(toc.locator('li.active')).toBeVisible();
	});
});

test.describe('flightbag AIM reader', () => {
	test('AIM 5-1-7 deep link renders the paragraph body', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_AIM_PARAGRAPH('5', '1', '7'));
		const renderedSection = page.locator('[data-testid="rendered-section"]').first();
		await expect(renderedSection).toBeVisible();
		await expect(renderedSection.locator('h1')).toContainText(/5-1-7/);
	});
});

test.describe('flightbag CFR Part landing', () => {
	test('14 CFR 91 Part landing surfaces the eCFR fallback', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_CFR_PART('14', '91'));
		await expect(page.getByRole('heading', { level: 1 })).toContainText(/14 CFR Part 91/i);

		// Until per-section ingest lands, the page renders the eCFR callout.
		const callout = page.locator('section.callout').first();
		await expect(callout).toBeVisible();
		const ecfrLink = callout.getByRole('link', { name: /Open Part .* on eCFR/i });
		await expect(ecfrLink).toBeVisible();
		await expect(ecfrLink).toHaveAttribute('href', /ecfr\.gov/);
	});
});

test.describe('flightbag reader content fixes', () => {
	test('IFH §1.1 renders without leaking the YAML frontmatter block', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('ifh', '8083-15B', '1', '1'));
		const rendered = page.locator('[data-testid="rendered-section"]').first();
		await expect(rendered).toBeVisible();
		const text = await rendered.innerText();
		// Frontmatter keys never make it into the rendered body.
		expect(text).not.toMatch(/^---\s*$/m);
		expect(text).not.toContain('handbook: ifh');
		expect(text).not.toContain('source_url:');
		expect(text).not.toContain('faa_pages:');
	});

	test('IFH §2.2 does not render the section title twice', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('ifh', '8083-15B', '2', '2'));
		const rendered = page.locator('[data-testid="rendered-section"]').first();
		await expect(rendered).toBeVisible();
		// At most one H1 inside the rendered section. The body's body-level
		// heading (`# Communication Equipment`) duplicating the page title
		// is dropped by the renderer.
		const h1Count = await rendered.locator('h1').count();
		expect(h1Count).toBe(1);
	});

	test('an empty section renders the placeholder copy instead of a blank page', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('ifh', '8083-15B', '1', '1'));
		const rendered = page.locator('[data-testid="rendered-section"]').first();
		await expect(rendered).toBeVisible();
		// IFH §1.1 has only the frontmatter block in its body; once stripped
		// the placeholder appears.
		const placeholder = rendered.locator('[data-testid="rendered-section-empty"]');
		await expect(placeholder).toBeVisible();
		await expect(placeholder).toContainText(/no body content/i);
	});

	test('IFH §2.5 renders the inline figure for "Figure 2-5"', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('ifh', '8083-15B', '2', '5'));
		const rendered = page.locator('[data-testid="rendered-section"]').first();
		await expect(rendered).toBeVisible();
		const fig = rendered.locator('img').first();
		await expect(fig).toBeVisible();
		await expect(fig).toHaveAttribute('src', /handbook-asset\/.*figure-2-5/);
	});
});

test.describe('flightbag source links cluster', () => {
	test('handbook section page exposes a Source cluster with an external link', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '12', '9'));
		const cluster = page.locator('[data-testid="source-links"]').first();
		await expect(cluster).toBeVisible();
		const onlineLink = cluster.getByRole('link', { name: /Online source/i });
		await expect(onlineLink).toBeVisible();
		await expect(onlineLink).toHaveAttribute('href', /^https?:\/\//);
	});

	test('AIM paragraph page exposes a Source cluster with an external link', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_AIM_PARAGRAPH('5', '1', '7'));
		const cluster = page.locator('[data-testid="source-links"]').first();
		await expect(cluster).toBeVisible();
		const onlineLink = cluster.getByRole('link', { name: /Online source/i });
		await expect(onlineLink).toBeVisible();
		await expect(onlineLink).toHaveAttribute('href', /^https?:\/\//);
	});

	test('CFR Part landing exposes a Source cluster with an eCFR link', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_CFR_PART('14', '91'));
		const cluster = page.locator('[data-testid="source-links"]').first();
		await expect(cluster).toBeVisible();
		const onlineLink = cluster.getByRole('link', { name: /Online source/i });
		await expect(onlineLink).toBeVisible();
		await expect(onlineLink).toHaveAttribute('href', /ecfr\.gov/);
	});
});
