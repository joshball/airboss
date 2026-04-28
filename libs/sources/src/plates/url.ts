/**
 * Phase 10 -- Approach plate live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`plates` corpus URL conventions).
 *
 * The FAA Digital Terminal Procedures Publication (dTPP) hosts plates on
 * a per-cycle, per-airport listing. Procedure-specific deep-link URLs
 * embed cycle date + a CMS-managed PDF filename that doesn't compose
 * stably from the procedure slug alone. The live URL falls back to the
 * dTPP landing page where readers select airport + cycle.
 *
 * URL form:
 *   https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parsePlatesLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:plates/';

const FAA_DTPP_BASE = 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp';

/**
 * Build the dTPP landing-page URL. Returns null for non-plates SourceIds
 * or malformed locators.
 */
export function getPlatesLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parsePlatesLocator(locator);
	if (parsed.kind !== 'ok' || parsed.plates === undefined) return null;

	return FAA_DTPP_BASE;
}
