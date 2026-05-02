// @ab/hangar-jobs -- generic job queue + streamed log.
//
// Owns the `hangar.job` + `hangar.job_log` tables, the polling worker,
// and the per-handler runtime contract (`JobContext`, `JobHandler`,
// `JobHandlers`). Handler registration belongs to the consuming app
// (e.g. `apps/hangar/src/lib/server/jobs.ts`); the kind taxonomy lives
// in `@ab/constants` (`JOB_KINDS`).

export {
	appendJobLog,
	type EnqueueInput,
	enqueueJob,
	getJob,
	type ListJobsOptions,
	listJobs,
	readJobLog,
	recoverOrphanedRunning,
} from './enqueue';
export {
	hangarJob,
	hangarJobLog,
	hangarJobsSchema,
	type NewHangarJobLogRow,
	type NewHangarJobRow,
} from './schema';
export type {
	HangarJobLogRow,
	HangarJobRow,
	JobContext,
	JobHandler,
	JobHandlers,
	JobProgress,
} from './types';
export { cancelJob, startWorker, type WorkerHandle, type WorkerOptions } from './worker';
