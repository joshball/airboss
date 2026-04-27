/**
 * FAA ACS / PTS live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`acs` corpus URL conventions) + the WP at
 * `docs/work-packages/cert-syllabus-and-goal-composer/`.
 *
 * The FAA does not deep-link individual areas / tasks / elements within an
 * ACS publication; the public landing page is the FAA test-standards index
 * (or the cert-specific landing page when known). The resolver returns the
 * cert-specific landing URL when one is registered; otherwise it returns
 * the test-standards index.
 *
 * Per-cert URLs are best-effort: when the FAA renames the cert page (it has
 * happened repeatedly through the 2020s), this table is the one place to
 * update.
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseAcsLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:acs/';

/** FAA test-standards landing page. Used as the fallback. */
export const ACS_TEST_STANDARDS_INDEX_URL = 'https://www.faa.gov/training_testing/testing/acs';

/**
 * Per-cert public landing pages. Adding a new cert means adding here AND
 * extending `ACS_CERT_SLUGS` in `locator.ts`. Missing cert -> falls back to
 * the index URL.
 */
export const ACS_CERT_LIVE_URLS: Record<string, string> = {
	'ppl-asel': 'https://www.faa.gov/training_testing/testing/acs/private_airplane',
	'ppl-amel': 'https://www.faa.gov/training_testing/testing/acs/private_airplane',
	'ppl-helo': 'https://www.faa.gov/training_testing/testing/acs/private_helicopter',
	ipl: 'https://www.faa.gov/training_testing/testing/acs/instrument_airplane',
	'cpl-asel': 'https://www.faa.gov/training_testing/testing/acs/commercial_airplane',
	'cpl-amel': 'https://www.faa.gov/training_testing/testing/acs/commercial_airplane',
	'atp-amel': 'https://www.faa.gov/training_testing/testing/acs/atp',
	'cfi-asel': 'https://www.faa.gov/training_testing/testing/acs/cfi_airplane',
	'cfi-amel': 'https://www.faa.gov/training_testing/testing/acs/cfi_airplane',
	'cfii-asel': 'https://www.faa.gov/training_testing/testing/acs/cfi_airplane',
	'cfii-amel': 'https://www.faa.gov/training_testing/testing/acs/cfi_airplane',
	mei: 'https://www.faa.gov/training_testing/testing/acs/cfi_airplane',
	meii: 'https://www.faa.gov/training_testing/testing/acs/cfi_airplane',
};

/**
 * Build the FAA URL for a given `acs` entry + edition. Returns the cert-
 * specific landing URL when registered; otherwise the test-standards index.
 * Returns null when the SourceId does not parse as an `acs` identifier.
 */
export function getAcsLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);
	const parsed = parseAcsLocator(locator);
	if (parsed.kind !== 'ok' || parsed.acs === undefined) return null;
	return ACS_CERT_LIVE_URLS[parsed.acs.cert] ?? ACS_TEST_STANDARDS_INDEX_URL;
}
