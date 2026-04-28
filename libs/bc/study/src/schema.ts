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
	ACS_TRIAD_VALUES,
	AIRPLANE_CLASS_VALUES,
	BLOOM_LEVEL_VALUES,
	CARD_FEEDBACK_SIGNAL_VALUES,
	CARD_STATE_VALUES,
	CARD_STATUS_VALUES,
	CARD_STATUSES,
	CARD_TYPE_VALUES,
	CERT_VALUES,
	type Cert,
	CONTENT_SOURCE_VALUES,
	CONTENT_SOURCES,
	CREDENTIAL_CATEGORY_VALUES,
	CREDENTIAL_CLASS_VALUES,
	CREDENTIAL_KIND_VALUES,
	CREDENTIAL_PREREQ_KIND_VALUES,
	CREDENTIAL_STATUS_VALUES,
	CREDENTIAL_STATUSES,
	DEFAULT_SESSION_LENGTH,
	DEPTH_PREFERENCE_VALUES,
	DEPTH_PREFERENCES,
	DIFFICULTY_VALUES,
	DOMAIN_VALUES,
	type Domain,
	GOAL_STATUS_VALUES,
	GOAL_STATUSES,
	GOAL_SYLLABUS_WEIGHT_MAX,
	GOAL_SYLLABUS_WEIGHT_MIN,
	HANDBOOK_NOTES_MAX_LENGTH,
	HANDBOOK_READ_STATUS_VALUES,
	HANDBOOK_READ_STATUSES,
	HANDBOOK_SECTION_LEVEL_VALUES,
	HANDBOOK_SECTION_LEVELS,
	KNOWLEDGE_EDGE_TYPE_VALUES,
	MASTERY_STABILITY_DAYS,
	MAX_SESSION_LENGTH,
	MIN_SESSION_LENGTH,
	NODE_LIFECYCLE_VALUES,
	NODE_LIFECYCLES,
	PHASE_OF_FLIGHT_VALUES,
	PLAN_STATUS_VALUES,
	PLAN_STATUSES,
	REFERENCE_KIND_VALUES,
	REVIEW_SESSION_STATUS_VALUES,
	REVIEW_SESSION_STATUSES,
	SAVED_DECK_LABEL_MAX_LENGTH,
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
	SNOOZE_DURATION_LEVEL_VALUES,
	SNOOZE_REASON_VALUES,
	STUDY_PRIORITY_VALUES,
	SYLLABUS_KIND_VALUES,
	SYLLABUS_NODE_LEVEL_VALUES,
	SYLLABUS_PRIMACY,
	SYLLABUS_PRIMACY_VALUES,
	SYLLABUS_STATUS_VALUES,
	SYLLABUS_STATUSES,
} from '@ab/constants';
import { timestamps } from '@ab/db';
import type { RelevanceEntry, StructuredCitation } from '@ab/types';
import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	pgSchema,
	primaryKey,
	real,
	smallint,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core';

export const studySchema = pgSchema(SCHEMAS.STUDY);

/** Serialize a list of text values into a SQL `IN (...)` fragment for CHECK. */
function inList(values: readonly string[]): string {
	return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
}

/**
 * Serialize a list of text values into a JSON array literal for embedding in
 * a CHECK constraint that uses jsonb containment (`<@`) to validate enum
 * membership. Single quotes are escaped at the SQL layer (the result is
 * embedded between single quotes).
 */
function jsonStringArray(values: readonly string[]): string {
	const escaped = values.map((v) => `"${v.replace(/"/g, '\\"').replace(/'/g, "''")}"`);
	return `[${escaped.join(', ')}]`;
}

/**
 * Shared CHECK-expression helpers so tables that carry the same semantic
 * column (confidence 1..5, non-negative duration in ms) stay in lockstep.
 * The raw SQL lives here, CHECK constraint names stay on the caller so grep
 * for `sir_confidence_check` / `review_confidence_check` still hits.
 */
function confidenceRangeCheckSql(column: string): string {
	return `"${column}" IS NULL OR "${column}" BETWEEN 1 AND 5`;
}

function nonNegativeDurationCheckSql(column: string): string {
	return `"${column}" IS NULL OR "${column}" >= 0`;
}

