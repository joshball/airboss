/**
 * Hangar app's job handler registry.
 *
 * Maps `JOB_KINDS.*` strings to the per-kind runner function `startWorker`
 * invokes when it picks up a job row. wp-hangar-registry landed the single
 * `sync-to-disk` handler; wp-hangar-sources-v1 added fetch / upload /
 * extract / build / diff / validate.
 *
 * The boot-time worker lives in `hooks.server.ts`; this file is pure
 * configuration and assembles factories from `@ab/bc-hangar` (source-job
 * factories) and `@ab/hangar-sync` (the sync handler) into the map handed
 * to `startWorker({ handlers })`. Living in the app rather than a sibling
 * lib breaks the bc-hangar -> hangar-sync -> bc-hangar package cycle.
 */

import {
	makeBuildHandler,
	makeDiffHandler,
	makeExtractHandler,
	makeFetchHandler,
	makeUploadHandler,
	makeValidateHandler,
	withEditionStub,
} from '@ab/bc-hangar/server';
import { JOB_KINDS } from '@ab/constants';
import type { JobHandlers } from '@ab/hangar-jobs';
import { runSyncJob } from '@ab/hangar-sync';

/**
 * Handler map handed to `startWorker({ handlers })`. Kind strings come from
 * `JOB_KINDS`; values are the async handler functions that receive a
 * `JobContext` and perform the work. Every handler is stateless at module
 * level; dependencies are closed over via `make*Handler({ ... })` factories
 * so tests can swap spawn + db.
 */
export const hangarJobHandlers: JobHandlers = {
	[JOB_KINDS.SYNC_TO_DISK]: runSyncJob,
	[JOB_KINDS.FETCH_SOURCE]: makeFetchHandler({ fetchHtml: withEditionStub() }),
	[JOB_KINDS.UPLOAD_SOURCE]: makeUploadHandler(),
	[JOB_KINDS.EXTRACT_SOURCE]: makeExtractHandler(),
	[JOB_KINDS.BUILD_REFERENCES]: makeBuildHandler(),
	[JOB_KINDS.DIFF_SOURCE]: makeDiffHandler(),
	[JOB_KINDS.VALIDATE_REFERENCES]: makeValidateHandler(),
};
