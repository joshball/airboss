/**
 * eCFR title metadata accessor.
 *
 * The eCFR Versioner only serves snapshots for dates that exist in its
 * amendment history. We hit `/api/versioner/v1/titles.json` once per run to
 * pick each title's `latest_amended_on` so we never request a date the API
 * cannot serve.
 *
 * `_setCachedTitlesForTest` is a test seam used by `download.test.ts` to
 * pre-load the cache and avoid touching the live API.
 *
 * Hardening: a 30 s `AbortController` timeout bounds the call so a hung eCFR
 * endpoint cannot stall an entire `bun run sources download` invocation. A
 * single retry with linear backoff is layered on top so a transient 5xx /
 * timeout is recovered automatically; see security review #4 +
 * backend "fetchEcfrTitles no timeout/retry" finding.
 */

import { SOURCE_ACTION_LIMITS } from '@ab/constants';
import { sleep } from '../../lib/sleep';
import { USER_AGENT } from './constants';

const ECFR_TITLES_URL = 'https://www.ecfr.gov/api/versioner/v1/titles.json';

export interface EcfrTitleMeta {
	readonly number: number;
	readonly latest_amended_on: string;
}

export interface EcfrTitlesResponse {
	readonly titles: readonly EcfrTitleMeta[];
}

let cachedTitles: EcfrTitlesResponse | null = null;

export async function fetchEcfrTitles(fetchImpl: typeof fetch = globalThis.fetch): Promise<EcfrTitlesResponse> {
	if (cachedTitles !== null) return cachedTitles;
	const maxAttempts = SOURCE_ACTION_LIMITS.DOWNLOAD_MAX_RETRIES;
	let lastError: Error | null = null;
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const parsed = await fetchTitlesOnce(fetchImpl);
			cachedTitles = parsed;
			return parsed;
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));
			if (attempt >= maxAttempts || !isTransientTitlesError(lastError)) {
				throw lastError;
			}
			const delay = SOURCE_ACTION_LIMITS.DOWNLOAD_BACKOFF_BASE_MS * 2 ** (attempt - 1);
			await sleep(delay);
		}
	}
	// Unreachable: the loop either returns or throws. Assertive default keeps
	// the type checker honest without the non-null assertion CLAUDE.md bans.
	throw lastError ?? new Error('fetchEcfrTitles: exhausted retries with no captured error');
}

async function fetchTitlesOnce(fetchImpl: typeof fetch): Promise<EcfrTitlesResponse> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), SOURCE_ACTION_LIMITS.METADATA_FETCH_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetchImpl(ECFR_TITLES_URL, {
			headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timer);
	}
	if (!response.ok) {
		throw new Error(`failed to fetch eCFR titles metadata: HTTP ${response.status}`);
	}
	const parsed = (await response.json()) as EcfrTitlesResponse;
	if (!Array.isArray(parsed.titles)) {
		throw new Error('eCFR titles response missing titles array');
	}
	return parsed;
}

function isTransientTitlesError(error: Error): boolean {
	const msg = error.message.toLowerCase();
	if (msg.includes('http 5')) return true;
	if (error.name === 'AbortError') return true;
	return msg.includes('timeout') || msg.includes('network') || msg.includes('socket');
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

export { ECFR_TITLES_URL };