/**
 * Authored knowledge-graph node. See ADR 011.
 *
 * Identity, knowledge-character, and a small set of scalar fields live in
 * dedicated columns so the build script and read-side queries can filter on
 * them without a JSON traversal. Variable-shape data (references array,
 * assessment-method list, cross-domain list) stays in jsonb -- the schema
 * prompt in the ADR is explicit that empty fields are information, and
 * jsonb lets us round-trip heterogeneous metadata without forcing premature
 * typing on fields that are still stabilising.
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
		 * Lowest cert that requires this knowledge: PPL / IR / CPL / CFI. Higher
		 * certs inherit through `CERT_PREREQUISITES`. Nullable so freshly-
		 * scaffolded nodes can land before the author tags them; the build
		 * script errors on missing values for committed nodes.
		 */
		minimumCert: text('minimum_cert'),
		/**
		 * Study-time priority: critical / standard / stretch. Every node a
		 * learner sees is already on the ACS/PTS for `minimumCert` -- this
		 * field expresses where to spend the next 30 minutes, not what's
		 * testable. See `STUDY_PRIORITIES` in libs/constants/src/study.ts.
		 */
		studyPriority: text('study_priority'),
		modalities: jsonb('modalities').$type<string[]>().notNull().default([]),
		estimatedTimeMinutes: integer('estimated_time_minutes'),
		reviewTimeMinutes: integer('review_time_minutes'),
		/** Reference list: [{ source, detail, note }, ...]. */
		references: jsonb('references').$type<{ source: string; detail: string; note: string }[]>().notNull().default([]),
		assessable: boolean('assessable').notNull().default(false),
		assessmentMethods: jsonb('assessment_methods').$type<string[]>().notNull().default([]),
		masteryCriteria: text('mastery_criteria'),
		/**
		 * Dev-seed marker. NULL on production rows; set to a tag like
		 * `dev-seed-2026-04-25` for rows inserted by the dev-seed pipeline so
		 * `db seed:remove` can find and clean them.
		 */
		seedOrigin: text('seed_origin'),
		/** Markdown body (everything after the frontmatter). Phase slicing happens at render-time. */
		contentMd: text('content_md').notNull(),
		/**
		 * sha256 of `contentMd` + canonicalized frontmatter. Populated by the
		 * seed script on every upsert. Lets a caller ask "did this node change
		 * since the user last saw it?" without joining to a full version table.
		 */
		contentHash: text('content_hash'),
		/**
		 * Monotonically increasing content version. Bumped by the seed script
		 * only when `contentHash` actually changes, so re-running the seed on
		 * unchanged sources is a no-op. A future `knowledge_node_version`
		 * table can hold full history when the need arrives; the counter +
		 * hash unblock change-aware UX in the meantime.
		 */
		version: integer('version').notNull().default(1),
		/**
		 * Authoring user when the node was imported / edited through tooling.
		 * NULL for nodes seeded from the repo markdown (their provenance lives
		 * in git history). `set null` so author removal doesn't orphan the
		 * content; nodes outlive their authors in the graph's point of view.
		 */
		authorId: text('author_id').references(() => bauthUser.id, { onDelete: 'set null', onUpdate: 'cascade' }),
		/**
		 * Authoring lifecycle -- skeleton / started / complete. Derived from
		 * phase coverage in `content_md`. Mirrored on every write by
		 * `upsertKnowledgeNode` (calling `lifecycleFromContent`) so the
		 * indexed column tracks the authored markdown without read-path
		 * recomputation. Nullable for existing rows during the migration
		 * window; the seed back-fills on next run.
		 */
		lifecycle: text('lifecycle').default(NODE_LIFECYCLES.SKELETON),
		/**
		 * Cert-syllabus WP migration flag. False on every existing row at
		 * migration time; flips true after `migrate-references-to-structured.ts`
		 * has reshaped the row's `references` JSONB array from `LegacyCitation`
		 * to a uniform array of `StructuredCitation` entries. Idempotency
		 * gate: the migration script skips rows where this is true. Once
		 * the migration phase completes for every row this column becomes
		 * informational; a follow-on cleanup can drop it.
		 */
		referencesV2Migrated: boolean('references_v2_migrated').notNull().default(false),
		/**
		 * Derived cache of `(cert, bloom, priority)` triples. Rebuilt from
		 * authored syllabi by `bun run db build:relevance`; never authored
		 * directly. Empty default so existing rows materialize as zero-relevance
		 * before the first rebuild lands. The YAML frontmatter `relevance:`
		 * field is dropped from `course/knowledge/<slug>/node.md` once the
		 * cache rebuild is verified equivalent (cert-syllabus WP phase 22).
		 *
		 * Highest-bloom-wins per `(node, cert)` pair after dedup. Read by the
		 * existing dashboard / lens code unchanged from the authored shape.
		 */
		relevance: jsonb('relevance').$type<RelevanceEntry[]>().notNull().default([]),
		...timestamps(),
	},
	(t) => ({
		knowledgeNodeDomainIdx: index('knowledge_node_domain_idx').on(t.domain),
		knowledgeNodeLifecycleIdx: index('knowledge_node_lifecycle_idx').on(t.lifecycle),
		knowledgeNodeMinimumCertIdx: index('knowledge_node_minimum_cert_idx').on(t.minimumCert),
		knowledgeNodeStudyPriorityIdx: index('knowledge_node_study_priority_idx').on(t.studyPriority),
		// GIN index on the JSONB `references` array supports the reverse query
		// "knowledge nodes that cite this handbook section." `getNodesCitingSection`
		// uses `references @> ?::jsonb` with a `{kind, reference_id}` probe; the
		// jsonb_path_ops opclass keeps the index small and the `@>` containment
		// check fast at the cost of a narrower operator surface (we never need
		// `?` / `?|` / `?&` against this column).
		knowledgeNodeReferencesGinIdx: index('knowledge_node_references_gin_idx').using(
			'gin',
			sql`"references" jsonb_path_ops`,
		),
		lifecycleCheck: check(
			'knowledge_node_lifecycle_check',
			sql.raw(`"lifecycle" IS NULL OR "lifecycle" IN (${inList(NODE_LIFECYCLE_VALUES)})`),
		),
		minimumCertCheck: check(
			'knowledge_node_minimum_cert_check',
			sql.raw(`"minimum_cert" IS NULL OR "minimum_cert" IN (${inList(CERT_VALUES)})`),
		),
		studyPriorityCheck: check(
			'knowledge_node_study_priority_check',
			sql.raw(`"study_priority" IS NULL OR "study_priority" IN (${inList(STUDY_PRIORITY_VALUES)})`),
		),
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
		seedOrigin: text('seed_origin'),
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
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
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
		/** Dev-seed marker. NULL on production rows. */
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		cardUserStatusIdx: index('card_user_status_idx').on(t.userId, t.status),
		cardUserDomainIdx: index('card_user_domain_idx').on(t.userId, t.domain),
		cardUserCreatedIdx: index('card_user_created_idx').on(t.userId, t.createdAt),
		// node-first order: the read shapes in `knowledge.ts` (getCardsForNode,
		// listNodeSummaries count-by-node) select on node_id primarily and
		// user_id secondarily. Node is the more selective column (one node of
		// ~30 authored) so the index probes fewer rows when the leading filter
		// is node_id. The user-first prefix was not actually used by any query.
		cardNodeUserIdx: index('card_node_user_idx').on(t.nodeId, t.userId),
		// Trigram GIN indexes for `memory/browse` ILIKE '%pattern%' search.
		// pg_trgm's `gin_trgm_ops` opclass makes leading-wildcard matches
		// index-backed instead of triggering a per-user card scan. The
		// extension is created by the companion apply-sql (pg_trgm is a
		// contrib extension available in the airboss dev container).
		cardFrontTrgmIdx: index('card_front_trgm_idx').using('gin', sql`"front" gin_trgm_ops`),
		cardBackTrgmIdx: index('card_back_trgm_idx').using('gin', sql`"back" gin_trgm_ops`),
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
			.references(() => card.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		// ts-fsrs AGAIN/HARD/GOOD/EASY = 1/2/3/4. Stored as smallint so
		// Drizzle + pg bindings pass the raw enum value through ts-fsrs
		// unchanged. The CHECK below enumerates the meaningful values rather
		// than leaving a silent BETWEEN; label-to-number mapping lives in
		// `REVIEW_RATINGS` in @ab/constants.
		// 1 = AGAIN, 2 = HARD, 3 = GOOD, 4 = EASY.
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
		/**
		 * Optional link back to the `memory_review_session` that produced this
		 * review (review-sessions-url layer a). Stays NULL for reviews written
		 * outside a session (legacy data, `/sessions/[id]` engine slots, future
		 * deep-link review flows). Cross-references panel on `/memory/<id>`
		 * uses this pointer to list "sessions that included this card." `set
		 * null` on delete so a session cleanup never destroys review history.
		 */
		reviewSessionId: text('review_session_id').references(() => memoryReviewSession.id, { onDelete: 'set null' }),
		/** Dev-seed marker. NULL on production rows. */
		seedOrigin: text('seed_origin'),
	},
	(t) => ({
		reviewCardReviewedIdx: index('review_card_reviewed_idx').on(t.cardId, t.reviewedAt),
		reviewUserReviewedIdx: index('review_user_reviewed_idx').on(t.userId, t.reviewedAt),
		// Supports the cross-refs query "memory_review_sessions that included
		// this card" without scanning every review row for the user.
		reviewSessionCardIdx: index('review_session_card_idx').on(t.reviewSessionId, t.cardId),
		// IN (1,2,3,4) rather than BETWEEN so the CHECK documents the
		// discrete ts-fsrs labels (AGAIN/HARD/GOOD/EASY) a reader of
		// `\d study.review` sees at the psql prompt.
		ratingCheck: check('review_rating_check', sql.raw(`"rating" IN (1, 2, 3, 4)`)),
		confidenceCheck: check('review_confidence_check', sql.raw(confidenceRangeCheckSql('confidence'))),
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
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
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
		/**
		 * Last mutation timestamp for this projection row. `lastReviewedAt` is
		 * "when the user last reviewed," not "when this row last changed" --
		 * a migration that rewrites stability/difficulty, a lapse-count
		 * backfill, or a manual correction changes the row without touching
		 * `lastReviewedAt`. `updatedAt` answers "when did the projection last
		 * change" so debugging state drift against the review log is tractable.
		 */
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.cardId, t.userId] }),
		cardStateUserDueIdx: index('card_state_user_due_idx').on(t.userId, t.dueAt),
		// Partial index on mastered rows only. `getMasteredCount`, `getDomainBreakdown`,
		// `getNodeMastery`, and `getNodeMasteryMap` all filter on
		// `stability > MASTERY_STABILITY_DAYS`. A partial index keeps the write
		// cost negligible (only mastered rows hit the index) while eliminating
		// the scan over every active card at scale.
		cardStateUserMasteredIdx: index('card_state_user_mastered_idx')
			.on(t.userId)
			.where(sql.raw(`"stability" > ${MASTERY_STABILITY_DAYS}`)),
		// Supports `fetchCardCandidates`'s join back to the most recent review
		// via `card_state.last_review_id`. Without this, the BC fix (perf major
		// item 9) falls back to a sequential scan of card_state.
		cardStateLastReviewIdx: index('card_state_last_review_idx').on(t.lastReviewId),
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
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
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
		/** Dev-seed marker. NULL on production rows. */
		seedOrigin: text('seed_origin'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		scenarioUserStatusIdx: index('scenario_user_status_idx').on(t.userId, t.status),
		scenarioUserDomainIdx: index('scenario_user_domain_idx').on(t.userId, t.domain),
		// (userId, createdAt) backs `getScenarios` (scenarios.ts) which filters
		// by user_id and orders by created_at DESC for the browse list; also
		// backs `getRepBacklog` which uses `created_at DESC` as a tiebreaker in
		// the last-attempted-first ordering. Kept deliberately; do not drop.
		scenarioUserCreatedIdx: index('scenario_user_created_idx').on(t.userId, t.createdAt),
		scenarioUserNodeIdx: index('scenario_user_node_idx').on(t.userId, t.nodeId),
		// Difficulty is low-cardinality; useful on larger backlogs. `getScenarios`
		// and `getRepBacklog` both accept a difficulty filter (scenarios.ts:229, 293).
		scenarioUserDifficultyIdx: index('scenario_user_difficulty_idx').on(t.userId, t.difficulty),
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

export type ScenarioRow = typeof scenario.$inferSelect;
export type NewScenarioRow = typeof scenario.$inferInsert;
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
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		title: text('title').notNull(),
		status: text('status').notNull().default(PLAN_STATUSES.ACTIVE),
		certGoals: jsonb('cert_goals').$type<Cert[]>().notNull().default([]),
		focusDomains: jsonb('focus_domains').$type<Domain[]>().notNull().default([]),
		skipDomains: jsonb('skip_domains').$type<Domain[]>().notNull().default([]),
		skipNodes: jsonb('skip_nodes').$type<string[]>().notNull().default([]),
		depthPreference: text('depth_preference').notNull().default(DEPTH_PREFERENCES.WORKING),
		sessionLength: smallint('session_length').notNull().default(DEFAULT_SESSION_LENGTH),
		defaultMode: text('default_mode').notNull().default(SESSION_MODES.MIXED),
		/**
		 * Cert-syllabus WP migration flag. NULL on every existing row at
		 * migration time; set to `now()` after `migrate-study-plan-to-goals.ts`
		 * has materialized this plan's `cert_goals` into a `goal` row plus
		 * `goal_syllabus` rows. Idempotency gate: the migration script skips
		 * rows where this is non-null. The engine continues reading
		 * `cert_goals` directly until a follow-on WP cuts it over to
		 * `getDerivedCertGoals(userId)`.
		 */
		goalMigratedAt: timestamp('goal_migrated_at', { withTimezone: true }),
		/** Dev-seed marker. NULL on production rows. */
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		planUserStatusIdx: index('plan_user_status_idx').on(t.userId, t.status),
		// Partial UNIQUE: enforces "one active plan per user" at the DB level.
		// Expressed in Drizzle so drizzle-kit tracks it like any other index;
		// the old scripts/db/plan-active-unique.sql one-shot backfill is kept
		// for existing environments but `bun run db push` now makes it
		// redundant on fresh DBs.
		planUserActiveUniq: uniqueIndex('plan_user_active_uniq').on(t.userId).where(sql`status = 'active'`),
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
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		planId: text('plan_id')
			.notNull()
			.references(() => studyPlan.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
		mode: text('mode').notNull(),
		focusOverride: text('focus_override'),
		certOverride: text('cert_override'),
		sessionLength: smallint('session_length').notNull(),
		items: jsonb('items').$type<SessionItem[]>().notNull(),
		/** Seed used by the engine; preserved so Shuffle can regenerate deterministically. */
		seed: text('seed').notNull(),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		/** Dev-seed marker. NULL on production rows. */
		seedOrigin: text('seed_origin'),
	},
	(t) => ({
		sessionUserStartedIdx: index('session_user_started_idx').on(t.userId, t.startedAt),
		sessionPlanStartedIdx: index('session_plan_started_idx').on(t.planId, t.startedAt),
		modeCheck: check('session_mode_check', sql.raw(`"mode" IN (${inList(SESSION_MODE_VALUES)})`)),
		focusOverrideCheck: check(
			'session_focus_override_check',
			sql.raw(`"focus_override" IS NULL OR "focus_override" IN (${inList(DOMAIN_VALUES)})`),
		),
		certOverrideCheck: check(
			'session_cert_override_check',
			sql.raw(`"cert_override" IS NULL OR "cert_override" IN (${inList(CERT_VALUES)})`),
		),
		// Mirror study_plan.session_length range so a buggy override-assembly
		// path can't insert out-of-range values on a session row.
		sessionLengthCheck: check(
			'session_session_length_check',
			sql.raw(`"session_length" BETWEEN ${MIN_SESSION_LENGTH} AND ${MAX_SESSION_LENGTH}`),
		),
	}),
);

/**
 * Append-only attempt log per session slot. Every item result -- whether the
 * user reviewed, attempted, started a node, or skipped -- writes exactly one
 * row. The FK to review uses `set null` so the trail survives hard deletes of
 * the underlying content.
 */
export const sessionItemResult = studySchema.table(
	'session_item_result',
	{
		id: text('id').primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => session.id, { onDelete: 'cascade' }),
		/**
		 * Denormalized for per-user aggregate queries (streak). FK is required
		 * so the column cannot drift from `session.user_id`; the write path in
		 * `sessions.ts` keeps the two consistent and the FK enforces it at the
		 * storage layer. `cascade` matches every other user-scoped table.
		 */
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		slotIndex: smallint('slot_index').notNull(),
		itemKind: text('item_kind').notNull(),
		slice: text('slice').notNull(),
		reasonCode: text('reason_code').notNull(),
		cardId: text('card_id').references(() => card.id, { onDelete: 'set null' }),
		scenarioId: text('scenario_id').references(() => scenario.id, { onDelete: 'set null' }),
		/**
		 * Optional pointer to a knowledge_node. `set null` on delete: rep /
		 * node-start history outlives the node so the learner's historical
		 * record stays intact if a node is removed or renamed. Carries a FK +
		 * index (`sir_node_completed_idx`) so node-scoped aggregations don't
		 * scan the whole slot table.
		 */
		nodeId: text('node_id').references(() => knowledgeNode.id, { onDelete: 'set null' }),
		reviewId: text('review_id').references(() => review.id, { onDelete: 'set null' }),
		skipKind: text('skip_kind'),
		/** Free-text detail when an item is skipped because its source was deleted etc. */
		reasonDetail: text('reason_detail'),
		/**
		 * Rep-specific outcome fields. Populated when `item_kind = 'rep'` and the
		 * slot is completed with a real answer (skipKind IS NULL). Per ADR 012,
		 * the session_item_result row is the single source of truth for rep
		 * outcomes, same way reviews carry their rating/confidence on the
		 * session slot.
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
		/** Dev-seed marker. NULL on production rows. */
		seedOrigin: text('seed_origin'),
	},
	(t) => ({
		// UNIQUE on (session_id, slot_index) backs the atomic UPSERT in
		// `recordItemResult` -- the enforcement for ADR 012's session-slot
		// idempotency claim. Without this, two concurrent submits can both
		// INSERT and produce a duplicate row. See ADR 012 appendix for context.
		sirSessionSlotUnique: uniqueIndex('sir_session_slot_unique').on(t.sessionId, t.slotIndex),
		sirUserCompletedIdx: index('sir_user_completed_idx').on(t.userId, t.completedAt),
		// Rep-attempt aggregations filter on (userId, itemKind='rep', completedAt IS NOT NULL).
		// A dedicated index keeps calibration / mastery / activity reads bounded after the
		// substrate unification (ADR 012).
		sirUserKindCompletedIdx: index('sir_user_kind_completed_idx').on(t.userId, t.itemKind, t.completedAt),
		sirScenarioCompletedIdx: index('sir_scenario_completed_idx').on(t.scenarioId, t.completedAt),
		// Covers node-scoped aggregations (node mastery, "has the user touched
		// this node via a session slot?") without scanning the whole slot
		// table for each knowledge-graph render.
		sirNodeCompletedIdx: index('sir_node_completed_idx').on(t.nodeId, t.completedAt),
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
		confidenceCheck: check('sir_confidence_check', sql.raw(confidenceRangeCheckSql('confidence'))),
		answerMsCheck: check('sir_answer_ms_check', sql.raw(nonNegativeDurationCheckSql('answer_ms'))),
	}),
);

