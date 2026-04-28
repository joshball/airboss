/**
 * Pure helpers used by the upload job handler. Lifted into a dedicated module
 * so tests can exercise edge cases (missing extension, dotfile, case folding)
 * without pulling in `@ab/db` at import time.
 */

/** Lowercased extension without the dot. Returns `''` when none present. */
export function extensionOf(filename: string): string {
	const lastDot = filename.lastIndexOf('.');
	if (lastDot <= 0 || lastDot === filename.length - 1) return '';
	return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Given `sizeBytes` vs the current checksum, decide whether the upload is a
 * no-op. Centralised so the logic is testable and the handler stays slim.
 */
export function isNoChange(existingChecksum: string, uploadedChecksum: string): boolean {
	return existingChecksum.length > 0 && existingChecksum === uploadedChecksum;
}

/**
 * Pick the archives to prune, keeping the newest `keep` entries (lex sort).
 * Version strings sort lex-friendly when they're years or semver-ish, which is
 * the case for every FAA regulatory document we ingest.
 */
export function pickArchivesToPrune(archives: readonly string[], keep: number): readonly string[] {
	if (archives.length <= keep) return [];
	const sorted = [...archives].sort();
	return sorted.slice(0, sorted.length - keep);
}

/**
 * Format the destination + archive filename pair for a given source + ext.
 * Kept as a helper so both the handler and its test can rely on the same
 * naming convention.
 */
export function archiveFilename(sourceId: string, version: string, ext: string): string {
	return `${sourceId}@${version}.${ext}`;
}

export function destFilename(sourceId: string, ext: string): string {
	return `${sourceId}.${ext}`;
}
