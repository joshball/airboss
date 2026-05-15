/**
 * Drizzle schema for the wx-practice tables. Lives under the `study`
 * Postgres namespace -- the wx-practice surface is study-app fluency
 * training, not its own bounded context. The tables exist independently
 * from `study.card` / `study.review` so the encoded-text mastery ledger
 * stays free of the spaced-rep scheduler's churn (different sampling
 * signal, different reward function).
 *
 * Ids are prefix_ULID via `createId()` from `@ab/utils`:
 *
 * - `wx_practice_session.id` -> `wxps_<ulid>`
 * - `wx_practice_attempt.id` -> `wxpa_<ulid>`
 *
 * The mastery table uses a composite primary key `(user, product, family,
 * sub_family)` so the upsert path can `INSERT ... ON CONFLICT DO UPDATE`
 * without a synthetic row id.
 *
 * Schema is contract-frozen for `feat/wx-practice-mastery-dashboard`.
 * Field names + product / family / state value sets are stable.
 */

import { bauthUser } from '@ab/auth/schema';
import { SCHEMAS } from '@ab/constants';
import { boolean, integer, pgSchema, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const wxPracticeSchema = pgSchema(SCHEMAS.STUDY);

/**
 * One row per drill session. Created by POST `/practice/wx/drill/start`,
 * closed by POST `/practice/wx/drill/end`.
 *
 * `products` is a Postgres text[] so the sampler / dashboard can scope to a
 * subset of products without a join. `focusFamilies` is null when the
 * session uses default sampling (no per-family filter).
 */
export const wxPracticeSession = wxPracticeSchema.table('wx_practice_session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
	endedAt: timestamp('ended_at', { withTimezone: true }),
	products: text('products').array().notNull(),
	tier: integer('tier').notNull(),
	focusFamilies: text('focus_families').array(),
	itemCount: integer('item_count').notNull(),
});

/**
 * One row per question shown. The audit trail for `wxPracticeMastery`.
 * `responseMs` measures wall-clock from prompt-shown to answer-submitted
 * (client-supplied). `answer` is the student's literal answer for free-form
 * questions or the chosen option key for choice forms.
 */
export const wxPracticeAttempt = wxPracticeSchema.table('wx_practice_attempt', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	sessionId: text('session_id')
		.notNull()
		.references(() => wxPracticeSession.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	product: text('product').notNull(),
	rawExample: text('raw_example').notNull(),
	family: text('family').notNull(),
	subFamily: text('sub_family'),
	tokenShown: text('token_shown').notNull(),
	questionForm: text('question_form').notNull(),
	correct: boolean('correct').notNull(),
	answer: text('answer').notNull(),
	responseMs: integer('response_ms').notNull(),
	shownAt: timestamp('shown_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Per-(user, product, family, sub-family) mastery ledger. Updated after every
 * attempt by the state machine in `state-machine.ts`. `recentRing` is a fixed-
 * length boolean[] of the last N attempts (N = WX_PRACTICE_RECENT_RING_LENGTH).
 */
export const wxPracticeMastery = wxPracticeSchema.table(
	'wx_practice_mastery',
	{
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		product: text('product').notNull(),
		family: text('family').notNull(),
		subFamily: text('sub_family').notNull().default(''),
		attempts: integer('attempts').notNull().default(0),
		correct: integer('correct').notNull().default(0),
		recentRing: boolean('recent_ring').array().notNull().default([]),
		streakAcrossSessions: integer('streak_across_sessions').notNull().default(0),
		state: text('state').notNull().default('active'),
		lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
		lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.userId, table.product, table.family, table.subFamily] }),
	}),
);

export type WxPracticeSessionRow = typeof wxPracticeSession.$inferSelect;
export type WxPracticeSessionInsert = typeof wxPracticeSession.$inferInsert;
export type WxPracticeAttemptRow = typeof wxPracticeAttempt.$inferSelect;
export type WxPracticeAttemptInsert = typeof wxPracticeAttempt.$inferInsert;
export type WxPracticeMasteryRow = typeof wxPracticeMastery.$inferSelect;
export type WxPracticeMasteryInsert = typeof wxPracticeMastery.$inferInsert;