export type StudyPlanRow = typeof studyPlan.$inferSelect;
export type NewStudyPlanRow = typeof studyPlan.$inferInsert;
export type SessionRow = typeof session.$inferSelect;
export type NewSessionRow = typeof session.$inferInsert;
export type SessionItemResultRow = typeof sessionItemResult.$inferSelect;
export type NewSessionItemResultRow = typeof sessionItemResult.$inferInsert;

/**
 * Per-user per-node phase progress for the knowledge /learn stepper.
 *
 * Tracks which of the seven phases (Context ... Verify) a learner has visited
 * and which they've explicitly marked complete via "Got it". `lastPhase`
 * enables resume-where-you-left-off on return visits.
 *
 * Distinct from mastery (which is dual-gate over attached cards + reps): this
 * table is a lightweight UX signal -- no pedagogical weight. Rows are upserted
 * idempotently; phase lists dedupe via BC functions.
 */
export const knowledgeNodeProgress = studySchema.table(
	'knowledge_node_progress',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		/**
		 * Knowledge-graph node slug. `set null` on delete so a node rebuild
		 * that renames a slug doesn't cascade-destroy the learner's progress
		 * row -- the row is kept as an orphan until the next progress write
		 * reconciles it. Explicit FK (previously skipped because "seeds may
		 * rebuild independently") is worth the trade: a dangling `node_id`
		 * that no longer resolves is a bug, not a feature, and cascade-set-
		 * null preserves the historical record.
		 */
		nodeId: text('node_id').references(() => knowledgeNode.id, { onDelete: 'set null' }),
		visitedPhases: text('visited_phases').array().notNull().default(sql`'{}'::text[]`),
		completedPhases: text('completed_phases').array().notNull().default(sql`'{}'::text[]`),
		lastPhase: text('last_phase'),
		// Append-only-ish projection: only `updatedAt` matters because every
		// write is a full upsert of the projection. No createdAt by design.
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => ({
		userNodeUnique: uniqueIndex('knp_user_node_unique').on(t.userId, t.nodeId),
		// Supports node-first reads ("who has touched this node?" / "what's
		// the progress on this node across users?"). Without this, listing
		// node progress falls back to the unique index prefix on `user_id`.
		knpNodeIdx: index('knp_node_idx').on(t.nodeId),
	}),
);

export type KnowledgeNodeProgressRow = typeof knowledgeNodeProgress.$inferSelect;
export type NewKnowledgeNodeProgressRow = typeof knowledgeNodeProgress.$inferInsert;

/**
 * Canonical deck spec persisted on a review session row. The hash is
 * SHA-1(JSON.stringify(deck_spec)) first 8 chars and is recomputed on the
 * server at session-creation time so two requests with the same logical
 * filter land on the same `deck_hash` regardless of JSON key order.
 *
 * Layer (a) Resume only uses `deck_spec`/`deck_hash` as bookkeeping -- the
 * filter is always "due now, optional domain" today. Layer (b) Redo (deferred
 * per spec) is what lights these fields up as the reproducible entry point.
 */
export interface ReviewSessionDeckSpec {
	/** Domain filter when the session was scoped by one. `null` = all domains. */
	domain: string | null;
}

