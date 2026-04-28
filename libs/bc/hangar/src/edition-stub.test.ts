/**
 * Unit tests for the dev-only edition-resolver override. Verifies:
 *   - helper returns null when the env var is not set
 *   - helper returns null when NODE_ENV=production (even if var is set)
 *   - helper reads a local file path when set
 *   - helper reads an http(s) URL when set
 *   - `resolveCurrentSectionalEdition` called with the stub returns the
 *     edition encoded in the stub payload, not whatever the real index URL
 *     would produce
 *   - `withEditionStub` preserves the real fetcher when the flag is off
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveCurrentSectionalEdition } from '@ab/aviation/sources';
import { ENV_VARS } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeStubFetchHtml, withEditionStub } from './edition-stub';

const TMP_ROOT = join(import.meta.dirname, '__tmp_edition_stub__');
const STUB_PATH = join(TMP_ROOT, 'next-edition.html');

/** HTML that encodes a "next edition" strictly later than the committed fixture. */
const NEXT_EDITION_HTML = `<!doctype html>
<html><body>
<h1>VFR Sectional Charts</h1>
<ul>
	<li><a href="/visual/2026-05-16/sectional-files/Denver.zip">Denver - 2026-05-16 (Edition 117)</a></li>
</ul>
</body></html>`;

function clearEnv() {
	delete process.env[ENV_VARS.HANGAR_EDITION_STUB_URL];
	delete process.env[ENV_VARS.NODE_ENV];
}

beforeEach(async () => {
	clearEnv();
	await rm(TMP_ROOT, { recursive: true, force: true });
	await mkdir(TMP_ROOT, { recursive: true });
	await writeFile(STUB_PATH, NEXT_EDITION_HTML, 'utf8');
});

afterEach(async () => {
	clearEnv();
	await rm(TMP_ROOT, { recursive: true, force: true });
});

describe('makeStubFetchHtml', () => {
	it('returns null when the env var is not set', () => {
		expect(makeStubFetchHtml()).toBeNull();
	});

	it('returns null in production even when the env var is set', () => {
		process.env[ENV_VARS.HANGAR_EDITION_STUB_URL] = STUB_PATH;
		process.env[ENV_VARS.NODE_ENV] = 'production';
		expect(makeStubFetchHtml()).toBeNull();
	});

	it('reads a local filesystem path when the env var is set', async () => {
		process.env[ENV_VARS.HANGAR_EDITION_STUB_URL] = STUB_PATH;
		const stub = makeStubFetchHtml();
		expect(stub).not.toBeNull();
		const html = await stub?.('https://aeronav.faa.gov/visual/');
		expect(html).toContain('2026-05-16');
		expect(html).toContain('Edition 117');
	});

	it('strips the `file://` prefix when present', async () => {
		process.env[ENV_VARS.HANGAR_EDITION_STUB_URL] = `file://${STUB_PATH}`;
		const stub = makeStubFetchHtml();
		const html = await stub?.('https://aeronav.faa.gov/visual/');
		expect(html).toContain('2026-05-16');
	});

	it('fetches an http(s) URL when the env var starts with http(s)://', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(NEXT_EDITION_HTML, { status: 200 }));
		process.env[ENV_VARS.HANGAR_EDITION_STUB_URL] = 'https://stub.example/next.html';
		try {
			const stub = makeStubFetchHtml();
			const html = await stub?.('https://aeronav.faa.gov/visual/');
			expect(html).toContain('2026-05-16');
			expect(fetchSpy).toHaveBeenCalledWith('https://stub.example/next.html');
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it('throws a clear error on HTTP non-2xx', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }));
		process.env[ENV_VARS.HANGAR_EDITION_STUB_URL] = 'https://stub.example/missing.html';
		try {
			const stub = makeStubFetchHtml();
			await expect(stub?.('https://aeronav.faa.gov/visual/')).rejects.toThrow(/HTTP 404/);
		} finally {
			fetchSpy.mockRestore();
		}
	});
});

describe('resolveCurrentSectionalEdition + stub integration', () => {
	it('returns the edition from the stub payload, not the real index', async () => {
		process.env[ENV_VARS.HANGAR_EDITION_STUB_URL] = STUB_PATH;
		const stub = makeStubFetchHtml();
		expect(stub).not.toBeNull();
		if (!stub) throw new Error('stub not active');
		const result = await resolveCurrentSectionalEdition({
			region: 'Denver',
			indexUrl: 'https://aeronav.faa.gov/visual/',
			urlTemplate: 'https://aeronav.faa.gov/visual/{edition-date}/sectional-files/{region}.zip',
			fetchHtml: stub,
			now: () => new Date('2026-05-20T00:00:00.000Z'),
		});
		expect(result.effectiveDate).toBe('2026-05-16');
		expect(result.editionNumber).toBe(117);
		expect(result.resolvedUrl).toBe('https://aeronav.faa.gov/visual/2026-05-16/sectional-files/Denver.zip');
	});
});

describe('withEditionStub', () => {
	it('returns the real fetcher when the override is off', () => {
		const real = async () => 'real-html';
		const wrapped = withEditionStub(real);
		expect(wrapped).toBe(real);
	});

	it('returns undefined when neither override nor real fetcher given', () => {
		expect(withEditionStub()).toBeUndefined();
	});

	it('prefers the stub over the real fetcher when active', async () => {
		process.env[ENV_VARS.HANGAR_EDITION_STUB_URL] = STUB_PATH;
		const real = vi.fn(async () => 'real-html');
		const wrapped = withEditionStub(real);
		expect(wrapped).not.toBe(real);
		const html = await wrapped?.('https://aeronav.faa.gov/visual/');
		expect(html).toContain('2026-05-16');
		expect(real).not.toHaveBeenCalled();
	});
});
