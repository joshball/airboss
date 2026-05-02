/**
 * HTTP-hardening unit tests covering the network-layer guards added by the
 * "feat(sources): http fetch hardening" pass:
 *
 *   - Same-host (allowlist) enforcement on every request and on every
 *     redirect hop.
 *   - HTTPS-only scheme enforcement.
 *   - Body-size cap during streaming downloads.
 *   - End-to-end timeout via `AbortController`.
 *
 * All HTTP traffic is mocked. The tests target `https://www.faa.gov/...` so
 * they hit the same allowlist the production callers use.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SOURCE_ACTION_LIMITS } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { downloadFile, followRedirectsHead, HostPolicyError, headRequest } from './http';

let tempRoot: string;

beforeEach(() => {
	tempRoot = mkdtempSync(join(tmpdir(), 'airboss-http-'));
});
afterEach(() => {
	rmSync(tempRoot, { recursive: true, force: true });
});

function streamFromBytes(bytes: Uint8Array): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		},
	});
}

function makeOkResponse(url: string, bytes: Uint8Array): Response {
	const init: ResponseInit = { status: 200, headers: { 'Content-Length': String(bytes.byteLength) } };
	const response = new Response(streamFromBytes(bytes), init);
	Object.defineProperty(response, 'url', { value: url });
	return response;
}

describe('http hardening: host allowlist + HTTPS-only', () => {
	it('refuses a non-allowlisted host on the initial GET', async () => {
		const fakeFetch: typeof fetch = async () => new Response('nope', { status: 200 });
		const dest = join(tempRoot, 'evil.bin');
		await expect(
			downloadFile('https://attacker.example/payload.pdf', dest, { verbose: false, fetchImpl: fakeFetch }),
		).rejects.toBeInstanceOf(HostPolicyError);
	});

	it('refuses a non-HTTPS scheme even on an allowlisted host', async () => {
		const fakeFetch: typeof fetch = async () => new Response('nope', { status: 200 });
		await expect(
			downloadFile('http://www.faa.gov/insecure.pdf', join(tempRoot, 'x.pdf'), {
				verbose: false,
				fetchImpl: fakeFetch,
			}),
		).rejects.toBeInstanceOf(HostPolicyError);
	});

	it('refuses a HEAD request on a disallowed host', async () => {
		const fakeFetch: typeof fetch = async () => new Response('', { status: 200 });
		await expect(headRequest('https://attacker.example/probe', fakeFetch)).rejects.toBeInstanceOf(HostPolicyError);
	});

	it('rejects a redirect from an allowed host into a disallowed one', async () => {
		// First HEAD: 302 -> attacker.example. Second HEAD never reached.
		const fakeFetch: typeof fetch = async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.startsWith('https://www.faa.gov/')) {
				return new Response(null, {
					status: 302,
					headers: { Location: 'https://attacker.example/poisoned.pdf' },
				});
			}
			return new Response('should not be reached', { status: 200 });
		};
		await expect(followRedirectsHead('https://www.faa.gov/redirected', fakeFetch, false)).rejects.toBeInstanceOf(
			HostPolicyError,
		);
	});

	it('rejects a redirect that downgrades https -> http', async () => {
		const fakeFetch: typeof fetch = async () =>
			new Response(null, { status: 302, headers: { Location: 'http://www.faa.gov/foo.pdf' } });
		await expect(followRedirectsHead('https://www.faa.gov/start', fakeFetch, false)).rejects.toBeInstanceOf(
			HostPolicyError,
		);
	});

	it('allows a same-host redirect chain ending on the allowlist host', async () => {
		let seen = 0;
		const fakeFetch: typeof fetch = async (input: RequestInfo | URL) => {
			seen += 1;
			const url = String(input);
			if (url === 'https://www.faa.gov/start') {
				return new Response(null, { status: 302, headers: { Location: 'https://www.faa.gov/final' } });
			}
			if (url === 'https://www.faa.gov/final') {
				return new Response(null, { status: 200 });
			}
			throw new Error(`unexpected URL: ${url}`);
		};
		const result = await followRedirectsHead('https://www.faa.gov/start', fakeFetch, false);
		expect(result).toBe('https://www.faa.gov/final');
		expect(seen).toBe(2);
	});
});

describe('http hardening: body-size cap', () => {
	/**
	 * Stream `cap + 1` bytes through repeated 1 MiB chunks. The downloader
	 * counts cumulative bytes per data event, so the cap fires the moment
	 * we cross the threshold; we never have to allocate a single 250 MiB
	 * buffer. Total allocation per test is one 1 MiB Uint8Array reused for
	 * every chunk.
	 */
	function makeOversizedBody(totalBytes: number): ReadableStream<Uint8Array> {
		const chunkSize = 1024 * 1024;
		const chunk = new Uint8Array(chunkSize);
		let remaining = totalBytes;
		return new ReadableStream<Uint8Array>({
			pull(controller) {
				if (remaining <= 0) {
					controller.close();
					return;
				}
				const len = Math.min(chunkSize, remaining);
				controller.enqueue(len === chunkSize ? chunk : chunk.subarray(0, len));
				remaining -= len;
			},
		});
	}

	it('aborts the stream when bytes exceed MAX_DOWNLOAD_BYTES', async () => {
		const cap = SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES;
		const fakeFetch: typeof fetch = async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === 'https://www.faa.gov/oversize.pdf') {
				const response = new Response(makeOversizedBody(cap + 1), { status: 200 });
				Object.defineProperty(response, 'url', { value: url });
				return response;
			}
			// HEAD probe (manual redirect chase) -- 200 short-circuits the loop.
			return new Response(null, { status: 200 });
		};
		const dest = join(tempRoot, 'oversize.pdf');
		await expect(
			downloadFile('https://www.faa.gov/oversize.pdf', dest, { verbose: false, fetchImpl: fakeFetch }),
		).rejects.toThrow(/exceeded/);
	}, 60_000);

	it('passes a body that fits under the cap', async () => {
		const body = new TextEncoder().encode('hello world');
		const fakeFetch: typeof fetch = async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === 'https://www.faa.gov/small.pdf') {
				return makeOkResponse(url, body);
			}
			return new Response(null, { status: 200 });
		};
		const dest = join(tempRoot, 'small.pdf');
		const outcome = await downloadFile('https://www.faa.gov/small.pdf', dest, {
			verbose: false,
			fetchImpl: fakeFetch,
		});
		expect(outcome.bytes).toBe(body.byteLength);
		expect(readFileSync(dest)).toEqual(Buffer.from(body));
	});
});

describe('http hardening: timeout enforcement', () => {
	it('hooks up an AbortSignal on every GET so a hung endpoint cannot stall forever', async () => {
		// We do not run the full NETWORK_TIMEOUT_MS clock in a unit test; we
		// verify that the downloader passes a `signal` through to the fetch
		// implementation. Production wires that signal to a `setTimeout`
		// driven by `NETWORK_TIMEOUT_MS`.
		let observedSignal: AbortSignal | undefined;
		const body = new TextEncoder().encode('ok');
		const fakeFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (init && init.method !== 'HEAD') {
				observedSignal = init.signal ?? undefined;
			}
			if (init?.method === 'HEAD') {
				return new Response(null, { status: 200 });
			}
			return makeOkResponse(url, body);
		};
		const dest = join(tempRoot, 'timeout.bin');
		await downloadFile('https://www.faa.gov/x.pdf', dest, { verbose: false, fetchImpl: fakeFetch });
		expect(observedSignal).toBeDefined();
		// AbortSignal should still be in non-aborted state on a clean request.
		expect(observedSignal?.aborted).toBe(false);
	});
});