/**
 * Memory-review session row (review-sessions-url layer a "Resume", see
 * `docs/work-packages/review-sessions-url/spec.md`). One row per run; the
 * card list is frozen at start and replayed from `current_index` so closing
 * and reopening the URL lands the learner on the same card.
 *
 * Distinct from `session` (the engine-scheduler session): engine sessions
 * mix cards, reps, and node starts under a plan; review sessions are a
 * pure memory-card traversal driven by the due-queue + an optional filter.
 */
export const memoryReviewSession = studySchema.table(
	'memory_review_session',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		/** SHA-1(deck_spec JSON) first 8 chars. Buckets runs of the "same deck" for future analytics + Layer (b) Redo. */
		deckHash: text('deck_hash').notNull(),
		deckSpec: jsonb('deck_spec').$type<ReviewSessionDeckSpec>().notNull(),
		cardIdList: jsonb('card_id_list').$type<string[]>().notNull(),
		currentIndex: integer('current_index').notNull().default(0),
		status: text('status').notNull().default(REVIEW_SESSION_STATUSES.ACTIVE),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp('completed_at', { withTimezone: true }),
	},
	(t) => ({
		// Resolves "is there an active/abandoned run of this deck for this user?"
		// without scanning the user's full session history.
		mrsUserDeckStatusIdx: index('mrs_user_deck_status_idx').on(t.userId, t.deckHash, t.status),
		// Dashboard history read: "most recent sessions for this user."
		mrsUserStartedIdx: index('mrs_user_started_idx').on(t.userId, t.startedAt),
		mrsStatusCheck: check('mrs_status_check', sql.raw(`"status" IN (${inList(REVIEW_SESSION_STATUS_VALUES)})`)),
		mrsCurrentIndexCheck: check('mrs_current_index_check', sql.raw(`"current_index" >= 0`)),
	}),
);

export type MemoryReviewSessionRow = typeof memoryReviewSession.$inferSelect;
export type NewMemoryReviewSessionRow = typeof memoryReviewSession.$inferInsert;

/**
 * Per-(user, deckHash) overlay row for the Saved Decks dashboard surface.
 *
 * Saved Decks are otherwise implicit -- every distinct `deck_hash` on a
 * `memory_review_session` row contributes to the list (see
 * `listSavedDecks`). This table lets a learner attach a custom label to a
 * deck (`label`) and dismiss it from the dashboard (`dismissed_at`) without
 * touching the underlying review-session history. Both fields are optional;
 * absent rows fall back to the auto-derived summary and stay visible.
 *
 * The deck-hash itself isn't a foreign key (no `saved_deck_hash` table
 * exists) -- it's just whatever `computeDeckHash` produced when the
 * matching memory-review session was started. Re-running the same filter
 * after dismissal re-creates the implicit Saved Decks entry; a future call
 * to `renameSavedDeck` or `deleteSavedDeck` upserts onto the same row.
 *
 * Unique on (user_id, deck_hash) so we never have to merge multiple
 * overlay rows for one deck.
 */
export const savedDeck = studySchema.table(
	'saved_deck',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		/** Same 8-char hash carried on `memory_review_session.deck_hash`. */
		deckHash: text('deck_hash').notNull(),
		/**
		 * Optional learner-supplied display name. NULL means "use the
		 * auto-derived summary." Capped at {@link SAVED_DECK_LABEL_MAX_LENGTH}
		 * characters at the BC layer; the DB check enforces the same bound so
		 * any future direct insert (seed, migration) can't sneak past.
		 */
		label: text('label'),
		/**
		 * When set, the dashboard hides this saved deck. The underlying
		 * memory-review sessions are untouched -- "delete" here means "stop
		 * surfacing this entry on the Saved Decks list." Re-running the same
		 * filter clears the timestamp via the upsert path so the deck
		 * reappears next visit.
		 */
		dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
		...timestamps(),
	},
	(t) => ({
		// One overlay row per (user, deckHash). Conflict target for the
		// rename + delete upserts.
		savedDeckUserHashUnique: uniqueIndex('saved_deck_user_hash_unique').on(t.userId, t.deckHash),
		// Active-only read used by the dashboard `listSavedDecks` join.
		savedDeckUserActiveIdx: index('saved_deck_user_active_idx')
			.on(t.userId, t.deckHash)
			.where(sql`dismissed_at IS NULL`),
		// Length guard. The BC validator catches user input up-front; the
		// CHECK is the belt-and-suspenders guard against direct writes.
		savedDeckLabelLengthCheck: check(
			'saved_deck_label_length_check',
			sql.raw(`"label" IS NULL OR char_length("label") <= ${SAVED_DECK_LABEL_MAX_LENGTH}`),
		),
		// Empty-string label is meaningless -- callers should pass NULL to
		// clear. This blocks the "" sneak-past at the storage layer too.
		savedDeckLabelNonEmptyCheck: check(
			'saved_deck_label_non_empty_check',
			sql.raw(`"label" IS NULL OR char_length("label") > 0`),
		),
	}),
);

export type SavedDeckRow = typeof savedDeck.$inferSelect;
export type NewSavedDeckRow = typeof savedDeck.$inferInsert;
/**
 * Snooze rows for per-user card-out-of-deck actions.
 *
 * One row per Snooze press. `reason` drives the lifecycle:
 *
 * - `bad-question`  -- `snooze_until` may be NULL (wait-for-author-edit) or a
 *   future timestamp; `resolved_at` is set when the author edits the card.
 * - `wrong-domain`  -- `snooze_until` is future, `resolved_at` NULL while active.
 * - `know-it-bored` -- `snooze_until` is future; never requires resolution.
 * - `remove`        -- `snooze_until` NULL; `resolved_at` set when the user
 *   restores the card from Browse.
 *
 * Active rows are those with `resolved_at IS NULL` AND (`snooze_until IS NULL`
 * OR `snooze_until > now()`). The review scheduler and Browse filters honour
 * this shape via `getActiveSnoozes` / `getRemovedCards`.
 */
