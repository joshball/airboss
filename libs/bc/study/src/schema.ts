/**
 * Drizzle schema for the `study` Postgres namespace.
 *
 * Owns cards, review history, materialized per-user/per-card state, and the
 * authored knowledge graph (knowledge_node + knowledge_edge). IDs for cards
 * and reviews are `prefix_ULID` via @ab/utils generateCardId / generateReviewId;
 * knowledge-graph rows use the author-assigned slug (e.g. `airspace-vfr-weather-minimums`)
 * as their primary key so edges and card links remain grep-able and stable
 * across rebuilds.
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
	type Cert,
	CONTENT_SOURCE_VALUES,
	CONTENT_SOURCES,
	DEFAULT_SESSION_LENGTH,
	DEPTH_PREFERENCE_VALUES,
	DEPTH_PREFERENCES,
	DIFFICULTY_VALUES,
	type Domain,
	KNOWLEDGE_EDGE_TYPE_VALUES,
	MAX_SESSION_LENGTH,
	MIN_SESSION_LENGTH,
	PHASE_OF_FLIGHT_VALUES,
	PLAN_STATUS_VALUES,
	PLAN_STATUSES,
	SCENARIO_OPTIONS_MAX,
	SCENARIO_OPTIONS_MIN,
	SCENARIO_STATUS_VALUES,
	SCENARIO_STATUSES,
	SCHEMAS,
	SESSION_ITEM_KIND_VALUES,
	SESSION_MODE_VALUES,
	SESSION_MODES,
	SESSION_REASON_CODE_VALUES,
	SESSION_SKIP_KIND_VALUES,
	SESSION_SLICE_VALUES,
	type SessionReasonCode,
	type SessionSlice,
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

/**
 * Authored knowledge-graph node. See ADR 011.
 *
 * Identity, knowledge-character, and a small set of scalar fields live in
 * dedicated columns so the build script and read-side queries can filter on
 * them without a JSON traversal. Everything with variable shape (relevance
 * array, references array, assessment method list, cross-domain list) stays
 * in jsonb -- the schema prompt in the ADR is explicit that empty fields are
 * information, and jsonb lets us round-trip heterogeneous metadata without
 * forcing premature typing on fields that are still stabilising.
 */
export const knowledgeNode = studySchema.table(
	'knowledge_node',
	{
		/** Author-assigned kebab-case slug (PK). Matches node.md `id` frontmatter. */
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		/** Primary domain (DOMAINS). Validated upstream; no FK into constants. */
		domain: text('domain').notNull(),
		/** Additional domains where this node is relevant; stored verbatim. */
		crossDomains: jsonb('cross_domains').$type<string[]>().notNull().default([]),
		/** Knowledge-type labels (factual / conceptual / procedural / judgment / ...). */
		knowledgeTypes: jsonb('knowledge_types').$type<string[]>().notNull().default([]),
		technicalDepth: text('technical_depth'),
		stability: text('stability'),
		/**
		 * Cert relevance array: [{ cert, bloom, priority }, ...]. Stored as jsonb
		 * so the full multi-row structure round-trips; future queries (study-plan
		 * filters) will read it without a join.
		 */
		relevance: jsonb('relevance').$type<{ cert: string; bloom: string; priority: string }[]>().notNull().default([]),
		modalities: jsonb('modalities').$type<string[]>().notNull().default([]),
		estimatedTimeMinutes: integer('estimated_time_minutes'),
		reviewTimeMinutes: integer('review_time_minutes'),
		/** Reference list: [{ source, detail, note }, ...]. */
		references: jsonb('references').$type<{ source: string; detail: string; note: string }[]>().notNull().default([]),
		assessable: boolean('assessable').notNull().default(false),
		assessmentMethods: jsonb('assessment_methods').$type<string[]>().notNull().default([]),
		masteryCriteria: text('mastery_criteria'),
		/** Markdown body (everything after the frontmatter). Phase slicing happens at render-time. */
		contentMd: text('content_md').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		knowledgeNodeDomainIdx: index('knowledge_node_domain_idx').on(t.domain),
	}),
);

