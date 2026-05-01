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
 *
 * Dot-style ACs: a small set of ACs (e.g. AC 91-21.1D) carry a trailing
 * dotted component in the doc number. The locator stores them as
 * `<a>-<b>.<c>` (dash-then-dot, the locator's canonical form) but the FAA
 * publishes the same document at `<a>.<b>-<c>` (dot-then-dash, e.g.
 * `AC_91.21-1D.pdf`, see `scripts/sources/config/ac.yaml`). The builder
 * swaps separator positions on the way out so the live URL matches what FAA
 * actually serves.
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseAcLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:ac/';

const FAA_AC_BASE = 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_';

/**
 * Translate the locator's dash/dot doc number into the FAA's dot/dash form.
 *
 * Locator form: `<a>-<b>.<c>` (e.g. `91-21.1`).
 * FAA form:     `<a>.<b>-<c>` (e.g. `91.21-1`, served at `AC_91.21-1D.pdf`).
 *
 * Doc numbers without a trailing dotted component pass through unchanged
 * (`61-65` -> `61-65`, served at `AC_61-65J.pdf`).
 */
export function toFaaDocFilename(docNumber: string): string {
	return docNumber.replace(/^(\d+)-(\d+)\.(\d+)$/, '$1.$2-$3');
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

	const docFilename = toFaaDocFilename(parsed.ac.docNumber);
	const revUpper = parsed.ac.revision.toUpperCase();
	return `${FAA_AC_BASE}${docFilename}${revUpper}.pdf`;
}
