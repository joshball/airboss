/**
 * NTSB-ALJ live URL builder.
 *
 * Source of truth: WP-NTSB-ALJ spec at `docs/work-packages/wp-ntsb-alj/spec.md`
 * + library-completeness §4.A (`https://www.ntsb.gov/legal/alj/Pages/default.aspx`).
 *
 * Like SAFO, the NTSB-OALJ portal indexes ALJ rulings without a stable
 * per-ruling download URL composable from the case number alone -- ALJ
 * decisions are CMS-managed PDFs whose filenames don't round-trip cleanly
 * from the docket id. The formula falls back to the OALJ landing page
 * where readers can search by case number. Per-ruling override URLs are
 * carried on the manifest's `source_url` field on each edition row.
 *
 * URL form:
 *   https://www.ntsb.gov/legal/alj/Pages/default.aspx
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseNtsbAljLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:ntsb-alj/';

const NTSB_ALJ_BASE = 'https://www.ntsb.gov/legal/alj/Pages/default.aspx';

/**
 * Build the NTSB-OALJ landing-page URL. Returns null for non-ntsb-alj
 * SourceIds or malformed locators.
 */
export function getNtsbAljLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parseNtsbAljLocator(locator);
	if (parsed.kind !== 'ok' || parsed.ntsbAlj === undefined) return null;

	return NTSB_ALJ_BASE;
}