export const cardSnooze = studySchema.table(
	'card_snooze',
	{
		id: text('id').primaryKey(),
		cardId: text('card_id')
			.notNull()
			.references(() => card.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		reason: text('reason').notNull(),
		comment: text('comment'),
		durationLevel: text('duration_level'),
		snoozeUntil: timestamp('snooze_until', { withTimezone: true }),
		resolvedAt: timestamp('resolved_at', { withTimezone: true }),
		/**
		 * Stamped when the underlying card is edited after the snooze was
		 * created. Used by the review queue to mark re-entry so the banner
		 * "This card was updated. Does it look better now?" shows exactly once.
		 * NULL means the card has not been edited since this snooze row was
		 * created; non-NULL triggers the re-entry path.
		 */
		cardEditedAt: timestamp('card_edited_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		// Hot path: "is this card currently snoozed for this user?" for the
		// review-queue filter. A (user, card) prefix matches both the per-card
		// lookup and the per-user bulk snooze list.
		cardSnoozeUserCardIdx: index('card_snooze_user_card_idx').on(t.userId, t.cardId),
		// Author-review queue query ("unresolved bad-question rows") and the
		// re-entry banner read filter by (user, reason, resolvedAt).
		cardSnoozeUserReasonIdx: index('card_snooze_user_reason_idx').on(t.userId, t.reason, t.resolvedAt),
		// Browse Removed filter: active remove rows per user.
		cardSnoozeUserRemovedIdx: index('card_snooze_user_removed_idx')
			.on(t.userId, t.cardId)
			.where(sql`reason = 'remove' AND resolved_at IS NULL`),
		// Enforce: one active `remove` row per (card, user). Restoring writes
		// `resolved_at`, which drops the row from this partial index and
		// allows a future re-remove.
		cardSnoozeUniqueRemove: uniqueIndex('card_snooze_unique_remove')
			.on(t.cardId, t.userId)
			.where(sql`reason = 'remove' AND resolved_at IS NULL`),
		reasonCheck: check('card_snooze_reason_check', sql.raw(`"reason" IN (${inList(SNOOZE_REASON_VALUES)})`)),
		durationLevelCheck: check(
			'card_snooze_duration_level_check',
			sql.raw(`"duration_level" IS NULL OR "duration_level" IN (${inList(SNOOZE_DURATION_LEVEL_VALUES)})`),
		),
	}),
);

/**
 * Per-user per-card content feedback. Separate from recall ratings (stored
 * on `review`) and from schedule-altering snoozes (stored on `card_snooze`).
 * Multiple rows per (card, user) allowed: the learner can like a card today
 * and flag it a week later.
 *
 * `flag` rows surface in the same author-review surface as `bad-question`
 * snoozes via a UNION in the admin query (future Hangar queue, not this WP).
 */
export const cardFeedback = studySchema.table(
	'card_feedback',
	{
		id: text('id').primaryKey(),
		cardId: text('card_id')
			.notNull()
			.references(() => card.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		signal: text('signal').notNull(),
		comment: text('comment'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		// Per-card aggregate read ("has this user liked / flagged this card?"),
		// per-user list for the learner's history.
		cardFeedbackUserCardIdx: index('card_feedback_user_card_idx').on(t.userId, t.cardId),
		signalCheck: check('card_feedback_signal_check', sql.raw(`"signal" IN (${inList(CARD_FEEDBACK_SIGNAL_VALUES)})`)),
	}),
);

export type CardSnoozeRow = typeof cardSnooze.$inferSelect;
export type NewCardSnoozeRow = typeof cardSnooze.$inferInsert;
export type CardFeedbackRow = typeof cardFeedback.$inferSelect;
export type NewCardFeedbackRow = typeof cardFeedback.$inferInsert;

/**
 * First-class citation source. Edition-versioned. One row per
 * `(document_slug, edition)` pair. Powers the `Citation` discriminated union
 * carried on `knowledge_node.references` and the handbook reader's index +
 * "newer edition available" banner.
 *
 * Spans every kind of FAA reference (handbooks, CFR titles, ACs, ACS / PTS,
 * AIM, PCG, NTSB reports, POH excerpts, other). v1 only ingests handbooks
 * end-to-end; the schema is shaped to accept the rest as the cert-syllabus
 * and ref-extraction WPs land.
 *
 * `superseded_by_id` self-FK lets the seed wire each older edition to the
 * latest; `seed_origin` matches the project-wide dev-seed marker convention.
 */
export const reference = studySchema.table(
	'reference',
	{
		id: text('id').primaryKey(),
		/**
		 * Reference family. See {@link REFERENCE_KINDS}. Storage discriminator
		 * for the structured `Citation` union; the resolver in
		 * `libs/bc/study/src/handbooks.ts` only handles `handbook` in v1.
		 */
		kind: text('kind').notNull(),
		/** Stable cross-edition slug: `phak`, `afh`, `avwx`, `14cfr61`, etc. */
		documentSlug: text('document_slug').notNull(),
		/** FAA edition tag: `FAA-H-8083-25C`, `2024-09`, free-form per kind. */
		edition: text('edition').notNull(),
		/** Display name: "Pilot's Handbook of Aeronautical Knowledge". */
		title: text('title').notNull(),
		publisher: text('publisher').notNull().default('FAA'),
		url: text('url'),
		/**
		 * Set when a newer edition exists. The reader surfaces "newer edition
		 * available" when this points to a non-archived row; resolvers continue
		 * to honor citations against the older edition so historical links
		 * never break. `set null` so deleting a newer edition (rare) doesn't
		 * cascade-destroy the older ones.
		 */
		supersededById: text('superseded_by_id').references((): AnyPgColumn => reference.id, {
			onDelete: 'set null',
		}),
		/** Dev-seed marker; NULL on production rows. */
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		// One row per (document_slug, edition). The seed conflict-targets this.
		referenceDocEditionUnique: uniqueIndex('reference_doc_edition_unique').on(t.documentSlug, t.edition),
		referenceKindIdx: index('reference_kind_idx').on(t.kind),
		// "Most-recent edition for this document" probe + the "is this row
		// superseded?" filter both lean on (document_slug, superseded_by_id).
		referenceDocSupersededIdx: index('reference_doc_superseded_idx').on(t.documentSlug, t.supersededById),
		kindCheck: check('reference_kind_check', sql.raw(`"kind" IN (${inList(REFERENCE_KIND_VALUES)})`)),
		// Slug shape: kebab-case, 3..32 chars. Document slugs are reader URL
		// fragments; constraining at the storage layer keeps a typo from
		// shipping a route that breaks `decodeURIComponent` round-trips.
		documentSlugShapeCheck: check(
			'reference_document_slug_shape_check',
			sql.raw(`"document_slug" ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'`),
		),
		editionLengthCheck: check('reference_edition_length_check', sql.raw(`char_length("edition") BETWEEN 1 AND 64`)),
	}),
);

/**
 * Per-section content row. One row per `<chapter>/<section>.md` file in the
 * `handbooks/` tree. Tree-shaped via `parent_id`: a chapter is a row at
 * `level='chapter'` with `parent_id IS NULL`; sections nest under chapters,
 * subsections under sections.
 *
 * `code` is the citation-grade dotted index ("12", "12.3", "12.3.2"); the
 * seed composes it deterministically so URL stability across re-ingests
 * doesn't depend on row ordering. `content_hash` (SHA-256 of the source
 * markdown file) drives idempotent seed: an unchanged section is a no-op.
 */
export const handbookSection = studySchema.table(
	'handbook_section',
	{
		id: text('id').primaryKey(),
		referenceId: text('reference_id')
			.notNull()
			.references(() => reference.id, { onDelete: 'cascade' }),
		/**
		 * NULL for chapter rows; the chapter id for section rows; the section
		 * id for subsection rows. `cascade` so a chapter delete drops its
		 * subtree -- per-edition trees are mass-replaced by the seed when an
		 * extraction warning becomes a fixable bug.
		 */
		parentId: text('parent_id').references((): AnyPgColumn => handbookSection.id, {
			onDelete: 'cascade',
		}),
		/** chapter / section / subsection. See {@link HANDBOOK_SECTION_LEVELS}. */
		level: text('level').notNull(),
		/** Within-parent sort order. */
		ordinal: integer('ordinal').notNull(),
		/** Citation code: "12", "12.3", "12.3.2". Composed deterministically. */
		code: text('code').notNull(),
		title: text('title').notNull(),
		/**
		 * First FAA-printed page reference. Stored as text because FAA pagination
		 * is hyphenated (`"12-7"` = chapter 12, page 7 within the chapter); a
		 * future handbook with non-hyphenated pages just stores the bare digit
		 * string. NULL when the page reference is unknown.
		 */
		faaPageStart: text('faa_page_start'),
		faaPageEnd: text('faa_page_end'),
		/** Canonical citation string ("PHAK Ch 12 §3 (pp. 12-7..12-9)"). Cached for display. */
		sourceLocator: text('source_locator').notNull(),
		/** Section body markdown. Empty on chapter rows. */
		contentMd: text('content_md').notNull().default(''),
		/** SHA-256 of the source markdown file. Drives idempotent seed. */
		contentHash: text('content_hash').notNull(),
		/** Cached aggregates so list rendering avoids per-row joins. */
		hasFigures: boolean('has_figures').notNull().default(false),
		hasTables: boolean('has_tables').notNull().default(false),
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		// One row per (reference, code). Conflict target for the seed upsert.
		handbookSectionRefCodeUnique: uniqueIndex('handbook_section_ref_code_unique').on(t.referenceId, t.code),
		// Tree walks: chapter list -> sections -> subsections.
		handbookSectionTreeIdx: index('handbook_section_tree_idx').on(t.referenceId, t.parentId, t.ordinal),
		// "List chapters in this handbook" -- level=chapter ordered by ordinal.
		handbookSectionLevelIdx: index('handbook_section_level_idx').on(t.referenceId, t.level, t.ordinal),
		levelCheck: check('handbook_section_level_check', sql.raw(`"level" IN (${inList(HANDBOOK_SECTION_LEVEL_VALUES)})`)),
		// Code shape: dotted decimal up to 3 levels deep ("12", "12.3", "12.3.2").
		codeShapeCheck: check('handbook_section_code_shape_check', sql.raw(`"code" ~ '^[0-9]+(\\.[0-9]+){0,2}$'`)),
		// `parent_id IS NULL` iff `level = 'chapter'`. Belt-and-suspenders against
		// a buggy seed inserting a section without a chapter or a chapter under
		// another row.
		parentLevelConsistencyCheck: check(
			'handbook_section_parent_level_check',
			sql.raw(
				`("level" = '${HANDBOOK_SECTION_LEVELS.CHAPTER}' AND "parent_id" IS NULL) OR ("level" <> '${HANDBOOK_SECTION_LEVELS.CHAPTER}' AND "parent_id" IS NOT NULL)`,
			),
		),
		ordinalNonNegativeCheck: check('handbook_section_ordinal_check', sql.raw(`"ordinal" >= 0`)),
		// Printed FAA pagination is `<chapter>-<page>` so lexicographic ordering
		// (`"12-23"` < `"12-9"`) is unsafe. Just enforce the NULL-pair invariant:
		// either both ends are NULL (page reference unknown) or `faa_page_start`
		// is set. `faa_page_end` may be NULL when the section ends on its start
		// page. The within-chapter ordering uses `ordinal`, not page strings.
		faaPagesConsistentCheck: check(
			'handbook_section_faa_pages_check',
			sql.raw(`("faa_page_start" IS NULL AND "faa_page_end" IS NULL) OR "faa_page_start" IS NOT NULL`),
		),
	}),
);

/**
 * Per-figure record. Bound to a section by FK; ordered by `ordinal` within
 * the section. Asset path is repo-relative under `handbooks/<doc>/<edition>/figures/`.
 *
 * Figures are mass-replaced when a section's `content_hash` changes: the
 * seed deletes every row for the section and re-inserts to keep ordinals
 * dense. Width / height are nullable because the extractor records them
 * opportunistically (some PDFs decode to vector content with no pixel
 * dimension to record).
 */
