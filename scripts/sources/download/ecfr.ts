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
 */

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
	const response = await fetchImpl(ECFR_TITLES_URL, {
		headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
	});
	if (!response.ok) {
		throw new Error(`failed to fetch eCFR titles metadata: HTTP ${response.status}`);
	}
	const parsed = (await response.json()) as EcfrTitlesResponse;
	if (!Array.isArray(parsed.titles)) {
		throw new Error('eCFR titles response missing titles array');
	}
	cachedTitles = parsed;
	return parsed;
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
