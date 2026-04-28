/**
 * Phase 10 -- FAA forms live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`forms` corpus URL conventions).
 *
 * The FAA forms catalog publishes each form behind a CMS-managed
 * `documentID` query parameter (e.g. `documentID/123456`). The
 * documentID does not compose stably from the form number, so the
 * formula returns null. Per-form ingestion records the canonical
 * `source_url` on the registry entry's edition; the resolver surfaces
 * that via `Edition.source_url` once ingestion lands.
 *
 * Authors who want to deep-link to a specific form rev should record the
 * URL on the registry entry; this builder will return null until then.
 */

import type { EditionId, SourceId } from '../types.ts';

/**
 * No formula composes for `forms`. The FAA forms portal keys on a
 * CMS-managed `documentID` that doesn't compose from the form number.
 */
export function getFormsLiveUrl(_id: SourceId, _edition: EditionId): string | null {
	return null;
}
