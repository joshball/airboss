/**
 * Source registry types. A `Source` represents a downloaded corpus file
 * (14 CFR XML, AIM PDF, a POH) that extraction parsers consume. A
 * `SourceCitation` is a pointer on a `Reference` back into a known `Source`
 * at a specific locator.
 *
 * The in-repo `Source[]` table is owned by the extraction-pipeline package
 * (`wp-reference-extraction-pipeline`); its populated list lives at
 * `libs/aviation/src/sources/registry.ts` as `SOURCES`. Binary corpus
 * files may not yet be downloaded -- entries use the `PENDING_DOWNLOAD`
 * sentinel for `downloadedAt` and `checksum` until the pipeline lands. The
 * `sources[].sourceId` validation gate is active: `validateReferences()`
 * errors if any citation points at an id not in `SOURCES`.
 */

import type { ReferenceSourceType } from '@ab/constants';

export interface Source {
	/** Stable identifier. Examples: `cfr-14`, `aim-2026-01`, `poh-c172s-1981`. */
	id: string;

	/** Which `SourceType` this is. Drives parser dispatch. */
	type: ReferenceSourceType;

	/** Human-readable title. */
	title: string;

	/** Version / edition of the source document (e.g. `revised-2026-01-01`). */
	version: string;

	/** ISO-8601 datetime when the corpus file was downloaded. */
	downloadedAt: string;

	/** Format of the downloaded file. `geotiff-zip` is the sectional-chart archive. */
	format: 'xml' | 'pdf' | 'html' | 'txt' | 'json' | 'csv' | 'geotiff-zip';

	/** Repo-relative path to the downloaded file under `data/sources/`. */
	path: string;

	/** Canonical URL where the user can cross-check the live source. */
	url: string;

	/** SHA-256 of the downloaded file. Detects unintended overwrites. */
	checksum: string;
}

/**
 * Per-kind media sidecar for non-textual sources. Populated on successful
 * ingest of a `binary-visual` source (sectional chart, plate, airport
 * diagram); null for text sources.
 *
 * Thumbnails live at `<source.path>/<edition>/thumb.jpg` (relative path
 * stored here). The preview tile on `/sources/[id]` renders the thumbnail
 * inline and links the archive for download.
 */
export interface SourceMedia {
	/** Repo-relative path to the thumbnail image. */
	thumbnailPath: string;
	/** sha256 of the thumbnail file for integrity checks. */
	thumbnailSha256: string;
	/** Bytes; enforced <= SECTIONAL_THUMBNAIL.MAX_BYTES at generate time. */
	thumbnailSizeBytes: number;
	/** Manifest of files inside the source archive, recorded at ingest. */
	archiveEntries: ReadonlyArray<{ name: string; sizeBytes: number }>;
	/** Tool used to generate the thumbnail (e.g. `gdal_translate`, `sips`, `unavailable`). */
	generator: string;
}

/**
 * Per-edition version-tracking record for sources with scheduled refreshes
 * (sectionals, plates, ACS revisions, AIM quarterly updates). Populated on
 * every successful ingest; drift detection compares the resolved date +
 * archive sha against the previous edition.
 */
export interface SourceEdition {
	/** ISO-8601 date the edition became effective. */
	effectiveDate: string;
	/** FAA edition number (e.g. 116). Null for sources without one. */
	editionNumber: number | null;
	/** Concrete URL the fetch actually ran against (after template resolution). */
	resolvedUrl: string;
	/** ISO-8601 timestamp when this edition was resolved from the upstream index. */
	resolvedAt: string;
}

export function isSourceMedia(value: unknown): value is SourceMedia {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	if (typeof v.thumbnailPath !== 'string') return false;
	if (typeof v.thumbnailSha256 !== 'string') return false;
	if (typeof v.thumbnailSizeBytes !== 'number' || !Number.isFinite(v.thumbnailSizeBytes)) return false;
	if (typeof v.generator !== 'string') return false;
	if (!Array.isArray(v.archiveEntries)) return false;
	for (const entry of v.archiveEntries) {
		if (!entry || typeof entry !== 'object') return false;
		const e = entry as Record<string, unknown>;
		if (typeof e.name !== 'string') return false;
		if (typeof e.sizeBytes !== 'number' || !Number.isFinite(e.sizeBytes)) return false;
	}
	return true;
}

export function isSourceEdition(value: unknown): value is SourceEdition {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	if (typeof v.effectiveDate !== 'string') return false;
	if (v.editionNumber !== null && (typeof v.editionNumber !== 'number' || !Number.isFinite(v.editionNumber))) {
		return false;
	}
	if (typeof v.resolvedUrl !== 'string') return false;
	if (typeof v.resolvedAt !== 'string') return false;
	return true;
}

export interface SourceCitation {
	/** Source id from the `Source` registry. */
	sourceId: string;

	/**
	 * Locator within the source. Shape is source-type specific:
	 *   CFR  -- { title: 14, part: 91, section: '155' }
	 *   AIM  -- { chapter: 7, section: 1, paragraph: 1 }
	 *   POH  -- { section: '4.5', page: 42 }
	 *   NTSB -- { reportId: 'CEN20LA123' }
	 */
	locator: Readonly<Record<string, string | number>>;

	/** Optional deep-link URL to the cited chunk. */
	url?: string;
}

/**
 * Contract every per-source-type parser implements. Extraction-pipeline
 * package implements concrete parsers; the type lives here so both sides
 * share a stable interface.
 */
export interface SourceExtractor {
	/** Does this extractor understand the given `sourceId`? */
	canHandle(sourceId: string): boolean;

	/**
	 * Materialize the verbatim block for a single reference. Concrete
	 * extractors read the file at `sourceFile` and pluck out the text at
	 * `locator`.
	 */
	extract(
		locator: Readonly<Record<string, string | number>>,
		sourceFile: string,
	): Promise<{ text: string; sourceVersion: string; extractedAt: string }>;
}