/**
 * Edge in the knowledge graph.
 *
 * `toNodeId` is a plain text column, NOT a foreign key: ADR 011 permits edges
 * whose target does not (yet) exist -- a visible gap is information. The
 * `targetExists` flag is maintained by the build script after every upsert so
 * read-side queries can filter out dangling edges without re-scanning every
 * node. `edgeType` is constrained to the KNOWLEDGE_EDGE_TYPES enum.
 *
 * Composite PK = (from, to, type). Authoring a `requires` and a `related`
 * edge between the same two nodes is legal; duplicates within a single type
 * are not.
 */
export const knowledgeEdge = studySchema.table(
	'knowledge_edge',
	{
		fromNodeId: text('from_node_id')
			.notNull()
			.references(() => knowledgeNode.id, { onDelete: 'cascade' }),
		toNodeId: text('to_node_id').notNull(),
		edgeType: text('edge_type').notNull(),
		/**
		 * True when `toNodeId` resolves to an existing knowledge_node at the
		 * time of the last build. The build script refreshes this after every
		 * run; render-time filters can use it to hide or mark gaps.
		 */
		targetExists: boolean('target_exists').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.fromNodeId, t.toNodeId, t.edgeType] }),
		knowledgeEdgeFromIdx: index('knowledge_edge_from_idx').on(t.fromNodeId, t.edgeType),
		knowledgeEdgeToIdx: index('knowledge_edge_to_idx').on(t.toNodeId, t.edgeType),
		edgeTypeCheck: check(
			'knowledge_edge_type_check',
			sql.raw(`"edge_type" IN (${inList(KNOWLEDGE_EDGE_TYPE_VALUES)})`),
		),
	}),
);

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
		/**
		 * Optional link back to the knowledge graph. NULL = personal card,
		 * non-NULL = graph-linked. `set null` on delete keeps review history
		 * attached to the card even if the graph node is later removed or
		 * renamed; the card row is still owned by the user.
		 */
		nodeId: text('node_id').references(() => knowledgeNode.id, { onDelete: 'set null' }),
		isEditable: boolean('is_editable').notNull().default(true),
		status: text('status').notNull().default(CARD_STATUSES.ACTIVE),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		cardUserStatusIdx: index('card_user_status_idx').on(t.userId, t.status),
		cardUserDomainIdx: index('card_user_domain_idx').on(t.userId, t.domain),
		cardUserCreatedIdx: index('card_user_created_idx').on(t.userId, t.createdAt),
		cardUserNodeIdx: index('card_user_node_idx').on(t.userId, t.nodeId),
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
		/**
		 * Optional knowledge-graph node id. Mirrors `card.nodeId`: NULL for
		 * personal scenarios, non-NULL for scenarios attached to a graph node.
		 * `set null` on delete keeps rep-attempt history attached to the
		 * scenario even if the graph node is later removed or renamed.
		 */
		nodeId: text('node_id').references(() => knowledgeNode.id, { onDelete: 'set null' }),
		isEditable: boolean('is_editable').notNull().default(true),
		regReferences: jsonb('reg_references').$type<string[]>().notNull().default([]),
		status: text('status').notNull().default(SCENARIO_STATUSES.ACTIVE),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		scenarioUserStatusIdx: index('scenario_user_status_idx').on(t.userId, t.status),
		scenarioUserDomainIdx: index('scenario_user_domain_idx').on(t.userId, t.domain),
		scenarioUserCreatedIdx: index('scenario_user_created_idx').on(t.userId, t.createdAt),
		scenarioUserNodeIdx: index('scenario_user_node_idx').on(t.userId, t.nodeId),
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
		// Shape guard: `options` must be a jsonb array with 2..5 elements.
		// Option id uniqueness and "exactly one correct" are enforced by
		// `newScenarioSchema` + the BC's `createScenario` -- not here. The
		// BC is the only write path; a jsonb-aggregate CHECK for id
		// uniqueness adds noise without being airtight across future
		// migrations. If a bypass ever appears, add the CHECK then.
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
export type KnowledgeNodeRow = typeof knowledgeNode.$inferSelect;
export type NewKnowledgeNodeRow = typeof knowledgeNode.$inferInsert;
export type KnowledgeEdgeRow = typeof knowledgeEdge.$inferSelect;
export type NewKnowledgeEdgeRow = typeof knowledgeEdge.$inferInsert;

