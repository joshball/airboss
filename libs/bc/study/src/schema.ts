/**
 * Drizzle schema for the `study` Postgres namespace.
 *
 * Owns cards, review history, and materialized per-user/per-card state.
 * IDs are `prefix_ULID` via @ab/utils generateCardId / generateReviewId.
 *
 * card_state intentionally has no created_at/updated_at: it is a materialized
 * projection of (card, review) history and reviewedAt of the latest review
 * is the relevant timestamp. `last_review_id` links to that review.
 */

// Import the Drizzle table directly (not via the @ab/auth barrel) so that
// drizzle-kit can resolve the file without pulling in SvelteKit/Svelte deps.
import { bauthUser } from '@ab/auth/schema';
import {
	CARD_STATE_VALUES,
	CARD_STATUS_VALUES,
	CARD_STATUSES,
	CARD_TYPE_VALUES,
	CONTENT_SOURCE_VALUES,
	CONTENT_SOURCES,
	DIFFICULTY_VALUES,
	PHASE_OF_FLIGHT_VALUES,
	SCENARIO_OPTIONS_MAX,
	SCENARIO_OPTIONS_MIN,
	SCENARIO_STATUS_VALUES,
	SCENARIO_STATUSES,
	SCHEMAS,
} from '@ab/constants';
import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgSchema,
	primaryKey,
	real,
	smallint,
	text,
	timestamp,
} from 'drizzle-orm/pg-core';

export const studySchema = pgSchema(SCHEMAS.STUDY);

/** Serialize a list of text values into a SQL `IN (...)` fragment for CHECK. */
function inList(values: readonly string[]): string {
	return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
}

export const card = studySchema.table(
	'card',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade' }),
		front: text('front').notNull(),
		back: text('back').notNull(),
		domain: text('domain').notNull(),
		tags: jsonb('tags').$type<string[]>().notNull().default([]),
		cardType: text('card_type').notNull(),
		sourceType: text('source_type').notNull().default(CONTENT_SOURCES.PERSONAL),
		sourceRef: text('source_ref'),
		isEditable: boolean('is_editable').notNull().default(true),
		status: text('status').notNull().default(CARD_STATUSES.ACTIVE),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		cardUserStatusIdx: index('card_user_status_idx').on(t.userId, t.status),
		cardUserDomainIdx: index('card_user_domain_idx').on(t.userId, t.domain),
		cardUserCreatedIdx: index('card_user_created_idx').on(t.userId, t.createdAt),
		cardTypeCheck: check('card_type_check', sql.raw(`"card_type" IN (${inList(CARD_TYPE_VALUES)})`)),
		sourceTypeCheck: check('card_source_type_check', sql.raw(`"source_type" IN (${inList(CONTENT_SOURCE_VALUES)})`)),
		statusCheck: check('card_status_check', sql.raw(`"status" IN (${inList(CARD_STATUS_VALUES)})`)),
	}),
);

export const review = studySchema.table(
	'review',
	{
		id: text('id').primaryKey(),
		// restrict: deleting a card with review history requires archiving first;
		// reviews are the audit trail of a learner's interaction and must not be
		// silently lost when someone hard-deletes a card.
		cardId: text('card_id')
			.notNull()
			.references(() => card.id, { onDelete: 'restrict' }),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade' }),
		rating: smallint('rating').notNull(),
		confidence: smallint('confidence'),
		stability: real('stability').notNull(),
		difficulty: real('difficulty').notNull(),
		elapsedDays: real('elapsed_days').notNull(),
		scheduledDays: real('scheduled_days').notNull(),
		state: text('state').notNull(),
		dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
		reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull().defaultNow(),
		answerMs: integer('answer_ms'),
	},
	(t) => ({
		reviewCardReviewedIdx: index('review_card_reviewed_idx').on(t.cardId, t.reviewedAt),
		reviewUserReviewedIdx: index('review_user_reviewed_idx').on(t.userId, t.reviewedAt),
		ratingCheck: check('review_rating_check', sql`"rating" BETWEEN 1 AND 4`),
		confidenceCheck: check('review_confidence_check', sql`"confidence" IS NULL OR "confidence" BETWEEN 1 AND 5`),
		stateCheck: check('review_state_check', sql.raw(`"state" IN (${inList(CARD_STATE_VALUES)})`)),
	}),
);

export const cardState = studySchema.table(
	'card_state',
	{
		cardId: text('card_id')
			.notNull()
			.references(() => card.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade' }),
		stability: real('stability').notNull(),
		difficulty: real('difficulty').notNull(),
		state: text('state').notNull(),
		dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
		lastReviewId: text('last_review_id').references(() => review.id, { onDelete: 'set null' }),
		// Denormalized copy of the last review's reviewedAt. Null until the first
		// review. ts-fsrs uses (now - lastReviewedAt) as the elapsed_days input;
		// passing null sends elapsed_days=0 through the scheduler, which breaks
		// stability growth on subsequent reviews.
		lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
		reviewCount: integer('review_count').notNull().default(0),
		lapseCount: integer('lapse_count').notNull().default(0),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.cardId, t.userId] }),
		cardStateUserDueIdx: index('card_state_user_due_idx').on(t.userId, t.dueAt),
		stateCheck: check('card_state_state_check', sql.raw(`"state" IN (${inList(CARD_STATE_VALUES)})`)),
	}),
);

