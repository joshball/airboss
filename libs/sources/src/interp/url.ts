/**
 * Phase 10 -- Legal interpretations live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`interp` corpus URL conventions).
 *
 * The FAA Office of the Chief Counsel publishes interpretation letters at
 * a CMS-managed index. There is no stable URL formula keyed on
 * `<author>-<year>` -- each letter has an opaque CMS document ID. The live
 * URL falls back to the interpretations landing page so authors can locate
 * the letter via the on-page filter.
 *
 * NTSB Board orders likewise live behind a search interface; the
 * `?ea=<order-number>` discriminator is queryable on the NTSB Aviation
 * Appeals page once the reader gets there.
 *
 * URL form (chief-counsel):
 *   https://www.faa.gov/about/office_org/headquarters_offices/agc/practice_areas/regulations/interpretations/
 *
 * URL form (ntsb):
 *   https://www.ntsb.gov/legal/Pages/aviation_appeals.aspx
 *
 * When per-letter ingestion lands and records the actual `source_url` on
 * the registry entry, the resolver will surface that via `Edition.source_url`
 * -- but the offline fallback stays at these landing pages so the reader
 * always has somewhere to go.
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseInterpLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:interp/';

const FAA_CHIEF_COUNSEL_BASE =
	'https://www.faa.gov/about/office_org/headquarters_offices/agc/practice_areas/regulations/interpretations';
const NTSB_AVIATION_APPEALS_BASE = 'https://www.ntsb.gov/legal/Pages/aviation_appeals.aspx';

/**
 * Build the live URL for an `interp` entry. The edition argument is accepted
 * for `CorpusResolver` interface conformance.
 */
export function getInterpLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parseInterpLocator(locator);
	if (parsed.kind !== 'ok' || parsed.interp === undefined) return null;

	if (parsed.interp.authority === 'chief-counsel') {
		return FAA_CHIEF_COUNSEL_BASE;
	}
	return NTSB_AVIATION_APPEALS_BASE;
}
