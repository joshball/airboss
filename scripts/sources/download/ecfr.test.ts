/**
 * Cluster-E hardening tests for the eCFR titles fetcher.
 *
 * The fetcher now:
 *   - sets an `AbortController` timeout per attempt
 *   - retries up to `ECFR_TITLES_MAX_ATTEMPTS` on transient errors (5xx / network)
 *   - does NOT retry on 4xx
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _setCachedTitlesForTest, ECFR_TITLES_MAX_ATTEMPTS, ECFR_TITLES_URL, fetchEcfrTitles } from './ecfr';

const TITLES_BODY = {
	titles: [
		{ number: 14, latest_amended_on: '2026-04-22' },
		{ number: 49, latest_amended_on: '2026-04-20' },
	],
};

beforeEach(() => {
	_setCachedTitlesForTest(null);
});

afterEach(() => {
	_setCachedTitlesForTest(null);
});

describe('fetchEcfrTitles -- cluster-E hardening', () => {
	it('returns the parsed titles on a happy 200 response', async () => {
		const fakeFetch: typeof fetch = async (input: RequestInfo | URL): Promise<Response> => {
			expect(String(input)).toBe(ECFR_TITLES_URL);
			return new Response(JSON.stringify(TITLES_BODY), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		};
		const result = await fetchEcfrTitles(fakeFetch);
		expect(result.titles).toHaveLength(2);
	});

	it('caches the response across calls', async () => {
		let calls = 0;
		const fakeFetch: typeof fetch = async (): Promise<Response> => {
			calls += 1;
			return new Response(JSON.stringify(TITLES_BODY), { status: 200 });
		};
		await fetchEcfrTitles(fakeFetch);
		await fetchEcfrTitles(fakeFetch);
		expect(calls).toBe(1);
	});

	it('retries on a transient 5xx and succeeds on a later attempt', async () => {
		let attempts = 0;
		const fakeFetch: typeof fetch = async (): Promise<Response> => {
			attempts += 1;
			if (attempts === 1) return new Response('upstream', { status: 503 });
			return new Response(JSON.stringify(TITLES_BODY), { status: 200 });
		};
		const result = await fetchEcfrTitles(fakeFetch, async () => {});
		expect(result.titles).toHaveLength(2);
		expect(attempts).toBe(2);
	});

	it('throws after ECFR_TITLES_MAX_ATTEMPTS attempts on persistent 5xx', async () => {
		let attempts = 0;
		const fakeFetch: typeof fetch = async (): Promise<Response> => {
			attempts += 1;
			return new Response('upstream', { status: 503 });
		};
		await expect(fetchEcfrTitles(fakeFetch, async () => {})).rejects.toThrow(/HTTP 503/);
		expect(attempts).toBe(ECFR_TITLES_MAX_ATTEMPTS);
	});

	it('does not retry on 4xx', async () => {
		let attempts = 0;
		const fakeFetch: typeof fetch = async (): Promise<Response> => {
			attempts += 1;
			return new Response('not found', { status: 404 });
		};
		await expect(fetchEcfrTitles(fakeFetch, async () => {})).rejects.toThrow(/HTTP 404/);
		expect(attempts).toBe(1);
	});
});