export type CardRow = typeof card.$inferSelect;
export type NewCardRow = typeof card.$inferInsert;
export type ReviewRow = typeof review.$inferSelect;
export type NewReviewRow = typeof review.$inferInsert;
export type CardStateRow = typeof cardState.$inferSelect;
export type NewCardStateRow = typeof cardState.$inferInsert;

/**
 * Option on a decision-rep scenario. Always stored as an element of the
 * `scenario.options` JSONB array. `whyNot` is required when isCorrect is
 * false (enforced by validation + BC guards; a DB CHECK on a JSONB array
 * element adds noise without being airtight).
 */
export interface ScenarioOption {
	id: string;
	text: string;
	isCorrect: boolean;
	outcome: string;
	whyNot: string;
}

/**
 * Decision-rep scenario. Single-decision micro-scenarios that back the
 * `/reps` flow -- read situation, pick an option, see the outcome and
 * teaching point. Shares `source_type` / `source_ref` / `is_editable` with
 * cards for future course/import integration.
 */
export const scenario = studySchema.table(
	'scenario',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		situation: text('situation').notNull(),
		options: jsonb('options').$type<ScenarioOption[]>().notNull(),
		teachingPoint: text('teaching_point').notNull(),
		domain: text('domain').notNull(),
		difficulty: text('difficulty').notNull(),
		phaseOfFlight: text('phase_of_flight'),
		sourceType: text('source_type').notNull().default(CONTENT_SOURCES.PERSONAL),
		sourceRef: text('source_ref'),
		isEditable: boolean('is_editable').notNull().default(true),
		regReferences: jsonb('reg_references').$type<string[]>().notNull().default([]),
		status: text('status').notNull().default(SCENARIO_STATUSES.ACTIVE),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		scenarioUserStatusIdx: index('scenario_user_status_idx').on(t.userId, t.status),
		scenarioUserDomainIdx: index('scenario_user_domain_idx').on(t.userId, t.domain),
		scenarioUserCreatedIdx: index('scenario_user_created_idx').on(t.userId, t.createdAt),
		difficultyCheck: check('scenario_difficulty_check', sql.raw(`"difficulty" IN (${inList(DIFFICULTY_VALUES)})`)),
		phaseOfFlightCheck: check(
			'scenario_phase_check',
			sql.raw(`"phase_of_flight" IS NULL OR "phase_of_flight" IN (${inList(PHASE_OF_FLIGHT_VALUES)})`),
		),
		sourceTypeCheck: check(
			'scenario_source_type_check',
			sql.raw(`"source_type" IN (${inList(CONTENT_SOURCE_VALUES)})`),
		),
		statusCheck: check('scenario_status_check', sql.raw(`"status" IN (${inList(SCENARIO_STATUS_VALUES)})`)),
		optionsShapeCheck: check(
			'scenario_options_shape_check',
			sql.raw(
				`jsonb_typeof("options") = 'array'
				 AND jsonb_array_length("options") BETWEEN ${SCENARIO_OPTIONS_MIN} AND ${SCENARIO_OPTIONS_MAX}`,
			),
		),
	}),
);

/**
 * A single attempt at a scenario. Each attempt is its own row (no
 * materialized state), which matches the "judgment reps repeat over time"
 * framing and sidesteps the SRS scheduling machinery cards carry.
 *
 * `confidence` stays NULL when the user wasn't prompted -- the rep flow
 * samples on ~50% of reps via the same deterministic hash cards use.
 */
export const repAttempt = studySchema.table(
	'rep_attempt',
	{
		id: text('id').primaryKey(),
		// restrict: attempts are the audit trail of a learner's judgment
		// practice; a scenario with history must be archived, not hard-deleted.
		scenarioId: text('scenario_id')
			.notNull()
			.references(() => scenario.id, { onDelete: 'restrict' }),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade' }),
		chosenOption: text('chosen_option').notNull(),
		isCorrect: boolean('is_correct').notNull(),
		confidence: smallint('confidence'),
		answerMs: integer('answer_ms'),
		attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		repAttemptScenarioAttemptedIdx: index('rep_attempt_scenario_attempted_idx').on(t.scenarioId, t.attemptedAt),
		repAttemptUserAttemptedIdx: index('rep_attempt_user_attempted_idx').on(t.userId, t.attemptedAt),
		confidenceCheck: check('rep_attempt_confidence_check', sql`"confidence" IS NULL OR "confidence" BETWEEN 1 AND 5`),
		answerMsCheck: check('rep_attempt_answer_ms_check', sql`"answer_ms" IS NULL OR "answer_ms" >= 0`),
	}),
);

export type ScenarioRow = typeof scenario.$inferSelect;
export type NewScenarioRow = typeof scenario.$inferInsert;
export type RepAttemptRow = typeof repAttempt.$inferSelect;
export type NewRepAttemptRow = typeof repAttempt.$inferInsert;
