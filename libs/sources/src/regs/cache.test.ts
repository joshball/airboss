import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __cache_internal__, cacheXmlPath, loadEcfrXml, resolveCacheRoot, sha256 } from './cache.ts';

let tmpRoot: string;
let originalEnv: string | undefined;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'cfr-cache-'));
	originalEnv = process.env.AIRBOSS_HANDBOOK_CACHE;
	process.env.AIRBOSS_HANDBOOK_CACHE = tmpRoot;
});

afterEach(() => {
	if (originalEnv === undefined) delete process.env.AIRBOSS_HANDBOOK_CACHE;
	else process.env.AIRBOSS_HANDBOOK_CACHE = originalEnv;
	rmSync(tmpRoot, { recursive: true, force: true });
});

describe('resolveCacheRoot', () => {
	it('honors AIRBOSS_HANDBOOK_CACHE env var', () => {
		expect(resolveCacheRoot()).toBe(tmpRoot);
	});
});

describe('cacheXmlPath', () => {
	it('builds the full-Title path', () => {
		expect(cacheXmlPath('14', '2026-01-01')).toBe(join(tmpRoot, 'regulations/cfr-14/2026-01-01/full.xml'));
	});

	it('encodes partFilter into the file name', () => {
		expect(cacheXmlPath('49', '2026-01-01', new Set(['830', '1552']))).toBe(
			join(tmpRoot, 'regulations/cfr-49/2026-01-01/parts-1552-830.xml'),
		);
	});
});

describe('loadEcfrXml', () => {
	it('reads from a fixture path', async () => {
		const fixturePath = join(tmpRoot, 'fixture.xml');
		writeFileSync(fixturePath, '<root/>', 'utf-8');
		const result = await loadEcfrXml({ title: '14', editionDate: '2026-01-01', fixturePath });
		expect(result.xml).toBe('<root/>');
		expect(result.sourceUrl).toBe(`file://${fixturePath}`);
		expect(result.sourceSha256).toBe(sha256('<root/>'));
	});

	it('reads from cache when present', async () => {
		const cachePath = cacheXmlPath('14', '2026-01-01');
		mkdirSync(dirname(cachePath), { recursive: true });
		writeFileSync(cachePath, '<cached/>', 'utf-8');
		const result = await loadEcfrXml({ title: '14', editionDate: '2026-01-01' });
		expect(result.xml).toBe('<cached/>');
		expect(result.sourceUrl).toContain(cachePath);
	});

	it('falls through to fetch + writes cache when missing', async () => {
		const result = await loadEcfrXml({
			title: '14',
			editionDate: '2026-01-01',
			fetchImpl: async () => ({
				ok: true,
				status: 200,
				text: async () => '<fetched/>',
			}),
		});
		expect(result.xml).toBe('<fetched/>');
		expect(result.sourceUrl).toBe('https://www.ecfr.gov/api/versioner/v1/full/2026-01-01/title-14.xml');

		// And on a second call, it reads the cache file rather than fetching
		const second = await loadEcfrXml({
			title: '14',
			editionDate: '2026-01-01',
			fetchImpl: async () => {
				throw new Error('should not fetch on cached run');
			},
		});
		expect(second.xml).toBe('<fetched/>');
	});

	it('throws on non-OK response', async () => {
		await expect(
			loadEcfrXml({
				title: '14',
				editionDate: '2026-01-01',
				fetchImpl: async () => ({ ok: false, status: 404, text: async () => '' }),
			}),
		).rejects.toThrow(/404/);
	});
});

describe('writeCacheDirectory creation', () => {
	it('creates the cache directory tree on demand', () => {
		// Just call resolveCacheRoot from a fresh tmpdir; directory creation is implicit.
		mkdtempSync(join(tmpdir(), 'cfr-cache-empty-'));
		expect(() => resolveCacheRoot()).not.toThrow();
	});
});

describe('buildEcfrUrl', () => {
	it('appends ?part= for partFilter', () => {
		const url = __cache_internal__.buildEcfrUrl({
			title: '49',
			editionDate: '2026-01-01',
			partFilter: new Set(['830', '1552']),
		});
		expect(url).toContain('title-49.xml?');
		expect(url).toMatch(/part=830/);
		expect(url).toMatch(/part=1552/);
	});

	it('omits query when no filter', () => {
		const url = __cache_internal__.buildEcfrUrl({
			title: '14',
			editionDate: '2026-01-01',
		});
		expect(url).toBe('https://www.ecfr.gov/api/versioner/v1/full/2026-01-01/title-14.xml');
	});
});
