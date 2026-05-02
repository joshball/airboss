/**
 * Pure helpers used by the upload job handler. Lifted into a dedicated module
 * so tests can exercise edge cases (missing extension, dotfile, case folding)
 * without pulling in `@ab/db` at import time.
 */

/**
 * Whitelist for upload file extensions. The slice after `lastIndexOf('.')`
 * cannot contain `..` (so path-escape is impossible), but it CAN contain `/`
 * if the upstream filename was crafted like `x.foo/bar` -- which would let
 * `resolve()` collapse the destination into a real subdirectory under
 * `destDir`. The simplest correct fix is to require the extension to be
 * pure alphanumeric (the only legitimate aviation-document extensions are
 * `pdf`, `html`, `txt`, `xml`, `zip`, etc.); anything that fails the check
 * falls back to the existing row's `format` column upstream.
 *
 * Closes the chunk-6 security MIN: Upload `originalFilename` extension can
 * contain path-segment characters and produce nested directories.
 */
const SAFE_EXTENSION_RE = /^[a-z0-9]+$/;

/** Lowercased extension without the dot. Returns `''` when none present
 * or when the candidate fails the safe-extension whitelist. */
export function extensionOf(filename: string): string {
	const lastDot = filename.lastIndexOf('.');
	if (lastDot <= 0 || lastDot === filename.length - 1) return '';
	const candidate = filename.slice(lastDot + 1).toLowerCase();
	return SAFE_EXTENSION_RE.test(candidate) ? candidate : '';
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

/**
 * Same-version archive filename: when the operator re-uploads with the same
 * version string but different bytes (e.g. corrected scan, errata patch), we
 * disambiguate with a short prefix of the prior checksum so multiple
 * same-version uploads do not clobber each other.
 *
 * `priorChecksum` is the sha256 hex string of the bytes being archived; the
 * first 12 chars give 48 bits of entropy, plenty to distinguish all yearly
 * re-uploads of the same source.
 */
export function archiveFilenameWithChecksum(
	sourceId: string,
	version: string,
	priorChecksum: string,
	ext: string,
): string {
	const shaPrefix = priorChecksum.slice(0, 12);
	return `${sourceId}@${version}-${shaPrefix}.${ext}`;
}

export function destFilename(sourceId: string, ext: string): string {
	return `${sourceId}.${ext}`;
}

/**
 * Stage filename used between "tmp upload arrived" and "atomic rename into
 * place". Living inside `destDir` (rather than `os.tmpdir()`) guarantees
 * `rename(stage -> destPath)` stays on the same filesystem, which keeps the
 * archive-and-install pair atomic from the operator's perspective.
 */
export function stageFilename(sourceId: string, ext: string, suffix: string): string {
	return `${sourceId}.${ext}.uploading-${suffix}`;
}
