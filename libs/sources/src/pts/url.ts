/**
 * FAA PTS live URL builder.
 *
 * The FAA does not deep-link individual areas / tasks / objectives within
 * a PTS publication. The resolver returns the publication-specific PDF URL
 * when registered; otherwise the test-standards index.
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parsePtsLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:pts/';

/** FAA test-standards landing page (shared with ACS). Used as the fallback. */
export const PTS_TEST_STANDARDS_INDEX_URL = 'https://www.faa.gov/training_testing/testing/acs';

/**
 * Per-publication public landing pages. Adding a new publication means
 * adding it here AND extending `PTS_PUBLICATION_SLUGS` in `locator.ts`.
 * Missing slug -> falls back to the index URL.
 */
export const PTS_PUBLICATION_LIVE_URLS: Record<string, string> = {
	'cfii-airplane-9e': 'https://www.faa.gov/training_testing/testing/acs/cfi_instrument_pts_9.pdf',
};

/**
 * Build the FAA URL for a given `pts` entry + edition. Returns the
 * publication-specific PDF URL when registered; otherwise the
 * test-standards index. Returns null when the SourceId does not parse as
 * a `pts` identifier.
 */
export function getPtsLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);
	const parsed = parsePtsLocator(locator);
	if (parsed.kind !== 'ok' || parsed.pts === undefined) return null;
	return PTS_PUBLICATION_LIVE_URLS[parsed.pts.slug] ?? PTS_TEST_STANDARDS_INDEX_URL;
}
