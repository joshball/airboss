/**
 * End-to-end-ish tests for `runDiscoverErrata`.
 *
 * Network is stubbed via injected fetch + injected Python meta reader.
 * Each test exercises the full pipeline: scrape -> merge -> persist ->
 * pending markdown -> last-run sentinel. GitHub creation is gated on
 * `GH_TOKEN` and verified by absence (no token -> no API attempt).
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DISCOVERY_CACHE, DISCOVERY_STATUSES } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ALL_HANDBOOK_SLUGS, getCatalogueEntry } from './catalogue';
import { runDiscoverErrata } from './run';
import { loadState } from './state';

const AFH_HTML = `<html><body>
  <a href="/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf">AFH MOSAIC</a>
</body></html>`;

function fetchStub(htmlByHost: Map<string, string>): typeof fetch {
	return (async (input: string | URL | Request) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		const html = htmlByHost.get(url);
		if (html === undefined) {
			return new Response('not found', { status: 404 });
		}
		return new Response(html, {
			status: 200,
			headers: { 'Content-Type': 'text/html' },
		});
	}) as typeof fetch;
}

describe('runDiscoverErrata', () => {
	let cacheRoot: string;
	const log: string[] = [];
	const logger = (line: string) => log.push(line);

	beforeEach(() => {
		cacheRoot = mkdtempSync(join(tmpdir(), 'airboss-discover-run-'));
		log.length = 0;
	});
	afterEach(() => {
		rmSync(cacheRoot, { recursive: true, force: true });
	});

	it('scrapes AFH, persists state, writes the pending report and last-run sentinel', async () => {
		const afh = getCatalogueEntry('afh');
		if (afh === undefined) throw new Error('catalogue missing afh');
		const fetchImpl = fetchStub(new Map([[afh.parentPageUrl, AFH_HTML]]));
		const code = await runDiscoverErrata({
			argv: ['--doc=afh'],
			cacheRoot,
			fetchImpl,
			readMeta: async () => [
				{
					slug: 'afh',
					hasPlugin: true,
					hasYaml: true,
					discoveryUrl: afh.parentPageUrl,
					linkPatterns: [],
					applied: [],
					dismissed: [],
				},
			],
			now: () => new Date('2026-04-28T00:00:00Z'),
			env: {},
			logger,
		});
		// New candidate -> exit code 2 per design.
		expect(code).toBe(2);
		const state = loadState(cacheRoot, 'afh');
		expect(state).not.toBeNull();
		expect(state?.candidates).toHaveLength(1);
		expect(state?.candidates[0]?.status).toBe(DISCOVERY_STATUSES.CANDIDATE);

		const pendingPath = join(cacheRoot, DISCOVERY_CACHE.PENDING_REPORT_FILE);
		const pending = readFileSync(pendingPath, 'utf8');
		expect(pending).toContain('AFH_Addendum_(MOSAIC).pdf');

		const lastRunPath = join(cacheRoot, DISCOVERY_CACHE.LAST_RUN_FILE);
		const lastRun = JSON.parse(readFileSync(lastRunPath, 'utf8'));
		expect(lastRun.handbooks_scanned).toBe(1);
		expect(lastRun.candidates_found).toBe(1);
	});

	it('marks an applied URL as applied via Python meta', async () => {
		const afh = getCatalogueEntry('afh');
		if (afh === undefined) throw new Error('catalogue missing afh');
		const fetchImpl = fetchStub(new Map([[afh.parentPageUrl, AFH_HTML]]));
		const url = 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf';
		const code = await runDiscoverErrata({
			argv: ['--doc=afh'],
			cacheRoot,
			fetchImpl,
			readMeta: async () => [
				{
					slug: 'afh',
					hasPlugin: true,
					hasYaml: true,
					discoveryUrl: afh.parentPageUrl,
					linkPatterns: [],
					applied: [{ url, errataId: 'mosaic' }],
					dismissed: [],
				},
			],
			now: () => new Date('2026-04-28T00:00:00Z'),
			env: {},
			logger,
		});
		// Applied (not new) -> exit 0; an `applied` candidate is not "new".
		expect(code).toBe(0);
		const state = loadState(cacheRoot, 'afh');
		expect(state?.candidates[0]?.status).toBe(DISCOVERY_STATUSES.APPLIED);
		expect(state?.candidates[0]?.errataId).toBe('mosaic');
	});

	it('honors a dismissed URL across the run', async () => {
		const afh = getCatalogueEntry('afh');
		if (afh === undefined) throw new Error('catalogue missing afh');
		const fetchImpl = fetchStub(new Map([[afh.parentPageUrl, AFH_HTML]]));
		const url = 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf';
		const code = await runDiscoverErrata({
			argv: ['--doc=afh'],
			cacheRoot,
			fetchImpl,
			readMeta: async () => [
				{
					slug: 'afh',
					hasPlugin: true,
					hasYaml: true,
					discoveryUrl: afh.parentPageUrl,
					linkPatterns: [],
					applied: [],
					dismissed: [{ url, sha256: null, reason: 'duplicate' }],
				},
			],
			now: () => new Date('2026-04-28T00:00:00Z'),
			env: {},
			logger,
		});
		// Dismissed -> exit 0 (not a new candidate).
		expect(code).toBe(0);
		const state = loadState(cacheRoot, 'afh');
		expect(state?.candidates[0]?.status).toBe(DISCOVERY_STATUSES.DISMISSED);
	});

	it('skips when freshness gate is satisfied', async () => {
		const afh = getCatalogueEntry('afh');
		if (afh === undefined) throw new Error('catalogue missing afh');
		const fetchImpl = fetchStub(new Map([[afh.parentPageUrl, AFH_HTML]]));
		// Seed last-run as fresh.
		const recentNow = '2026-04-28T00:00:00Z';
		await runDiscoverErrata({
			argv: ['--doc=afh', '--force'],
			cacheRoot,
			fetchImpl,
			readMeta: async () => [
				{
					slug: 'afh',
					hasPlugin: true,
					hasYaml: true,
					discoveryUrl: afh.parentPageUrl,
					linkPatterns: [],
					applied: [],
					dismissed: [],
				},
			],
			now: () => new Date(recentNow),
			env: {},
			logger,
		});
		log.length = 0;
		const code = await runDiscoverErrata({
			argv: ['--doc=afh'],
			cacheRoot,
			fetchImpl: () => {
				throw new Error('fetch should not be called when fresh');
			},
			readMeta: async () => {
				throw new Error('meta should not be read when fresh');
			},
			now: () => new Date('2026-04-28T01:00:00Z'),
			env: {},
			logger,
		});
		expect(code).toBe(0);
		expect(log.some((l) => l.includes('skipped'))).toBe(true);
	});

	it('--force bypasses the freshness gate', async () => {
		const afh = getCatalogueEntry('afh');
		if (afh === undefined) throw new Error('catalogue missing afh');
		const fetchImpl = fetchStub(new Map([[afh.parentPageUrl, AFH_HTML]]));
		// Seed last-run.
		await runDiscoverErrata({
			argv: ['--doc=afh', '--force'],
			cacheRoot,
			fetchImpl,
			readMeta: async () => [
				{
					slug: 'afh',
					hasPlugin: true,
					hasYaml: true,
					discoveryUrl: afh.parentPageUrl,
					linkPatterns: [],
					applied: [],
					dismissed: [],
				},
			],
			now: () => new Date('2026-04-28T00:00:00Z'),
			env: {},
			logger,
		});
		// Re-run with --force inside the freshness window: scrape happens.
		let scraped = false;
		const fetchImplCounting = (async (input: string | URL | Request) => {
			scraped = true;
			const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
			return new Response(url === afh.parentPageUrl ? AFH_HTML : '', {
				status: 200,
				headers: { 'Content-Type': 'text/html' },
			});
		}) as typeof fetch;
		await runDiscoverErrata({
			argv: ['--doc=afh', '--force'],
			cacheRoot,
			fetchImpl: fetchImplCounting,
			readMeta: async () => [
				{
					slug: 'afh',
					hasPlugin: true,
					hasYaml: true,
					discoveryUrl: afh.parentPageUrl,
					linkPatterns: [],
					applied: [],
					dismissed: [],
				},
			],
			now: () => new Date('2026-04-28T01:00:00Z'),
			env: {},
			logger,
		});
		expect(scraped).toBe(true);
	});

	it('scans every catalogued slug when --doc is omitted', async () => {
		// Stub returns the same simple page for every catalogue parent; we
		// just count how many distinct URLs got scraped.
		const visited = new Set<string>();
		const fetchImpl = (async (input: string | URL | Request) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
			visited.add(url);
			return new Response('<html><body></body></html>', {
				status: 200,
				headers: { 'Content-Type': 'text/html' },
			});
		}) as typeof fetch;
		const code = await runDiscoverErrata({
			argv: [],
			cacheRoot,
			fetchImpl,
			readMeta: async () =>
				ALL_HANDBOOK_SLUGS.map((slug) => ({
					slug,
					hasPlugin: false,
					hasYaml: false,
					discoveryUrl: null,
					linkPatterns: [],
					applied: [],
					dismissed: [],
				})),
			now: () => new Date('2026-04-28T00:00:00Z'),
			env: {},
			logger,
		});
		expect(code).toBe(0);
		// Empty page -> no candidates.
		const lastRun = JSON.parse(readFileSync(join(cacheRoot, DISCOVERY_CACHE.LAST_RUN_FILE), 'utf8'));
		expect(lastRun.handbooks_scanned).toBe(ALL_HANDBOOK_SLUGS.length);
		expect(visited.size).toBeGreaterThanOrEqual(ALL_HANDBOOK_SLUGS.length);
	});

	it('does not attempt the GitHub API when GH_TOKEN is unset', async () => {
		const afh = getCatalogueEntry('afh');
		if (afh === undefined) throw new Error('catalogue missing afh');
		const fetchImpl = fetchStub(new Map([[afh.parentPageUrl, AFH_HTML]]));
		await runDiscoverErrata({
			argv: ['--doc=afh'],
			cacheRoot,
			fetchImpl,
			readMeta: async () => [
				{
					slug: 'afh',
					hasPlugin: true,
					hasYaml: true,
					discoveryUrl: afh.parentPageUrl,
					linkPatterns: [],
					applied: [],
					dismissed: [],
				},
			],
			now: () => new Date('2026-04-28T00:00:00Z'),
			env: {},
			logger,
		});
		// The orchestrator logs an explicit "GH_TOKEN not set" message; if the
		// banner ever shells `gh`, this is the canary.
		expect(log.some((l) => l.includes('GH_TOKEN not set'))).toBe(true);
	});
});
