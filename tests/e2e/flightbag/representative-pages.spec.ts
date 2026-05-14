/**
 * Representative-pages coverage for the flightbag reader.
 *
 * The flightbag has thousands of leaf pages -- one per handbook section, one
 * per CFR section, one per AIM paragraph, one per AC section, one per ACS
 * task. Walking every URL is wasteful; walking none risks shipping a routing
 * regression that quietly 500s an entire corpus.
 *
 * Strategy: pick a small representative sample per active reference -- the
 * first row, a row near the middle, and the last row -- and assert each one
 * renders with a 2xx status and a non-empty H1. URLs are computed directly
 * from the seeded `(documentSlug, edition, code)` tuple via `ROUTES.FLIGHTBAG_*`
 * so the spec exercises the routes the catalog actually links to, not the
 * `urlForReference()` URI bridge (which has its own per-corpus locator
 * regexes that occasionally drift from the seed shapes -- those drifts are
 * a separate citation-chip concern, not a reader-route concern).
 *
 * Behaviour: any 5xx, any locator miss, any blank H1 fails the parameterised
 * test for that one row. The rest continue. The full sample at the time of
 * writing is ~200 pages (3 per active reference * ~70 references). Runtime is
 * dominated by SSR; budget ~30s on a warm dev server.
 *
 * NOT covered: corpora whose readers don't accept a section-level deep link
 * (PCG, POH/AFM, SAFO/InFO bulletins, NTSB ALJ rulings, generic ACS/PTS
 * skeletons). These get a single landing-page test instead -- enough to
 * catch a 500 on the catalog card target.
 */

import { expect, test } from '@playwright/test';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DEV_DB_URL_E2E, REFERENCE_KINDS, ROUTES } from '../../../libs/constants/src';
import { notSupersededInRegistry } from '../../../libs/bc/study/src/edition-predicates.ts';
import { reference, referenceSection } from '../../../libs/bc/study/src/schema';

interface SamplePage {
	readonly kind: string;
	readonly documentSlug: string;
	readonly position: 'first' | 'middle' | 'last';
	readonly code: string;
	readonly url: string;
}

/**
 * Per-corpus URL builder. Returns null for corpora that don't have a
 * section-level reader route yet -- those are covered by the catalog landing
 * test in `reader.spec.ts`. Each branch builds straight from the seeded row
 * shape; no URI parsing, no locator regex.
 */
function buildSectionUrl(kind: string, documentSlug: string, edition: string, code: string): string | null {
	switch (kind) {
		case REFERENCE_KINDS.HANDBOOK: {
			// Handbook sections use dotted codes (`12.3` = chapter 12, section 3).
			// Whole-chapter rows have a single segment. Subsections (`12.3.4`)
			// are an existing reader unknown -- the route only handles two
			// segments -- so fall back to the chapter for the deepest leaf we
			// actually render. Front-matter rows (`0.1`, `0.2`, ...) use a
			// pseudo-chapter `0` that has no `/handbook/.../0/...` reader route;
			// they're surfaced via the handbook landing's front-matter list and
			// don't have a deep-linkable section page yet, so skip them here.
			const segments = code.split('.');
			const chapter = segments[0] ?? code;
			const section = segments[1];
			if (chapter === '0') return null;
			if (section !== undefined) {
				return ROUTES.FLIGHTBAG_HANDBOOK_SECTION(documentSlug, edition, chapter, section);
			}
			return ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(documentSlug, edition, chapter);
		}
		case REFERENCE_KINDS.AIM: {
			// AIM codes are dashed: `5-1-7` (chapter-section-paragraph). Skip
			// appendix rows -- the flightbag has no `/aim/appendix/...` route
			// today, and the catalog landing covers the appendix card.
			if (/^appendix-/i.test(code)) return null;
			const parts = code.split('-');
			if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
				return ROUTES.FLIGHTBAG_AIM_PARAGRAPH(parts[0], parts[1], parts[2]);
			}
			if (parts.length === 2 && parts[0] && parts[1]) {
				return ROUTES.FLIGHTBAG_AIM_SECTION(parts[0], parts[1]);
			}
			if (parts.length === 1 && parts[0]) {
				return ROUTES.FLIGHTBAG_AIM_CHAPTER(parts[0]);
			}
			return null;
		}
		case REFERENCE_KINDS.CFR: {
			// CFR slug is `<title>cfr<part>` (e.g. `14cfr91`). `code` is either
			// the part number (chapter row), a true `<part>.<section>` numeric
			// section, or a Subpart/Appendix range row whose code carries a `-`
			// (e.g. `121.1200-121.1399`). The reader's `[section]` route
			// validates against `/^[a-z0-9-]+$/` and rejects period-bearing
			// section IDs, so range rows have no leaf reader page today --
			// route them to the Part landing instead.
			const slugMatch = /^([0-9]+)cfr(.+)$/.exec(documentSlug);
			if (!slugMatch) return null;
			const [, title = '', part = ''] = slugMatch;
			if (code === part) return ROUTES.FLIGHTBAG_CFR_PART(title, part);
			// Strict numeric section: `<part>.<digits>` only. Anything else
			// (range codes, subpart wrappers seeded with `subpart-X` codes,
			// dotted appendices) drops back to the Part landing.
			const sectionMatch = /^[0-9]+\.([0-9]+)$/.exec(code);
			if (sectionMatch?.[1]) return ROUTES.FLIGHTBAG_CFR_SECTION(title, part, sectionMatch[1]);
			return ROUTES.FLIGHTBAG_CFR_PART(title, part);
		}
		default:
			// AC, ACS, NTSB, SAFO, InFO, POH, PCG, PTS, OTHER: section URL
			// shapes are covered by their per-corpus specs (or a follow-up WP).
			// The reader.spec.ts catalog test already pins the landing pages.
			return null;
	}
}

