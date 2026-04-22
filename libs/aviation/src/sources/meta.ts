/**
 * `SourceMeta` -- the committed sidecar next to every downloaded source
 * binary under `data/sources/`.
 *
 * Binaries are gitignored; `<source-id>.meta.json` files next to them are
 * committed. A fresh clone reads the meta.json to know where to re-download
 * and which sha256 to verify.
 *
 * The shape mirrors (but does not duplicate) the `Source` registry entry;
 * the meta.json is the per-file artifact of an actual download, while the
 * registry lists everything we intend to track. Checksums in the meta.json
 * are the source of truth at rest; the registry entry's `checksum` should
 * match when the binary is present.
 */

import type { Source } from '../schema/source';

export interface SourceMeta {
	/** Matches `Source.id` in the registry. */
	sourceId: string;

	/** Matches `Source.version`. */
	version: string;

	/** Canonical download URL; mirrors `Source.url`. */
	url: string;

	/** SHA-256 of the binary at the time of download. */
	checksum: string;

	/** ISO-8601 datetime the binary was downloaded. */
	downloadedAt: string;

	/** Mirrors `Source.format`. */
	format: Source['format'];

	/** Size of the binary in bytes. Drives the size report. */
	sizeBytes: number;
}

export function isSourceMeta(value: unknown): value is SourceMeta {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.sourceId === 'string' &&
		typeof v.version === 'string' &&
		typeof v.url === 'string' &&
		typeof v.checksum === 'string' &&
		typeof v.downloadedAt === 'string' &&
		typeof v.format === 'string' &&
		['xml', 'pdf', 'html', 'txt', 'json', 'csv'].includes(v.format as string) &&
		typeof v.sizeBytes === 'number' &&
		Number.isFinite(v.sizeBytes)
	);
}

/** Given a `Source`, the expected path to its sidecar meta.json. */
export function metaPathFor(source: Source): string {
	return `${source.path}.meta.json`;
}
