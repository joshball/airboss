/**
 * Unit tests for the PDF download path. All HTTP traffic is mocked.
 *
 * Atomicity contract per ADR 021: the body streams to `<destPath>.part`,
 * then `rename` lands the file at the canonical path. After a successful
 * download no `.part` sibling remains. After a failure the `.part` is
 * removed before the error propagates.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { downloadFile } from './http';

let tempRoot: string;

beforeEach(() => {
	tempRoot = mkdtempSync(join(tmpdir(), 'airboss-http-'));
});
afterEach(() => {
	rmSync(tempRoot, { recursive: true, force: true });
});

describe('downloadFile', () => {
	it('streams the response body to destPath via tmp+rename', async () => {
		const body = '%PDF-1.4 fake pdf bytes';
		const fakeFetch: typeof fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const method = init?.method ?? 'GET';
			if (method === 'HEAD') {
				return new Response('', { status: 200, headers: { 'Content-Length': String(body.length) } });
			}
			return new Response(body, { status: 200, headers: { 'Content-Length': String(body.length) } });
		};

		const dest = join(tempRoot, 'ac', 'ac-61-65-j.pdf');
		const outcome = await downloadFile('https://example.test/AC_61-65J.pdf', dest, {
			verbose: false,
			fetchImpl: fakeFetch,
		});

		expect(existsSync(dest)).toBe(true);
		expect(readFileSync(dest, 'utf-8')).toBe(body);
		expect(outcome.bytes).toBe(body.length);
		expect(outcome.sha256).toMatch(/^[0-9a-f]{64}$/);
		// ADR 021 §Atomicity: the .part side file must be gone after success.
		expect(existsSync(`${dest}.part`)).toBe(false);
	});

	it('cleans up the .part file when the response stream fails', async () => {
		// Fake fetch that returns a Response whose body throws mid-pipeline.
		// Use a non-transient error message (`isTransient` retries on
		// "timeout"/"network"/"socket"/"AbortError"); we want a single
		// attempt + cleanup so the test doesn't sleep through the retry.
		const failingStream = new ReadableStream({
			start(controller) {
				controller.enqueue(new Uint8Array([0x25, 0x50, 0x44, 0x46])); // "%PDF"
				controller.error(new Error('simulated stream abort -- non-transient'));
			},
		});
		const fakeFetch: typeof fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const method = init?.method ?? 'GET';
			if (method === 'HEAD') {
				return new Response('', { status: 200 });
			}
			return new Response(failingStream, { status: 200 });
		};

		const dest = join(tempRoot, 'ac', 'broken.pdf');
		await expect(
			downloadFile('https://example.test/broken.pdf', dest, {
				verbose: false,
				fetchImpl: fakeFetch,
			}),
		).rejects.toThrow();

		// Canonical path should not exist (rename never ran).
		expect(existsSync(dest)).toBe(false);
		// .part side file must have been cleaned up.
		expect(existsSync(`${dest}.part`)).toBe(false);
	});
});
