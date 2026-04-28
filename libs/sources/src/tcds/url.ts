/**
 * Phase 10 -- TCDS live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`tcds` corpus URL conventions).
 *
 * The FAA Regulatory and Guidance Library (RGL) hosts TCDSs at deep
 * URLs that vary per TCDS (the path embeds a CMS document id keyed on
 * model, not the TCDS number itself). The formula falls back to the
 * TCDS landing page where readers select the type by manufacturer.
 *
 * URL form:
 *   https://www.faa.gov/aircraft/air_cert/design_approvals/transport/typecertdatasheets
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseTcdsLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:tcds/';

const FAA_TCDS_BASE = 'https://www.faa.gov/aircraft/air_cert/design_approvals/transport/typecertdatasheets';

/**
 * Build the TCDS landing-page URL. Returns null for non-tcds SourceIds
 * or malformed locators.
 */
export function getTcdsLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parseTcdsLocator(locator);
	if (parsed.kind !== 'ok' || parsed.tcds === undefined) return null;

	return FAA_TCDS_BASE;
}
