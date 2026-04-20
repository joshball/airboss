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
	CONTENT_SOURCE_VALUES,
	CONTENT_SOURCES,
	KNOWLEDGE_EDGE_TYPE_VALUES,
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
export type KnowledgeNodeRow = typeof knowledgeNode.$inferSelect;
export type NewKnowledgeNodeRow = typeof knowledgeNode.$inferInsert;
export type KnowledgeEdgeRow = typeof knowledgeEdge.$inferSelect;
export type NewKnowledgeEdgeRow = typeof knowledgeEdge.$inferInsert;
