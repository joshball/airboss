/**
 * SHA verification at register time.
 *
 * Source of truth for the 2026-05-01 backend review's "no SHA verification
 * on register" critical (finding #2). Every register path that consumes a
 * cached file alongside a downloader manifest re-hashes the bytes and
 * compares against the recorded `source_sha256`. On mismatch the register
 * MUST exit non-zero and not advance any registry state.
 *
 * Default behavior: verification is ON. The CLI can opt out via
 * `--skip-sha-verify` for tests that intentionally feed mutated cache
 * fixtures; production runs must never set this.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export class ShaMismatchError extends Error {
	readonly cachedPath: string;
	readonly expectedSha: string;
	readonly actualSha: string;
	constructor(cachedPath: string, expectedSha: string, actualSha: string) {
		super(
			`SHA mismatch at ${cachedPath}: manifest claims ${expectedSha}, cached bytes hash to ${actualSha}. ` +
				'The cache is poisoned or out-of-date; re-run the downloader with --force-refresh before retrying.',
		);
		this.name = 'ShaMismatchError';
		this.cachedPath = cachedPath;
		this.expectedSha = expectedSha;
		this.actualSha = actualSha;
	}
}

/**
 * Compute the SHA-256 of a file's bytes. Synchronous; the register paths
 * already read PDFs synchronously to extract them, so consistency wins over
 * micro-throughput.
 */
export function hashFileSync(path: string): string {
	const bytes = readFileSync(path);
	return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Verify that the file at `cachedPath` hashes to `expectedSha`. Throws
 * `ShaMismatchError` on mismatch. No-op when `skip` is true (test escape
 * hatch only; production runs must leave it false).
 */
export function verifyCachedSha(cachedPath: string, expectedSha: string, skip: boolean = false): void {
	if (skip) return;
	const actual = hashFileSync(cachedPath);
	if (actual !== expectedSha) {
		throw new ShaMismatchError(cachedPath, expectedSha, actual);
	}
}
