/**
 * Tests for the ported `downloadFile` helper. Uses a fake `fetch` so we can
 * hit happy, retry, and 304 paths without network IO.
 */

import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeFileHash, downloadFile, headCheck } from './download';

function makeResponse(
	status: number,
	body: ArrayBuffer | string | null,
	headers: Record<string, string> = {},
): Response {
	if (body === null) return new Response(null, { status, headers });
	return new Response(body, { status, headers });
}

describe('downloadFile', () => {
	let workDir: string;

	beforeEach(async () => {
		workDir = await mkdtemp(join(tmpdir(), 'airboss-download-'));
	});

	afterEach(async () => {
		await rm(workDir, { recursive: true, force: true });
	});

	it('writes the body + returns sha256 + size on a 200 response', async () => {
		const body = new TextEncoder().encode('hello world').buffer;
		const calls: string[] = [];
		const fetchImpl = ((url: string | URL | Request, init?: RequestInit) => {
			calls.push(`${init?.method ?? 'GET'} ${url.toString()}`);
			if (init?.method === 'HEAD') return Promise.resolve(makeResponse(200, null, { 'content-length': '11' }));
			return Promise.resolve(makeResponse(200, body, { 'content-length': '11' }));
		}) as typeof fetch;

		const dest = join(workDir, 'hello.txt');
		const result = await downloadFile('https://example.test/hello.txt', dest, {
			fetchImpl,
			sleepImpl: async () => {},
		});

		expect(result.notModified).toBe(false);
		expect(result.fileSize).toBe(11);
		// sha256('hello world')
		expect(result.sha256).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
		expect(await readFile(dest, 'utf8')).toBe('hello world');
		// No leftover .part
		await expect(stat(`${dest}.part`)).rejects.toThrow();
		// HEAD happened, then GET
		expect(calls[0]?.startsWith('HEAD ')).toBe(true);
		expect(calls[1]?.startsWith('GET ')).toBe(true);
	});

	it('retries after transient 500 then succeeds', async () => {
		const body = new TextEncoder().encode('ok').buffer;
		let gets = 0;
		const fetchImpl = ((_url: string | URL | Request, init?: RequestInit) => {
			if (init?.method === 'HEAD') return Promise.resolve(makeResponse(200, null));
			gets += 1;
			if (gets === 1) return Promise.resolve(makeResponse(500, 'server error'));
			return Promise.resolve(makeResponse(200, body));
		}) as typeof fetch;

		const dest = join(workDir, 'retry.bin');
		const result = await downloadFile('https://example.test/retry', dest, {
			fetchImpl,
			sleepImpl: async () => {},
		});
		expect(gets).toBe(2);
		expect(result.fileSize).toBe(2);
	});

	it('throws after max retries and leaves no partial file', async () => {
		const fetchImpl = ((_url: string | URL | Request, init?: RequestInit) => {
			if (init?.method === 'HEAD') return Promise.resolve(makeResponse(200, null));
			return Promise.resolve(makeResponse(503, 'unavail'));
		}) as typeof fetch;

		const dest = join(workDir, 'fail.bin');
		await expect(
			downloadFile('https://example.test/fail', dest, {
				fetchImpl,
				sleepImpl: async () => {},
			}),
		).rejects.toThrow(/after 3 attempts/);

		await expect(stat(dest)).rejects.toThrow();
		await expect(stat(`${dest}.part`)).rejects.toThrow();
	});

	it('returns notModified on 304 and does not write a file', async () => {
		let getCalled = false;
		const fetchImpl = ((_url: string | URL | Request, init?: RequestInit) => {
			if (init?.method === 'HEAD')
				return Promise.resolve(makeResponse(200, null, { etag: '"abc"', 'content-length': '5' }));
			getCalled = true;
			expect((init?.headers as Record<string, string>)['If-None-Match']).toBe('"abc"');
			return Promise.resolve(makeResponse(304, null));
		}) as typeof fetch;

		const dest = join(workDir, 'cached.bin');
		const result = await downloadFile('https://example.test/cached', dest, {
			etag: '"abc"',
			fetchImpl,
			sleepImpl: async () => {},
		});
		expect(getCalled).toBe(true);
		expect(result.notModified).toBe(true);
		expect(result.fileSize).toBe(0);
		await expect(stat(dest)).rejects.toThrow();
	});

	it('follows redirects via the underlying fetch (redirect=follow)', async () => {
		const body = new TextEncoder().encode('final').buffer;
		const fetchImpl = ((_url: string | URL | Request, init?: RequestInit) => {
			if (init?.method === 'HEAD') return Promise.resolve(makeResponse(200, null));
			return Promise.resolve(makeResponse(200, body));
		}) as typeof fetch;

		const dest = join(workDir, 'redirect.bin');
		const result = await downloadFile('https://example.test/redirect', dest, {
			fetchImpl,
			sleepImpl: async () => {},
		});
		expect(result.fileSize).toBe(5);
	});
});

describe('headCheck', () => {
	it('returns nulls when HEAD is blocked (non-ok response)', async () => {
		const fetchImpl = (() => Promise.resolve(new Response('', { status: 405 }))) as typeof fetch;
		const result = await headCheck('https://example.test/blocked', { fetchImpl });
		expect(result).toEqual({ contentLength: null, lastModified: null, etag: null });
	});

	it('parses content-length, etag, last-modified when HEAD succeeds', async () => {
		const fetchImpl = (() =>
			Promise.resolve(
				new Response('', {
					status: 200,
					headers: { 'content-length': '42', etag: '"tag"', 'last-modified': 'yesterday' },
				}),
			)) as typeof fetch;
		const result = await headCheck('https://example.test/ok', { fetchImpl });
		expect(result).toEqual({ contentLength: 42, lastModified: 'yesterday', etag: '"tag"' });
	});
});

describe('computeFileHash', () => {
	let workDir: string;
	beforeEach(async () => {
		workDir = await mkdtemp(join(tmpdir(), 'airboss-hash-'));
	});
	afterEach(async () => {
		await rm(workDir, { recursive: true, force: true });
	});

	it('computes the sha256 of a written file', async () => {
		const body = new TextEncoder().encode('hello world').buffer;
		const fetchImpl = ((_url: string | URL | Request, init?: RequestInit) => {
			if (init?.method === 'HEAD') return Promise.resolve(new Response('', { status: 200 }));
			return Promise.resolve(new Response(body, { status: 200 }));
		}) as typeof fetch;
		const dest = join(workDir, 'h.txt');
		await downloadFile('https://example.test/h', dest, { fetchImpl, sleepImpl: async () => {} });
		expect(await computeFileHash(dest)).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
	});
});
