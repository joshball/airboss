/**
 * Per-page helper that builds the `<SourceLinks>` payload from a reference
 * row. Called from every flightbag `+page.server.ts` so the link to the FAA
 * canonical PDF (when cached locally) and the online source URL render
 * consistently across handbook / AIM / CFR / AC / ACS pages.
 *
 * Server-only: probes the local cache via `cachedSourcePdfExists`. Pages pass
 * the resolved payload back to the page component; the component itself
 * (`<SourceLinks>` in `@ab/library`) is browser-safe.
 */

import { externalUrlForReference, REFERENCE_KINDS, type ReferenceKind, ROUTES } from '@ab/constants';
import { cachedSourcePdfExists, describeSourcePdf } from '@ab/sources';

export interface SourceLinksData {
	/** Link to the canonical online source (FAA web page or eCFR section). `null` when no useful URL exists. */
	readonly onlineUrl: string | null;
	/** Link to the locally cached PDF, served via `/source-pdf/...`. `null` when the cache miss / no canonical PDF. */
	readonly localPdfHref: string | null;
	/** Whether the corpus has a canonical PDF that simply isn't cached on this dev box. */
	readonly localPdfMissing: boolean;
}

export function buildSourceLinks(args: {
	kind: ReferenceKind;
	documentSlug: string;
	edition: string;
	url: string | null;
}): SourceLinksData {
	const { kind, documentSlug, edition, url } = args;
	// `externalUrlForReference` deliberately returns `null` for handbooks
	// because the **library index** treats handbooks as in-app reading
	// surfaces (no off-site link on the card). The flightbag reader is the
	// in-app surface, so its "Online source" cluster should still expose
	// the canonical FAA PDF URL when one is recorded on the reference row.
	// We bypass the helper for handbook rows and read the manifest URL
	// directly; every other kind keeps the helper's resolution order.
	const onlineUrl = kind === REFERENCE_KINDS.HANDBOOK ? url : externalUrlForReference(kind, documentSlug, edition, url);

	const descriptor = describeSourcePdf({ kind, documentSlug, edition });
	if (descriptor === null) {
		return { onlineUrl, localPdfHref: null, localPdfMissing: false };
	}
	const exists = cachedSourcePdfExists(descriptor.cacheRelPath);
	return {
		onlineUrl,
		localPdfHref: exists ? ROUTES.FLIGHTBAG_SOURCE_PDF(descriptor.cacheRelPath) : null,
		localPdfMissing: !exists,
	};
}