/**
 * A single presented slot in a session. Stored inline on `study.session.items`
 * as an ordered jsonb array so the whole batch commits atomically. See spec
 * "SessionItem shape" for the rationale.
 */
export type SessionItem =
	| {
			kind: 'card';
			cardId: string;
			slice: SessionSlice;
			reasonCode: SessionReasonCode;
			reasonDetail?: string;
	  }
	| {
			kind: 'rep';
			scenarioId: string;
			slice: SessionSlice;
			reasonCode: SessionReasonCode;
			reasonDetail?: string;
	  }
	| {
			kind: 'node_start';
			nodeId: string;
			slice: SessionSlice;
			reasonCode: SessionReasonCode;
			reasonDetail?: string;
	  };

/**
 * Study plan -- per-user configuration that shapes the session engine.
 *
 * Editable in place: this is a mutable config aggregate, not an audit record.
 * The one-active-plan invariant is enforced by a Postgres partial UNIQUE index
 * defined in the companion migration (see scripts/db/plan-active-unique.sql),
 * because Drizzle's table DSL does not express partial UNIQUE cleanly.
 */
export const studyPlan = studySchema.table(
	'study_plan',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		status: text('status').notNull().default(PLAN_STATUSES.ACTIVE),
		certGoals: jsonb('cert_goals').$type<Cert[]>().notNull().default([]),
		focusDomains: jsonb('focus_domains').$type<Domain[]>().notNull().default([]),
		skipDomains: jsonb('skip_domains').$type<Domain[]>().notNull().default([]),
		skipNodes: jsonb('skip_nodes').$type<string[]>().notNull().default([]),
		depthPreference: text('depth_preference').notNull().default(DEPTH_PREFERENCES.WORKING),
		sessionLength: smallint('session_length').notNull().default(DEFAULT_SESSION_LENGTH),
		defaultMode: text('default_mode').notNull().default(SESSION_MODES.MIXED),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		planUserStatusIdx: index('plan_user_status_idx').on(t.userId, t.status),
		statusCheck: check('plan_status_check', sql.raw(`"status" IN (${inList(PLAN_STATUS_VALUES)})`)),
		depthCheck: check('plan_depth_check', sql.raw(`"depth_preference" IN (${inList(DEPTH_PREFERENCE_VALUES)})`)),
		modeCheck: check('plan_mode_check', sql.raw(`"default_mode" IN (${inList(SESSION_MODE_VALUES)})`)),
		sessionLengthCheck: check(
			'plan_session_length_check',
			sql.raw(`"session_length" BETWEEN ${MIN_SESSION_LENGTH} AND ${MAX_SESSION_LENGTH}`),
		),
	}),
);

/**
 * One row per session start. A session carries a committed, ordered batch of
 * items in `items` jsonb (the engine output snapshot) and a `completed_at`
 * timestamp that stays NULL while in progress. The plan FK uses `restrict` so
 * historical sessions always have a plan to attribute to; archiving a plan
 * does not delete its sessions.
 */
export const session = studySchema.table(
	'session',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade' }),
		planId: text('plan_id')
			.notNull()
			.references(() => studyPlan.id, { onDelete: 'restrict' }),
		mode: text('mode').notNull(),
		focusOverride: text('focus_override'),
		certOverride: text('cert_override'),
		sessionLength: smallint('session_length').notNull(),
		items: jsonb('items').$type<SessionItem[]>().notNull(),
		/** Seed used by the engine; preserved so Shuffle can regenerate deterministically. */
		seed: text('seed').notNull(),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp('completed_at', { withTimezone: true }),
	},
	(t) => ({
		sessionUserStartedIdx: index('session_user_started_idx').on(t.userId, t.startedAt),
		sessionPlanStartedIdx: index('session_plan_started_idx').on(t.planId, t.startedAt),
		modeCheck: check('session_mode_check', sql.raw(`"mode" IN (${inList(SESSION_MODE_VALUES)})`)),
	}),
);

