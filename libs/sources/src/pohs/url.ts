/**
 * Phase 10 -- Pilot Operating Handbook live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`pohs` corpus URL conventions).
 *
 * POHs are manufacturer-published, copyrighted documents. There is no
 * authoritative public URL formula -- per-aircraft availability ranges
 * from "free PDF on the manufacturer's pilot portal" to "paywalled
 * service-bulletin tracker" to "out of print, secondary market only".
 *
 * The first-slice resolver returns null. When per-aircraft ingestion
 * lands, the registry entry's `source_url` will surface the canonical
 * link for that specific POH.
 */

import type { EditionId, SourceId } from '../types.ts';

/**
 * No formula composes for `pohs`. POHs are manufacturer-published with
 * no stable URL convention; per-aircraft `source_url` lives on the
 * registry entry once ingestion lands.
 */
export function getPohsLiveUrl(_id: SourceId, _edition: EditionId): string | null {
	return null;
}
