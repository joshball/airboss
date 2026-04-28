/**
 * Shared literals for the source-downloader modules.
 *
 * Pulled out of `plans.ts` to break a circular import between `plans.ts` and
 * `ecfr.ts` (both need `USER_AGENT`).
 */

export const SCHEMA_VERSION = 1;
export const USER_AGENT = 'airboss-source-downloader/1.0 (+https://github.com/joshball/airboss)';

export const MAX_REDIRECTS = 5;
export const RETRY_DELAY_MS = 5000;
export const NETWORK_TIMEOUT_MS = 120_000;
