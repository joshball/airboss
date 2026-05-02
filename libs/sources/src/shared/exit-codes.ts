/**
 * Exit-code constants for ingest CLIs.
 *
 * Source of truth for the "must exit non-zero on unrecoverable skip"
 * contract called out in the 2026-05-01 backend review (finding #1). Per-CLI
 * `runIngestCli` functions classify each entry in `report.skipReasons` as
 * either a soft skip (intentional / informational; out of scope) or a hard
 * skip (unrecoverable; parse error, schema mismatch, SHA mismatch). Hard
 * skips force a non-zero exit so CI / orchestrators do not treat partial
 * advance as success.
 *
 * Soft-skip markers are matched as a substring of the skip reason. The
 * downloaders and ingesters spell skip reasons consistently, so substring
 * matching is reliable; if a future skip reason needs a different shape, it
 * is added here rather than re-classified at the call site.
 */

export const INGEST_EXIT_CODES = {
	/** Successful run; no entries skipped due to unrecoverable failures. */
	OK: 0,
	/** At least one entry was skipped due to an unrecoverable failure. */
	HARD_SKIPS: 1,
	/** CLI argument parse error. */
	BAD_ARGS: 2,
	/**
	 * SHA verification failed against the cached source bytes. The cache is
	 * poisoned (or the recorded checksum drifted); the operator must re-fetch
	 * before any state advances.
	 */
	SHA_MISMATCH: 3,
} as const;

export type IngestExitCode = (typeof INGEST_EXIT_CODES)[keyof typeof INGEST_EXIT_CODES];

/**
 * Substring markers that identify a "soft skip" -- intentional, informational,
 * NOT an unrecoverable failure. Anything matching one of these stays exit 0.
 *
 * Anything NOT matching is treated as a hard skip and forces exit 1.
 */
const SOFT_SKIP_MARKERS: readonly string[] = [
	// AC: unrevisioned ACs are deliberately rejected by ADR 019 §1.2.
	'unrevisioned ACs are rejected',
	// AC: FAA slash-style ACs (150/...) need a future WP.
	'looks like FAA slash-style',
	// ACS: out-of-scope publication slugs (filter mismatch).
	'not in --slug filter',
	'not in ACS_PUBLICATION_SLUGS',
	'is not yet wired to a publication slug',
	// AC/ACS/AIM: cache layout absent (operator hasn't run downloader yet).
	'per-corpus manifest not found',
	// Already-up-to-date / nothing-new fast paths.
	'already up to date',
	'no new entries',
];

/**
 * Returns true when `reason` matches a known soft-skip marker. Soft skips do
 * not force a non-zero exit.
 */
export function isSoftSkip(reason: string): boolean {
	for (const marker of SOFT_SKIP_MARKERS) {
		if (reason.includes(marker)) return true;
	}
	return false;
}

/**
 * Classify a list of skip reasons into soft and hard buckets. Hard-bucket
 * reasons trigger a non-zero exit code; soft-bucket reasons are logged but
 * do not.
 */
export function classifySkipReasons(reasons: readonly string[]): {
	readonly soft: readonly string[];
	readonly hard: readonly string[];
} {
	const soft: string[] = [];
	const hard: string[] = [];
	for (const reason of reasons) {
		if (isSoftSkip(reason)) {
			soft.push(reason);
		} else {
			hard.push(reason);
		}
	}
	return { soft, hard };
}
