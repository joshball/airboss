/**
 * Tests for the `download-sources` CLI plan + arg parsing. No network calls.
 *
 * The streaming download path is not exercised here; doing so reliably needs
 * either a fixture HTTP server or the live FAA / eCFR endpoints (flaky). A
 * smoke test that downloads ONE small file is opt-in via `AIRBOSS_E2E_DOWNLOAD=1`
 * (see `bun run download-sources --corpus=ac --dry-run` for the URL plan).
 */

import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __download_internal__, runDownloadSources } from './download-sources';

const { parseArgs, buildPlans, buildEcfrUrl, currentMonthEdition, AC_TARGETS, ACS_TARGETS, AIM_PDF_CANDIDATES } =
	__download_internal__;

let tempRoot: string;

beforeEach(() => {
	tempRoot = mkdtempSync(join(tmpdir(), 'airboss-dl-'));
});

afterEach(() => {
	rmSync(tempRoot, { recursive: true, force: true });
});

describe('parseArgs', () => {
	it('defaults to all corpora, no dry-run, today edition date', () => {
		const args = parseArgs([]);
		expect(args.dryRun).toBe(false);
		expect(args.forceRefresh).toBe(false);
		expect(args.includeHandbooksExtras).toBe(false);
		expect(args.corpora.has('regs')).toBe(true);
		expect(args.corpora.has('aim')).toBe(true);
		expect(args.corpora.has('ac')).toBe(true);
		expect(args.corpora.has('acs')).toBe(true);
		expect(args.corpora.has('handbooks')).toBe(true);
		expect(args.editionDate).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
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
			'--include-handbooks-extras',
			'--edition-date=2026-01-15',
		]);
		expect(args.dryRun).toBe(true);
		expect(args.forceRefresh).toBe(true);
		expect(args.verbose).toBe(true);
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
		const url = buildEcfrUrl({ title: '14', editionDate: '2026-04-27' });
		expect(url).toBe('https://www.ecfr.gov/api/versioner/v1/full/2026-04-27/title-14.xml');
	});

	it('appends ?part= for partial title 49 fetches', () => {
		const url = buildEcfrUrl({
			title: '49',
			editionDate: '2026-04-27',
			partFilter: new Set(['830']),
		});
		expect(url).toBe('https://www.ecfr.gov/api/versioner/v1/full/2026-04-27/title-49.xml?part=830');
	});
});

describe('buildPlans', () => {
	it('produces 3 regs plans (title 14 full, 49 part 830, 49 part 1552)', () => {
		const args = parseArgs(['--corpus=regs', '--edition-date=2026-04-27']);
		const plans = buildPlans(args, tempRoot);
		expect(plans).toHaveLength(3);
		const docs = plans.map((p) => p.doc).sort();
		expect(docs).toEqual(['cfr-14-full', 'cfr-49-parts-1552', 'cfr-49-parts-830']);
		for (const p of plans) {
			expect(p.corpus).toBe('regs');
			expect(p.extension).toBe('xml');
			expect(p.urls[0]).toContain('ecfr.gov/api/versioner');
			expect(p.destPath.startsWith(tempRoot)).toBe(true);
		}
	});

	it('produces a single aim plan with candidate URLs', () => {
		const args = parseArgs(['--corpus=aim']);
		const plans = buildPlans(args, tempRoot);
		expect(plans).toHaveLength(1);
		const [aim] = plans;
		expect(aim).toBeDefined();
		if (aim === undefined) return;
		expect(aim.corpus).toBe('aim');
		expect(aim.urls.length).toBe(AIM_PDF_CANDIDATES.length);
		expect(aim.edition).toBe(currentMonthEdition());
		expect(aim.destPath.endsWith('source.pdf')).toBe(true);
	});

	it('produces one plan per AC target', () => {
		const args = parseArgs(['--corpus=ac']);
		const plans = buildPlans(args, tempRoot);
		expect(plans).toHaveLength(AC_TARGETS.length);
		expect(plans.every((p) => p.corpus === 'ac' && p.extension === 'pdf')).toBe(true);
	});

	it('produces one plan per ACS target', () => {
		const args = parseArgs(['--corpus=acs']);
		const plans = buildPlans(args, tempRoot);
		expect(plans).toHaveLength(ACS_TARGETS.length);
		expect(plans.every((p) => p.corpus === 'acs')).toBe(true);
	});

	it('skips handbooks unless --include-handbooks-extras', () => {
		const without = buildPlans(parseArgs(['--corpus=handbooks']), tempRoot);
		expect(without).toHaveLength(0);
		const withExtras = buildPlans(parseArgs(['--corpus=handbooks', '--include-handbooks-extras']), tempRoot);
		expect(withExtras.length).toBeGreaterThan(0);
		expect(withExtras.every((p) => p.corpus === 'handbooks')).toBe(true);
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
				argv: ['--dry-run', '--corpus=regs,ac', '--edition-date=2026-04-27'],
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

describe('manifest skip behavior', () => {
	it('skips a plan when manifest size matches existing source file', async () => {
		// Pre-populate a "cached" source.pdf + manifest.json for the AC plan,
		// then run with --corpus=ac and confirm zero downloads happen by
		// asserting the script returns 0 without network access (no fetch
		// mock is provided -- if it tried to fetch, it would hard-fail).
		const args = parseArgs(['--corpus=ac']);
		const plans = buildPlans(args, tempRoot);
		const [first] = plans;
		expect(first).toBeDefined();
		if (first === undefined) return;

		const dir = join(tempRoot, 'ac', first.doc, first.edition);
		mkdirSync(dir, { recursive: true });
		const sourceBytes = Buffer.from('cached pdf bytes');
		writeFileSync(join(dir, 'source.pdf'), sourceBytes);
		writeFileSync(
			join(dir, 'manifest.json'),
			JSON.stringify({
				corpus: 'ac',
				doc: first.doc,
				edition: first.edition,
				source_url: 'file://test',
				source_sha256: 'deadbeef',
				size_bytes: sourceBytes.byteLength,
				fetched_at: new Date().toISOString(),
				schema_version: 1,
			}),
		);

		// Replace the plan list to a single entry so we don't try to fetch
		// the other ACs (which would hit live URLs). We use --corpus=ac
		// + only this one cached plan by spying on buildPlans is overkill;
		// instead, pre-cache ALL ac targets.
		for (const plan of plans) {
			if (plan === first) continue;
			const d = join(tempRoot, plan.corpus, plan.doc, plan.edition);
			mkdirSync(d, { recursive: true });
			const bytes = Buffer.from(`cached ${plan.doc}`);
			writeFileSync(join(d, 'source.pdf'), bytes);
			writeFileSync(
				join(d, 'manifest.json'),
				JSON.stringify({
					corpus: plan.corpus,
					doc: plan.doc,
					edition: plan.edition,
					source_url: 'file://test',
					source_sha256: 'deadbeef',
					size_bytes: bytes.byteLength,
					fetched_at: new Date().toISOString(),
					schema_version: 1,
				}),
			);
		}

		const originalLog = console.log;
		const originalErr = console.error;
		const captured: string[] = [];
		console.log = (...a: unknown[]) => captured.push(a.map(String).join(' '));
		console.error = (...a: unknown[]) => captured.push(a.map(String).join(' '));
		try {
			const code = await runDownloadSources({
				argv: ['--corpus=ac', '--verbose'],
				cacheRoot: tempRoot,
			});
			expect(code).toBe(0);
			expect(captured.some((l) => l.includes('skip (cached)'))).toBe(true);
		} finally {
			console.log = originalLog;
			console.error = originalErr;
		}
	});
});