/**
 * Append-only attempt log per session slot. Every item result -- whether the
 * user reviewed, attempted, started a node, or skipped -- writes exactly one
 * row. The FK to review / rep_attempt uses `set null` so the trail survives
 * hard deletes of the underlying content.
 */
export const sessionItemResult = studySchema.table(
	'session_item_result',
	{
		id: text('id').primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => session.id, { onDelete: 'cascade' }),
		/** Denormalized for per-user aggregate queries (streak). */
		userId: text('user_id').notNull(),
		slotIndex: smallint('slot_index').notNull(),
		itemKind: text('item_kind').notNull(),
		slice: text('slice').notNull(),
		reasonCode: text('reason_code').notNull(),
		cardId: text('card_id').references(() => card.id, { onDelete: 'set null' }),
		scenarioId: text('scenario_id').references(() => scenario.id, { onDelete: 'set null' }),
		nodeId: text('node_id'),
		reviewId: text('review_id').references(() => review.id, { onDelete: 'set null' }),
		repAttemptId: text('rep_attempt_id').references(() => repAttempt.id, { onDelete: 'set null' }),
		skipKind: text('skip_kind'),
		/** Free-text detail when an item is skipped because its source was deleted etc. */
		reasonDetail: text('reason_detail'),
		/**
		 * Rep-specific outcome fields. Populated when `item_kind = 'rep'` and the
		 * slot is completed with a real answer (skipKind IS NULL). Moved here
		 * from `rep_attempt` as part of the ADR 012 unification: the session_
		 * item_result row is now the single source of truth for rep outcomes,
		 * same way reviews carry their rating/confidence on the session slot.
		 *
		 * Stay NULL for non-rep kinds (cards, node_starts), skipped reps, and
		 * slots that haven't been completed yet. Not NOT NULL on the table
		 * because a rep slot is inserted at session commit time before the user
		 * answers it.
		 */
		chosenOption: text('chosen_option'),
		isCorrect: boolean('is_correct'),
		confidence: smallint('confidence'),
		answerMs: integer('answer_ms'),
		presentedAt: timestamp('presented_at', { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp('completed_at', { withTimezone: true }),
	},
	(t) => ({
		sirSessionSlotIdx: index('sir_session_slot_idx').on(t.sessionId, t.slotIndex),
		sirUserCompletedIdx: index('sir_user_completed_idx').on(t.userId, t.completedAt),
		// Rep-attempt aggregations filter on (userId, itemKind='rep', completedAt IS NOT NULL).
		// A dedicated index keeps calibration / mastery / activity reads bounded after the
		// substrate unification (ADR 012).
		sirUserKindCompletedIdx: index('sir_user_kind_completed_idx').on(t.userId, t.itemKind, t.completedAt),
		sirScenarioCompletedIdx: index('sir_scenario_completed_idx').on(t.scenarioId, t.completedAt),
		itemKindCheck: check('sir_item_kind_check', sql.raw(`"item_kind" IN (${inList(SESSION_ITEM_KIND_VALUES)})`)),
		sliceCheck: check('sir_slice_check', sql.raw(`"slice" IN (${inList(SESSION_SLICE_VALUES)})`)),
		reasonCodeCheck: check(
			'sir_reason_code_check',
			sql.raw(`"reason_code" IN (${inList(SESSION_REASON_CODE_VALUES)})`),
		),
		skipKindCheck: check(
			'sir_skip_kind_check',
			sql.raw(`"skip_kind" IS NULL OR "skip_kind" IN (${inList(SESSION_SKIP_KIND_VALUES)})`),
		),
		confidenceCheck: check(
			'sir_confidence_check',
			sql`"confidence" IS NULL OR "confidence" BETWEEN 1 AND 5`,
		),
		answerMsCheck: check('sir_answer_ms_check', sql`"answer_ms" IS NULL OR "answer_ms" >= 0`),
	}),
);

export type StudyPlanRow = typeof studyPlan.$inferSelect;
export type NewStudyPlanRow = typeof studyPlan.$inferInsert;
export type SessionRow = typeof session.$inferSelect;
export type NewSessionRow = typeof session.$inferInsert;
export type SessionItemResultRow = typeof sessionItemResult.$inferSelect;
export type NewSessionItemResultRow = typeof sessionItemResult.$inferInsert;