export const handbookFigure = studySchema.table(
	'handbook_figure',
	{
		id: text('id').primaryKey(),
		sectionId: text('section_id')
			.notNull()
			.references(() => handbookSection.id, { onDelete: 'cascade' }),
		ordinal: integer('ordinal').notNull(),
		caption: text('caption').notNull().default(''),
		/** Repo-relative path under `handbooks/<doc>/<edition>/figures/`. */
		assetPath: text('asset_path').notNull(),
		width: integer('width'),
		height: integer('height'),
		seedOrigin: text('seed_origin'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		handbookFigureSectionIdx: index('handbook_figure_section_idx').on(t.sectionId, t.ordinal),
		ordinalNonNegativeCheck: check('handbook_figure_ordinal_check', sql.raw(`"ordinal" >= 0`)),
		dimensionsCheck: check(
			'handbook_figure_dimensions_check',
			sql.raw(`("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0)`),
		),
	}),
);

/**
 * Per-(user, section) read tracking. Composite PK so a user has at most
 * one row per section. Editions cycle row identity at the `handbook_section`
 * layer (a new edition produces fresh rows with new ids), so the user
 * automatically gets a fresh read state when opening a new-edition section.
 *
 * Status flips: `unread -> reading` is the only automatic transition (first
 * heartbeat / first open); every other transition requires user input.
 * `comprehended` is a separate "read but didn't get it" toggle scoped to a
 * read or reading row.
 */
export const handbookReadState = studySchema.table(
	'handbook_read_state',
	{
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		handbookSectionId: text('handbook_section_id')
			.notNull()
			.references(() => handbookSection.id, { onDelete: 'cascade' }),
		status: text('status').notNull().default(HANDBOOK_READ_STATUSES.UNREAD),
		/**
		 * "Read but didn't get it" toggle. Counts as read for coverage; queryable
		 * for a "to revisit" lens. UI keeps it disabled until status reaches
		 * `reading` (BC enforces this on writes).
		 */
		comprehended: boolean('comprehended').notNull().default(false),
		/** Most-recent heartbeat timestamp. */
		lastReadAt: timestamp('last_read_at', { withTimezone: true }),
		/** Increments per distinct page open (debounced 5s server-side). */
		openedCount: integer('opened_count').notNull().default(0),
		/** Sum of heartbeat-windowed seconds the section was visible. */
		totalSecondsVisible: integer('total_seconds_visible').notNull().default(0),
		/** User's private markdown notes scoped to this section. */
		notesMd: text('notes_md').notNull().default(''),
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.userId, t.handbookSectionId] }),
		// "Unread sections in handbook X" / "what am I currently reading" query.
		handbookReadStateUserStatusIdx: index('handbook_read_state_user_status_idx').on(t.userId, t.status),
		// Cross-user analytics (later phases): "how many users have read this section?"
		handbookReadStateSectionIdx: index('handbook_read_state_section_idx').on(t.handbookSectionId),
		statusCheck: check(
			'handbook_read_state_status_check',
			sql.raw(`"status" IN (${inList(HANDBOOK_READ_STATUS_VALUES)})`),
		),
		totalSecondsCheck: check('handbook_read_state_total_seconds_check', sql.raw(`"total_seconds_visible" >= 0`)),
		openedCountCheck: check('handbook_read_state_opened_count_check', sql.raw(`"opened_count" >= 0`)),
		notesLengthCheck: check(
			'handbook_read_state_notes_length_check',
			sql.raw(`char_length("notes_md") <= ${HANDBOOK_NOTES_MAX_LENGTH}`),
		),
	}),
);

export type ReferenceRow = typeof reference.$inferSelect;
export type NewReferenceRow = typeof reference.$inferInsert;
export type HandbookSectionRow = typeof handbookSection.$inferSelect;
export type NewHandbookSectionRow = typeof handbookSection.$inferInsert;
export type HandbookFigureRow = typeof handbookFigure.$inferSelect;
export type NewHandbookFigureRow = typeof handbookFigure.$inferInsert;
export type HandbookReadStateRow = typeof handbookReadState.$inferSelect;
export type NewHandbookReadStateRow = typeof handbookReadState.$inferInsert;

// ---------------------------------------------------------------------------
// Cert-syllabus-and-goal-composer WP -- ADR 016 phases 1-6.
//
// Three new object families:
//   - credential / credential_prereq / credential_syllabus
//   - syllabus / syllabus_node / syllabus_node_link
//   - goal / goal_syllabus / goal_node
//
// See `docs/work-packages/cert-syllabus-and-goal-composer/spec.md` and
// `docs/decisions/016-cert-syllabus-goal-model/decision.md`.
// ---------------------------------------------------------------------------

/**
 * One pilot-cert / instructor-cert / rating / endorsement / etc. node in the
 * credential DAG. Replaces the four-cert `CERTS` constant as the source of
 * truth once the engine cutover happens; until then `CERTS` stays as a
 * fast-path subset (see `CERT_PREREQUISITES` deprecation).
 *
 * `regulatory_basis` is a JSONB array of `StructuredCitation` shapes
 * (typically `kind: 'cfr'`) so a credential defined across multiple CFR
 * sections (e.g. multi-engine class rating spans 14 CFR 61.63 + 61.31) can
 * carry every citation inline. Empty array = unanchored credential (the
 * `student` placeholder credential, school-internal credentials).
 */
export const credential = studySchema.table(
	'credential',
	{
		id: text('id').primaryKey(),
		/** Stable kebab-case slug: `private`, `commercial`, `cfi`, `multi-engine-land`. */
		slug: text('slug').notNull(),
		/** See {@link CREDENTIAL_KINDS}. */
		kind: text('kind').notNull(),
		/** Display name: "Private Pilot Certificate". */
		title: text('title').notNull(),
		/** See {@link CREDENTIAL_CATEGORIES}. `none` for credentials that don't carry a category. */
		category: text('category').notNull(),
		/** See {@link CREDENTIAL_CLASSES}. NULL for credentials without an associated class. */
		class: text('class'),
		/**
		 * Inline `StructuredCitation` array carrying the CFR / AC sections
		 * that define this credential. Empty array allowed for student /
		 * school-internal credentials.
		 */
		regulatoryBasis: jsonb('regulatory_basis').$type<StructuredCitation[]>().notNull().default([]),
		status: text('status').notNull().default(CREDENTIAL_STATUSES.ACTIVE),
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		credentialSlugUnique: uniqueIndex('credential_slug_unique').on(t.slug),
		credentialKindIdx: index('credential_kind_idx').on(t.kind),
		credentialCategoryClassIdx: index('credential_category_class_idx').on(t.category, t.class),
		credentialStatusIdx: index('credential_status_idx').on(t.status),
		// GIN index on regulatory_basis so the eventual "every credential
		// citing this CFR" reverse query is index-backed.
		credentialRegulatoryBasisGinIdx: index('credential_regulatory_basis_gin_idx').using(
			'gin',
			sql`"regulatory_basis" jsonb_path_ops`,
		),
		kindCheck: check('credential_kind_check', sql.raw(`"kind" IN (${inList(CREDENTIAL_KIND_VALUES)})`)),
		categoryCheck: check('credential_category_check', sql.raw(`"category" IN (${inList(CREDENTIAL_CATEGORY_VALUES)})`)),
		classCheck: check(
			'credential_class_check',
			sql.raw(`"class" IS NULL OR "class" IN (${inList(CREDENTIAL_CLASS_VALUES)})`),
		),
		statusCheck: check('credential_status_check', sql.raw(`"status" IN (${inList(CREDENTIAL_STATUS_VALUES)})`)),
		slugShapeCheck: check('credential_slug_shape_check', sql.raw(`"slug" ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'`)),
	}),
);

/**
 * One edge in the credential prereq DAG. Many-to-many: CFII requires CFI
 * AND IR. Cycle prevention happens at the seed layer (topological sort);
 * the BC walkers carry a defence-in-depth visited-set guard.
 *
 * Composite PK so the same (credential, prereq, kind) edge can't be
 * inserted twice.
 */
export const credentialPrereq = studySchema.table(
	'credential_prereq',
	{
		credentialId: text('credential_id')
			.notNull()
			.references(() => credential.id, { onDelete: 'cascade' }),
		prereqId: text('prereq_id')
			.notNull()
			.references(() => credential.id, { onDelete: 'restrict' }),
		/** See {@link CREDENTIAL_PREREQ_KINDS}. */
		kind: text('kind').notNull(),
		/** Authoring note explaining why this prereq exists. */
		notes: text('notes').notNull().default(''),
		seedOrigin: text('seed_origin'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.credentialId, t.prereqId, t.kind] }),
		// Reverse query: "what credentials require X as a prereq?"
		credentialPrereqByPrereqIdx: index('credential_prereq_by_prereq_idx').on(t.prereqId, t.kind),
		kindCheck: check('credential_prereq_kind_check', sql.raw(`"kind" IN (${inList(CREDENTIAL_PREREQ_KIND_VALUES)})`)),
		// Self-loop guard. Cycle detection is the seed's job; this catches the
		// trivial case at the DB layer.
		noSelfLoopCheck: check('credential_prereq_no_self_loop_check', sql.raw(`"credential_id" <> "prereq_id"`)),
	}),
);

/**
 * Many-to-many between credentials and syllabi. A credential has at most
 * one `primary` syllabus (enforced via partial UNIQUE) and any number of
 * `supplemental` syllabi. The primary syllabus is what `getDerivedCertGoals`
 * resolves to when migrating `study_plan.cert_goals`.
 */
