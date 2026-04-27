/**
 * Phase 7 -- FAA AIM live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`aim` corpus URL conventions) + the WP at
 * `docs/work-packages/reference-aim-ingestion/`.
 *
 * The FAA does not deep-link individual AIM paragraphs; the public landing
 * page for the AIM is the directory containing the full document. The
 * resolver returns the AIM landing URL. When the manifest records a more
 * specific source URL (e.g. the PDF itself), the resolver may surface that
 * via `Edition.source_url` -- but the canonical "open this in a browser" URL
 * stays at the landing-page level.
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseAimLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:aim/';

/**
 * The FAA's AIM landing page. Adding a deep-link convention later (e.g. once
 * the FAA exposes per-paragraph anchors) means changing this constant or
 * extending `getAimLiveUrl` to compose an anchor.
 */
export const AIM_LIVE_URL = 'https://www.faa.gov/air_traffic/publications/atpubs/';

/**
 * Build the FAA URL for a given `aim` entry + edition. Returns the AIM
 * landing URL; FAA does not provide per-paragraph deep links. Returns null
 * when the SourceId can't be parsed (defensive; the validator should already
 * have rejected such inputs upstream).
 */
export function getAimLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parseAimLocator(locator);
	if (parsed.kind !== 'ok' || parsed.aim === undefined) return null;

	return AIM_LIVE_URL;
}
