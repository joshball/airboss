/**
 * Unit tests for the AIM HTML download path. All HTTP traffic is mocked.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { downloadHtmlFile } from './html-fetch';

let tempRoot: string;

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
		});
		expect(existsSync(dest)).toBe(true);
		expect(readFileSync(dest, 'utf-8')).toBe(body);
		expect(outcome.bytes).toBe(body.length);
		expect(outcome.sha256).toMatch(/^[0-9a-f]{64}$/);
		// ADR 021 §Atomicity: the .part side file must be renamed away after a
		// successful download so the cache is left in a single canonical state.
		expect(existsSync(`${dest}.part`)).toBe(false);
	});

	it('rejects responses whose Content-Type is not text/html', async () => {
		const fakeFetch: typeof fetch = async (): Promise<Response> => {
			return new Response('binary', { status: 200, headers: { 'Content-Type': 'application/pdf' } });
		};
		await expect(
			downloadHtmlFile('https://example.test/x.html', join(tempRoot, 'x.html'), {
				verbose: false,
				fetchImpl: fakeFetch,
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
			}),
		).resolves.toBeDefined();
	});

	it('throws on non-2xx status', async () => {
		const fakeFetch: typeof fetch = async (): Promise<Response> => new Response('', { status: 404 });
		await expect(
			downloadHtmlFile('https://example.test/x.html', join(tempRoot, 'x.html'), {
				verbose: false,
				fetchImpl: fakeFetch,
			}),
		).rejects.toThrow(/HTTP 404/);
	});
});