export const credentialSyllabus = studySchema.table(
	'credential_syllabus',
	{
		credentialId: text('credential_id')
			.notNull()
			.references(() => credential.id, { onDelete: 'cascade' }),
		syllabusId: text('syllabus_id')
			.notNull()
			.references((): AnyPgColumn => syllabus.id, { onDelete: 'cascade' }),
		primacy: text('primacy').notNull().default(SYLLABUS_PRIMACY.SUPPLEMENTAL),
		seedOrigin: text('seed_origin'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		credentialSyllabusUnique: uniqueIndex('credential_syllabus_unique').on(t.credentialId, t.syllabusId),
		// One primary syllabus per credential; supplementals unbounded.
		credentialSyllabusPrimaryUnique: uniqueIndex('credential_syllabus_primary_unique')
			.on(t.credentialId)
			.where(sql`primacy = '${sql.raw(SYLLABUS_PRIMACY.PRIMARY)}'`),
		credentialSyllabusBySyllabusIdx: index('credential_syllabus_by_syllabus_idx').on(t.syllabusId),
		primacyCheck: check(
			'credential_syllabus_primacy_check',
			sql.raw(`"primacy" IN (${inList(SYLLABUS_PRIMACY_VALUES)})`),
		),
	}),
);

/**
 * Authored syllabus -- ACS / PTS / school / personal track. Top of the
 * syllabus-tree; its rows live on `syllabus_node`.
 *
 * `(kind, edition)` is partially UNIQUE for ACS / PTS so the same FAA
 * publication doesn't ship twice; school / personal syllabi don't get
 * edition uniqueness because edition isn't a meaningful concept there.
 */
export const syllabus = studySchema.table(
	'syllabus',
	{
		id: text('id').primaryKey(),
		slug: text('slug').notNull(),
		kind: text('kind').notNull(),
		title: text('title').notNull(),
		/**
		 * Edition slug per ADR 020 (e.g. `faa-s-acs-25` for the PPL ACS).
		 * Free-form text for school / personal syllabi.
		 */
		edition: text('edition').notNull(),
		sourceUrl: text('source_url'),
		status: text('status').notNull().default(SYLLABUS_STATUSES.ACTIVE),
		/**
		 * Set when a newer edition exists. Mirrors the `reference.superseded_by_id`
		 * pattern: deleting a newer edition (rare) doesn't cascade-destroy the
		 * older ones. Goals pinned to the older edition keep working.
		 */
		supersededById: text('superseded_by_id').references((): AnyPgColumn => syllabus.id, {
			onDelete: 'set null',
		}),
		/**
		 * Optional FK to the FAA publication that backs this syllabus. NULL
		 * for school / personal syllabi.
		 */
		referenceId: text('reference_id').references(() => reference.id, { onDelete: 'set null' }),
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		syllabusSlugUnique: uniqueIndex('syllabus_slug_unique').on(t.slug),
		// Partial UNIQUE for ACS / PTS only: one row per (kind, edition).
		syllabusAcsPtsEditionUnique: uniqueIndex('syllabus_acs_pts_edition_unique')
			.on(t.kind, t.edition)
			.where(sql`kind IN ('acs', 'pts')`),
		syllabusKindStatusIdx: index('syllabus_kind_status_idx').on(t.kind, t.status),
		syllabusReferenceIdx: index('syllabus_reference_idx').on(t.referenceId),
		kindCheck: check('syllabus_kind_check', sql.raw(`"kind" IN (${inList(SYLLABUS_KIND_VALUES)})`)),
		statusCheck: check('syllabus_status_check', sql.raw(`"status" IN (${inList(SYLLABUS_STATUS_VALUES)})`)),
		slugShapeCheck: check('syllabus_slug_shape_check', sql.raw(`"slug" ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'`)),
	}),
);

/**
 * One node in a syllabus tree. Areas / tasks / elements for ACS / PTS;
 * chapters / sections / subsections for non-ACS shapes.
 *
 * `airboss_ref` is the canonical ADR 019 identifier; required at the BC
 * layer for ACS / PTS leaves (the seed pipeline rejects authored leaves
 * that lack it). The DB CHECK is syntactic only -- full validation runs
 * via `@ab/sources` parser at upsert time.
 *
 * `citations` carries the per-node `StructuredCitation` array inline (see
 * the design rationale: citations stay inline rather than getting their
 * own row table now that WP #1's `StructuredCitation` is the primitive).
 */
export const syllabusNode = studySchema.table(
	'syllabus_node',
	{
		id: text('id').primaryKey(),
		syllabusId: text('syllabus_id')
			.notNull()
			.references(() => syllabus.id, { onDelete: 'cascade' }),
		parentId: text('parent_id').references((): AnyPgColumn => syllabusNode.id, {
			onDelete: 'cascade',
		}),
		/** See {@link SYLLABUS_NODE_LEVELS}. */
		level: text('level').notNull(),
		/** Within-parent sort order. */
		ordinal: integer('ordinal').notNull(),
		/**
		 * Citation code per the deterministic composition rule (`V` -> `V.A`
		 * -> `V.A.K1`). Free-form for non-ACS / non-PTS syllabi.
		 */
		code: text('code').notNull(),
		title: text('title').notNull(),
		/** Verbatim ACS / PTS element text (or authored description for non-ACS). */
		description: text('description').notNull().default(''),
		/**
		 * ACS K/R/S triad. Required for `level='element'` rows on ACS / PTS
		 * syllabi; null on internal nodes and non-ACS leaves.
		 */
		triad: text('triad'),
		/**
		 * Bloom level expected at this leaf. NULL on internal nodes; required
		 * on element-level rows. Drives the relevance cache rebuild.
		 */
		requiredBloom: text('required_bloom'),
		/**
		 * Stored leaf flag for the hot lens-rollup query. Maintained by the
		 * seed pipeline; CHECK enforces consistency with `required_bloom`.
		 */
		isLeaf: boolean('is_leaf').notNull().default(false),
		/**
		 * Canonical ADR 019 identifier. Validated by `@ab/sources` parser at
		 * the BC + seed layer. The DB CHECK is syntactic-only: rows either
		 * carry a string starting with `airboss-ref:` or NULL.
		 */
		airbossRef: text('airboss_ref'),
		/**
		 * Inline `StructuredCitation` array. Empty by default; the seed
		 * appends entries from the YAML manifest.
		 */
		citations: jsonb('citations').$type<StructuredCitation[]>().notNull().default([]),
		/**
		 * Airplane-class scoping for ACS / PTS rows that the FAA tags with a
		 * parenthetical class restriction (e.g.
		 * `Task A. Maneuvering with One Engine Inoperative (AMEL, AMES)`).
		 * NULL = class-agnostic (the row applies to every class for this
		 * credential category, the common case). Non-null = a non-empty
		 * subset of {@link AIRPLANE_CLASSES}. The lens framework filters by
		 * this column when a goal targets a class-specific credential
		 * (e.g. MEI = AMEL/AMES tasks within CFI Airplane ACS-25).
		 */
		classes: jsonb('classes').$type<string[]>(),
		/**
		 * SHA-256 of the YAML node entry (canonicalized). Drives idempotent
		 * seed: an unchanged node entry is a no-op.
		 */
		contentHash: text('content_hash'),
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		syllabusNodeSyllabusCodeUnique: uniqueIndex('syllabus_node_syllabus_code_unique').on(t.syllabusId, t.code),
		// Tree walk: parent -> children, ordered by ordinal.
		syllabusNodeTreeIdx: index('syllabus_node_tree_idx').on(t.syllabusId, t.parentId, t.ordinal),
		// "All rows at level X in syllabus Y" -- e.g. every area in PPL ACS.
		syllabusNodeLevelIdx: index('syllabus_node_level_idx').on(t.syllabusId, t.level, t.ordinal),
		// Hot path for lens rollup: every leaf under a syllabus.
		syllabusNodeLeafIdx: index('syllabus_node_leaf_idx').on(t.syllabusId, t.isLeaf),
		// GIN index on citations so the reverse-citation query is index-backed.
		syllabusNodeCitationsGinIdx: index('syllabus_node_citations_gin_idx').using('gin', sql`"citations" jsonb_path_ops`),
		levelCheck: check('syllabus_node_level_check', sql.raw(`"level" IN (${inList(SYLLABUS_NODE_LEVEL_VALUES)})`)),
		triadCheck: check(
			'syllabus_node_triad_check',
			sql.raw(`"triad" IS NULL OR "triad" IN (${inList(ACS_TRIAD_VALUES)})`),
		),
		requiredBloomCheck: check(
			'syllabus_node_required_bloom_check',
			sql.raw(`"required_bloom" IS NULL OR "required_bloom" IN (${inList(BLOOM_LEVEL_VALUES)})`),
		),
		// `parent_id IS NULL` iff `level` is a top-of-tree level (area / chapter).
		parentLevelConsistencyCheck: check(
			'syllabus_node_parent_level_check',
			sql.raw(
				`("level" IN ('area', 'chapter') AND "parent_id" IS NULL) OR ("level" NOT IN ('area', 'chapter') AND "parent_id" IS NOT NULL)`,
			),
		),
		// Triad is meaningful only on element-level rows.
		triadLevelConsistencyCheck: check(
			'syllabus_node_triad_level_check',
			sql.raw(`("level" = 'element' AND "triad" IS NOT NULL) OR ("level" <> 'element' AND "triad" IS NULL)`),
		),
		// `required_bloom` is set iff `is_leaf=true`.
		requiredBloomLeafCheck: check(
			'syllabus_node_required_bloom_leaf_check',
			sql.raw(
				`("is_leaf" = true AND "required_bloom" IS NOT NULL) OR ("is_leaf" = false AND "required_bloom" IS NULL)`,
			),
		),
		// Syntactic guard for airboss_ref. Full validation runs via `@ab/sources`.
		airbossRefShapeCheck: check(
			'syllabus_node_airboss_ref_shape_check',
			sql.raw(`"airboss_ref" IS NULL OR "airboss_ref" LIKE 'airboss-ref:%'`),
		),
		ordinalNonNegativeCheck: check('syllabus_node_ordinal_check', sql.raw(`"ordinal" >= 0`)),
		// Class scoping: NULL or every element drawn from AIRPLANE_CLASS_VALUES.
		// Non-empty when set; empty array would be ambiguous with NULL and is
		// rejected to keep the "this row applies to every class" semantics
		// consistent. Postgres CHECK can't carry a subquery, so we test
		// containment: the class array is a subset of the canonical class
		// array (which contains every legal value exactly once). `<@` is
		// jsonb's "contained-by" operator.
		classesCheck: check(
			'syllabus_node_classes_check',
			sql.raw(
				`"classes" IS NULL OR (jsonb_typeof("classes") = 'array' AND jsonb_array_length("classes") > 0 AND "classes" <@ '${jsonStringArray(AIRPLANE_CLASS_VALUES)}'::jsonb)`,
			),
		),
	}),
);

