/**
 * FAA ACS live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`acs` corpus URL conventions) + the
 * cert-syllabus WP's locked Q7 format.
 *
 * The FAA does not deep-link individual areas / tasks / elements within an
 * ACS publication; the public landing page is the FAA test-standards index
 * (or the publication-specific landing page when known). The resolver
 * returns the publication-specific landing URL when one is registered;
 * otherwise it returns the test-standards index.
 *
 * Per-publication URLs are best-effort: when the FAA renames the cert page
 * (it has happened repeatedly through the 2020s), this table is the one
 * place to update.
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseAcsLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:acs/';

/** FAA test-standards landing page. Used as the fallback. */
export const ACS_TEST_STANDARDS_INDEX_URL = 'https://www.faa.gov/training_testing/testing/acs';

/**
 * Per-publication public landing pages. Adding a new publication means
 * adding it here AND extending `ACS_PUBLICATION_SLUGS` in `locator.ts`.
 * Missing slug -> falls back to the index URL.
 */
export const ACS_PUBLICATION_LIVE_URLS: Record<string, string> = {
	'ppl-airplane-6c': 'https://www.faa.gov/training_testing/testing/acs/private_airplane_acs_6.pdf',
	'ir-airplane-8c': 'https://www.faa.gov/training_testing/testing/acs/instrument_rating_airplane_acs_8.pdf',
	'cpl-airplane-7b': 'https://www.faa.gov/training_testing/testing/acs/commercial_airplane_acs_7.pdf',
	'cfi-airplane-25': 'https://www.faa.gov/training_testing/testing/acs/cfi_airplane_acs_25.pdf',
	'atp-airplane-11a': 'https://www.faa.gov/training_testing/testing/acs/atp_airplane_acs_11.pdf',
};

/**
 * Build the FAA URL for a given `acs` entry + edition. Returns the
 * publication-specific PDF URL when registered; otherwise the
 * test-standards index. Returns null when the SourceId does not parse as
 * an `acs` identifier.
 */
export function getAcsLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);
	const parsed = parseAcsLocator(locator);
	if (parsed.kind !== 'ok' || parsed.acs === undefined) return null;
	return ACS_PUBLICATION_LIVE_URLS[parsed.acs.slug] ?? ACS_TEST_STANDARDS_INDEX_URL;
}
