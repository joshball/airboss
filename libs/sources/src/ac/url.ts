/**
 * Phase 8 -- FAA AC live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`ac` corpus URL conventions).
 *
 * The FAA hosts ACs at `documentLibrary/media/Advisory_Circular/AC_<doc>.pdf`
 * with the revision letter capitalized inline (e.g. `AC_61-65J.pdf`). The
 * pattern is stable enough to compose without consulting a per-doc lookup.
 * When a manifest records a more specific URL (the actual fetched source),
 * the resolver may surface that via `Edition.source_url` -- but the canonical
 * "open this in a browser" URL stays at the FAA filename convention so it
 * works offline.
 *
 * Dot-style doc numbers (e.g. `91-21.1`): the locator stores the doc number
 * with a dash between the major series and the trailing dot-component (the
 * shape the AC ingest reconstructs from the doc-id slug + edition prefix). The
 * FAA filename inverts that separator: `AC_91.21-1D.pdf`, NOT `AC_91-21.1D.pdf`
 * (confirmed against `scripts/sources/config/ac.yaml` -- the explicit URL row
 * for `ac-91-21-1d` ships `AC_91.21-1D.pdf`). The composer flips the first
 * dash and dot for any locator whose doc number matches `<a>-<b>.<c>`.
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, ParsedAcLocator, SourceId } from '../types.ts';
import { parseAcLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:ac/';

const FAA_AC_BASE = 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_';

/**
 * Map an AC locator's doc number to the FAA's filename form. For `<a>-<b>.<c>`
 * locators (e.g. `91-21.1`) the FAA flips the separators to `<a>.<b>-<c>`
 * (e.g. `91.21-1`). All other shapes pass through unchanged.
 */
export function acDocNumberToFaaFilename(docNumber: string): string {
	const dotStyleMatch = /^(\d+)-(\d+)\.(\d+)$/.exec(docNumber);
	if (dotStyleMatch !== null) {
		const major = dotStyleMatch[1];
		const minor = dotStyleMatch[2];
		const trailing = dotStyleMatch[3];
		if (major !== undefined && minor !== undefined && trailing !== undefined) {
			return `${major}.${minor}-${trailing}`;
		}
	}
	return docNumber;
}

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

	const ac: ParsedAcLocator = parsed.ac;
	const docFilename = acDocNumberToFaaFilename(ac.docNumber);
	const revUpper = ac.revision.toUpperCase();
	return `${FAA_AC_BASE}${docFilename}${revUpper}.pdf`;
}
