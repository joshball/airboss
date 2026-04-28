/**
 * Phase 10 -- NTSB live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`ntsb` corpus URL conventions).
 *
 * NTSB hosts reports through the CAROL document repository; the public
 * search interface accepts an NTSB ID as a query parameter and returns
 * the matching report. Direct PDF URLs require an internal `event_id`
 * we can't derive from the NTSB ID without a registry lookup, so the
 * URL formula points at the search landing page with the NTSB ID
 * prefilled. When per-report ingestion lands and records the actual
 * `source_url` on the registry entry, the resolver will surface that
 * via `Edition.source_url` -- but the offline fallback stays at this
 * formula so it works without ingestion.
 *
 * URL form:
 *   https://data.ntsb.gov/carol-main-public/basic-search?queryString=<ntsbId>
 *
 * The section segment (factual / probable-cause / etc.) is rendered as
 * a hash fragment so the search landing page can scroll the reader to
 * the matching section once the report opens. This is best-effort --
 * NTSB's CAROL UI may not honor the fragment on every report layout.
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseNtsbLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:ntsb/';

const NTSB_CAROL_BASE = 'https://data.ntsb.gov/carol-main-public/basic-search';

/**
 * Build the NTSB URL for a given `ntsb` entry. NTSB IDs are immutable so
 * `_edition` is unused; the parameter is here for `CorpusResolver`
 * interface conformance.
 */
export function getNtsbLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parseNtsbLocator(locator);
	if (parsed.kind !== 'ok' || parsed.ntsb === undefined) return null;

	const url = new URL(NTSB_CAROL_BASE);
	url.searchParams.set('queryString', parsed.ntsb.ntsbId);
	const base = url.toString();
	if (parsed.ntsb.section !== undefined) {
		return `${base}#${parsed.ntsb.section}`;
	}
	return base;
}
