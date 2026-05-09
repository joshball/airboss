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

		// Sticky TOC sidebar lists every entry in the doc; the active one
		// carries `class="active"`. The flightbag reader wraps the TOC drawer
		// (a `<nav class="toc-drawer">`) inside an `<aside class="toc-rail">`
		// sticky rail.
		const toc = page.locator('aside.toc-rail');
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
	test('14 CFR 91 Part landing surfaces a sections list and an eCFR link', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_CFR_PART('14', '91'));
		await expect(page.getByRole('heading', { level: 1 })).toContainText(/14 CFR Part 91/i);

		// Per-section ingest has landed (PRs #668, #678): the Part page now
		// renders a Sections list for the seeded `referenceSection` rows
		// instead of the original `section.callout` placeholder. Assert the
		// Sections landmark + at least one section link.
		const sectionsLandmark = page.locator('section[aria-label="Sections"], region[aria-label="Sections"]').first();
		await expect(sectionsLandmark).toBeVisible();
		await expect(sectionsLandmark.getByRole('link').first()).toBeVisible();

		// The eCFR fallback link still ships on every Part page, served via
		// the shared Source cluster (covered in detail by the
		// `CFR Part landing exposes a Source cluster with an eCFR link`
		// test below). Pin the link's presence here too so a regression in
		// the cluster doesn't silently strip the fallback.
		const sourceCluster = page.locator('[data-testid="source-links"]').first();
		const ecfrLink = sourceCluster.getByRole('link', { name: /Online source/i });
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

	test.skip('an empty section renders prev/next/up nav instead of a dead-end page', async ({ page }) => {
		// SKIPPED 2026-05-08 (no representative content): the figure-pairing
		// pass (PR #660) plus the AFH-3B / IFH ingest re-runs paired Figure
		// 1-1 to IFH §1.1 (and similar figures to every other previously-empty
		// depth-1 section), so `RenderedSection`'s `hasContent = stripped ||
		// figures.length > 0` derived rune is now `true` for every seeded
		// handbook section -- the `emptyFallback` branch (which renders
		// `nav.reader-nav.variant-empty`) is unreachable through real seed
		// data. The code path itself is still exercised by the `<RenderedSection>`
		// component unit tests; an e2e re-revival can pin a fixture-seeded
		// section row with empty body + zero figures specifically for this
		// test, or a Storybook-style visual smoke can take over. Re-enable
		// trigger: a depth-1 handbook section row with `length(trim(content_md))
		// = 0 AND has_figures = false` exists in the seeded e2e DB.
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('ifh', '8083-15B', '1', '1'), {
			waitUntil: 'domcontentloaded',
		});
		const rendered = page.locator('[data-testid="rendered-section"]').first();
		await expect(rendered).toBeVisible();
		const nav = rendered.locator('nav.reader-nav.variant-empty').first();
		await expect(nav).toBeVisible();
		const upLink = nav.locator('[data-testid="reader-nav-up"]');
		await expect(upLink).toBeVisible();
		const nextLink = nav.locator('[data-testid="reader-nav-next"]');
		await expect(nextLink).toBeVisible();
	});

	test('every section page exposes a footer reader-nav strip', async ({ page }) => {
		// Pick a section in the middle of the chapter so prev + next + up are all present.
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('ifh', '8083-15B', '2', '5'));
		const footer = page.locator('nav.reader-nav:not(.variant-empty)').first();
		await expect(footer).toBeVisible();
		await expect(footer.locator('[data-testid="reader-nav-prev"]')).toBeVisible();
		await expect(footer.locator('[data-testid="reader-nav-next"]')).toBeVisible();
	});

	test('chapter page renders the chapter preamble before the section list', async ({ page }) => {
		// IFH chapter 1 has a preamble body file; without the fix the page
		// shows just the section list. With the fix the preamble renders first.
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('ifh', '8083-15B', '1'));
		const rendered = page.locator('[data-testid="rendered-section"]').first();
		await expect(rendered).toBeVisible();
		// Preamble's H1 is "Chapter 1: The National Airspace System" -- followed
		// by the body content, then the "Sections" list further down.
		const sectionsHeader = page.locator('section[aria-label="Sections"] h2');
		await expect(sectionsHeader).toBeVisible();
	});

	test('handbook table renders inline with the body, not as escaped text', async ({ page }) => {
		// AvWX 4.2 carries a `<div class="handbook-table">...<table>...</table></div>` block.
		// Heavy section pages (chapter TOC + body + figures + table HTML) hit the
		// 15s `load` budget under e2e load; `domcontentloaded` is enough since
		// the assertion targets the SSR'd table markup, not a hydrated UI piece.
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('avwx', '8083-28B', '4', '2'), {
			waitUntil: 'domcontentloaded',
		});
		const rendered = page.locator('[data-testid="rendered-section"]').first();
		await expect(rendered).toBeVisible();
		// The table should render as a real <table> element, not as escaped text.
		const table = rendered.locator('.handbook-table table').first();
		await expect(table).toBeVisible();
		// And there's an "Open original table" affordance.
		const openLink = rendered.locator('a.handbook-table-source').first();
		await expect(openLink).toBeVisible();
		await expect(openLink).toHaveAttribute('href', /handbook-asset/);
	});

	test('section page exposes the metadata panel sourced from frontmatter or DB', async ({ page }) => {
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('iph', '8083-16B', '2', '3'));
		const panel = page.locator('[data-testid="rendered-section-metadata"]').first();
		await expect(panel).toBeVisible();
	});

	test('chapter page exposes the metadata panel via the preamble RenderedSection', async ({ page }) => {
		// Repro of the original bug: chapter pages had no Metadata panel
		// because the chapter row's preamble wasn't rendered when sections
		// existed alongside.
		// IPH chapter 2 carries 8+ figures in its preamble; `load` waits for
		// every img response to settle, blowing the 15s nav budget. The metadata
		// panel is SSR-rendered, so `domcontentloaded` is sufficient.
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('iph', '8083-16B', '2'), {
			waitUntil: 'domcontentloaded',
		});
		const panel = page.locator('[data-testid="rendered-section-metadata"]').first();
		await expect(panel).toBeVisible();
	});

	test('IPH chapter 2 preamble renders the inline figure (Figure 2-1) end-to-end', async ({ page }) => {
		// `has_figures: true` on the IPH ch 2 chapter row means the chapter
		// markdown carries `![...](/handbooks/iph/.../figures/...png)` blocks.
		// The renderer rewrites the URL to the streamer; the streamer must
		// 200 with an image content-type.
		// `domcontentloaded` because we drive the streamer ourselves via
		// `page.request.get(src)` below; waiting for `load` is wasted time
		// (and trips the 15s nav budget on this 8-figure preamble).
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('iph', '8083-16B', '2'), {
			waitUntil: 'domcontentloaded',
		});
		const rendered = page.locator('[data-testid="rendered-section"]').first();
		await expect(rendered).toBeVisible();
		const fig = rendered.locator('img').first();
		await expect(fig).toBeVisible();
		const src = (await fig.getAttribute('src')) ?? '';
		expect(src).toMatch(/^\/handbook-asset\//);
		// Streamer responds with image content-type, not 404.
		const response = await page.request.get(src);
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type'] ?? '').toMatch(/^image\//);
	});

	test('IFH §2.5 renders the inline figure for "Figure 2-5"', async ({ page }) => {
		// Closed by the figure-pairing work package: section 2.5's caption
		// "Figure 2-5. Phonetic pronunciation guide." now scopes to section
		// 2.5 (caption-number rescoping in `figures.py`), the manifest
		// carries `has_figures: true`, and the renderer embeds
		// `![Figure 2-5. ...](.../fig-2-04-phonetic-pronunciation-guide.png)`
		// inline. The strict assertion against the rendered <img> is the
		// success criterion for the WP.
		// `domcontentloaded` because we drive the figure streamer manually via
		// `page.request.get(src)` below; the `load`-event wait was tripping
		// the 15s navigation budget on this figure-bearing section.
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('ifh', '8083-15B', '2', '5'), {
			waitUntil: 'domcontentloaded',
		});
		const rendered = page.locator('[data-testid="rendered-section"]').first();
		await expect(rendered).toBeVisible();
		const figureImg = rendered
			.locator('img[alt*="Figure 2-5"], img[alt*="Phonetic pronunciation"]')
			.first();
		await expect(figureImg).toBeVisible();
		const src = (await figureImg.getAttribute('src')) ?? '';
		expect(src).toMatch(/^\/handbook-asset\//);
		const response = await page.request.get(src);
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type'] ?? '').toMatch(/^image\//);
	});
});

test.describe('flightbag source links cluster', () => {
	test('handbook section page exposes a Source cluster with an external link', async ({ page }) => {
		// PHAK §12.9 ships a chapter TOC + body + figure-tail; `load` waits for
		// every subresource to settle, blowing the 15s nav budget. The Source
		// cluster is SSR-rendered, so `domcontentloaded` is enough.
		await page.goto(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '12', '9'), {
			waitUntil: 'domcontentloaded',
		});
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
