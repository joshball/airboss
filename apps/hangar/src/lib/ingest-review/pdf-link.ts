/**
 * Build a `file://` URL for "View page N in PDF" buttons.
 *
 * Per the WP design (`docs/work-packages/hangar-ingest-review-queue/design.md`),
 * v1 ships an external file:// link only -- no embedded viewer. The link
 * resolves against the developer-local source cache root (per ADR 018).
 *
 * Pure function: takes the already-resolved cache root + issue
 * coordinates and renders a file:// URL. The cache root is computed in
 * `+page.server.ts` via `resolveCacheRoot({ ensureExists: false })` from
 * `@ab/constants` (server-only because it reads `process.env`); this
 * helper is browser-safe so it can be re-rendered client-side if a
 * future feature wants a deep link without a server round-trip.
 */

export interface PdfLinkInput {
	corpus: string;
	sourceId: string;
	edition: string | null;
	pageNum: number | null;
}

/**
 * Render a `file://` URL pointing at the canonical PDF in the cache,
 * with a `#page=N` fragment hint. Returns `null` when there's no
 * meaningful target (page-less issue or non-handbook corpus).
 *
 * Layout:
 *
 *   <cacheRoot>/handbooks/<slug>/<edition>/<edition>.pdf
 */
export function pdfLinkFor(cacheRoot: string, input: PdfLinkInput): string | null {
	if (input.pageNum === null) return null;
	if (input.corpus !== 'handbook') return null;
	if (!input.edition) return null;
	const trimmed = cacheRoot.replace(/\/+$/, '');
	const path = `${trimmed}/handbooks/${input.sourceId}/${input.edition}/${input.edition}.pdf`;
	return `file://${path}#page=${input.pageNum}`;
}
