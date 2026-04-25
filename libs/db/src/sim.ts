/**
 * Sim BC Drizzle schema.
 *
 * Today: a single `sim_attempt` table that records each completed flight
 * (one row per scenario run). The row carries enough to (a) reconstruct
 * a debrief from history, (b) feed a future spaced-rep scheduler that
 * biases on poor sim performance the same way it biases on missed reps.
 *
 * Tape and grade are stored as JSONB. The tape is large but bounded
 * (~1-5MB for a typical run); JSONB avoids a separate blob store while
 * the volume is small. If runs ever land in the 100k+ regime, move the
 * tape to object storage and keep only a `tape_uri` here.
 *
 * Persistence call site is currently dormant -- the sim app has no auth
 * (see `apps/sim/src/hooks.server.ts` "Sim has no auth"), so no row is
 * ever inserted. The table + BC fns ship now so when sim auth lands the
 * cockpit/horizon/dual pages get a one-line wire-up.
 */

import { bauthUser } from '@ab/auth/schema';
import { SCHEMAS } from '@ab/constants';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, jsonb, pgSchema, real, text, timestamp } from 'drizzle-orm/pg-core';
import { timestamps } from './columns';

export const simSchema = pgSchema(SCHEMAS.SIM);

/**
 * Shape of the `grade` jsonb column. Mirrors `GradeReport` in `@ab/bc-sim`;
 * duplicated here so `@ab/db` stays free of any `@ab/bc-sim` dependency
 * (BC stays pure-physics; persistence lives in the db lib).
 */
export interface SimAttemptGrade {
	total: number;
	components: ReadonlyArray<{
		kind: string;
		weight: number;
		score: number;
		summary?: string;
	}>;
}

/**
 * Shape of the `tape` jsonb column. Mirrors `ReplayTape` in `@ab/bc-sim`.
 * `unknown` here keeps `@ab/db` independent of the tape format; the BC
 * owns parsing/validating on the read path via `parseTape`.
 */
export type SimAttemptTape = unknown;

/**
 * One row per completed scenario run.
 *
 * - `id`: `sat_<ULID>` (sat = Sim ATtempt). See `generateSimAttemptId`.
 * - `outcome`: matches `SimScenarioOutcome` ('success' | 'failure' | 'aborted').
 *   Stored as text so a new outcome value doesn't require a migration.
 * - `gradeTotal`: denormalised top-line score (0..1) for fast filtering /
 *   sorting on history pages without parsing the JSON column.
 * - `grade`: full per-component breakdown. Null when the scenario declared
 *   no grading block, or when the evaluator failed.
 * - `tape`: full replay tape. Null on aborted runs that produced no frames.
 * - `endedAt`: when the run terminated (outcome reached or aborted).
 *   `createdAt` is the row insert time, may differ slightly.
 */
export const simAttempt = simSchema.table(
	'attempt',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		scenarioId: text('scenario_id').notNull(),
		outcome: text('outcome').notNull(),
		reason: text('reason').notNull(),
		elapsedSeconds: real('elapsed_seconds').notNull(),
		gradeTotal: real('grade_total'),
		grade: jsonb('grade').$type<SimAttemptGrade>(),
		tape: jsonb('tape').$type<SimAttemptTape>(),
		endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
		...timestamps(),
	},
	(table) => [
		// History lookups: "show this user's recent attempts at this scenario"
		// is the primary query the dashboard + spaced-rep scheduler will hit.
		index('sim_attempt_user_scenario_ended_idx').on(table.userId, table.scenarioId, table.endedAt),
		// Recent-activity feed across all scenarios for one user.
		index('sim_attempt_user_ended_idx').on(table.userId, table.endedAt),
	],
);

export type SimAttemptRow = InferSelectModel<typeof simAttempt>;
export type NewSimAttemptRow = InferInsertModel<typeof simAttempt>;