/**
 * Collect first/middle/last sections per active reference. Returns the URL +
 * a label so test failures point at the exact (slug, position, code) that
 * regressed. Rows whose kind has no URL builder yet are dropped -- those
 * stay covered by the catalog landing test.
 */
async function collectSamplePages(): Promise<readonly SamplePage[]> {
	// Hard-pin to the e2e DB -- the webServer entries spawn every SvelteKit
	// process pinned at `airboss_e2e`, so the catalog rows the reader
	// serves live there. We do NOT honour `DATABASE_URL` here because bun
	// auto-loads `.env` from cwd and would silently route this query to
	// the developer's dev DB instead.
	const client = postgres(DEV_DB_URL_E2E, { max: 1 });
	const db = drizzle(client);
	try {
		const refs = await db
			.select({
				id: reference.id,
				kind: reference.kind,
				documentSlug: reference.documentSlug,
				edition: reference.edition,
			})
			.from(reference)
			.where(notSupersededInRegistry());

		const samples: SamplePage[] = [];
		for (const ref of refs) {
			const sections = await db
				.select({ code: referenceSection.code })
				.from(referenceSection)
				.where(eq(referenceSection.referenceId, ref.id))
				// (depth, ordinal) is NOT unique within a reference -- CFR subpart
				// wrappers (`subpart-B`, `subpart-C`) share an ordinal with the
				// first numeric section under them. Without a deterministic
				// tiebreaker, every Playwright worker re-runs this query and gets
				// a different first/middle/last row, producing parameterised test
				// names that don't match between the orchestrator and the workers
				// ("Test not found in the worker process"). Sort by `code` last
				// so the sample is identical across workers.
				.orderBy(asc(referenceSection.depth), asc(referenceSection.ordinal), asc(referenceSection.code));

			if (sections.length === 0) continue;

			const middle = sections[Math.floor(sections.length / 2)];
			const picks: { position: SamplePage['position']; row: (typeof sections)[number] | undefined }[] = [
				{ position: 'first', row: sections[0] },
				{ position: 'middle', row: middle },
				{ position: 'last', row: sections[sections.length - 1] },
			];

			for (const pick of picks) {
				if (!pick.row) continue;
				const candidate = buildSectionUrl(ref.kind, ref.documentSlug, ref.edition, pick.row.code);
				if (candidate === null) continue;
				samples.push({
					kind: ref.kind,
					documentSlug: ref.documentSlug,
					position: pick.position,
					code: pick.row.code,
					url: candidate,
				});
			}
		}

		// Stable ordering so test reports are deterministic. Sort by (kind, slug,
		// position) -- position keeps first/middle/last grouped per doc.
		const positionRank: Record<SamplePage['position'], number> = { first: 0, middle: 1, last: 2 };
		return [...samples].sort((a, b) => {
			if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
			if (a.documentSlug !== b.documentSlug) return a.documentSlug < b.documentSlug ? -1 : 1;
			return positionRank[a.position] - positionRank[b.position];
		});
	} finally {
		await client.end({ timeout: 1 });
	}
}

const samples = await collectSamplePages();

test.describe('flightbag representative pages', () => {
	test('sample size is non-trivial -- catches a fully-empty registry', () => {
		// Defensive: if a future refactor blanks the registry, every parameterised
		// test below would silently pass via `for-of` no-iter. Pin the floor at
		// 15 (smaller than any plausible real corpus) so a regression here
		// surfaces as a single failing assertion instead of a green test
		// report. At write time the dev seed produces ~19 samples (handbook +
		// AIM + CFR triplets, after front-matter rows are skipped); raise this
		// floor when AC/ACS/POH builders land.
		expect(samples.length).toBeGreaterThan(15);
	});

	for (const sample of samples) {
		test(`${sample.kind}/${sample.documentSlug} ${sample.position} (${sample.code})`, async ({ page }) => {
			const response = await page.goto(sample.url, { waitUntil: 'domcontentloaded' });
			const status = response?.status() ?? 0;

			// 2xx is the happy path. 304 from the dev server cache is fine. 4xx /
			// 5xx are real failures: a route regression, a missing seed row, or
			// SSR that crashed.
			expect(status, `${sample.url} returned ${status}`).toBeLessThan(400);

			// Page must render a primary heading -- corpus-specific text checks
			// would couple this spec to the per-page label format. The H1
			// presence + non-empty text is the minimal "the SSR rendered
			// something" pin that catches blank-shell regressions.
			const h1 = page.getByRole('heading', { level: 1 }).first();
			await expect(h1, `H1 missing on ${sample.url}`).toBeVisible({ timeout: 5_000 });
			const headingText = (await h1.textContent())?.trim() ?? '';
			expect(headingText.length, `H1 was empty on ${sample.url}`).toBeGreaterThan(0);
		});
	}
});
