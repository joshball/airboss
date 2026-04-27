/**
 * Tests for the `download-sources` CLI plan + arg parsing. No live network calls.
 *
 * The streaming download path is not exercised here; doing so reliably needs
 * either a fixture HTTP server or the live FAA / eCFR endpoints (flaky). A
 * smoke test that downloads ONE small file is opt-in via `AIRBOSS_E2E_DOWNLOAD=1`
 * (see `bun run download-sources --corpus=ac --dry-run` for the URL plan).
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __download_internal__, runDownloadSources } from './download-sources';

const {
	parseArgs,
	buildPlans,
	buildEcfrUrl,
	currentMonthEdition,
	headRequest,
	latestAmendedOnFor,
	_setCachedTitlesForTest,
	AC_TARGETS,
	ACS_TARGETS,
	AIM_PDF_URL,
	USER_AGENT,
	ECFR_TITLES_URL,
} = __download_internal__;

const FIXED_TITLES = {
	titles: [
		{ number: 14, latest_amended_on: '2026-04-22' },
		{ number: 49, latest_amended_on: '2026-04-20' },
	],
};

let tempRoot: string;

beforeEach(() => {
	tempRoot = mkdtempSync(join(tmpdir(), 'airboss-dl-'));
	_setCachedTitlesForTest(FIXED_TITLES);
});

afterEach(() => {
	rmSync(tempRoot, { recursive: true, force: true });
	_setCachedTitlesForTest(null);
});

describe('parseArgs', () => {
	it('defaults to all corpora, no dry-run, edition date null (auto-detect)', () => {
		const args = parseArgs([]);
		expect(args.dryRun).toBe(false);
		expect(args.forceRefresh).toBe(false);
		expect(args.verify).toBe(false);
		expect(args.includeHandbooksExtras).toBe(false);
		expect(args.corpora.has('regs')).toBe(true);
		expect(args.corpora.has('aim')).toBe(true);
		expect(args.corpora.has('ac')).toBe(true);
		expect(args.corpora.has('acs')).toBe(true);
		expect(args.corpora.has('handbooks')).toBe(true);
		expect(args.editionDate).toBeNull();
	});

	it('honors --corpus= subset', () => {
		const args = parseArgs(['--corpus=regs,ac']);
		expect([...args.corpora].sort()).toEqual(['ac', 'regs']);
	});

	it('rejects unknown corpus', () => {
		expect(() => parseArgs(['--corpus=widgets'])).toThrow(/unknown corpus/);
	});

	it('parses flags', () => {
		const args = parseArgs([
			'--dry-run',
			'--force-refresh',
			'--verbose',
			'--verify',
			'--include-handbooks-extras',
			'--edition-date=2026-01-15',
		]);
		expect(args.dryRun).toBe(true);
		expect(args.forceRefresh).toBe(true);
		expect(args.verbose).toBe(true);
		expect(args.verify).toBe(true);
		expect(args.includeHandbooksExtras).toBe(true);
		expect(args.editionDate).toBe('2026-01-15');
	});

	it('rejects malformed edition date', () => {
		expect(() => parseArgs(['--edition-date=2026/01/01'])).toThrow(/YYYY-MM-DD/);
	});

	it('rejects unknown flags', () => {
		expect(() => parseArgs(['--no-such-flag'])).toThrow(/unknown argument/);
	});
});

describe('buildEcfrUrl', () => {
	it('builds a full-title URL with no part filter', () => {
		const url = buildEcfrUrl({ title: '14', editionDate: '2026-04-22' });
		expect(url).toBe('https://www.ecfr.gov/api/versioner/v1/full/2026-04-22/title-14.xml');
	});

	it('appends ?part= for partial title 49 fetches', () => {
		const url = buildEcfrUrl({
			title: '49',
			editionDate: '2026-04-20',
			partFilter: new Set(['830']),
		});
		expect(url).toBe('https://www.ecfr.gov/api/versioner/v1/full/2026-04-20/title-49.xml?part=830');
	});
});

describe('latestAmendedOnFor', () => {
	it('returns the per-title latest_amended_on', () => {
		expect(latestAmendedOnFor(FIXED_TITLES, '14')).toBe('2026-04-22');
		expect(latestAmendedOnFor(FIXED_TITLES, '49')).toBe('2026-04-20');
	});

	it('throws when title missing', () => {
		expect(() => latestAmendedOnFor({ titles: [] }, '14')).toThrow(/title 14/);
	});
});

describe('buildPlans', () => {
	it('uses auto-detected per-title editions when --edition-date not passed', async () => {
		const args = parseArgs(['--corpus=regs']);
		const plans = await buildPlans(args, tempRoot);
		expect(plans).toHaveLength(3);
		const t14 = plans.find((p) => p.doc === 'cfr-14-full');
		const t49a = plans.find((p) => p.doc === 'cfr-49-parts-830');
		const t49b = plans.find((p) => p.doc === 'cfr-49-parts-1552');
		expect(t14).toBeDefined();
		expect(t49a).toBeDefined();
		expect(t49b).toBeDefined();
		if (t14 === undefined || t49a === undefined || t49b === undefined) return;
		expect(t14.edition).toBe('2026-04-22');
		expect(t14.url).toContain('/2026-04-22/');
		expect(t49a.edition).toBe('2026-04-20');
		expect(t49a.url).toContain('/2026-04-20/');
		expect(t49b.edition).toBe('2026-04-20');
		expect(t49b.url).toContain('/2026-04-20/');
	});

	it('honors --edition-date override for both titles', async () => {
		const args = parseArgs(['--corpus=regs', '--edition-date=2026-04-27']);
		const plans = await buildPlans(args, tempRoot);
		expect(plans).toHaveLength(3);
		for (const p of plans) {
			expect(p.corpus).toBe('regs');
			expect(p.extension).toBe('xml');
			expect(p.url).toContain('ecfr.gov/api/versioner');
			expect(p.url).toContain('/2026-04-27/');
			expect(p.edition).toBe('2026-04-27');
			expect(p.destPath.startsWith(tempRoot)).toBe(true);
			expect(p.writeSourceSymlink).toBe(false);
		}
	});

	it('produces a single aim plan with the canonical URL and descriptive filename', async () => {
		const args = parseArgs(['--corpus=aim']);
		const plans = await buildPlans(args, tempRoot);
		expect(plans).toHaveLength(1);
		const [aim] = plans;
		expect(aim).toBeDefined();
		if (aim === undefined) return;
		expect(aim.corpus).toBe('aim');
		expect(aim.url).toBe(AIM_PDF_URL);
		expect(aim.edition).toBe(currentMonthEdition());
		expect(aim.destPath.endsWith(`aim-${currentMonthEdition()}.pdf`)).toBe(true);
		expect(aim.writeSourceSymlink).toBe(true);
	});

	it('produces one plan per AC target with descriptive filenames', async () => {
		const args = parseArgs(['--corpus=ac']);
		const plans = await buildPlans(args, tempRoot);
		expect(plans).toHaveLength(AC_TARGETS.length);
		expect(plans.every((p) => p.corpus === 'ac' && p.extension === 'pdf')).toBe(true);
		expect(plans.every((p) => p.writeSourceSymlink === true)).toBe(true);
		// Descriptive filename ends with the AC PDF name, not 'source.pdf'.
		expect(plans.every((p) => p.destPath.endsWith('.pdf') && !p.destPath.endsWith('source.pdf'))).toBe(true);
	});

	it('uses verified URLs (no fallbacks)', async () => {
		const args = parseArgs(['--corpus=ac,acs,aim']);
		const plans = await buildPlans(args, tempRoot);
		const urls = plans.map((p) => p.url);
		// Each plan has a single URL, no fallbacks.
		expect(urls).toContain('https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_61-65J.pdf');
		expect(urls).toContain('https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_120-71B.pdf');
		expect(urls).toContain('https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_91.21-1D.pdf');
		expect(urls).toContain('https://www.faa.gov/training_testing/testing/acs/private_airplane_acs_6.pdf');
		expect(urls).toContain('https://www.faa.gov/training_testing/testing/acs/cfi_airplane_acs_25.pdf');
		expect(urls).toContain(AIM_PDF_URL);
		// Old wrong path + fallback patterns are gone.
		expect(urls.every((u) => !u.includes('/training_testing/testing/acs/media/'))).toBe(true);
		expect(urls.every((u) => !u.includes('_change_1.pdf'))).toBe(true);
	});

	it('produces one plan per ACS target', async () => {
		const args = parseArgs(['--corpus=acs']);
		const plans = await buildPlans(args, tempRoot);
		expect(plans).toHaveLength(ACS_TARGETS.length);
		expect(plans.every((p) => p.corpus === 'acs')).toBe(true);
	});

	it('skips handbooks unless --include-handbooks-extras', async () => {
		const without = await buildPlans(parseArgs(['--corpus=handbooks']), tempRoot);
		expect(without).toHaveLength(0);
		const withExtras = await buildPlans(parseArgs(['--corpus=handbooks', '--include-handbooks-extras']), tempRoot);
		expect(withExtras.length).toBeGreaterThan(0);
		expect(withExtras.every((p) => p.corpus === 'handbooks')).toBe(true);
		// Handbooks keep `source.pdf` for compatibility with the existing reader.
		expect(withExtras.every((p) => p.destPath.endsWith('source.pdf'))).toBe(true);
		expect(withExtras.every((p) => p.writeSourceSymlink === false)).toBe(true);
	});
});

describe('User-Agent header', () => {
	it('sends UA on titles fetch, HEAD, and follow-redirects HEAD', async () => {
		_setCachedTitlesForTest(null);
		const seen: string[] = [];
		const fakeFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const headers = new Headers(init?.headers ?? {});
			const ua = headers.get('User-Agent') ?? '';
			seen.push(ua);
			if (String(input) === ECFR_TITLES_URL) {
				return new Response(JSON.stringify(FIXED_TITLES), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			return new Response('', { status: 200, headers: { 'Content-Length': '0' } });
		};

		// Titles fetch via internal accessor -- we test by running buildPlans
		// for regs, which forces a titles fetch when cache is empty.
		const args = parseArgs(['--corpus=regs']);
		// We need to inject the fetch; buildPlans uses globalThis.fetch when no
		// fetchImpl is passed. Patch globalThis.fetch for this test.
		const orig = globalThis.fetch;
		try {
			(globalThis as { fetch: typeof fetch }).fetch = fakeFetch;
			const plans = await buildPlans(args, tempRoot);
			expect(plans.length).toBe(3);
		} finally {
			(globalThis as { fetch: typeof fetch }).fetch = orig;
		}

		// At least one captured UA must be the airboss UA.
		expect(seen.some((u) => u === USER_AGENT)).toBe(true);
	});

	it('headRequest sends UA on the request and any redirect HEADs', async () => {
		const seen: string[] = [];
		const fakeFetch: typeof fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const headers = new Headers(init?.headers ?? {});
			seen.push(headers.get('User-Agent') ?? '');
			return new Response('', {
				status: 200,
				headers: { 'Content-Length': '1234', 'Last-Modified': 'Wed, 22 Apr 2026 12:00:00 GMT' },
			});
		};
		const result = await headRequest('https://example.test/foo.pdf', fakeFetch);
		expect(result.status).toBe(200);
		expect(result.contentLength).toBe(1234);
		expect(result.lastModified).toBe('Wed, 22 Apr 2026 12:00:00 GMT');
		expect(seen.every((u) => u === USER_AGENT)).toBe(true);
	});
});

describe('runDownloadSources -- dry run', () => {
	it('prints plan and returns exit code 0 without touching the network', async () => {
		const originalLog = console.log;
		const originalErr = console.error;
		const lines: string[] = [];
		console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '));
		console.error = (...args: unknown[]) => lines.push(args.map(String).join(' '));
		try {
			const code = await runDownloadSources({
				argv: ['--dry-run', '--corpus=regs,ac', '--edition-date=2026-04-22'],
				cacheRoot: tempRoot,
			});
			expect(code).toBe(0);
			expect(lines.some((l) => l.includes('Dry run'))).toBe(true);
			expect(lines.some((l) => l.includes('regs/cfr-14-full'))).toBe(true);
			expect(lines.some((l) => l.includes('ac/ac-00-6-b'))).toBe(true);
		} finally {
			console.log = originalLog;
			console.error = originalErr;
		}
	});

	it('reports help and returns 0 on --help', async () => {
		const originalLog = console.log;
		const captured: string[] = [];
		console.log = (...args: unknown[]) => captured.push(args.map(String).join(' '));
		try {
			const code = await runDownloadSources({ argv: ['--help'], cacheRoot: tempRoot });
			expect(code).toBe(0);
			expect(captured.some((l) => l.includes('one-shot source-corpus downloader'))).toBe(true);
		} finally {
			console.log = originalLog;
		}
	});

	it('returns 2 on argument parse errors', async () => {
		const originalErr = console.error;
		const captured: string[] = [];
		console.error = (...args: unknown[]) => captured.push(args.map(String).join(' '));
		try {
			const code = await runDownloadSources({
				argv: ['--corpus=widgets'],
				cacheRoot: tempRoot,
			});
			expect(code).toBe(2);
			expect(captured.some((l) => l.includes('unknown corpus'))).toBe(true);
		} finally {
			console.error = originalErr;
		}
	});
});

describe('runDownloadSources -- verify mode', () => {
	it('runs HEAD against every URL and returns 0 when all 200', async () => {
		const seen: { url: string; method: string }[] = [];
		const fakeFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const url = String(input);
			const method = init?.method ?? 'GET';
			seen.push({ url, method });
			return new Response('', {
				status: 200,
				headers: { 'Content-Length': '4096', 'Last-Modified': 'Mon, 21 Apr 2026 12:00:00 GMT' },
			});
		};
		const orig = globalThis.fetch;
		const originalLog = console.log;
		const captured: string[] = [];
		console.log = (...a: unknown[]) => captured.push(a.map(String).join(' '));
		try {
			(globalThis as { fetch: typeof fetch }).fetch = fakeFetch;
			const code = await runDownloadSources({
				argv: ['--verify', '--corpus=ac', '--edition-date=2026-04-22'],
				cacheRoot: tempRoot,
			});
			expect(code).toBe(0);
			expect(captured.some((l) => l.includes('URL verification'))).toBe(true);
			expect(captured.some((l) => l.includes('URLs OK'))).toBe(true);
			expect(seen.every((s) => s.method === 'HEAD')).toBe(true);
		} finally {
			(globalThis as { fetch: typeof fetch }).fetch = orig;
			console.log = originalLog;
		}
	});

	it('returns 1 when any URL is non-2xx', async () => {
		const fakeFetch: typeof fetch = async (input: RequestInfo | URL): Promise<Response> => {
			const url = String(input);
			if (url.includes('AC_91-79A')) return new Response('', { status: 404 });
			return new Response('', { status: 200, headers: { 'Content-Length': '4096' } });
		};
		const orig = globalThis.fetch;
		const originalLog = console.log;
		console.log = () => {};
		try {
			(globalThis as { fetch: typeof fetch }).fetch = fakeFetch;
			const code = await runDownloadSources({
				argv: ['--verify', '--corpus=ac', '--edition-date=2026-04-22'],
				cacheRoot: tempRoot,
			});
			expect(code).toBe(1);
		} finally {
			(globalThis as { fetch: typeof fetch }).fetch = orig;
			console.log = originalLog;
		}
	});
});

describe('manifest skip behavior (HEAD-then-skip)', () => {
	it('skips a plan when HEAD content-length matches manifest size and last-modified has not advanced', async () => {
		const args = parseArgs(['--corpus=ac', '--edition-date=2026-04-22']);
		const plans = await buildPlans(args, tempRoot);

		// Pre-cache every AC target so no real fetch is needed for downloads.
		for (const plan of plans) {
			const dir = join(tempRoot, plan.corpus, plan.doc, plan.edition);
			mkdirSync(dir, { recursive: true });
			const filename = plan.destPath.split('/').pop() ?? 'source.pdf';
			const bytes = Buffer.from(`cached ${plan.doc}`);
			writeFileSync(join(dir, filename), bytes);
			writeFileSync(
				join(dir, 'manifest.json'),
				JSON.stringify({
					corpus: plan.corpus,
					doc: plan.doc,
					edition: plan.edition,
					source_url: plan.url,
					source_filename: filename,
					source_sha256: 'deadbeef',
					size_bytes: bytes.byteLength,
					fetched_at: '2026-04-20T00:00:00Z',
					last_modified: 'Mon, 20 Apr 2026 12:00:00 GMT',
					schema_version: 1,
				}),
			);
		}

		// Fake fetch returns HEAD with matching content-length and same last-modified.
		const fakeFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const method = init?.method ?? 'GET';
			if (method !== 'HEAD') {
				throw new Error(`unexpected non-HEAD request to ${String(input)} -- cache should have hit`);
			}
			// Determine which plan this URL belongs to to set the right content-length.
			const plan = plans.find((p) => p.url === String(input));
			const size = plan === undefined ? 0 : Buffer.from(`cached ${plan.doc}`).byteLength;
			return new Response('', {
				status: 200,
				headers: {
					'Content-Length': String(size),
					'Last-Modified': 'Mon, 20 Apr 2026 12:00:00 GMT',
				},
			});
		};

		const orig = globalThis.fetch;
		const originalLog = console.log;
		const originalErr = console.error;
		const captured: string[] = [];
		console.log = (...a: unknown[]) => captured.push(a.map(String).join(' '));
		console.error = (...a: unknown[]) => captured.push(a.map(String).join(' '));
		try {
			(globalThis as { fetch: typeof fetch }).fetch = fakeFetch;
			const code = await runDownloadSources({
				argv: ['--corpus=ac', '--verbose', '--edition-date=2026-04-22'],
				cacheRoot: tempRoot,
			});
			expect(code).toBe(0);
			expect(captured.some((l) => l.includes('skip (cached'))).toBe(true);
		} finally {
			(globalThis as { fetch: typeof fetch }).fetch = orig;
			console.log = originalLog;
			console.error = originalErr;
		}
	});

	it('refetches when HEAD content-length disagrees with cache', async () => {
		const args = parseArgs(['--corpus=ac', '--edition-date=2026-04-22']);
		const plans = await buildPlans(args, tempRoot);

		// Pre-cache only the first AC plan with stale size.
		const [first] = plans;
		expect(first).toBeDefined();
		if (first === undefined) return;
		const firstDir = join(tempRoot, first.corpus, first.doc, first.edition);
		mkdirSync(firstDir, { recursive: true });
		const filename = first.destPath.split('/').pop() ?? 'source.pdf';
		writeFileSync(join(firstDir, filename), Buffer.from('old'));
		writeFileSync(
			join(firstDir, 'manifest.json'),
			JSON.stringify({
				corpus: first.corpus,
				doc: first.doc,
				edition: first.edition,
				source_url: first.url,
				source_filename: filename,
				source_sha256: 'old',
				size_bytes: 3,
				fetched_at: '2026-01-01T00:00:00Z',
				last_modified: 'Wed, 01 Jan 2026 00:00:00 GMT',
				schema_version: 1,
			}),
		);

		// Fake fetch returns content-length=3 for HEAD of cached plans (would be a hit),
		// but the manifest says 3 -- so test the *opposite*: HEAD returns DIFFERENT
		// content-length (5) which forces refetch. The download then succeeds with 5 bytes.
		const fakeFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const method = init?.method ?? 'GET';
			if (String(input) === first.url) {
				if (method === 'HEAD') {
					return new Response('', {
						status: 200,
						headers: { 'Content-Length': '5', 'Last-Modified': 'Wed, 22 Apr 2026 12:00:00 GMT' },
					});
				}
				return new Response('NEWER', {
					status: 200,
					headers: { 'Content-Length': '5', 'Last-Modified': 'Wed, 22 Apr 2026 12:00:00 GMT' },
				});
			}
			// All other AC plans -- fail HEAD so they don't try to download; we
			// only care about asserting the first one refetched.
			return new Response('', { status: 404 });
		};

		const orig = globalThis.fetch;
		const originalLog = console.log;
		const originalErr = console.error;
		const captured: string[] = [];
		console.log = (...a: unknown[]) => captured.push(a.map(String).join(' '));
		console.error = (...a: unknown[]) => captured.push(a.map(String).join(' '));
		try {
			(globalThis as { fetch: typeof fetch }).fetch = fakeFetch;
			await runDownloadSources({
				argv: ['--corpus=ac', '--verbose', '--edition-date=2026-04-22'],
				cacheRoot: tempRoot,
			});
			expect(captured.some((l) => l.includes(`refetch ${first.corpus}/${first.doc}`))).toBe(true);
		} finally {
			(globalThis as { fetch: typeof fetch }).fetch = orig;
			console.log = originalLog;
			console.error = originalErr;
		}
	});
});
