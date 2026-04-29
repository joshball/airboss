/**
 * Smoke test for runVerifyUrls. The real verifier hits the live FAA so we
 * stub `fetch` globally for this test (no mocking framework needed).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runVerifyUrls } from './verify-urls';

describe('runVerifyUrls (mocked fetch)', () => {
	let originalFetch: typeof fetch;
	let originalLog: typeof console.log;
	let originalError: typeof console.error;
	const captured: string[] = [];

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		originalLog = console.log;
		originalError = console.error;
		captured.length = 0;
		console.log = (...args: unknown[]) => captured.push(args.map(String).join(' '));
		console.error = (...args: unknown[]) => captured.push(args.map(String).join(' '));
	});

	afterEach(() => {
		(globalThis as { fetch: typeof fetch }).fetch = originalFetch;
		console.log = originalLog;
		console.error = originalError;
	});

	it('returns 0 when every URL HEADs 200 and AIM section probes 404', async () => {
		(globalThis as { fetch: typeof fetch }).fetch = makeFakeFetch();
		const code = await runVerifyUrls();
		expect(code).toBe(0);
		expect(captured.some((line) => line.includes('URLs verified'))).toBe(true);
	}, 30000);

	it('returns 1 with structured remediation when one URL 404s', async () => {
		(globalThis as { fetch: typeof fetch }).fetch = makeFakeFetch({ failingUrlSubstring: 'AC_61-65J' });
		const code = await runVerifyUrls();
		expect(code).toBe(1);
		expect(captured.some((line) => line.includes('AC_61-65J') && line.includes('ERROR'))).toBe(true);
		expect(captured.some((line) => line.includes('ac.yaml#'))).toBe(true);
	}, 30000);
});

function makeFakeFetch(opts: { failingUrlSubstring?: string } = {}): typeof fetch {
	return (async (input: RequestInfo | URL): Promise<Response> => {
		const url = String(input);
		if (opts.failingUrlSubstring !== undefined && url.includes(opts.failingUrlSubstring)) {
			return new Response('', { status: 404 });
		}
		// AIM probe URLs (sections beyond the configured count) must 404 so
		// the AIM section-count check passes.
		const m = url.match(/chap(\d+)_section_(\d+)\.html/);
		if (m !== null) {
			const counts = [1, 9, 5, 7, 14, 6, 5, 7, 1, 4, 7, 6];
			const c = Number.parseInt(m[1] ?? '0', 10);
			const s = Number.parseInt(m[2] ?? '0', 10);
			if (s > (counts[c] ?? 0)) return new Response('', { status: 404 });
		}
		// Two-hop scrape pages: PHAK index returns 12 chapter links;
		// each chapter page returns one .pdf link. The scraper needs PHAK
		// chapter_count = 17 chapters but our YAML says 17, so the index
		// must list at least 17 chapter links. Build them on demand.
		if (url.endsWith('/aviation/phak') || url.endsWith('/aviation/phak/')) {
			const links: string[] = [];
			for (let n = 1; n <= 17; n += 1) {
				links.push(`<a href="${url}/chapter-${n}-test">Chapter ${n}</a>`);
			}
			return new Response(`<html><body>${links.join('\n')}</body></html>`, {
				status: 200,
				headers: { 'Content-Type': 'text/html', 'Content-Length': String(links.join('').length) },
			});
		}
		if (url.includes('/aviation/phak/chapter-')) {
			return new Response('<html><body><a href="/test/file.pdf">PDF</a></body></html>', {
				status: 200,
				headers: { 'Content-Type': 'text/html', 'Content-Length': '64' },
			});
		}
		return new Response('', {
			status: 200,
			headers: {
				'Content-Length': '1024',
				'Content-Type': url.endsWith('.html') ? 'text/html' : 'application/pdf',
			},
		});
	}) as typeof fetch;
}
