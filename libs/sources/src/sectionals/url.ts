/**
 * Phase 10 -- VFR sectional chart live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`sectionals` corpus URL conventions).
 *
 * The FAA AeroNav portal hosts current and prior cycle sectionals. The
 * direct download URL embeds an edition-cycle date and a CMS-managed
 * filename that doesn't compose stably from chart name alone (file naming
 * varies per chart and per cycle). The live URL falls back to the
 * AeroNav VFR landing page where readers select the chart by name.
 *
 * URL form:
 *   https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseSectionalsLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:sectionals/';

const FAA_VFR_BASE = 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr';

/**
 * Build the AeroNav VFR landing-page URL. Returns null for non-sectionals
 * SourceIds or malformed locators.
 */
export function getSectionalsLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parseSectionalsLocator(locator);
	if (parsed.kind !== 'ok' || parsed.sectionals === undefined) return null;

	return FAA_VFR_BASE;
}
