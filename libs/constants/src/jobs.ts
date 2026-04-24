/**
 * Hangar job queue taxonomy. `hangar.job` rows carry one of these kinds;
 * the worker dispatches on `kind` to the appropriate handler.
 *
 * wp-hangar-registry lands the `sync-to-disk` runner. The remaining kinds
 * are reserved here so later work packages can enqueue them without a
 * schema change; their handlers ship in wp-hangar-sources-v1.
 */
export const JOB_KINDS = {
	/** Write dirty reference/source rows back to TOML and commit (or open a PR). */
	SYNC_TO_DISK: 'sync-to-disk',
	/** Download a source binary from its canonical URL. WP3. */
	FETCH_SOURCE: 'fetch-source',
	/** Ingest an uploaded source binary. WP3. */
	UPLOAD_SOURCE: 'upload-source',
	/** Run an extractor against a source to populate verbatim blocks. WP3. */
	EXTRACT_SOURCE: 'extract-source',
	/** Rebuild generated reference files from extracted content. WP3. */
	BUILD_REFERENCES: 'build-references',
	/** Yearly diff pass between old and new source versions. WP3. */
	DIFF_SOURCE: 'diff-source',
	/** Validate the registry + wiki-links + sources. WP3. */
	VALIDATE_REFERENCES: 'validate-references',
	/** Size report for corpus binaries. WP3. */
	SIZE_REPORT: 'size-report',
} as const;

export type JobKind = (typeof JOB_KINDS)[keyof typeof JOB_KINDS];
export const JOB_KIND_VALUES: readonly JobKind[] = Object.values(JOB_KINDS);

export const JOB_STATUSES = {
	QUEUED: 'queued',
	RUNNING: 'running',
	COMPLETE: 'complete',
	FAILED: 'failed',
	CANCELLED: 'cancelled',
} as const;

export type JobStatus = (typeof JOB_STATUSES)[keyof typeof JOB_STATUSES];
export const JOB_STATUS_VALUES: readonly JobStatus[] = Object.values(JOB_STATUSES);

/** Terminal statuses -- a job in one of these will never be picked up again. */
export const JOB_TERMINAL_STATUSES: readonly JobStatus[] = [
	JOB_STATUSES.COMPLETE,
	JOB_STATUSES.FAILED,
	JOB_STATUSES.CANCELLED,
];

/** Log stream classifier for `hangar.job_log.stream`. */
export const JOB_LOG_STREAMS = {
	STDOUT: 'stdout',
	STDERR: 'stderr',
	EVENT: 'event',
} as const;

export type JobLogStream = (typeof JOB_LOG_STREAMS)[keyof typeof JOB_LOG_STREAMS];
export const JOB_LOG_STREAM_VALUES: readonly JobLogStream[] = Object.values(JOB_LOG_STREAMS);

/** Modes for the sync-to-disk handler. */
export const HANGAR_SYNC_MODES = {
	/** Stage + commit locally on the current branch. */
	COMMIT_LOCAL: 'commit-local',
	/** Push to a new branch and open a GitHub PR via `gh`. */
	PR: 'pr',
} as const;

export type HangarSyncMode = (typeof HANGAR_SYNC_MODES)[keyof typeof HANGAR_SYNC_MODES];
export const HANGAR_SYNC_MODE_VALUES: readonly HangarSyncMode[] = Object.values(HANGAR_SYNC_MODES);

/** Sync outcome (persisted in `hangar.sync_log.outcome`). */
export const SYNC_OUTCOMES = {
	SUCCESS: 'success',
	CONFLICT: 'conflict',
	FAILED: 'failed',
} as const;

export type SyncOutcome = (typeof SYNC_OUTCOMES)[keyof typeof SYNC_OUTCOMES];
export const SYNC_OUTCOME_VALUES: readonly SyncOutcome[] = Object.values(SYNC_OUTCOMES);
