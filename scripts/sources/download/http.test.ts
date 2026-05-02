/**
 * Tests for the source-downloader HTTP layer.
 *
 * Focus: ADR 021 atomicity. The downloader streams body bytes into a
 * `<destPath>.part` sibling and only renames over the canonical path
 * after the pipeline completes. A SIGINT or stream error mid-download
 * must leave either the prior file or no file at the canonical path --
 * never a partially-written PDF.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { downloadFile } from './http';

let tempRoot: string;

beforeEach(() => {
	tempRoot = mkdtempSync(join(tmpdir(), 'airboss-http-'));
});

afterEach(() => {
	rmSync(tempRoot, { recursive: true, force: true });
});

/**
 * Build a `fetch` stub that handles HEAD (for redirect-follow) by returning
 * a 200 with no Location, and GET by returning a synthesized response with
 * an in-memory body of `bodyBytes`.
 */
function buildFakeFetch(bodyBytes: Uint8Array): typeof fetch {
	return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const method = init?.method ?? 'GET';
		const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		if (method === 'HEAD') {
			return new Response(null, { status: 200, headers: { 'Content-Length': String(bodyBytes.byteLength) } });
		}
		// Wrap the body in a ReadableStream so the downloader's streaming path
		// is exercised end-to-end.
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(bodyBytes);
				controller.close();
			},
		});
		return new Response(stream, {
			status: 200,
			headers: {
				'Content-Length': String(bodyBytes.byteLength),
				'Last-Modified': 'Mon, 01 May 2026 00:00:00 GMT',
				ETag: '"deadbeef"',
				url,
			},
		});
	}) as typeof fetch;
}

describe('downloadFile (atomic write per ADR 021)', () => {
	it('happy path -- writes the body to destPath and leaves no .part sibling', async () => {
		const body = new TextEncoder().encode('hello world');
		const dest = join(tempRoot, 'corpus', 'doc.pdf');
		const outcome = await downloadFile('https://example.test/doc.pdf', dest, {
			verbose: false,
			fetchImpl: buildFakeFetch(body),
		});

		expect(existsSync(dest)).toBe(true);
		expect(readFileSync(dest)).toEqual(Buffer.from(body));
		expect(outcome.bytes).toBe(body.byteLength);
		expect(outcome.sha256).toMatch(/^[0-9a-f]{64}$/);
		// Atomic-rename hygiene: no `.part` left dangling.
		expect(existsSync(`${dest}.part`)).toBe(false);
	});

	it('mid-write failure -- canonical destPath is never partially written', async () => {
		// Build a fetch whose body stream errors halfway through. The
		// downloader's `pipeline` will reject; the catch block must clean up
		// the `.part` and leave the canonical path absent.
		const fakeFetch: typeof fetch = (async (_input, init) => {
			const method = init?.method ?? 'GET';
			if (method === 'HEAD') {
				return new Response(null, { status: 200 });
			}
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new TextEncoder().encode('partial-bytes-'));
					// Defer the error so some bytes have flushed to the .part file.
					queueMicrotask(() => controller.error(new Error('simulated stream failure')));
				},
			});
			return new Response(stream, { status: 200 });
		}) as typeof fetch;

		const dest = join(tempRoot, 'corpus', 'broken.pdf');
		await expect(
			downloadFile('https://example.test/broken.pdf', dest, {
				verbose: false,
				fetchImpl: fakeFetch,
			}),
		).rejects.toThrow();

		// Canonical path was never created.
		expect(existsSync(dest)).toBe(false);
		// And the .part sibling was unlinked by the catch handler.
		expect(existsSync(`${dest}.part`)).toBe(false);
	});

	it('existing dest replaced atomically -- prior content fully overwritten', async () => {
		const dest = join(tempRoot, 'corpus', 'existing.pdf');
		mkdirSync(dirname(dest), { recursive: true });
		writeFileSync(dest, 'old-content', 'utf-8');
		const before = statSync(dest).size;
		expect(before).toBeGreaterThan(0);

		const body = new TextEncoder().encode('NEW-CONTENT-LARGER-THAN-OLD');
		await downloadFile('https://example.test/existing.pdf', dest, {
			verbose: false,
			fetchImpl: buildFakeFetch(body),
		});

		// Canonical path now holds the new bytes (verified by sha + content).
		expect(readFileSync(dest)).toEqual(Buffer.from(body));
		expect(existsSync(`${dest}.part`)).toBe(false);
	});

	it('mid-write failure with a prior file -- prior file survives untouched', async () => {
		const dest = join(tempRoot, 'corpus', 'prior.pdf');
		mkdirSync(dirname(dest), { recursive: true });
		const priorContent = 'PRIOR-GOOD-CONTENT';
		writeFileSync(dest, priorContent, 'utf-8');

		const fakeFetch: typeof fetch = (async (_input, init) => {
			const method = init?.method ?? 'GET';
			if (method === 'HEAD') {
				return new Response(null, { status: 200 });
			}
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new TextEncoder().encode('partial'));
					queueMicrotask(() => controller.error(new Error('simulated stream failure')));
				},
			});
			return new Response(stream, { status: 200 });
		}) as typeof fetch;

		await expect(
			downloadFile('https://example.test/prior.pdf', dest, {
				verbose: false,
				fetchImpl: fakeFetch,
			}),
		).rejects.toThrow();

		// Prior file is untouched.
		expect(readFileSync(dest, 'utf-8')).toBe(priorContent);
		expect(existsSync(`${dest}.part`)).toBe(false);
	});
});
