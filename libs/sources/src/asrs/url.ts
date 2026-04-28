/**
 * Phase 10 -- ASRS live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`asrs` corpus URL conventions).
 *
 * NASA's ASRS database provides per-report deep-links keyed on the ACN
 * via `?acn=<acn>`. The formula composes a real, working URL.
 *
 * URL form:
 *   https://asrs.arc.nasa.gov/search/database.html?acn=<acn>
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseAsrsLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:asrs/';

const ASRS_DATABASE_BASE = 'https://asrs.arc.nasa.gov/search/database.html';

/**
 * Build the NASA ASRS deep-link URL for a given ACN. ASRS reports are
 * immutable so `_edition` is unused.
 */
export function getAsrsLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parseAsrsLocator(locator);
	if (parsed.kind !== 'ok' || parsed.asrs === undefined) return null;

	const url = new URL(ASRS_DATABASE_BASE);
	url.searchParams.set('acn', parsed.asrs.acn);
	return url.toString();
}
