/**
 * Phase 10 -- SAFO live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`safo` corpus URL conventions).
 *
 * Like InFO, the FAA SAFO portal indexes Safety Alerts for Operators
 * by year and sequence, but the per-document download URL embeds a
 * CMS-managed filename that doesn't compose stably from the SAFO
 * number. The formula falls back to the landing page where readers
 * can search by SAFO number.
 *
 * URL form:
 *   https://www.faa.gov/other_visit/aviation_industry/airline_operators/airline_safety/safo
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseSafoLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:safo/';

const FAA_SAFO_BASE = 'https://www.faa.gov/other_visit/aviation_industry/airline_operators/airline_safety/safo';

/**
 * Build the SAFO landing-page URL. Returns null for non-safo SourceIds
 * or malformed locators.
 */
export function getSafoLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parseSafoLocator(locator);
	if (parsed.kind !== 'ok' || parsed.safo === undefined) return null;

	return FAA_SAFO_BASE;
}
