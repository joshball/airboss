/**
 * Dev-only edition-resolver override.
 *
 * When `HANGAR_EDITION_STUB_URL` is set, the binary-visual fetch pipeline
 * reads the HTML payload from that location (http(s):// URL or local
 * filesystem path) instead of the source's configured AeroNav index URL.
 * This lets operators exercise the "next edition available" path in the
 * wp-hangar-non-textual manual walkthrough (test-plan step 18) without
 * waiting for the real 56-day cycle to roll.
 *
 * Flag is OFF by default. Activation requires an explicit env var AND a
 * non-production NODE_ENV -- production refuses to honour the override so
 * a leftover env cannot corrupt a live fetch.
 *
 * Returns `null` when the override is not active, so callers can fall back
 * to the real fetcher with no behavioural change.
 */

import { readFile } from 'node:fs/promises';
import { ENV_VARS, getEnv, isProd } from '@ab/constants';

/** Shape the sectional resolver accepts for `fetchHtml`. */
export type FetchHtmlFn = (url: string) => Promise<string>;

/** Read the stub location. File paths win when the value does not look like a URL. */
async function readStubPayload(stubLocation: string): Promise<string> {
	if (/^https?:\/\//i.test(stubLocation)) {
		const res = await fetch(stubLocation);
		if (!res.ok) {
			throw new Error(`${ENV_VARS.HANGAR_EDITION_STUB_URL}: HTTP ${res.status} fetching stub at ${stubLocation}`);
		}
		return await res.text();
	}
	// Treat as a filesystem path (absolute or relative to cwd).
	const trimmed = stubLocation.replace(/^file:\/\//i, '');
	return await readFile(trimmed, 'utf8');
}

/**
 * Build a `fetchHtml` function that ignores the requested URL and returns
 * the contents of `HANGAR_EDITION_STUB_URL` instead. Returns `null` when
 * the override is not active so the caller can use the default fetcher.
 */
export function makeStubFetchHtml(): FetchHtmlFn | null {
	const stubLocation = getEnv(ENV_VARS.HANGAR_EDITION_STUB_URL);
	if (!stubLocation) return null;
	if (isProd()) return null;
	return async () => await readStubPayload(stubLocation);
}

/**
 * Wrap an optional real fetcher so the stub takes precedence when active.
 * Used by `makeFetchHandler` to honour the env var without forcing every
 * call-site to know about dev-only behaviour.
 */
export function withEditionStub(realFetchHtml?: FetchHtmlFn): FetchHtmlFn | undefined {
	const stub = makeStubFetchHtml();
	if (stub) return stub;
	return realFetchHtml;
}
