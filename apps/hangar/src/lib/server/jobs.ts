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

/**
 * Handler map handed to `startWorker({ handlers })`. Kind strings come from
 * `JOB_KINDS`; values are the async handler functions that receive a
 * `JobContext` and perform the work.
 *
 * Note: WP3 adds handlers for `FETCH_SOURCE`, `UPLOAD_SOURCE`, etc. Until
 * then, enqueueing any non-`sync-to-disk` kind will fail with
 * "no handler registered" and be recorded on the job row.
 */
export const hangarJobHandlers: JobHandlers = {
	[JOB_KINDS.SYNC_TO_DISK]: runSyncJob,
};
