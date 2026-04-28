/**
 * Source-ingestion operational constants.
 *
 * Used by the hangar sources v1 surface and the `libs/aviation/src/sources/download.ts`
 * port. Kept separate from `sim.ts` / `study.ts` so reference-system wiring doesn't
 * force a reach across unrelated domains.
 */

import { REFERENCE_SOURCE_TYPES, type ReferenceSourceType } from './reference-tags';

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
	/** Dedicated binary-visual kinds (wp-hangar-non-textual Phase 5). */
	ZIP: 'zip',
	GEOTIFF: 'geotiff',
	JPEG: 'jpeg',
	/** Fallback for any extension with no dedicated previewer. */
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
	// wp-hangar-non-textual: raster/archive previews
	zip: PREVIEW_KINDS.ZIP,
	tif: PREVIEW_KINDS.GEOTIFF,
	tiff: PREVIEW_KINDS.GEOTIFF,
	geotiff: PREVIEW_KINDS.GEOTIFF,
	jpg: PREVIEW_KINDS.JPEG,
	jpeg: PREVIEW_KINDS.JPEG,
};

// -------- wp-hangar-non-textual: source kind classifier --------

/**
 * `source-kind` discriminator. Drives the fetch/extract/diff/validate pipeline
 * branch: text sources run the wiki-link extraction pipeline; binary-visual
 * sources skip extraction (there is no prose to capture from a raster chart)
 * and instead capture edition metadata + a thumbnail at ingest time.
 *
 * See wp-hangar-non-textual design.md. When a new non-textual family lands
 * (plates, airport diagrams, NTSB CSV, AOPA HTML), extend this enum and the
 * `SOURCE_KIND_BY_TYPE` map; every pipeline step reads from the map so the
 * extension stays additive.
 */
export const SOURCE_KINDS = {
	TEXT: 'text',
	BINARY_VISUAL: 'binary-visual',
} as const;

export type SourceKind = (typeof SOURCE_KINDS)[keyof typeof SOURCE_KINDS];

export const SOURCE_KIND_VALUES: readonly SourceKind[] = Object.values(SOURCE_KINDS);

/**
 * Every `ReferenceSourceType` maps to exactly one kind. Callers that used to
 * switch on the source type for pipeline-shaped decisions (extract vs skip,
 * render preview tile vs not) switch to this map; the type value still drives
 * label + locator decisions.
 */
export const SOURCE_KIND_BY_TYPE: Readonly<Record<ReferenceSourceType, SourceKind>> = {
	[REFERENCE_SOURCE_TYPES.CFR]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.AIM]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.PCG]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.AC]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.ACS]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.PHAK]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.AFH]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.IFH]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.POH]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.NTSB]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.GAJSC]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.AOPA]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.FAA_SAFETY]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.SOP]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.AUTHORED]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.DERIVED]: SOURCE_KINDS.TEXT,
	[REFERENCE_SOURCE_TYPES.SECTIONAL]: SOURCE_KINDS.BINARY_VISUAL,
};

/**
 * Thumbnail generation budget for sectional charts. The detail page reserves
 * layout space at these fixed dimensions; the generator steps JPEG quality
 * down until the encoded size fits under MAX_BYTES, and throws if it would
 * drop below MIN_QUALITY.
 */
export const SECTIONAL_THUMBNAIL = {
	WIDTH: 512,
	HEIGHT: 384,
	QUALITY: 70,
	MIN_QUALITY: 40,
	MAX_BYTES: 256 * 1024,
} as const;

/**
 * Default cadence for VFR sectional editions. FAA AeroNav publishes on a
 * 56-day cycle; the registry stores this per-source so future products with
 * different cadences (e.g. 28-day IFR charts) plug into the same shape.
 */
export const SECTIONAL_CADENCE_DAYS = 56;

/**
 * URL-template placeholders recognised by the sectional edition resolver.
 * Kept as constants so the form-side validator can insist the operator-typed
 * template uses one of the known tokens.
 */
export const SECTIONAL_URL_PLACEHOLDERS = {
	EDITION_DATE: '{edition-date}',
	REGION: '{region}',
} as const;

// ---------------------------------------------------------------------------
// Errata discovery (WP `apply-errata-and-afh-mosaic`, phase R7)
// ---------------------------------------------------------------------------

