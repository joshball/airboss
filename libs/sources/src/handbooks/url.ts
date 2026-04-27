/**
 * Phase 6 -- FAA handbook live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`handbooks` corpus URL conventions) + the WP at
 * `docs/work-packages/reference-handbook-ingestion/`.
 *
 * The FAA does not deep-link individual chapters or sections of its handbooks;
 * the public landing page for each handbook is the directory containing the
 * full PDF. The resolver returns the per-doc landing URL. When the manifest
 * records a more specific source URL (e.g. the PDF itself), the resolver may
 * surface that via `Edition.source_url` -- but the canonical "open this in a
 * browser" URL stays at the directory level.
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseHandbooksLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:handbooks/';

/**
 * Per-doc public landing pages. Adding a new handbook means adding here AND
 * extending `HANDBOOK_DOC_SLUGS` in `locator.ts`.
 */
export const HANDBOOK_LIVE_URLS: Record<string, string> = {
	phak: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
	afh: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook',
	avwx: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/aviation_weather_handbook',
};

/**
 * Build the FAA URL for a given `handbooks` entry + edition. Returns the
 * doc-level landing URL; FAA does not provide section-level deep links for
 * the handbook PDFs. Returns null when the SourceId can't be parsed
 * (defensive; the validator should already have rejected such inputs upstream).
 */
export function getHandbooksLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parseHandbooksLocator(locator);
	if (parsed.kind !== 'ok' || parsed.handbooks === undefined) return null;

	return HANDBOOK_LIVE_URLS[parsed.handbooks.doc] ?? null;
}
