/**
 * Unit tests for the AIM HTML download path. All HTTP traffic is mocked.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { downloadHtmlFile } from './html-fetch';

let tempRoot: string;

const TEST_HOSTS: readonly string[] = ['example.test'];

beforeEach(() => {
	tempRoot = mkdtempSync(join(tmpdir(), 'airboss-html-'));
});
afterEach(() => {
	rmSync(tempRoot, { recursive: true, force: true });
});

describe('downloadHtmlFile', () => {
	it('writes the response body to destPath and returns sha256 + bytes', async () => {
		const body = '<html><body><h4 class="paragraph-title" id="7-3-1">Sec 7-3-1</h4></body></html>';
		const fakeFetch: typeof fetch = async (_input: RequestInfo | URL): Promise<Response> => {
			return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
		};
		const dest = join(tempRoot, 'aim', 'chap07_section_03.html');
		const outcome = await downloadHtmlFile('https://example.test/file.html', dest, {
			verbose: false,
			fetchImpl: fakeFetch,
			allowedHosts: TEST_HOSTS,
		});
		expect(existsSync(dest)).toBe(true);
		expect(readFileSync(dest, 'utf-8')).toBe(body);
		expect(outcome.bytes).toBe(body.length);
		expect(outcome.sha256).toMatch(/^[0-9a-f]{64}$/);
	});

	it('rejects responses whose Content-Type is not text/html', async () => {
		const fakeFetch: typeof fetch = async (): Promise<Response> => {
			return new Response('binary', { status: 200, headers: { 'Content-Type': 'application/pdf' } });
		};
		await expect(
			downloadHtmlFile('https://example.test/x.html', join(tempRoot, 'x.html'), {
				verbose: false,
				fetchImpl: fakeFetch,
				allowedHosts: TEST_HOSTS,
			}),
		).rejects.toThrow(/unexpected Content-Type/);
	});

	it('accepts text/html with charset suffix', async () => {
		const fakeFetch: typeof fetch = async (): Promise<Response> => {
			return new Response('<html></html>', {
				status: 200,
				headers: { 'Content-Type': 'text/html; charset=ISO-8859-1' },
			});
		};
		await expect(
			downloadHtmlFile('https://example.test/x.html', join(tempRoot, 'x.html'), {
				verbose: false,
				fetchImpl: fakeFetch,
				allowedHosts: TEST_HOSTS,
			}),
		).resolves.toBeDefined();
	});

	it('throws on non-2xx status', async () => {
		const fakeFetch: typeof fetch = async (): Promise<Response> => new Response('', { status: 404 });
		await expect(
			downloadHtmlFile('https://example.test/x.html', join(tempRoot, 'x.html'), {
				verbose: false,
				fetchImpl: fakeFetch,
				allowedHosts: TEST_HOSTS,
			}),
		).rejects.toThrow(/HTTP 404/);
	});

	it('atomicity -- happy path leaves no .part sibling at destPath', async () => {
		const body = '<html><body>ok</body></html>';
		const fakeFetch: typeof fetch = async () =>
			new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
		const dest = join(tempRoot, 'aim', 'happy.html');
		await downloadHtmlFile('https://example.test/happy.html', dest, {
			verbose: false,
			fetchImpl: fakeFetch,
			allowedHosts: TEST_HOSTS,
		});
		expect(existsSync(dest)).toBe(true);
		expect(existsSync(`${dest}.part`)).toBe(false);
	});

	it('atomicity -- mid-stream failure leaves no partial dest and no .part sibling', async () => {
		const fakeFetch: typeof fetch = (async (_input, init): Promise<Response> => {
			const method = init?.method ?? 'GET';
			if (method === 'HEAD') return new Response(null, { status: 200 });
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new TextEncoder().encode('<html>partial'));
					queueMicrotask(() => controller.error(new Error('simulated stream failure')));
				},
			});
			return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/html' } });
		}) as typeof fetch;

		const dest = join(tempRoot, 'aim', 'broken.html');
		await expect(
			downloadHtmlFile('https://example.test/broken.html', dest, {
				verbose: false,
				fetchImpl: fakeFetch,
				allowedHosts: TEST_HOSTS,
			}),
		).rejects.toThrow();

		expect(existsSync(dest)).toBe(false);
		expect(existsSync(`${dest}.part`)).toBe(false);
	});

	it('refuses a redirect that leaves the allowed-host set', async () => {
		const fakeFetch: typeof fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			if (init?.method === 'HEAD') {
				return new Response(null, { status: 302, headers: { Location: 'https://attacker.example/x.html' } });
			}
			return new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
		};
		await expect(
			downloadHtmlFile('https://example.test/x.html', join(tempRoot, 'x.html'), {
				verbose: false,
				fetchImpl: fakeFetch,
				allowedHosts: TEST_HOSTS,
			}),
		).rejects.toThrow(/refused redirect.*attacker\.example/);
	});

	it('refuses a redirect that downgrades to plain http', async () => {
		const fakeFetch: typeof fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			if (init?.method === 'HEAD') {
				return new Response(null, { status: 302, headers: { Location: 'http://example.test/x.html' } });
			}
			return new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
		};
		await expect(
			downloadHtmlFile('https://example.test/x.html', join(tempRoot, 'x.html'), {
				verbose: false,
				fetchImpl: fakeFetch,
				allowedHosts: TEST_HOSTS,
			}),
		).rejects.toThrow(/refused redirect.*http:/);
	});

	it('aborts when the body exceeds maxBodyBytes', async () => {
		const body = 'x'.repeat(2048);
		const fakeFetch: typeof fetch = async (): Promise<Response> => {
			return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
		};
		await expect(
			downloadHtmlFile('https://example.test/x.html', join(tempRoot, 'big.html'), {
				verbose: false,
				fetchImpl: fakeFetch,
				allowedHosts: TEST_HOSTS,
				maxBodyBytes: 256,
			}),
		).rejects.toThrow(/exceeded 256 bytes/);
	});
});
