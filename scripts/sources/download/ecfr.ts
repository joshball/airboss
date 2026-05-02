/**
 * eCFR title metadata accessor.
 *
 * The eCFR Versioner only serves snapshots for dates that exist in its
 * amendment history. We hit `/api/versioner/v1/titles.json` once per run to
 * pick each title's `latest_amended_on` so we never request a date the API
 * cannot serve.
 *
 * Hardening (cluster E):
 *   - Wrap the fetch in an `AbortController` with `NETWORK_TIMEOUT_MS` so a
 *     hung eCFR endpoint cannot stall the entire run.
 *   - Add a bounded retry (up to ECFR_TITLES_MAX_ATTEMPTS) on transient errors
 *     (timeout / 5xx) with `RETRY_DELAY_MS` backoff between attempts.
 *
 * `_setCachedTitlesForTest` is a test seam used by `download.test.ts` to
 * pre-load the cache and avoid touching the live API.
 */

import { sleep } from '../../lib/sleep';
import { NETWORK_TIMEOUT_MS, RETRY_DELAY_MS, USER_AGENT } from './constants';

const ECFR_TITLES_URL = 'https://www.ecfr.gov/api/versioner/v1/titles.json';

/**
 * Maximum attempts (initial + retries) for the titles fetch. Keep it small:
 * the titles endpoint either returns quickly or is hung; we don't want a long
 * retry tail blocking `bun run sources download`.
 */
const ECFR_TITLES_MAX_ATTEMPTS = 3;

export interface EcfrTitleMeta {
	readonly number: number;
	readonly latest_amended_on: string;
}

export interface EcfrTitlesResponse {
	readonly titles: readonly EcfrTitleMeta[];
}

let cachedTitles: EcfrTitlesResponse | null = null;

/**
 * Optional sleep override. Tests pass a no-op so the retry loop runs fast.
 */
export type SleepImpl = (ms: number) => Promise<void>;

export async function fetchEcfrTitles(
	fetchImpl: typeof fetch = globalThis.fetch,
	sleepImpl: SleepImpl = sleep,
): Promise<EcfrTitlesResponse> {
	if (cachedTitles !== null) return cachedTitles;
	let lastError: Error | null = null;
	for (let attempt = 1; attempt <= ECFR_TITLES_MAX_ATTEMPTS; attempt += 1) {
		try {
			const parsed = await fetchOnce(fetchImpl);
			cachedTitles = parsed;
			return parsed;
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));
			if (attempt >= ECFR_TITLES_MAX_ATTEMPTS || !isTransient(lastError)) {
				throw lastError;
			}
			await sleepImpl(RETRY_DELAY_MS);
		}
	}
	// Unreachable but the type checker can't see it.
	throw lastError ?? new Error('eCFR titles fetch failed for an unknown reason');
}

async function fetchOnce(fetchImpl: typeof fetch): Promise<EcfrTitlesResponse> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetchImpl(ECFR_TITLES_URL, {
			signal: controller.signal,
			headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
		});
	} finally {
		clearTimeout(timer);
	}
	if (!response.ok) {
		const httpError = new Error(`failed to fetch eCFR titles metadata: HTTP ${response.status}`);
		(httpError as Error & { status?: number }).status = response.status;
		throw httpError;
	}
	const parsed = (await response.json()) as EcfrTitlesResponse;
	if (!Array.isArray(parsed.titles)) {
		throw new Error('eCFR titles response missing titles array');
	}
	return parsed;
}

function isTransient(error: Error): boolean {
	const status = (error as Error & { status?: number }).status;
	if (typeof status === 'number') {
		return status >= 500 && status < 600;
	}
	const msg = error.message.toLowerCase();
	return msg.includes('timeout') || msg.includes('network') || msg.includes('socket') || error.name === 'AbortError';
}

export function latestAmendedOnFor(titles: EcfrTitlesResponse, title: '14' | '49'): string {
	const entry = titles.titles.find((t) => String(t.number) === title);
	if (entry === undefined) {
		throw new Error(`eCFR titles response did not include title ${title}`);
	}
	if (typeof entry.latest_amended_on !== 'string' || entry.latest_amended_on.length === 0) {
		throw new Error(`eCFR title ${title} has no latest_amended_on`);
	}
	return entry.latest_amended_on;
}

/** Test seam: pre-load the titles cache so buildPlans does not need to fetch. */
export function _setCachedTitlesForTest(titles: EcfrTitlesResponse | null): void {
	cachedTitles = titles;
}

export { ECFR_TITLES_MAX_ATTEMPTS, ECFR_TITLES_URL };
