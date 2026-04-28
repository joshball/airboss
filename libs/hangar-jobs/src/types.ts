/**
 * Public types for `@ab/hangar-jobs`. Mostly re-exports of the Drizzle
 * row types, with a narrower `JobProgress` shape for handlers to emit.
 */

import type { HangarJobLogRow, HangarJobRow } from '@ab/bc-hangar/schema';

export type { HangarJobLogRow, HangarJobRow };

/** Standard progress payload. Freeform extras fit in `extra`. */
export interface JobProgress {
	/** Current step index (1-based). */
	step: number;
	/** Total expected steps when known. */
	total?: number;
	/** Human-readable current-activity label. */
	message: string;
	/** Any job-kind-specific extras. */
	extra?: Record<string, unknown>;
}

/** Accessor the handler uses to emit progress + log lines during a run. */
export interface JobContext {
	readonly job: HangarJobRow;
	/** Update the job's progress json. */
	reportProgress(progress: JobProgress): Promise<void>;
	/** Append one stdout line to the job log. */
	logStdout(line: string): Promise<void>;
	/** Append one stderr line to the job log. */
	logStderr(line: string): Promise<void>;
	/** Append a structured event (e.g. `enqueue`, `restart-recovery`). */
	logEvent(line: string): Promise<void>;
	/** Check whether the job has been cancelled externally. */
	isCancelled(): Promise<boolean>;
}

/** Handler contract: one per job kind. */
export type JobHandler = (ctx: JobContext) => Promise<Record<string, unknown> | undefined>;

export type JobHandlers = Readonly<Record<string, JobHandler>>;
