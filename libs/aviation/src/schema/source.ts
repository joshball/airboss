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

	/** Format of the downloaded file. */
	format: 'xml' | 'pdf' | 'html' | 'txt' | 'json' | 'csv';

	/** Repo-relative path to the downloaded file under `data/sources/`. */
	path: string;

	/** Canonical URL where the user can cross-check the live source. */
	url: string;

	/** SHA-256 of the downloaded file. Detects unintended overwrites. */
	checksum: string;
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
