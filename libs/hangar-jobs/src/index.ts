// @ab/hangar-jobs -- generic job queue + streamed log for hangar workloads.
//
// One schema (`hangar.job` + `hangar.job_log`), one worker, pluggable
// handlers per kind. wp-hangar-registry lands the `sync-to-disk` handler;
// wp-hangar-sources-v1 adds fetch / upload / extract / build / diff /
// validate / size-report without a schema change.

export {
	appendJobLog,
	type EnqueueInput,
	enqueueJob,
	getJob,
	type ListJobsOptions,
	listJobs,
	readJobLog,
	recoverOrphanedRunning,
	writeJobLogRow,
} from './enqueue';
export type {
	HangarJobLogRow,
	HangarJobRow,
	JobContext,
	JobHandler,
	JobHandlers,
	JobProgress,
} from './types';
export { cancelJob, startWorker, type WorkerHandle, type WorkerOptions } from './worker';
