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

/**
 * Cap on the byte length of a single `hangar.job_log.line`. A subprocess that
 * emits a multi-MiB single line (a recursive stack trace, a base64 blob, a
 * noisy diff) would otherwise land the whole payload in Postgres and ship it
 * to every poll of the live-log endpoint. Lines longer than this are
 * truncated and `JOB_LOG_TRUNCATION_MARKER` is appended so the operator sees
 * the cut.
 *
 * 16 KiB is plenty for diagnostic prose and JSON payloads; anything longer is
 * almost always a misbehaving emitter.
 */
export const JOB_LOG_MAX_BYTES = 16 * 1024;

/**
 * Cap on `hangar.job.result` text fields (e.g. `text` body returned by the
 * diff handler, which the UI renders verbatim).
 */
export const JOB_RESULT_TEXT_MAX_BYTES = 256 * 1024;

/** Suffix appended when a log line or result text is truncated to its cap. */
export const JOB_LOG_TRUNCATION_MARKER = ' ... [truncated]';

/**
 * ID prefixes for the hangar job-queue tables (composed via `@ab/utils createId`).
 * Persisted prefixes -- the literal values must never change.
 */
export const HANGAR_JOB_ID_PREFIX = 'job';
export const HANGAR_JOB_LOG_ID_PREFIX = 'jlg';
export const HANGAR_SYNC_LOG_ID_PREFIX = 'syn';

/**
 * Reason codes recorded in `metadata.reason` on `hangar.job` audit rows so
 * audit-explorer can surface "why" alongside "what" for state transitions.
 * Centralised so worker, recovery, and cancel paths agree on the vocabulary.
 */
export const JOB_AUDIT_REASONS = {
	/** Worker had no handler registered for the job kind. */
	NO_HANDLER: 'no-handler',
	/** Worker boot found a `running` row from a prior crashed process. */
	RECOVERED_FROM_RESTART: 'recovered-from-restart',
	/** Terminal write was preempted by an earlier `cancelled` transition. */
	PREEMPTED_BY_CANCEL: 'preempted-by-cancel',
} as const;

export type JobAuditReason = (typeof JOB_AUDIT_REASONS)[keyof typeof JOB_AUDIT_REASONS];

/**
 * Worker liveness tuning. The worker writes `last_heartbeat_at` on every
 * iteration of the poll loop; an external probe / UI can flag a job whose
 * heartbeat is older than `JOB_HEARTBEAT_STALE_MS` as "stuck".
 */
export const JOB_HEARTBEAT_INTERVAL_MS = 5000;
export const JOB_HEARTBEAT_STALE_MS = 30_000;

/**
 * Hard cap on the number of running-job rows surfaced to the hangar admin
 * UI. Worker concurrency defaults to 3, so the realistic running count is
 * bounded today; this cap is a safety belt against a stuck-recovery scenario
 * (orphaned `running` rows that pre-date the recovery sweep) leaking full
 * `payload` / `result` jsonb to every `/sources` page hit.
 *
 * 50 is well above worst-case live concurrency yet small enough to keep the
 * row set trivial for an "active arrows" overlay on the flow diagram.
 */
export const JOBS_LIST_HARD_CAP = 50;

/**
 * Cap on the number of log lines retained client-side on the job-detail page.
 * `pollLog` runs at 1 Hz and can return up to a few hundred new lines per
 * poll for a chatty subprocess (extract / build / diff). Without a cap a
 * long-running job grows the buffer (and the rendered DOM) without bound.
 *
 * On overflow the client drops the oldest lines and surfaces a "showing last
 * N -- view full log" affordance; the server retains the full history and
 * can be queried by `seq` cursor for the full stream.
 */
export const JOB_LOG_CLIENT_BUFFER_MAX = 5000;

/**
 * Job-detail UI poll interval (ms). Mirrors the worker's
 * `DEFAULT_POLL_INTERVAL_MS` so the live log refreshes at roughly the rate the
 * worker drains the queue. Worker side keeps its own constant local because
 * the worker contract doesn't depend on this UI default; the value is shared
 * here so a future tuning lands in one place.
 */
export const JOB_DETAIL_POLL_INTERVAL_MS = 1000;

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
