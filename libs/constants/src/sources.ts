/**
 * Source-ingestion operational constants.
 *
 * Used by the hangar sources v1 surface and the `libs/aviation/src/sources/download.ts`
 * port. Kept separate from `sim.ts` / `study.ts` so reference-system wiring doesn't
 * force a reach across unrelated domains.
 */

/** Limits that bound the cost of a single source-ingest operation. */
export const SOURCE_ACTION_LIMITS = {
	/** Hard cap on a single upload body. 500 MiB covers yearly CFR + AIM bundles. */
	MAX_UPLOAD_BYTES: 500 * 1024 * 1024,
	/** End-to-end timeout on a single download GET (wall clock). */
	DOWNLOAD_TIMEOUT_MS: 120_000,
	/** How many times to retry a failed fetch before giving up. */
	DOWNLOAD_MAX_RETRIES: 3,
	/** Linear backoff base: delay = BASE_MS * 2^(attempt-1). */
	DOWNLOAD_BACKOFF_BASE_MS: 1_000,
	/** HEAD probe timeout. HEAD is optional; short so we don't stall. */
	HEAD_TIMEOUT_MS: 60_000,
	/** Retained archived versions of a source binary before the oldest is pruned. */
	ARCHIVE_RETENTION: 3,
} as const;

/** User-Agent string sent by the source downloader. Advertises the tool honestly. */
export const SOURCE_DOWNLOADER_USER_AGENT =
	'Mozilla/5.0 (compatible; airboss-hangar/1.0; aviation reference ingestion)';

/** Extension -> previewer kind mapping for the /sources/[id]/files browser. */
export const PREVIEW_KINDS = {
	XML: 'xml',
	JSON: 'json',
	MARKDOWN: 'markdown',
	PDF: 'pdf',
	CSV: 'csv',
	TEXT: 'text',
	BINARY: 'binary',
} as const;

export type PreviewKind = (typeof PREVIEW_KINDS)[keyof typeof PREVIEW_KINDS];

/** Map lowercase extension (no leading `.`) -> preview kind. */
export const EXTENSION_TO_PREVIEW_KIND: Readonly<Record<string, PreviewKind>> = {
	xml: PREVIEW_KINDS.XML,
	json: PREVIEW_KINDS.JSON,
	md: PREVIEW_KINDS.MARKDOWN,
	markdown: PREVIEW_KINDS.MARKDOWN,
	pdf: PREVIEW_KINDS.PDF,
	csv: PREVIEW_KINDS.CSV,
	tsv: PREVIEW_KINDS.CSV,
	txt: PREVIEW_KINDS.TEXT,
	text: PREVIEW_KINDS.TEXT,
	log: PREVIEW_KINDS.TEXT,
	html: PREVIEW_KINDS.TEXT,
};
