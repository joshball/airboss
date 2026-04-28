/**
 * Phase 8 -- FAA AC live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`ac` corpus URL conventions).
 *
 * The FAA hosts ACs at `documentLibrary/media/Advisory_Circular/AC_<doc>.pdf`
 * with the doc number written without dots and the revision letter capitalized
 * inline (e.g. `AC_61-65J.pdf`). The pattern is stable enough to compose
 * without consulting a per-doc lookup. When a manifest records a more specific
 * URL (the actual fetched source), the resolver may surface that via
 * `Edition.source_url` -- but the canonical "open this in a browser" URL stays
 * at the FAA filename convention so it works offline.
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseAcLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:ac/';

const FAA_AC_BASE = 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_';

/**
 * Build the FAA URL for a given `ac` entry. The edition argument is accepted
 * for `CorpusResolver` interface conformance but unused -- AC URLs are
 * determined by doc number + revision, both encoded in the SourceId.
 */
export function getAcLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parseAcLocator(locator);
	if (parsed.kind !== 'ok' || parsed.ac === undefined) return null;

	const docFilename = parsed.ac.docNumber;
	const revUpper = parsed.ac.revision.toUpperCase();
	return `${FAA_AC_BASE}${docFilename}${revUpper}.pdf`;
}