/**
 * Many-to-many between syllabus leaves and knowledge graph nodes. A leaf
 * can link to multiple nodes (an ACS element exercising multiple skills);
 * a node can be linked from multiple leaves (the same skill cited across
 * areas / certs).
 *
 * `weight` defaults to 1.0 (full coverage); authoring downweights below 1
 * for partial coverage. The relevance cache rebuild reads this column to
 * derive `(cert, bloom, priority)` triples per linked node.
 */
export const syllabusNodeLink = studySchema.table(
	'syllabus_node_link',
	{
		id: text('id').primaryKey(),
		syllabusNodeId: text('syllabus_node_id')
			.notNull()
			.references(() => syllabusNode.id, { onDelete: 'cascade' }),
		knowledgeNodeId: text('knowledge_node_id')
			.notNull()
			.references(() => knowledgeNode.id, { onDelete: 'restrict' }),
		weight: real('weight').notNull().default(1.0),
		/** Authoring note explaining the link (rendered as a tooltip in the UI). */
		notes: text('notes').notNull().default(''),
		seedOrigin: text('seed_origin'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		syllabusNodeLinkUnique: uniqueIndex('syllabus_node_link_unique').on(t.syllabusNodeId, t.knowledgeNodeId),
		// Forward: "what knowledge nodes does this leaf link to?"
		syllabusNodeLinkBySyllabusNodeIdx: index('syllabus_node_link_by_syllabus_node_idx').on(t.syllabusNodeId),
		// Reverse: "what syllabus leaves link to this node?" -- hot for the
		// relevance cache rebuild.
		syllabusNodeLinkByKnowledgeNodeIdx: index('syllabus_node_link_by_knowledge_node_idx').on(
			t.knowledgeNodeId,
			t.syllabusNodeId,
		),
		weightRangeCheck: check('syllabus_node_link_weight_check', sql.raw(`"weight" >= 0 AND "weight" <= 1`)),
	}),
);

/**
 * Learner goal -- composes syllabi + ad-hoc nodes. One row per goal; the
 * partial UNIQUE on `(user_id) WHERE is_primary=true` enforces the
 * exactly-one-primary invariant.
 *
 * `cert_goals` derivation walks the user's primary goal's `goal_syllabus`
 * rows -> credential_syllabus reverse-lookup -> credential.slug, surfaced
 * via `getDerivedCertGoals(userId)` in the goals BC.
 */
export const goal = studySchema.table(
	'goal',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		title: text('title').notNull(),
		notesMd: text('notes_md').notNull().default(''),
		status: text('status').notNull().default(GOAL_STATUSES.ACTIVE),
		isPrimary: boolean('is_primary').notNull().default(false),
		/**
		 * Free-form target date authored by the learner ("2026-12-31"). NULL = no
		 * target. Stored as a `date` (calendar day, no time component) so the
		 * value renders consistently across time zones.
		 */
		targetDate: date('target_date', { mode: 'string' }),
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		goalUserStatusIdx: index('goal_user_status_idx').on(t.userId, t.status),
		// Partial UNIQUE: one primary goal per user. Mirrors `plan_user_active_uniq`.
		goalUserPrimaryUnique: uniqueIndex('goal_user_primary_unique').on(t.userId).where(sql`is_primary = true`),
		statusCheck: check('goal_status_check', sql.raw(`"status" IN (${inList(GOAL_STATUS_VALUES)})`)),
	}),
);

/**
 * Many-to-many between goals and syllabi with per-link weight. The lens
 * framework consumes `(goal_id, syllabus_id, weight)` as the projection
 * input. Default weight is 1.0; max is `GOAL_SYLLABUS_WEIGHT_MAX`.
 */
export const goalSyllabus = studySchema.table(
	'goal_syllabus',
	{
		goalId: text('goal_id')
			.notNull()
			.references(() => goal.id, { onDelete: 'cascade' }),
		syllabusId: text('syllabus_id')
			.notNull()
			.references(() => syllabus.id, { onDelete: 'restrict' }),
		weight: real('weight').notNull().default(1.0),
		seedOrigin: text('seed_origin'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.goalId, t.syllabusId] }),
		// Reverse: "what goals reference this syllabus?"
		goalSyllabusBySyllabusIdx: index('goal_syllabus_by_syllabus_idx').on(t.syllabusId),
		weightRangeCheck: check(
			'goal_syllabus_weight_check',
			sql.raw(`"weight" >= ${GOAL_SYLLABUS_WEIGHT_MIN} AND "weight" <= ${GOAL_SYLLABUS_WEIGHT_MAX}`),
		),
	}),
);

/**
 * Many-to-many between goals and knowledge nodes -- the ad-hoc piece that
 * lets a learner pin nodes outside any syllabus they've added. Aggregates
 * with `goal_syllabus` in `getGoalNodeUnion`.
 */
export const goalNode = studySchema.table(
	'goal_node',
	{
		goalId: text('goal_id')
			.notNull()
			.references(() => goal.id, { onDelete: 'cascade' }),
		knowledgeNodeId: text('knowledge_node_id')
			.notNull()
			.references(() => knowledgeNode.id, { onDelete: 'restrict' }),
		weight: real('weight').notNull().default(1.0),
		notes: text('notes').notNull().default(''),
		seedOrigin: text('seed_origin'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.goalId, t.knowledgeNodeId] }),
		// Reverse: "what goals pin this node?"
		goalNodeByKnowledgeNodeIdx: index('goal_node_by_knowledge_node_idx').on(t.knowledgeNodeId),
		weightRangeCheck: check(
			'goal_node_weight_check',
			sql.raw(`"weight" >= ${GOAL_SYLLABUS_WEIGHT_MIN} AND "weight" <= ${GOAL_SYLLABUS_WEIGHT_MAX}`),
		),
	}),
);

export type CredentialRow = typeof credential.$inferSelect;
export type NewCredentialRow = typeof credential.$inferInsert;
export type CredentialPrereqRow = typeof credentialPrereq.$inferSelect;
export type NewCredentialPrereqRow = typeof credentialPrereq.$inferInsert;
export type CredentialSyllabusRow = typeof credentialSyllabus.$inferSelect;
export type NewCredentialSyllabusRow = typeof credentialSyllabus.$inferInsert;
export type SyllabusRow = typeof syllabus.$inferSelect;
export type NewSyllabusRow = typeof syllabus.$inferInsert;
export type SyllabusNodeRow = typeof syllabusNode.$inferSelect;
export type NewSyllabusNodeRow = typeof syllabusNode.$inferInsert;
export type SyllabusNodeLinkRow = typeof syllabusNodeLink.$inferSelect;
export type NewSyllabusNodeLinkRow = typeof syllabusNodeLink.$inferInsert;
export type GoalRow = typeof goal.$inferSelect;
export type NewGoalRow = typeof goal.$inferInsert;
export type GoalSyllabusRow = typeof goalSyllabus.$inferSelect;
export type NewGoalSyllabusRow = typeof goalSyllabus.$inferInsert;
export type GoalNodeRow = typeof goalNode.$inferSelect;
export type NewGoalNodeRow = typeof goalNode.$inferInsert;
