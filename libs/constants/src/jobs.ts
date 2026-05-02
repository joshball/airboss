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
	/** Successful run where the re-emitted TOML matched the on-disk file (no write). */
	NOOP: 'noop',
	CONFLICT: 'conflict',
	FAILED: 'failed',
} as const;

export type SyncOutcome = (typeof SYNC_OUTCOMES)[keyof typeof SYNC_OUTCOMES];
export const SYNC_OUTCOME_VALUES: readonly SyncOutcome[] = Object.values(SYNC_OUTCOMES);

/**
 * Job target taxonomy used by `hangar.job.target_type` (and the audit
 * metadata that mirrors it). Constrains the per-target serialisation key.
 */
export const JOB_TARGET_TYPES = {
	REFERENCE: 'reference',
	SOURCE: 'source',
	REGISTRY: 'registry',
} as const;

export type JobTargetType = (typeof JOB_TARGET_TYPES)[keyof typeof JOB_TARGET_TYPES];
export const JOB_TARGET_TYPE_VALUES: readonly JobTargetType[] = Object.values(JOB_TARGET_TYPES);

/** Sentinel target id used by registry-wide jobs (build / validate). */
export const REGISTRY_TARGET_ID = 'registry';

/**
 * Byte caps for subprocess output and job error/result columns. A
 * misbehaving handler that emits megabytes of stack/stdout/stderr would
 * otherwise OOM the row insert and ship the blob to every poll of the
 * live-log endpoint.
 */
export const OUTPUT_BYTE_CAPS = {
	/** Per-line cap when writing to `hangar.job_log`. */
	LOG_LINE_BYTES: 16 * 1024,
	/** Cap for `hangar.job.error` text. */
	JOB_ERROR_BYTES: 64 * 1024,
	/** Cap for any text packed into `hangar.job.result`. */
	JOB_RESULT_BYTES: 256 * 1024,
} as const;

/**
 * Cadence used by job polling clients (UI). Mirrored worker-side in
 * `DEFAULT_POLL_INTERVAL_MS`; kept in sync via this single source.
 */
export const JOB_POLL_INTERVAL_MS = 1000;

/**
 * Outbound-fetch denylist: any host whose resolved IP falls in one of these
 * RFC-1918 / loopback / link-local / cloud-metadata ranges is rejected. Used
 * by the binary-visual fetcher and any future job that follows an
 * operator-supplied URL.
 */
export const SSRF_BLOCKED_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254'];

/** IPv4 ranges blocked at fetch time. Caller resolves the host first. */
export const SSRF_BLOCKED_RANGES: readonly { from: string; to: string }[] = [
	{ from: '10.0.0.0', to: '10.255.255.255' },
	{ from: '172.16.0.0', to: '172.31.255.255' },
	{ from: '192.168.0.0', to: '192.168.255.255' },
	{ from: '127.0.0.0', to: '127.255.255.255' },
	{ from: '169.254.0.0', to: '169.254.255.255' },
	{ from: '0.0.0.0', to: '0.255.255.255' },
];
