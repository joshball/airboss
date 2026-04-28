/**
 * Unit tests for the `bun run sources discover-errata` modules.
 *
 * Covers:
 *   - Catalogue invariants (17 handbooks, every entry has the required fields)
 *   - Argument parser
 *   - HTML scrape fixture (the FAA's actual AFH and PHAK markup, frozen at
 *     2026-04-28 -- see fixtures dir)
 *   - State merge: candidate -> applied / dismissed / withdrawn transitions
 *   - Freshness gate
 *   - Pending markdown report shape
 *   - GitHub issue body shape
 *
 * Network is never touched. Every test injects either a fixture HTML body
 * or a stub fetch implementation.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	DISCOVERY_CACHE,
	DISCOVERY_FRESHNESS_MS,
	DISCOVERY_GITHUB_LABEL,
	DISCOVERY_LAYOUT_HINTS,
	DISCOVERY_STATUSES,
	DISCOVERY_TIERS,
} from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	ALL_HANDBOOK_SLUGS,
	classifyLayout,
	emptyState,
	extractFindings,
	getCatalogueEntry,
	HANDBOOK_CATALOGUE,
	type HandbookCatalogueEntry,
	isStale,
	loadState,
	mergeScrapeResult,
	parseDiscoverArgs,
	pendingReportPath,
	readLastRun,
	renderIssueBody,
	renderPendingReport,
	type ScrapeFinding,
	saveState,
	stateFilePath,
	writeLastRun,
	writePendingReport,
} from './index';

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

describe('HANDBOOK_CATALOGUE', () => {
	it('contains exactly 17 entries', () => {
		expect(HANDBOOK_CATALOGUE.length).toBe(17);
		expect(ALL_HANDBOOK_SLUGS.length).toBe(17);
	});

	it('every entry has a unique slug', () => {
		const slugs = HANDBOOK_CATALOGUE.map((e) => e.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});

	it('every entry uses an HTTPS parent page', () => {
		for (const entry of HANDBOOK_CATALOGUE) {
			expect(entry.parentPageUrl.startsWith('https://')).toBe(true);
		}
	});

	it('flags the three ingested handbooks as actionable', () => {
		const actionable = HANDBOOK_CATALOGUE.filter((e) => e.tier === DISCOVERY_TIERS.ACTIONABLE);
		expect(actionable.map((e) => e.slug).sort()).toEqual(['afh', 'avwx', 'phak']);
	});

	it('every entry has at least one filename token', () => {
		for (const entry of HANDBOOK_CATALOGUE) {
			expect(entry.filenameTokens.length).toBeGreaterThan(0);
		}
	});

	it('getCatalogueEntry returns the matching entry or undefined', () => {
		expect(getCatalogueEntry('phak')?.slug).toBe('phak');
		expect(getCatalogueEntry('does-not-exist')).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

describe('parseDiscoverArgs', () => {
	it('defaults to scanning every catalogued slug', () => {
		const args = parseDiscoverArgs([]);
		expect(args.slugs).toEqual([]);
		expect(args.force).toBe(false);
		expect(args.dryRun).toBe(false);
	});

	it('parses --doc with comma-separated slugs', () => {
		const args = parseDiscoverArgs(['--doc=phak,afh']);
		expect(args.slugs).toEqual(['phak', 'afh']);
	});

	it('rejects unknown slugs with a typed error', () => {
		expect(() => parseDiscoverArgs(['--doc=unknown'])).toThrow(/unknown handbook slug/);
	});

	it('parses --force and --dry-run', () => {
		const args = parseDiscoverArgs(['--force', '--dry-run']);
		expect(args.force).toBe(true);
		expect(args.dryRun).toBe(true);
	});

	it('parses --cache-root override', () => {
		const args = parseDiscoverArgs(['--cache-root=/tmp/x']);
		expect(args.cacheRoot).toBe('/tmp/x');
	});

	it('rejects unknown flags', () => {
		expect(() => parseDiscoverArgs(['--what'])).toThrow(/unknown option/);
	});
});

// ---------------------------------------------------------------------------
// Scrape (pure HTML extractor, no network)
// ---------------------------------------------------------------------------

const AFH_FIXTURE_HTML = `
<html>
<body>
  <h1>Airplane Flying Handbook</h1>
  <p>The full handbook PDF is available below.</p>
  <ul>
    <li><a href="/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/00_afh_full.pdf">Airplane Flying Handbook</a></li>
    <li><a href="/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf">AFH MOSAIC Addendum (October 2025)</a></li>
    <li><a href="/regulations_policies/handbooks_manuals/aviation/AFH_Errata_2014.pdf">AFH 2014 Errata</a></li>
    <li><a href="/regulations_policies/handbooks_manuals/aviation/AFH_changes_3C.pdf">AFH Summary of Changes for 3C</a></li>
    <!-- An AFH-named PDF that is not an errata-shape: bound edition. Should NOT be flagged. -->
    <li><a href="/regulations_policies/handbooks_manuals/aviation/AFH_Cover.pdf">AFH Cover</a></li>
    <!-- A different handbook's addendum should NOT match the AFH page. -->
    <li><a href="/regulations_policies/handbooks_manuals/aviation/PHAK_Addendum_(MOSAIC).pdf">PHAK Addendum</a></li>
  </ul>
</body>
</html>
`;

describe('extractFindings (AFH parent page fixture)', () => {
	const afh = HANDBOOK_CATALOGUE.find((e) => e.slug === 'afh');
	if (afh === undefined) throw new Error('AFH catalogue entry missing');

	const findings = extractFindings(AFH_FIXTURE_HTML, afh, afh.parentPageUrl);
	const urls = findings.map((f) => f.url);

	it('extracts the MOSAIC addendum', () => {
		expect(urls).toContain(
			'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf',
		);
	});

	it('extracts the 2014 errata', () => {
		expect(urls).toContain('https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Errata_2014.pdf');
	});

	it('extracts the summary-of-changes PDF', () => {
		expect(urls).toContain('https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_changes_3C.pdf');
	});

	it('does not flag the bound-edition cover PDF', () => {
		expect(urls).not.toContain('https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Cover.pdf');
	});

	it('does not flag a sibling-handbook addendum', () => {
		expect(urls).not.toContain(
			'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/PHAK_Addendum_(MOSAIC).pdf',
		);
	});

	it('classifies layout hints by filename heuristic', () => {
		const byUrl = new Map(findings.map((f) => [f.url, f.layoutHint] as const));
		expect(
			byUrl.get('https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf'),
		).toBe(DISCOVERY_LAYOUT_HINTS.ADDENDUM);
		expect(byUrl.get('https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Errata_2014.pdf')).toBe(
			DISCOVERY_LAYOUT_HINTS.ERRATA,
		);
		expect(byUrl.get('https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_changes_3C.pdf')).toBe(
			DISCOVERY_LAYOUT_HINTS.CHANGE,
		);
	});
});

describe('classifyLayout', () => {
	it('returns errata when the filename mentions errata', () => {
		expect(classifyLayout('phak_errata.pdf')).toBe(DISCOVERY_LAYOUT_HINTS.ERRATA);
	});
	it('returns addendum for *addendum*.pdf', () => {
		expect(classifyLayout('phak_addendum_a.pdf')).toBe(DISCOVERY_LAYOUT_HINTS.ADDENDUM);
	});
	it('returns summary_of_changes when present', () => {
		expect(classifyLayout('faa-h-8083-16b-3_summary_of_changes.pdf')).toBe(DISCOVERY_LAYOUT_HINTS.SUMMARY_OF_CHANGES);
	});
	it('falls back to unknown when no token matches', () => {
		expect(classifyLayout('some_other.pdf')).toBe(DISCOVERY_LAYOUT_HINTS.UNKNOWN);
	});
});

// ---------------------------------------------------------------------------
// State + merge
// ---------------------------------------------------------------------------

function entryFor(slug: string): HandbookCatalogueEntry {
	const entry = getCatalogueEntry(slug);
	if (entry === undefined) throw new Error(`catalogue missing ${slug}`);
	return entry;
}

describe('mergeScrapeResult', () => {
	const afh = entryFor('afh');
	const baseFinding: ScrapeFinding = {
		url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf',
		layoutHint: DISCOVERY_LAYOUT_HINTS.ADDENDUM,
	};

	it('adds an unseen URL as a candidate', () => {
		const prior = emptyState({
			slug: afh.slug,
			title: afh.title,
			parentPageUrl: afh.parentPageUrl,
			tier: afh.tier,
		});
		const next = mergeScrapeResult(prior, [baseFinding], {
			now: '2026-04-28T00:00:00Z',
			tier: afh.tier,
			dismissedUrls: new Set(),
			appliedUrlsToId: new Map(),
		});
		expect(next.candidates).toHaveLength(1);
		expect(next.candidates[0]?.status).toBe(DISCOVERY_STATUSES.CANDIDATE);
		expect(next.candidates[0]?.firstSeenAt).toBe('2026-04-28T00:00:00Z');
	});

	it('preserves first_seen_at on re-scan', () => {
		const prior = mergeScrapeResult(
			emptyState({ slug: afh.slug, title: afh.title, parentPageUrl: afh.parentPageUrl, tier: afh.tier }),
			[baseFinding],
			{
				now: '2026-04-01T00:00:00Z',
				tier: afh.tier,
				dismissedUrls: new Set(),
				appliedUrlsToId: new Map(),
			},
		);
		const next = mergeScrapeResult(prior, [baseFinding], {
			now: '2026-04-28T00:00:00Z',
			tier: afh.tier,
			dismissedUrls: new Set(),
			appliedUrlsToId: new Map(),
		});
		expect(next.candidates[0]?.firstSeenAt).toBe('2026-04-01T00:00:00Z');
		expect(next.candidates[0]?.lastSeenAt).toBe('2026-04-28T00:00:00Z');
	});

	it('marks a dismissed URL as dismissed and keeps it dismissed across re-runs', () => {
		const prior = emptyState({
			slug: afh.slug,
			title: afh.title,
			parentPageUrl: afh.parentPageUrl,
			tier: afh.tier,
		});
		const dismissedUrls = new Set([baseFinding.url]);
		const first = mergeScrapeResult(prior, [baseFinding], {
			now: '2026-04-28T00:00:00Z',
			tier: afh.tier,
			dismissedUrls,
			appliedUrlsToId: new Map(),
		});
		expect(first.candidates[0]?.status).toBe(DISCOVERY_STATUSES.DISMISSED);

		const second = mergeScrapeResult(first, [baseFinding], {
			now: '2026-05-01T00:00:00Z',
			tier: afh.tier,
			dismissedUrls,
			appliedUrlsToId: new Map(),
		});
		expect(second.candidates[0]?.status).toBe(DISCOVERY_STATUSES.DISMISSED);
	});

	it('marks an applied URL as applied and stamps the errata id', () => {
		const prior = emptyState({
			slug: afh.slug,
			title: afh.title,
			parentPageUrl: afh.parentPageUrl,
			tier: afh.tier,
		});
		const appliedUrlsToId = new Map([[baseFinding.url, 'mosaic']]);
		const next = mergeScrapeResult(prior, [baseFinding], {
			now: '2026-04-28T00:00:00Z',
			tier: afh.tier,
			dismissedUrls: new Set(),
			appliedUrlsToId,
		});
		expect(next.candidates[0]?.status).toBe(DISCOVERY_STATUSES.APPLIED);
		expect(next.candidates[0]?.errataId).toBe('mosaic');
	});

	it('marks a known URL withdrawn when it disappears from the page', () => {
		const seeded = mergeScrapeResult(
			emptyState({ slug: afh.slug, title: afh.title, parentPageUrl: afh.parentPageUrl, tier: afh.tier }),
			[baseFinding],
			{
				now: '2026-04-01T00:00:00Z',
				tier: afh.tier,
				dismissedUrls: new Set(),
				appliedUrlsToId: new Map(),
			},
		);
		const next = mergeScrapeResult(seeded, [], {
			now: '2026-04-28T00:00:00Z',
			tier: afh.tier,
			dismissedUrls: new Set(),
			appliedUrlsToId: new Map(),
		});
		expect(next.candidates[0]?.status).toBe(DISCOVERY_STATUSES.WITHDRAWN);
		expect(next.candidates[0]?.withdrawnAt).toBe('2026-04-28T00:00:00Z');
	});
});

// ---------------------------------------------------------------------------
// State persistence (round-trip)
// ---------------------------------------------------------------------------

describe('saveState / loadState', () => {
	let cacheRoot: string;
	beforeEach(() => {
		cacheRoot = mkdtempSync(join(tmpdir(), 'airboss-discover-state-'));
	});
	afterEach(() => {
		rmSync(cacheRoot, { recursive: true, force: true });
	});

	it('writes and re-reads a state file with stable ordering', () => {
		const afh = entryFor('afh');
		const state = mergeScrapeResult(
			emptyState({ slug: afh.slug, title: afh.title, parentPageUrl: afh.parentPageUrl, tier: afh.tier }),
			[
				{
					url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf',
					layoutHint: DISCOVERY_LAYOUT_HINTS.ADDENDUM,
				},
			],
			{
				now: '2026-04-28T00:00:00Z',
				tier: afh.tier,
				dismissedUrls: new Set(),
				appliedUrlsToId: new Map(),
			},
		);
		saveState(cacheRoot, state);
		const reloaded = loadState(cacheRoot, 'afh');
		expect(reloaded).not.toBeNull();
		expect(reloaded?.candidates).toHaveLength(1);
		expect(reloaded?.candidates[0]?.url).toBe(state.candidates[0]?.url);
	});

	it('returns null when no state file exists', () => {
		expect(loadState(cacheRoot, 'phak')).toBeNull();
	});

	it('produces a path under <cache>/discovery/handbooks/<slug>.json', () => {
		const path = stateFilePath(cacheRoot, 'phak');
		expect(path.endsWith('discovery/handbooks/phak.json')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Freshness gate
// ---------------------------------------------------------------------------

describe('freshness gate', () => {
	let cacheRoot: string;
	beforeEach(() => {
		cacheRoot = mkdtempSync(join(tmpdir(), 'airboss-discover-fresh-'));
	});
	afterEach(() => {
		rmSync(cacheRoot, { recursive: true, force: true });
	});

	it('treats a missing sentinel as stale', () => {
		expect(isStale(cacheRoot)).toBe(true);
	});

	it('treats a sentinel inside the window as fresh', () => {
		writeLastRun(cacheRoot, {
			ranAt: new Date('2026-04-28T00:00:00Z').toISOString(),
			handbooksScanned: 17,
			candidatesFound: 0,
		});
		const now = Date.parse('2026-04-28T01:00:00Z');
		expect(isStale(cacheRoot, { now })).toBe(false);
	});

	it('treats a sentinel older than the window as stale', () => {
		writeLastRun(cacheRoot, {
			ranAt: '2026-04-01T00:00:00Z',
			handbooksScanned: 17,
			candidatesFound: 0,
		});
		const now = Date.parse('2026-04-28T00:00:00Z');
		expect(isStale(cacheRoot, { now })).toBe(true);
	});

	it('round-trips writeLastRun + readLastRun', () => {
		const now = '2026-04-28T00:00:00Z';
		writeLastRun(cacheRoot, { ranAt: now, handbooksScanned: 17, candidatesFound: 3 });
		const back = readLastRun(cacheRoot);
		expect(back?.ranAt).toBe(now);
		expect(back?.candidatesFound).toBe(3);
	});

	it('uses the freshness window constant', () => {
		// Sanity: the window constant is in days, not minutes (a regression here
		// would silently turn discovery into either always-on or never-on).
		expect(DISCOVERY_FRESHNESS_MS).toBe(7 * 24 * 60 * 60 * 1000);
	});
});

// ---------------------------------------------------------------------------
// Pending markdown
// ---------------------------------------------------------------------------

describe('renderPendingReport', () => {
	const afh = entryFor('afh');

	it('emits an empty-state message when no sections have unreviewed candidates', () => {
		const out = renderPendingReport([]);
		expect(out).toContain('No unreviewed candidates');
	});

	it('emits a section per handbook with one heading per candidate', () => {
		const state = mergeScrapeResult(
			emptyState({ slug: afh.slug, title: afh.title, parentPageUrl: afh.parentPageUrl, tier: afh.tier }),
			[
				{
					url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf',
					layoutHint: DISCOVERY_LAYOUT_HINTS.ADDENDUM,
				},
			],
			{
				now: '2026-04-28T00:00:00Z',
				tier: afh.tier,
				dismissedUrls: new Set(),
				appliedUrlsToId: new Map(),
			},
		);
		const out = renderPendingReport([{ entry: afh, state }]);
		expect(out).toContain(`## ${afh.title}`);
		expect(out).toContain('### addendum candidate');
		expect(out).toContain('drs.faa.gov/browse/?q=');
	});

	it('writePendingReport persists under <cache>/discovery/_pending.md', () => {
		const cacheRoot = mkdtempSync(join(tmpdir(), 'airboss-discover-pend-'));
		try {
			writePendingReport(cacheRoot, []);
			const path = pendingReportPath(cacheRoot);
			const out = readFileSync(path, 'utf8');
			expect(out).toContain('No unreviewed candidates');
			expect(path.endsWith(DISCOVERY_CACHE.PENDING_REPORT_FILE)).toBe(true);
		} finally {
			rmSync(cacheRoot, { recursive: true, force: true });
		}
	});
});

// ---------------------------------------------------------------------------
// Issue body
// ---------------------------------------------------------------------------

describe('renderIssueBody', () => {
	const afh = entryFor('afh');
	const candidate = {
		url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf',
		firstSeenAt: '2026-04-28T00:00:00Z',
		lastSeenAt: '2026-04-28T00:00:00Z',
		tier: DISCOVERY_TIERS.ACTIONABLE,
		layoutHint: DISCOVERY_LAYOUT_HINTS.ADDENDUM,
		status: DISCOVERY_STATUSES.CANDIDATE,
	};
	const body = renderIssueBody({ entry: afh, candidate });

	it('mentions the handbook + edition', () => {
		expect(body).toContain(afh.title);
		expect(body).toContain(afh.currentEdition);
	});

	it('includes the source URL and DRS sanity-check link', () => {
		expect(body).toContain(candidate.url);
		expect(body).toContain('drs.faa.gov/browse/?q=');
	});

	it('describes the tier semantics for the human reviewer', () => {
		expect(body).toContain('apply path exists');
	});

	it('points the reviewer at the apply / dismiss YAML edits', () => {
		expect(body).toContain('errata:');
		expect(body).toContain('dismissed_errata:');
	});

	it('mentions the GitHub label', () => {
		expect(DISCOVERY_GITHUB_LABEL).toBe('errata');
	});
});
