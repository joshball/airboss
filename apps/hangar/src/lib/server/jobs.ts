/**
 * Hangar job handler registry.
 *
 * Maps `JOB_KINDS.*` strings to the per-kind runner function `startWorker`
 * invokes when it picks up a job row. wp-hangar-registry lands the single
 * `sync-to-disk` handler; wp-hangar-sources-v1 extends this object with
 * fetch / upload / extract / build / diff / validate / size-report without
 * touching the worker wiring.
 *
 * The boot-time worker lives in `hooks.server.ts`; this file is pure
 * configuration, safe to import from anywhere on the server.
 */

import { JOB_KINDS } from '@ab/constants';
import type { JobHandlers } from '@ab/hangar-jobs';
import { runSyncJob } from '@ab/hangar-sync';
import {
	makeBuildHandler,
	makeDiffHandler,
	makeExtractHandler,
	makeFetchHandler,
	makeSizeReportHandler,
	makeUploadHandler,
	makeValidateHandler,
} from './source-jobs';

/**
 * Handler map handed to `startWorker({ handlers })`. Kind strings come from
 * `JOB_KINDS`; values are the async handler functions that receive a
 * `JobContext` and perform the work.
 *
 * WP2 (registry) landed `sync-to-disk`. WP3 (sources-v1) adds the reference-
 * system operations: fetch, upload, extract, build, diff, validate, size-report.
 * Every handler here is stateless at the module level; dependencies are closed
 * over via the `make*Handler({ ... })` factories so tests can swap spawn + db.
 */
export const hangarJobHandlers: JobHandlers = {
	[JOB_KINDS.SYNC_TO_DISK]: runSyncJob,
	[JOB_KINDS.FETCH_SOURCE]: makeFetchHandler(),
	[JOB_KINDS.UPLOAD_SOURCE]: makeUploadHandler(),
	[JOB_KINDS.EXTRACT_SOURCE]: makeExtractHandler(),
	[JOB_KINDS.BUILD_REFERENCES]: makeBuildHandler(),
	[JOB_KINDS.DIFF_SOURCE]: makeDiffHandler(),
	[JOB_KINDS.VALIDATE_REFERENCES]: makeValidateHandler(),
	[JOB_KINDS.SIZE_REPORT]: makeSizeReportHandler(),
};