/**
 * Cache-side layout for the discovery surface. All paths are relative to the
 * resolved cache root (default `~/Documents/airboss-handbook-cache/`, override
 * via `AIRBOSS_HANDBOOK_CACHE`). The dispatcher reads/writes through these
 * constants so swapping the layout later is a single edit.
 */
export const DISCOVERY_CACHE = {
	/** Top-level discovery directory under the cache root. */
	DIR: 'discovery',
	/** Per-handbook state JSON directory: `<cache>/discovery/handbooks/`. */
	HANDBOOKS_DIR: 'discovery/handbooks',
	/** Aggregated last-run sentinel (freshness check). */
	LAST_RUN_FILE: 'discovery/_last_run.json',
	/** Human-review markdown report aggregated across handbooks. */
	PENDING_REPORT_FILE: 'discovery/_pending.md',
} as const;

/**
 * Freshness gate. Discovery is event-driven, episodic; the FAA's published
 * cadence is years between events for most handbooks (see research dossier
 * Section 5). A weekly window is overkill but cheap; a 7-day skip lets the
 * dev-server hook + download piggyback fire cheaply on every invocation.
 */
export const DISCOVERY_FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;

/** GitHub label applied to auto-opened issues. Single label keeps idempotency simple. */
export const DISCOVERY_GITHUB_LABEL = 'errata';

/** Issue title template; `<N>` is replaced with the candidate count at write time. */
export const DISCOVERY_GITHUB_TITLE_PREFIX = 'errata: candidate detected';

/**
 * Manual DRS search URL template. Discovery emits this alongside every
 * candidate so the user can sanity-check against the FAA's authoritative
 * portal before applying. `{q}` is the URL-encoded query string.
 *
 * The DRS portal does not expose a documented JSON API (research dossier
 * Section 1); the link is a courtesy redirect into the human-facing search.
 */
export const DRS_SEARCH_URL_TEMPLATE = 'https://drs.faa.gov/browse/?q={q}';

/**
 * Layout-hint values reported per candidate. Best-effort classification from
 * filename heuristics; does not gate the apply pipeline. `unknown` is the
 * default when no pattern in the catalogue matches.
 */
export const DISCOVERY_LAYOUT_HINTS = {
	ADDENDUM: 'addendum',
	ERRATA: 'errata',
	SUMMARY_OF_CHANGES: 'summary_of_changes',
	CHANGE: 'change',
	UNKNOWN: 'unknown',
} as const;

export type DiscoveryLayoutHint = (typeof DISCOVERY_LAYOUT_HINTS)[keyof typeof DISCOVERY_LAYOUT_HINTS];

export const DISCOVERY_LAYOUT_HINT_VALUES: readonly DiscoveryLayoutHint[] = Object.values(DISCOVERY_LAYOUT_HINTS);

/**
 * Per-candidate tier flag. `actionable` candidates target a handbook airboss
 * has a plugin for (so an `--apply-errata` path exists once a parser lands);
 * `signal-only` candidates target unonboarded handbooks (we know an addendum
 * was published but we don't ingest the book yet).
 */
export const DISCOVERY_TIERS = {
	ACTIONABLE: 'actionable',
	SIGNAL_ONLY: 'signal-only',
} as const;

export type DiscoveryTier = (typeof DISCOVERY_TIERS)[keyof typeof DISCOVERY_TIERS];

export const DISCOVERY_TIER_VALUES: readonly DiscoveryTier[] = Object.values(DISCOVERY_TIERS);

/**
 * Per-candidate status. Drives report ordering and idempotency (an `applied`
 * or `dismissed` candidate is suppressed from the next run's report).
 */
export const DISCOVERY_STATUSES = {
	CANDIDATE: 'candidate',
	APPLIED: 'applied',
	DISMISSED: 'dismissed',
	WITHDRAWN: 'withdrawn',
	UNMATCHED: 'unmatched',
} as const;

export type DiscoveryStatus = (typeof DISCOVERY_STATUSES)[keyof typeof DISCOVERY_STATUSES];

export const DISCOVERY_STATUS_VALUES: readonly DiscoveryStatus[] = Object.values(DISCOVERY_STATUSES);

/** Env var that suppresses the dispatcher banner ("N unreviewed candidates"). */
export const DISCOVERY_QUIET_ENV = 'AIRBOSS_QUIET';

/** Env var carrying the GitHub token used by `gh issue create`. */
export const DISCOVERY_GITHUB_TOKEN_ENV = 'GH_TOKEN';
