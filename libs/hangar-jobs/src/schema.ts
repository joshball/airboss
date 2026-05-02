/**
 * Drizzle schema for the generic job queue (`hangar.job` + `hangar.job_log`).
 *
 * The tables live in the `hangar` Postgres namespace because that's where
 * the migrations created them, but the job-runtime owns the writes and the
 * row contract: `status`, `progress`, `result`, `error`, `startedAt`,
 * `finishedAt`, plus the per-job log stream. Hosting the schema here keeps
 * `@ab/hangar-jobs` self-contained and breaks the historical
 * `bc-hangar -> hangar-jobs -> bc-hangar` package cycle.
 *
 * `JobKind` stays in `@ab/constants` (cross-cutting list of supported
 * kinds); the BC-side jobs-queries helpers continue to type-narrow against
 * that union, but the table/row shapes themselves are owned here.
 */

import { bauthUser } from '@ab/auth/schema';
import { JOB_KIND_VALUES, JOB_LOG_STREAM_VALUES, JOB_STATUS_VALUES, SCHEMAS } from '@ab/constants';
import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgSchema, text, timestamp, unique } from 'drizzle-orm/pg-core';

/** Render a string array as a SQL `IN (...)` value list. */
const inList = (values: readonly string[]) => values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');

/**
 * Shared `hangar` Postgres schema namespace. Job tables sit alongside the
 * BC's content-mirror tables (`reference`, `source`, `sync_log`) but their
 * Drizzle definitions live in this lib so the dependency graph is a DAG.
 */
export const hangarJobsSchema = pgSchema(SCHEMAS.HANGAR);

export const hangarJob = hangarJobsSchema.table(
	'job',
	{
		id: text('id').primaryKey(),
		/** One of `JOB_KINDS`. */
		kind: text('kind').notNull(),
		/** Logical target family (e.g. `reference`, `source`, `registry`). */
		targetType: text('target_type'),
		/** Target id scoping (for per-target serialisation). */
		targetId: text('target_id'),
		/** One of `JOB_STATUSES`. */
		status: text('status').notNull().default('queued'),
		/** `{ step, total, message }` progress payload. */
		progress: jsonb('progress').$type<Record<string, unknown>>().notNull().default({}),
		/** Opaque payload handed to the handler. */
		payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
		/** Handler result on success. */
		result: jsonb('result').$type<Record<string, unknown> | null>(),
		/** Failure text on `status = failed`. */
		error: text('error'),
		actorId: text('actor_id').references(() => bauthUser.id, { onDelete: 'set null', onUpdate: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		startedAt: timestamp('started_at', { withTimezone: true }),
		finishedAt: timestamp('finished_at', { withTimezone: true }),
		/**
		 * Last heartbeat from the worker for this job. Updated on every poll
		 * iteration while the row is `running` so external probes / UI can flag
		 * stale heartbeats (`now - lastHeartbeatAt > JOB_HEARTBEAT_STALE_MS`)
		 * as "stuck" without trusting the handler to emit log lines.
		 */
		lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
	},
	(t) => ({
		jobStatusIdx: index('hangar_job_status_idx').on(t.status, t.createdAt),
		jobKindIdx: index('hangar_job_kind_idx').on(t.kind, t.createdAt),
		jobTargetIdx: index('hangar_job_target_idx').on(t.targetType, t.targetId, t.createdAt),
		jobActorIdx: index('hangar_job_actor_idx').on(t.actorId, t.createdAt),
		jobStatusCheck: check('hangar_job_status_check', sql.raw(`"status" IN (${inList(JOB_STATUS_VALUES)})`)),
		jobKindCheck: check('hangar_job_kind_check', sql.raw(`"kind" IN (${inList(JOB_KIND_VALUES)})`)),
	}),
);

export const hangarJobLog = hangarJobsSchema.table(
	'job_log',
	{
		id: text('id').primaryKey(),
		jobId: text('job_id')
			.notNull()
			.references(() => hangarJob.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		/** Monotonic per-job sequence number. Drives polling cursors. */
		seq: integer('seq').notNull(),
		/** One of `JOB_LOG_STREAMS`. */
		stream: text('stream').notNull(),
		line: text('line').notNull(),
		at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		/**
		 * `(job_id, seq)` is the polling cursor's primary access path AND a
		 * uniqueness invariant: the worker tail (`readJobLog` ordered by `seq`
		 * with cursor `seq > sinceSeq`) silently drops one row of any pair that
		 * shares a seq, and the orphan-recovery / draining-worker race used to
		 * produce exactly that collision (chunk-6 schema critical).
		 *
		 * The unique constraint backs the same B-tree the index used to provide,
		 * so `jobLogJobIdx` is now redundant and removed in the migration. The
		 * unique constraint is also the safety net behind `appendJobLog`'s
		 * atomic seq allocation -- if two transactions ever observe the same
		 * `MAX(seq)+1` despite the `FOR UPDATE` row lock, the loser fails fast
		 * with a 23505 instead of corrupting the cursor.
		 */
		jobLogJobSeqUnique: unique('hangar_job_log_job_seq_unique').on(t.jobId, t.seq),
		/**
		 * Timestamp index for ad-hoc cross-job range scans ("everything that
		 * happened in the last hour", future cross-job admin tail). Job logs
		 * are the highest-volume table in the hangar cluster; this is cheap
		 * insurance against a future surface that needs the column without
		 * paying for a full-table scan. Closes chunk-6 schema MIN.
		 */
		jobLogAtIdx: index('hangar_job_log_at_idx').on(t.at),
		jobLogStreamCheck: check('hangar_job_log_stream_check', sql.raw(`"stream" IN (${inList(JOB_LOG_STREAM_VALUES)})`)),
	}),
);

export type HangarJobRow = typeof hangarJob.$inferSelect;
export type NewHangarJobRow = typeof hangarJob.$inferInsert;
export type HangarJobLogRow = typeof hangarJobLog.$inferSelect;
export type NewHangarJobLogRow = typeof hangarJobLog.$inferInsert;
