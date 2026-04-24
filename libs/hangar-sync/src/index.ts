// @ab/hangar-sync -- DB -> TOML + aviation.ts -> git commit (or PR) pipeline.
//
// One sync job per invocation:
//   1. Take pg_advisory_xact_lock.
//   2. Load current reference + source rows, detect drift, detect conflict.
//   3. Emit new glossary.toml, sources.toml, and the generated aviation.ts.
//   4. Commit locally (dev) or push + open a PR (prod).
//   5. Clear dirty flags, write a sync_log row, audit.
//
// `runSyncJob` is the `@ab/hangar-jobs` handler registered against
// `JOB_KINDS.SYNC_TO_DISK` in `apps/hangar/src/lib/server/jobs.ts`.

export {
	type CommitAndMaybePrInput,
	commitAndMaybePr,
} from './commit-and-maybe-pr';
export { baselineFromSyncLog, type ConflictInputs, detectConflict } from './detect-conflict';
export { type DriftInputRow, type DriftInputs, type DriftOptions, detectDrift } from './detect-drift';
export { emitAviationTs } from './emit-aviation-ts';
export { emitToml } from './emit-toml';
export {
	ghPrCreate,
	gitAdd,
	gitCheckoutNewBranch,
	gitCommit,
	gitCurrentBranch,
	gitPush,
	nodeProcessRunner,
	type ProcessCall,
	ProcessError,
	type ProcessResult,
	type ProcessRunner,
	run as runProcess,
} from './git';
export {
	AVIATION_TS_PATH,
	GLOSSARY_TOML_PATH,
	RELATIVE_PATHS,
	REPO_ROOT,
	SOURCES_TOML_PATH,
	SYNC_ADVISORY_LOCK_KEY,
	SYNC_COMMIT_FILES,
} from './paths';
export {
	executeSync,
	type LoadedState,
	loadState,
	type RunSyncConfig,
	resolveSyncMode,
	runSync,
	runSyncJob,
	type SyncLogFn,
	type SyncWriters,
} from './run-sync-job';
export { rowToReference, rowToSource } from './to-domain';
export type {
	CommitOutcome,
	ConflictEntry,
	ConflictReport,
	DriftEntry,
	DriftReport,
	FileWrites,
	SyncResult,
} from './types';
