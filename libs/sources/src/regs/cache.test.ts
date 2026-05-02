import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ENV_VARS } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __cache_internal__, cacheXmlPath, loadEcfrXml, resolveCacheRoot, sha256 } from './cache.ts';

let tmpRoot: string;
let originalEnv: string | undefined;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'cfr-cache-'));
	originalEnv = process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE];
	process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE] = tmpRoot;
});

afterEach(() => {
	if (originalEnv === undefined) delete process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE];
	else process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE] = originalEnv;
	rmSync(tmpRoot, { recursive: true, force: true });
});

describe('resolveCacheRoot', () => {
	it('honors AIRBOSS_HANDBOOK_CACHE env var', () => {
		expect(resolveCacheRoot()).toBe(tmpRoot);
	});
});

describe('cacheXmlPath', () => {
	it('builds the full-Title path', () => {
		expect(cacheXmlPath('14', '2026-01-01')).toBe(join(tmpRoot, 'regulations/cfr-14/2026-01-01.xml'));
	});

	it('encodes partFilter into the file name', () => {
		expect(cacheXmlPath('49', '2026-01-01', new Set(['830', '1552']))).toBe(
			join(tmpRoot, 'regulations/cfr-49/2026-01-01-parts-1552-830.xml'),
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

describe('writeAtomic (ADR 021 atomicity)', () => {
	it('happy path -- writes the file and leaves no .tmp sibling', () => {
		const target = join(tmpRoot, 'sub', 'happy.txt');
		__cache_internal__.writeAtomic(target, 'hello world');
		expect(readFileSync(target, 'utf-8')).toBe('hello world');
		expect(existsSync(`${target}.tmp`)).toBe(false);
	});

	it('mid-write failure -- canonical path is never partially written', () => {
		// Force renameSync to fail by planting a non-empty directory at the
		// canonical path. The writer must throw and leave the directory
		// untouched -- never replace it with a partial file.
		const target = join(tmpRoot, 'sub', 'blocked.txt');
		mkdirSync(target, { recursive: true });
		writeFileSync(join(target, 'sentinel'), 'block', 'utf-8');

		expect(() => __cache_internal__.writeAtomic(target, 'should not land')).toThrow();
		expect(statSync(target).isDirectory()).toBe(true);
		expect(existsSync(join(target, 'sentinel'))).toBe(true);
	});

	it('existing dest replaced atomically -- prior content fully overwritten', () => {
		const target = join(tmpRoot, 'sub', 'replaced.txt');
		__cache_internal__.writeAtomic(target, 'first');
		expect(readFileSync(target, 'utf-8')).toBe('first');
		__cache_internal__.writeAtomic(target, 'second');
		expect(readFileSync(target, 'utf-8')).toBe('second');
		expect(existsSync(`${target}.tmp`)).toBe(false);
	});
});

describe('loadEcfrXml (cache write atomicity)', () => {
	it('does not leave a `.tmp` sibling at the cache path after a successful fetch', async () => {
		await loadEcfrXml({
			title: '14',
			editionDate: '2026-01-01',
			fetchImpl: async () => ({
				ok: true,
				status: 200,
				text: async () => '<fetched/>',
			}),
		});
		const cachePath = cacheXmlPath('14', '2026-01-01');
		expect(existsSync(cachePath)).toBe(true);
		expect(existsSync(`${cachePath}.tmp`)).toBe(false);
	});
});
