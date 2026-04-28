/**
 * Phase 10 -- InFO live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`info` corpus URL conventions).
 *
 * The FAA InFO portal indexes Information for Operators by year and
 * sequence, but the per-document download URL embeds a CMS-managed
 * filename (e.g. `InFO21010.pdf` works for some, while others use
 * `Info_21010.pdf` or other variants). The formula falls back to the
 * landing page where readers can search by InFO number.
 *
 * URL form:
 *   https://www.faa.gov/other_visit/aviation_industry/airline_operators/airline_safety/info
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseInfoLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:info/';

const FAA_INFO_BASE = 'https://www.faa.gov/other_visit/aviation_industry/airline_operators/airline_safety/info';

/**
 * Build the InFO landing-page URL. Returns null for non-info SourceIds
 * or malformed locators.
 */
export function getInfoLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parseInfoLocator(locator);
	if (parsed.kind !== 'ok' || parsed.info === undefined) return null;

	return FAA_INFO_BASE;
}
