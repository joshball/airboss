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
	ANNOTATION_ANCHOR_TEXT_MAX_LENGTH,
	ANNOTATION_CONTEXT_MAX_LENGTH,
	ANNOTATION_KIND_VALUES,
	ASSESSMENT_METHODS,
	type AssessmentMethod,
	AVIATION_TOPIC_VALUES,
	BLOOM_LEVEL_VALUES,
	CARD_FEEDBACK_SIGNAL_VALUES,
	CARD_KIND_VALUES,
	CARD_KINDS,
	CARD_STATE_VALUES,
	CARD_STATUS_VALUES,
	CARD_STATUSES,
	CARD_TYPE_VALUES,
	CERT_APPLICABILITY_VALUES,
	CERT_VALUES,
	type Cert,
	CONTENT_SOURCE_VALUES,
	CONTENT_SOURCES,
	COURSE_KIND_VALUES,
	COURSE_STATUS_VALUES,
	COURSE_STATUSES,
	COURSE_STEP_LEVEL_VALUES,
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
	HANDBOOK_ERRATA_PATCH_KIND_VALUES,
	HANDBOOK_READ_STATUS_VALUES,
	HANDBOOK_READ_STATUSES,
	HIGHLIGHT_COLOR_VALUES,
	KNOWLEDGE_EDGE_TYPE_VALUES,
	KNOWLEDGE_NODE_KIND_VALUES,
	KNOWLEDGE_NODE_KINDS,
	MASTERY_STABILITY_DAYS,
	MAX_SESSION_LENGTH,
	MIN_SESSION_LENGTH,
	NODE_LIFECYCLE_VALUES,
	NODE_LIFECYCLES,
	NOTE_BODY_MAX_LENGTH,
	NOTE_EXCERPT_MAX_LENGTH,
	NOTE_FOLLOW_UP_MAX_LENGTH,
	NOTE_TAG_MAX_LENGTH,
	NOTE_TAGS_MAX,
	NOTE_TITLE_MAX_LENGTH,
	PHASE_OF_FLIGHT_VALUES,
	PLAN_STATUS_VALUES,
	PLAN_STATUSES,
	QUESTION_TIER_VALUES,
	type QuestionTier,
	REVIEW_SESSION_STATUS_VALUES,
	REVIEW_SESSION_STATUSES,
	SAVED_DECK_LABEL_MAX_LENGTH,
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
	SOURCE_AUTHORITY_KIND_VALUES,
	type SourceAuthority,
	STUDY_PRIORITY_VALUES,
	SYLLABUS_KIND_VALUES,
	SYLLABUS_PRIMACY,
	SYLLABUS_PRIMACY_VALUES,
	SYLLABUS_STATUS_VALUES,
	SYLLABUS_STATUSES,
} from '@ab/constants';
import { inList, timestamps } from '@ab/db';
import type { RelevanceEntry, StructuredCitation } from '@ab/types';
import { desc, sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	boolean,
	check,
	date,
	foreignKey,
	index,
	integer,
	jsonb,
	pgSchema,
	primaryKey,
	real,
	smallint,
	text,
	timestamp,
	unique,
	uniqueIndex,
} from 'drizzle-orm/pg-core';

export const studySchema = pgSchema(SCHEMAS.STUDY);

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
		 * Semantic kind of this knowledge node. Drives lens-layer rendering
		 * differences (e.g. transitions framed differently from concepts) and
		 * lets a course step inherit its semantic shape from the linked node
		 * rather than re-declaring it. Single source of truth: a node is a
		 * transition regardless of which course references it (course-primitive
		 * WP, ADR 016 refinement 2026-05-08; LEARNING_PHILOSOPHY principle 11).
		 *
		 * Defaulted to `'concept'` on every existing row at migration time --
		 * the dominant kind in the shipped corpus -- so the column lands without
		 * a row-by-row backfill script.
		 */
		kind: text('kind').notNull().default(KNOWLEDGE_NODE_KINDS.CONCEPT),
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
		kindCheck: check('knowledge_node_kind_check', sql.raw(`"kind" IN (${inList(KNOWLEDGE_NODE_KIND_VALUES)})`)),
	}),
);

/**
 * Edge in the knowledge graph.
 *
 * `toNodeId` is a plain text column, NOT a foreign key: ADR 011 permits edges
 * whose target does not (yet) exist -- a visible gap is information.
 * Existence is resolved at read time via `LEFT JOIN knowledge_node ON
 * to_node_id = id` (see `getNodeView` in `knowledge.ts`). The previous
 * `target_exists` denormalized boolean was dropped per the 2026-05-06 schema
 * review (issue E): the build script was the only writer keeping it accurate,
 * any direct insert path silently corrupted the value, and the join answers
 * the question without drift. `edgeType` is constrained to the
 * KNOWLEDGE_EDGE_TYPES enum.
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
		// Belt-and-suspenders against an authoring slip: ADR 011 edges are
		// directional and a self-loop has no semantic meaning. The build
		// pipeline already filters these out; the DB CHECK enforces it at
		// the storage layer too. Mirrors `credential_prereq_no_self_loop_check`.
		noSelfLoopCheck: check('knowledge_edge_no_self_loop_check', sql.raw(`"from_node_id" <> "to_node_id"`)),
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
		/**
		 * Knowledge-axis card kind (evidence-kind-data-layer WP). Independent of
		 * `cardType` (presentation form). Drives the per-evidence-kind partition
		 * in `mastery.ts`'s `recall` vs `calculation` gates. Defaults to
		 * `recall` because recall is the dominant kind today; the migration
		 * relies on this default for metadata-only ALTER on existing rows.
		 */
		kind: text('kind').notNull().default(CARD_KINDS.RECALL),
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
		/**
		 * Audience tier (card-question-tier WP). Promotes the FAA-vs-CFI
		 * distinction from free-form `tags[]` into a typed first-class field.
		 * NULL = unclassified (default for the existing 250+ cards seeded
		 * before this WP); the explicit values let learners filter the review
		 * queue to "today, drill only the FAA-written tier" or "today, drill
		 * only what my CFI flagged." See
		 * `docs/work-packages/card-question-tier/design.md`.
		 */
		questionTier: text('question_tier').$type<QuestionTier>(),
		/**
		 * Structured citations backing the card's answer (card-question-tier
		 * WP). Each element pairs an authority kind (`cfr`, `aim`, `phak`,
		 * ...) with a free-form cite string (`14 CFR 91.155`, `AIM 7-1-21`,
		 * `PHAK Ch 11`). The kind drives badge / icon rendering on future
		 * surfaces; the cite is the human pointer. The CHECK constraint
		 * validates `kind` against `SOURCE_AUTHORITY_KIND_VALUES` and
		 * rejects empty cites at the storage layer; the BC Zod schema
		 * mirrors the rule for typed feedback at the form layer.
		 */
		sourceAuthority: jsonb('source_authority').$type<SourceAuthority[]>(),
		/**
		 * ACS task-element codes the card maps to (card-question-tier WP).
		 * Native Postgres `text[]` so array operators (`@>`, `&&`) and
		 * future GIN indexes work naturally for "find all cards covering
		 * PA.I.C.K2a" queries. Shape constrained by `ACS_CODE_PATTERN` in
		 * the Zod validation layer and the seeder.
		 */
		acsCodes: text('acs_codes').array(),
		/** Dev-seed marker. NULL on production rows. */
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		cardUserStatusIdx: index('card_user_status_idx').on(t.userId, t.status),
		cardUserDomainIdx: index('card_user_domain_idx').on(t.userId, t.domain),
		cardUserCreatedIdx: index('card_user_created_idx').on(t.userId, t.createdAt),
		// Browse-by-recently-updated (`cards.ts:348` ORDER BY updated_at DESC)
		// is index-backed via this composite. Without it, every edit forces a
		// per-user sort over the personal deck.
		cardUserUpdatedIdx: index('card_user_updated_idx').on(t.userId, t.updatedAt),
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
		// (id, user_id) UNIQUE backs the composite FK from `card_state` so that
		// `card_state.user_id` is structurally locked to the owning card's
		// `user_id`. `id` alone is already PRIMARY KEY; the (id, user_id) tuple
		// is functionally equivalent in uniqueness terms but lets Postgres
		// enforce REFERENCES (id, user_id) on dependent tables. See
		// docs/work-packages/card-state-fk-tightening/spec.md.
		cardIdUserUnique: unique('card_id_user_unique').on(t.id, t.userId),
		// Per-(user, kind) probe so the `getCardsForNodeByKind` helper and the
		// mastery.ts recall vs calculation partition queries don't fan out
		// across the user's whole card pool. evidence-kind-data-layer WP.
		cardUserKindIdx: index('card_user_kind_idx').on(t.userId, t.kind),
		cardTypeCheck: check('card_type_check', sql.raw(`"card_type" IN (${inList(CARD_TYPE_VALUES)})`)),
		cardKindCheck: check('card_kind_check', sql.raw(`"kind" IN (${inList(CARD_KIND_VALUES)})`)),
		sourceTypeCheck: check('card_source_type_check', sql.raw(`"source_type" IN (${inList(CONTENT_SOURCE_VALUES)})`)),
		statusCheck: check('card_status_check', sql.raw(`"status" IN (${inList(CARD_STATUS_VALUES)})`)),
		// card-question-tier WP. NULL is allowed (legacy unclassified cards);
		// non-null values must be in QUESTION_TIER_VALUES. Mirrors the BC Zod
		// schema so the storage layer is the final defense.
		questionTierCheck: check(
			'card_question_tier_check',
			sql.raw(`"question_tier" IS NULL OR "question_tier" IN (${inList(QUESTION_TIER_VALUES)})`),
		),
		// card-question-tier WP. NULL allowed (no citations); when present,
		// every element of the jsonb array must be `{kind, cite}` where kind
		// is in SOURCE_AUTHORITY_KIND_VALUES and cite is a non-empty string.
		// The CHECK uses jsonb_array_length + a NOT EXISTS over jsonb_array_elements
		// to scan for any malformed element. The BC Zod schema mirrors this for
		// authoring-time feedback; the CHECK is the storage-layer floor.
		sourceAuthorityShapeCheck: check(
			'card_source_authority_shape_check',
			sql.raw(
				`"source_authority" IS NULL OR (jsonb_typeof("source_authority") = 'array' AND NOT EXISTS (
					SELECT 1 FROM jsonb_array_elements("source_authority") AS elem
					WHERE jsonb_typeof(elem) <> 'object'
						OR (elem->>'kind') IS NULL
						OR (elem->>'kind') NOT IN (${inList(SOURCE_AUTHORITY_KIND_VALUES)})
						OR (elem->>'cite') IS NULL
						OR length(trim(elem->>'cite')) = 0
				))`,
			),
		),
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
		// (card_id, user_id) is governed by a composite FK in the table extras
		// below: REFERENCES card(id, user_id) ON DELETE CASCADE. The composite
		// FK locks `user_id` to the owning card's `user_id` at the storage
		// layer -- they cannot drift. A separate FK on `user_id` to bauth_user
		// is unnecessary because deleting a user already cascades through
		// `card.user_id -> bauth_user`, which in turn cascades to card_state
		// via the composite FK. See docs/work-packages/card-state-fk-tightening.
		cardId: text('card_id').notNull(),
		userId: text('user_id').notNull(),
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
		// Composite FK enforcing card_state.(card_id, user_id) === card.(id, user_id).
		// Backed by `card_id_user_unique` on the parent table.
		cardOwnerFk: foreignKey({
			columns: [t.cardId, t.userId],
			foreignColumns: [card.id, card.userId],
			name: 'card_state_card_owner_fk',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),
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
 * Option on a decision-rep scenario. Authored values live in the relational
 * `study.scenario_option` table (per scenario-options-relational WP). The
 * shape below is the BC-level read/write DTO -- the value bag the BC accepts
 * when creating a scenario and the shape it returns when loading one. The DB
 * row uses `scenario_option.id` as the surrogate key, which is the same
 * value carried in this DTO.
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
 *
 * Options live in the sibling `scenario_option` table so each option
 * has a stable id, FK target for `session_item_result.chosen_option_id`,
 * and a DB-level "exactly one correct" constraint.
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
		/**
		 * Per-scenario assessment-method tags (evidence-kind-data-layer WP).
		 * Drives the per-evidence-kind partition in `mastery.ts`'s `scenario`
		 * vs `demonstration` gates: a scenario tagged `['scenario','demonstration']`
		 * contributes the same rep attempts to both gates. Defaults to
		 * `['scenario']` so the cutover matches today's "every rep is judgment"
		 * behavior. BC-level validation (libs/bc/study/src/validation.ts)
		 * enforces non-empty + values in ASSESSMENT_METHOD_VALUES + uniqueness.
		 */
		assessmentMethods: jsonb('assessment_methods')
			.$type<AssessmentMethod[]>()
			.notNull()
			.default([ASSESSMENT_METHODS.SCENARIO]),
		status: text('status').notNull().default(SCENARIO_STATUSES.ACTIVE),
		/** Dev-seed marker. NULL on production rows. */
		seedOrigin: text('seed_origin'),
		// `...timestamps()` (createdAt + updatedAt) per the 2026-05-06 review §BB.
		// Every other content-bearing table tracks edit time; scenarios used to
		// only carry `createdAt`, so editing a scenario silently lost its
		// "last touched" signal.
		...timestamps(),
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
	}),
);

/**
 * Authored options on a decision-rep scenario. One row per option. `id` is
 * carried as a surrogate key (the same value the JSONB column used to carry)
 * so historical attempt rows that reference an option id keep resolving.
 *
 * Invariants enforced at the storage layer (per scenario-options-relational WP):
 *
 *   - exactly one option per scenario where `is_correct = true`
 *     (partial unique index `scenario_option_correct_unique`)
 *   - option count per scenario lives at the BC layer (validation.ts) since
 *     "between SCENARIO_OPTIONS_MIN and MAX" is a multi-row aggregate the
 *     write path enforces. The lower bound is also gated by the BC -- the
 *     table itself permits any number of rows so downstream tooling
 *     (authoring drafts, partial imports) can hold an in-progress scenario.
 *   - `(scenario_id, position)` is unique so the option order is stable.
 *   - `why_not` is required (non-empty) for incorrect options, optional for
 *     the correct one. Enforced by a CHECK below.
 */
export const scenarioOption = studySchema.table(
	'scenario_option',
	{
		id: text('id').primaryKey(),
		scenarioId: text('scenario_id')
			.notNull()
			.references(() => scenario.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		text: text('text').notNull(),
		isCorrect: boolean('is_correct').notNull(),
		outcome: text('outcome').notNull(),
		/**
		 * Required (non-empty) when `is_correct = false`. Optional for the
		 * correct option (authors can leave a note but empty is allowed).
		 */
		whyNot: text('why_not').notNull().default(''),
		/** 0-based position within the scenario; preserves authored order. */
		position: smallint('position').notNull(),
	},
	(t) => ({
		scenarioOptionScenarioPositionUnique: uniqueIndex('scenario_option_scenario_position_unique').on(
			t.scenarioId,
			t.position,
		),
		// Partial UNIQUE: enforces "exactly one correct option per scenario" at
		// the DB layer. The BC enforces "at least one" via validation.ts (a
		// scenario with zero options is rejected by the engine read path
		// regardless), so the partial index suffices.
		scenarioOptionCorrectUnique: uniqueIndex('scenario_option_correct_unique')
			.on(t.scenarioId)
			.where(sql`is_correct = true`),
		whyNotRequiredCheck: check(
			'scenario_option_why_not_required_check',
			sql`("is_correct" = true) OR (length(trim("why_not")) > 0)`,
		),
	}),
);

export type ScenarioOptionRow = typeof scenarioOption.$inferSelect;
export type NewScenarioOptionRow = typeof scenarioOption.$inferInsert;

export type ScenarioRow = typeof scenario.$inferSelect;
export type NewScenarioRow = typeof scenario.$inferInsert;
export type KnowledgeNodeRow = typeof knowledgeNode.$inferSelect;
export type NewKnowledgeNodeRow = typeof knowledgeNode.$inferInsert;
export type KnowledgeEdgeRow = typeof knowledgeEdge.$inferSelect;
export type NewKnowledgeEdgeRow = typeof knowledgeEdge.$inferInsert;

/**
 * Free-response teaching prompts (evidence-kind-data-layer WP). The substrate
 * for CFI-style "explain or demonstrate" evidence: one row authors a prompt
 * tied to a knowledge node; session_item_result rows with
 * `item_kind='teaching-exercise'` resolve back via `teaching_exercise_id`.
 *
 * Mirrors the scenario shape (id, userId, title, prompt, nodeId, isEditable,
 * status, seedOrigin, createdAt) but keeps its own table because teaching is
 * a free-response prompt, not a multiple-choice decision rep -- reusing
 * `scenario` would force NULL `scenario_option` rows and break the
 * `scenario_option_correct_unique` invariant.
 */
export const teachingExercise = studySchema.table(
	'teaching_exercise',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		title: text('title').notNull(),
		prompt: text('prompt').notNull(),
		domain: text('domain').notNull(),
		/**
		 * Optional knowledge-graph node id. Mirrors `card.nodeId` and
		 * `scenario.nodeId`: NULL = personal teaching exercise (does not
		 * contribute to any node's gate); non-NULL = graph-linked, picks up
		 * node-scoped mastery aggregation. `set null` on delete keeps history
		 * attached to the exercise even if the node is renamed or removed.
		 */
		nodeId: text('node_id').references(() => knowledgeNode.id, { onDelete: 'set null' }),
		isEditable: boolean('is_editable').notNull().default(true),
		status: text('status').notNull().default(SCENARIO_STATUSES.ACTIVE),
		/** Dev-seed marker. NULL on production rows. */
		seedOrigin: text('seed_origin'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		// (user_id, node_id) covers the per-node teaching gate query in
		// mastery.ts and the per-user authoring browse in the BC.
		teachingExerciseUserNodeIdx: index('teaching_exercise_user_node_idx').on(t.userId, t.nodeId),
		statusCheck: check('teaching_exercise_status_check', sql.raw(`"status" IN (${inList(SCENARIO_STATUS_VALUES)})`)),
	}),
);

export type TeachingExerciseRow = typeof teachingExercise.$inferSelect;
export type NewTeachingExerciseRow = typeof teachingExercise.$inferInsert;

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
	  }
	| {
			kind: 'teaching-exercise';
			teachingExerciseId: string;
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
		/**
		 * @deprecated Scheduled for drop after engine cutover trigger fires
		 * (`engine-goal-cutover` WP, Open Question (d): 14 consecutive days
		 * with zero `source='plan'` reads). Post-cutover the engine reads cert
		 * goals from the user's primary `goal` -> `goal_syllabus` projection
		 * via `getEngineTargeting(userId)`. The column survives the dual-read
		 * window so legacy users without a primary goal still resolve. New
		 * `createPlan` / `updatePlan` callers cannot supply a non-empty value.
		 */
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
		// (id, user_id) UNIQUE backs the composite FK from `session_item_result`
		// so that the slot row's `user_id` is structurally locked to the owning
		// session's `user_id`. Same pattern as `card_id_user_unique` above.
		sessionIdUserUnique: unique('session_id_user_unique').on(t.id, t.userId),
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
		/**
		 * (session_id, user_id) is governed by a composite FK in the table
		 * extras below: REFERENCES session(id, user_id) ON DELETE CASCADE. The
		 * composite FK locks `user_id` to the owning session's `user_id` at
		 * the storage layer -- the two cannot drift. A separate FK on
		 * `user_id` to bauth_user is unnecessary because deleting a user
		 * already cascades through `session.user_id -> bauth_user`, which in
		 * turn cascades to session_item_result via the composite FK.
		 *
		 * The denormalized `user_id` column stays for aggregate-query
		 * locality (per-user streak / activity reads avoid a join through
		 * session). See docs/work-packages/card-state-fk-tightening.
		 */
		sessionId: text('session_id').notNull(),
		userId: text('user_id').notNull(),
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
		/**
		 * Optional pointer to a teaching-exercise prompt. Set when
		 * `item_kind='teaching-exercise'` (BC-level invariant; a CHECK ties
		 * the two so the schema enforces `(item_kind = 'teaching-exercise') =
		 * (teaching_exercise_id IS NOT NULL)`). `set null` on delete keeps
		 * the historical attempt row attached even if the prompt is removed.
		 * evidence-kind-data-layer WP.
		 */
		teachingExerciseId: text('teaching_exercise_id').references(() => teachingExercise.id, { onDelete: 'set null' }),
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
		 *
		 * `chosen_option_id` is a FK to `scenario_option.id` (per
		 * scenario-options-relational WP); historical attempts carrying a now-
		 * deleted option id keep their row but the FK clears via `set null`.
		 */
		chosenOptionId: text('chosen_option_id').references(() => scenarioOption.id, { onDelete: 'set null' }),
		isCorrect: boolean('is_correct'),
		confidence: smallint('confidence'),
		answerMs: integer('answer_ms'),
		presentedAt: timestamp('presented_at', { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		/** Dev-seed marker. NULL on production rows. */
		seedOrigin: text('seed_origin'),
	},
	(t) => ({
		// Composite FK enforcing session_item_result.(session_id, user_id)
		// === session.(id, user_id). Backed by `session_id_user_unique` on
		// the parent table.
		sessionOwnerFk: foreignKey({
			columns: [t.sessionId, t.userId],
			foreignColumns: [session.id, session.userId],
			name: 'session_item_result_session_owner_fk',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),
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
		// Covers the FK back-reference. Without this, deleting a
		// `scenario_option` row (the rebuild path in scenario-options-relational)
		// has to seq-scan `session_item_result` to find rows referring to the
		// deleted option for `ON DELETE set null`. Partial because the column
		// is null on every non-rep slot (the majority of rows).
		sirChosenOptionIdx: index('sir_chosen_option_idx').on(t.chosenOptionId).where(sql`${t.chosenOptionId} is not null`),
		// Covers the FK back-reference for teaching-exercise rows; partial
		// because the column is NULL on every non-teaching slot. Mirrors the
		// chosen_option index pattern. evidence-kind-data-layer WP.
		sirTeachingExerciseIdx: index('sir_teaching_exercise_idx')
			.on(t.teachingExerciseId)
			.where(sql`${t.teachingExerciseId} is not null`),
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
		// Ties teaching_exercise_id to item_kind: a 'teaching-exercise' slot must
		// resolve to a teaching_exercise row, and any other item_kind must leave
		// the column NULL. Defensive backstop on the BC invariant; enforced at
		// the storage layer so direct Drizzle inserts can't drift. evidence-kind-data-layer WP.
		teachingExerciseShapeCheck: check(
			'sir_teaching_exercise_shape_check',
			sql.raw(`("item_kind" = 'teaching-exercise') = ("teaching_exercise_id" IS NOT NULL)`),
		),
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
		 * Knowledge-graph node slug. NOT NULL + cascade on delete: a progress
		 * row whose `nodeId` is NULL is meaningless (there's nothing to track
		 * progress *of*), and the previous `set null` policy left orphan rows
		 * that the unique index `(user_id, node_id)` accumulated forever
		 * because Postgres treats NULLs as distinct. ADR 011 slugs are stable;
		 * rebuilding on rename is the seed's job. Cascade is the cleaner
		 * answer per the 2026-05-06 review §F.
		 */
		nodeId: text('node_id')
			.notNull()
			.references(() => knowledgeNode.id, { onDelete: 'cascade' }),
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
		// per-user list for the learner's history. Trailing `created_at DESC`
		// makes `getLatestFeedback` (`feedback.ts:80`) an index-only LIMIT 1
		// instead of a per-pair seq+sort.
		cardFeedbackUserCardCreatedIdx: index('card_feedback_user_card_created_idx').on(
			t.userId,
			t.cardId,
			desc(t.createdAt),
		),
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
 * Per ADR 026: edition supersession lives in `sources_registry.editions`
 * (one row per `(source_id, edition_label)`, partial index
 * `WHERE retired_at IS NULL` powers the "current edition" probe). The
 * `edition` column on this row is a denormalized cache populated by the seed
 * from the registry's `edition_label`; the seed is the only writer. The
 * `edition-cache-write-guard` lint script blocks non-seed call sites.
 *
 * `seed_origin` matches the project-wide dev-seed marker convention.
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
		 * Aviation-topic axis values describing what subject(s) the reference
		 * covers. Powers the subject-grouped browse view at `/library`. Closed
		 * vocabulary; see {@link AVIATION_TOPIC_VALUES}. Author-supplied during
		 * seed (`course/references/*.yaml` `subjects:` field, or the handbook
		 * `manifest.json` `subjects:` field). 1..3 entries are typical; the
		 * library index cross-lists a reference once per subject. The CHECK
		 * constraint enforces enum membership; a 1..3 cap is enforced at the
		 * seed validator (zod).
		 */
		subjects: text('subjects').array().notNull().default(sql`'{}'::text[]`),
		/**
		 * Primary cert that "owns" this reference for library browsing. Drives
		 * the cert-spine in `/library/cert/{cert}` (library-by-cert WP). NULL
		 * means cert-agnostic -- the reference renders only in the topic and
		 * regulations spines.
		 *
		 * Carryover from prerequisite certs is NOT stored here -- it is derived
		 * at render time by walking `CredentialPrereq` via
		 * `getCertsCoveredBy()` (see ADR 016 / `libs/bc/study/src/credentials.ts`).
		 * Keeping carryover as a derived value avoids drift between this column
		 * and the credential DAG: any future change to PPL -> CPL prerequisites
		 * is picked up automatically without reseeding rows.
		 *
		 * See `docs/work-packages/library-by-cert/spec.md` ratifications block
		 * (Q1.A + the cert_carryover drop).
		 */
		primaryCert: text('primary_cert'),
		/**
		 * Per-kind hierarchy declaration. Shape:
		 * `{ levels: string[], strict_sequence?: boolean }`.
		 *
		 * `levels` is the set of legal `level` values for `reference_section`
		 * rows under this reference (validators check `every section.level IN
		 * reference.section_schema.levels` at ingest). `strict_sequence: true`
		 * (sectioned handbooks) additionally enforces "at depth N, level must
		 * be `levels[N]`." Off by default; CFR/AIM use the loose form because
		 * their hierarchies are asymmetric. Whole-doc handbooks declare
		 * `{ levels: ['document'], strict_sequence: true }`.
		 *
		 * Default `'{}'::jsonb` (empty object) so legacy rows pre-WP-SUB don't
		 * need backfill -- the validator treats an empty object as
		 * "no per-kind hierarchy declared, accept anything." Seeders populate
		 * this on every upsert so production rows are always fully specified.
		 */
		sectionSchema: jsonb('section_schema').notNull().default(sql`'{}'::jsonb`),
		/**
		 * Per-kind document-level extras. Empty for kinds that don't need any.
		 * Validated by per-kind Zod schemas at ingest. **No DB-level shape
		 * constraint** -- shape varies per kind, and the DB has no way to
		 * encode "this jsonb must match the schema for this row's `kind`."
		 * Examples: CFR title number, NTSB docket, AC cancels-list, the
		 * source-PDF page count for a whole-doc handbook.
		 */
		metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
		/** Dev-seed marker; NULL on production rows. */
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		// One row per (document_slug, edition). The seed conflict-targets this.
		referenceDocEditionUnique: uniqueIndex('reference_doc_edition_unique').on(t.documentSlug, t.edition),
		referenceKindIdx: index('reference_kind_idx').on(t.kind),
		// GIN index on the `subjects` text[] column powers the topic-spine
		// filter: `library-by-cert.ts` runs `subjects @> ARRAY[$topic]`
		// (Drizzle `arrayContains`) per topic page render, plus a `LATERAL
		// unnest(subjects) ... GROUP BY` for the per-topic counts query. Both
		// shapes are GIN-indexable on `text[]` with the default array opclass;
		// the containment probe (`@>`) reduces to inverted-index lookups
		// instead of a sequential scan over the reference catalog. The
		// counts query trades the in-JS aggregation for a single PG round-trip
		// that the planner will use the index for whenever the LATERAL filter
		// or topic predicate is present.
		referenceSubjectsGinIdx: index('reference_subjects_gin_idx').using('gin', sql`"subjects"`),
		// Slug shape: kebab-case, 3..32 chars. Document slugs are reader URL
		// fragments; constraining at the storage layer keeps a typo from
		// shipping a route that breaks `decodeURIComponent` round-trips.
		documentSlugShapeCheck: check(
			'reference_document_slug_shape_check',
			sql.raw(`"document_slug" ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'`),
		),
		editionLengthCheck: check('reference_edition_length_check', sql.raw(`char_length("edition") BETWEEN 1 AND 64`)),
		// Every subject string must be a valid AVIATION_TOPIC value. `<@` is the
		// "is contained by" operator on text[]: a subset comparison against the
		// whitelist ARRAY. Empty arrays satisfy `<@` trivially (the empty set is
		// a subset of every set), so the CHECK is permissive for legacy rows
		// pre-backfill; the seed validator enforces the 1..3 cap on author input.
		subjectsValuesCheck: check(
			'reference_subjects_values_check',
			sql.raw(`"subjects" <@ ARRAY[${inList(AVIATION_TOPIC_VALUES)}]::text[]`),
		),
		// Primary cert (nullable). NULL is allowed (cert-agnostic refs render
		// only in the topic/regulations spines). When non-NULL, must be a valid
		// CERT_APPLICABILITY value -- the same enum used by the YAML loader's
		// validator so an invalid YAML never reaches the DB without first
		// failing the seed.
		primaryCertCheck: check(
			'reference_primary_cert_check',
			sql.raw(`"primary_cert" IS NULL OR "primary_cert" IN (${inList(CERT_APPLICABILITY_VALUES)})`),
		),
	}),
);

/**
 * Per-section content row -- the substrate for every corpus's hierarchical
 * content (handbooks, AIM, CFR, AC, ACS, ...). One row per content node:
 * a chapter, a section, a subsection, a CFR paragraph, an AIM section, or
 * the entire document for a "whole-doc" handbook. Tree-shaped via
 * `parent_id`; flat references (Chief Counsel letters, whole-doc handbooks)
 * carry one row at depth 0.
 *
 * Per-corpus shape lives in `reference.section_schema` (level vocabulary +
 * strict-sequence flag). `depth` is positional only: 0 = top-level child of
 * the reference, ++ per nesting. It does NOT map 1:1 to `level` because some
 * corpora (CFR) are asymmetric -- depth 1 in Part 91 is a Subpart, depth 1
 * in Part 1 is a Section.
 *
 * `code` is the citation-grade locator -- `"12.3"` for a handbook subsection,
 * `"91.103(b)(1)(i)"` for a CFR clause, `"5-2-1"` for an AIM paragraph,
 * `"1"` for a whole-doc handbook's single document row. Per-kind regexes
 * validate the shape at ingest; the DB does not enforce a regex anymore --
 * shape varies per kind and one regex couldn't fit them all.
 *
 * `content_hash` (SHA-256 of the source body) drives idempotent seed: an
 * unchanged row is a no-op apart from refreshing scaffolding fields.
 *
 * Validation moves to ingest-time Zod (per-kind manifest schemas). The DB
 * keeps only the corpus-agnostic invariants: ordinal >= 0, FK integrity,
 * unique (reference_id, code), and the FAA-page null-pair invariant on
 * the kept handbook columns.
 */
export const referenceSection = studySchema.table(
	'reference_section',
	{
		id: text('id').primaryKey(),
		referenceId: text('reference_id')
			.notNull()
			.references(() => reference.id, { onDelete: 'cascade' }),
		/**
		 * NULL for top-level rows (chapters in a handbook, the document row in a
		 * whole-doc handbook, top-level Parts in a CFR title, etc.); parent's id
		 * for nested rows. `cascade` so a parent delete drops its subtree --
		 * per-edition trees are mass-replaced by the seed when an extraction
		 * warning becomes a fixable bug.
		 */
		parentId: text('parent_id').references((): AnyPgColumn => referenceSection.id, {
			onDelete: 'cascade',
		}),
		/**
		 * Per-kind level label. Validated at ingest against
		 * `reference.section_schema.levels`. Examples: `chapter`, `section`,
		 * `subsection` (handbooks); `subpart`, `section`, `paragraph`,
		 * `subparagraph`, `clause` (CFR); `chapter`, `section`, `paragraph`
		 * (AIM); `task`, `element` (ACS); `document` (whole-doc handbooks).
		 * No DB CHECK -- enum is per-corpus, declared on the parent reference.
		 */
		level: text('level').notNull(),
		/** Within-parent sort order. */
		ordinal: integer('ordinal').notNull(),
		/**
		 * Positional depth: 0 = top-level child of the reference, ++ per nesting
		 * level. NOT a 1:1 map to `level` for asymmetric hierarchies (CFR Part 91
		 * has Subparts at depth 0, sections at depth 1; CFR Part 1 has sections
		 * at depth 0).
		 */
		depth: integer('depth').notNull(),
		/**
		 * Citation locator: `"12"`, `"12.3"`, `"12.3.2"` (handbook),
		 * `"91.103(b)(1)(i)"` (CFR), `"5-2-1"` (AIM), `"1"` (whole-doc).
		 * Per-kind regex validation at ingest; no DB regex.
		 */
		code: text('code').notNull(),
		/**
		 * Canonical `airboss-ref:` URI for this section -- the cross-corpus
		 * deep-link identifier per ADR 019. Set by the seeder at insert time so
		 * the citation render path (`resolveCitationTargets`) and the audit
		 * (`auditCitations`) can both read it without rebuilding the URI from
		 * `(kind, documentSlug, edition, code)` tuples on every read. Five
		 * different URI shapes per corpus (handbooks: dotted-code -> slashed;
		 * AIM: dashed; CFR: paragraph chains; AC: section-N; ACS:
		 * area-{a}/task-{t}) make at-write computation strictly simpler than
		 * at-read.
		 *
		 * CHECK enforces the `airboss-ref:` prefix so a rogue insert path
		 * can't drift; the unique index reflects the invariant that one URI
		 * names exactly one section row.
		 */
		airbossRef: text('airboss_ref').notNull(),
		title: text('title').notNull(),
		// FAA-printed page references (e.g. `"12-7"` = chapter 12, page 7
		// within the chapter) live in `metadata.faaPages = { start, end }`
		// per the 2026-05-06 review §K. The shared `reference_section` table
		// is the substrate for every corpus; per-corpus extras (handbook
		// pagination, CFR effective dates, AC paragraph cancellations) live
		// in `metadata` jsonb so the column inventory doesn't grow with each
		// new kind. Validation moves to ingest-time Zod (manifest-validation).
		/** Canonical citation string ("PHAK Ch 12 §3 (pp. 12-7..12-9)"). Cached for display. */
		sourceLocator: text('source_locator').notNull(),
		/**
		 * Body markdown for this row. Empty on container rows (handbook chapters
		 * with no chapter-level body; CFR Part rows that just hold subparts).
		 * The readability probe `getReadableReferenceIds()` looks for any row
		 * under a reference where `content_md` is non-empty.
		 */
		contentMd: text('content_md').notNull().default(''),
		/** SHA-256 of the source markdown file (or `body_sha256` for whole-doc). Drives idempotent seed. */
		contentHash: text('content_hash').notNull(),
		/** Cached aggregates so list rendering avoids per-row joins. */
		hasFigures: boolean('has_figures').notNull().default(false),
		hasTables: boolean('has_tables').notNull().default(false),
		/**
		 * Per-kind per-section extras. Empty for kinds that don't need any.
		 * Validated by per-kind Zod schemas at ingest. **No DB-level shape
		 * constraint.** Examples: CFR effective date + authority note + cross-
		 * refs; AC paragraph cancellation pointers.
		 */
		metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		// One row per (reference, code). Conflict target for the seed upsert.
		referenceSectionRefCodeUnique: uniqueIndex('reference_section_ref_code_unique').on(t.referenceId, t.code),
		// Tree walks: parent listing for TOC rendering.
		referenceSectionTreeIdx: index('reference_section_tree_idx').on(t.referenceId, t.parentId, t.ordinal),
		// "List top-level rows in this reference" -- depth=0 ordered by ordinal.
		// Replaces the old level=chapter index; depth is corpus-agnostic.
		referenceSectionDepthIdx: index('reference_section_depth_idx').on(t.referenceId, t.depth, t.ordinal),
		// Readability probe: "any rows under this reference with body content?"
		// Partial index keeps the probe O(log N) on a sparse predicate.
		referenceSectionReadableIdx: index('reference_section_readable_idx')
			.on(t.referenceId)
			.where(sql`${t.contentMd} <> ''`),
		ordinalNonNegativeCheck: check('reference_section_ordinal_check', sql.raw(`"ordinal" >= 0`)),
		depthNonNegativeCheck: check('reference_section_depth_check', sql.raw(`"depth" >= 0`)),
		// Stage-5 cross-link: `airboss_ref` is the canonical URI for this
		// section. Shape check guards against the picker / seeder ever writing a
		// non-URI string. The URI is NOT unique across rows: hierarchies whose
		// flightbag route only deep-links to ancestor levels (e.g. AC subsections
		// fall back to their chapter's route per ADR 019 §1.2 + libs/sources/src/ac/
		// locator.ts) intentionally share a URI with their ancestor. The
		// `(reference_id, code)` unique index already pins one row per logical
		// position; the URI is a derived deep-link target, not a primary key.
		airbossRefShapeCheck: check(
			'reference_section_airboss_ref_shape_check',
			sql.raw(`"airboss_ref" ~ '^airboss-ref:'`),
		),
		// Indexed for reverse lookups (audit walks "find sections by URI") and
		// reference-by-URI on the picker / chip resolution paths.
		airbossRefIdx: index('reference_section_airboss_ref_idx').on(t.airbossRef),
		// `faa_pages_check` was dropped per the 2026-05-06 review §K; FAA
		// pagination is handbook-specific and now lives in `metadata.faaPages`,
		// validated at ingest by the per-corpus Zod schemas.
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
export const referenceFigure = studySchema.table(
	'reference_figure',
	{
		id: text('id').primaryKey(),
		sectionId: text('section_id')
			.notNull()
			.references(() => referenceSection.id, { onDelete: 'cascade' }),
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
		referenceFigureSectionIdx: index('reference_figure_section_idx').on(t.sectionId, t.ordinal),
		ordinalNonNegativeCheck: check('reference_figure_ordinal_check', sql.raw(`"ordinal" >= 0`)),
		dimensionsCheck: check(
			'reference_figure_dimensions_check',
			sql.raw(`("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0)`),
		),
	}),
);

/**
 * Per-section record of an FAA-published amendment (errata) applied to
 * the section content. One row per (section, erratum). Drives the
 * reader's amendment badge + diff panel.
 *
 * `original_text` is NULL when `patch_kind = 'add_subsection'` (the
 * erratum inserts an entirely new subsection). `replacement_text`
 * always carries the FAA's exact wording so the reader can render a
 * verbatim diff and the audit trail survives content_md regeneration.
 *
 * Cascade on section delete: amendments belong to their section. When
 * a section is replaced (edition cycle, hash change), the old amendments
 * drop with it and the apply-errata pipeline re-inserts on next run.
 *
 * See [ADR 020](../../../../docs/decisions/020-handbook-edition-and-amendment-policy.md)
 * and the `apply-errata-and-afh-mosaic` work package.
 */
export const referenceSectionErrata = studySchema.table(
	'reference_section_errata',
	{
		id: text('id').primaryKey(),
		sectionId: text('section_id')
			.notNull()
			.references(() => referenceSection.id, { onDelete: 'cascade' }),
		/** Erratum identifier (matches the YAML `errata[].id`, e.g. `mosaic`). */
		errataId: text('errata_id').notNull(),
		/** The FAA URL the erratum was downloaded from. Stored for citation. */
		sourceUrl: text('source_url').notNull(),
		/** When the FAA published the erratum (ISO date). */
		publishedAt: text('published_at').notNull(),
		/** When the apply pipeline ran. */
		appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
		/** See {@link HANDBOOK_ERRATA_PATCH_KINDS}. */
		patchKind: text('patch_kind').notNull(),
		/**
		 * Human-readable section anchor the erratum names (e.g. "Preflight
		 * Assessment of the Aircraft"). Nullable because the apply pipeline
		 * may resolve the section by `sectionId` alone in some cases.
		 */
		targetAnchor: text('target_anchor'),
		/**
		 * Printed FAA page reference (`<chapter>-<page>`, e.g. "2-4"). NOT
		 * the PDF page integer; that's a different beast.
		 */
		targetPage: text('target_page').notNull(),
		/**
		 * Verbatim original text being replaced. NULL when the patch kind
		 * is `add_subsection` (no original to replace).
		 */
		originalText: text('original_text'),
		replacementText: text('replacement_text').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		// One row per (section, erratum) pair: prevents double-apply. The
		// `--force` re-apply path deletes-then-inserts inside one transaction.
		bySectionErratum: uniqueIndex('reference_section_errata_section_errata_idx').on(t.sectionId, t.errataId),
		// Reader query: "show me amendments for this section, newest first."
		bySectionApplied: index('reference_section_errata_section_applied_idx').on(t.sectionId, t.appliedAt),
		patchKindCheck: check(
			'reference_section_errata_patch_kind_check',
			sql.raw(`"patch_kind" IN (${inList(HANDBOOK_ERRATA_PATCH_KIND_VALUES)})`),
		),
		// add_subsection patches have no original text; non-add kinds must.
		// (We allow original_text to remain NULL for non-add kinds during
		// the parse-only path, where the apply pipeline backfills it from
		// the section markdown at apply time. The CHECK enforces only the
		// inverse: if patch_kind = 'add_subsection', original_text IS NULL.)
		addSubsectionOriginalCheck: check(
			'reference_section_errata_add_subsection_check',
			sql.raw(`("patch_kind" <> 'add_subsection') OR ("original_text" IS NULL)`),
		),
		// Page anchor must look like "<chapter>-<page>" with both halves digit-only.
		targetPageShapeCheck: check(
			'reference_section_errata_target_page_check',
			sql.raw(`"target_page" ~ '^[0-9]+-[0-9]+$'`),
		),
		// Replacement text is non-empty.
		replacementNonEmptyCheck: check(
			'reference_section_errata_replacement_nonempty_check',
			sql.raw(`length(trim("replacement_text")) > 0`),
		),
		// Source URL must be HTTPS.
		sourceUrlHttpsCheck: check('reference_section_errata_source_url_check', sql.raw(`"source_url" LIKE 'https://%'`)),
	}),
);

/**
 * Per-(user, section) read tracking. Composite PK so a user has at most
 * one row per section. Editions cycle row identity at the `reference_section`
 * layer (a new edition produces fresh rows with new ids), so the user
 * automatically gets a fresh read state when opening a new-edition section.
 *
 * Status flips: `unread -> reading` is the only automatic transition (first
 * heartbeat / first open); every other transition requires user input.
 * `comprehended` is a separate "read but didn't get it" toggle scoped to a
 * read or reading row.
 */
export const referenceSectionReadState = studySchema.table(
	'reference_section_read_state',
	{
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		referenceSectionId: text('reference_section_id')
			.notNull()
			.references(() => referenceSection.id, { onDelete: 'cascade' }),
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
		// `notes_md` removed by wp-notes-primitive: per-section single-blob
		// notes are superseded by 1+ rows on `study.note` referencing the
		// same `referenceSectionId`. Migration script lives at
		// `scripts/migrations/migrate-notes-blobs.ts`; dev seed regenerates
		// from a clean schema so no data carries the old column forward.
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.userId, t.referenceSectionId] }),
		// "Unread sections in handbook X" / "what am I currently reading" query.
		referenceSectionReadStateUserStatusIdx: index('reference_section_read_state_user_status_idx').on(
			t.userId,
			t.status,
		),
		// Cross-user analytics (later phases): "how many users have read this section?"
		referenceSectionReadStateSectionIdx: index('reference_section_read_state_section_idx').on(t.referenceSectionId),
		statusCheck: check(
			'reference_section_read_state_status_check',
			sql.raw(`"status" IN (${inList(HANDBOOK_READ_STATUS_VALUES)})`),
		),
		totalSecondsCheck: check(
			'reference_section_read_state_total_seconds_check',
			sql.raw(`"total_seconds_visible" >= 0`),
		),
		openedCountCheck: check('reference_section_read_state_opened_count_check', sql.raw(`"opened_count" >= 0`)),
	}),
);

export type ReferenceRow = typeof reference.$inferSelect;
export type NewReferenceRow = typeof reference.$inferInsert;
export type ReferenceSectionRow = typeof referenceSection.$inferSelect;
export type NewReferenceSectionRow = typeof referenceSection.$inferInsert;
export type ReferenceFigureRow = typeof referenceFigure.$inferSelect;
export type NewReferenceFigureRow = typeof referenceFigure.$inferInsert;
export type ReferenceSectionReadStateRow = typeof referenceSectionReadState.$inferSelect;
export type NewReferenceSectionReadStateRow = typeof referenceSectionReadState.$inferInsert;

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
		/**
		 * Evidence-kind gating (evidence-kind-gating WP). When true the leaf
		 * demands TEACHING_EVIDENCE_KINDS in addition to whatever the triad
		 * mapping resolves to. Set on CFI pedagogical leaves where the
		 * candidate has to teach the concept, not just recall or demonstrate
		 * it. Default false. CHECK below restricts the flag to element-level
		 * rows that carry a triad.
		 */
		requiresTeaching: boolean('requires_teaching').notNull().default(false),
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
		// `level` vocabulary is per-corpus (ACS uses area/task/element; CFR uses
		// subpart/section/paragraph; school syllabi mint their own). Per the
		// 2026-05-06 review §H, per-corpus vocabularies belong in `metadata`
		// + ingest-time Zod, not in a CHECK that grows with every new corpus.
		// `parentLevelConsistencyCheck` was dropped for the same reason: it
		// hard-coded ('area', 'chapter') as the only top-of-tree levels. Both
		// invariants are validated by `manifest-validation.ts` at seed time.
		// `triad_check` and `required_bloom_check` stay -- ACS K/R/S triad is
		// closed at three values; Bloom's taxonomy is closed at six. Neither
		// grows with new corpora.
		triadCheck: check(
			'syllabus_node_triad_check',
			sql.raw(`"triad" IS NULL OR "triad" IN (${inList(ACS_TRIAD_VALUES)})`),
		),
		requiredBloomCheck: check(
			'syllabus_node_required_bloom_check',
			sql.raw(`"required_bloom" IS NULL OR "required_bloom" IN (${inList(BLOOM_LEVEL_VALUES)})`),
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
		// requires_teaching is meaningful only on element-level rows that
		// carry a triad. Setting it on internal nodes (area / task / chapter)
		// or on triad=null leaves silently widens the leaf-mastery gate; reject
		// at write time.
		requiresTeachingTriadCheck: check(
			'syllabus_node_requires_teaching_triad_check',
			sql.raw(`"requires_teaching" = false OR "triad" IS NOT NULL`),
		),
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
		/**
		 * Engine targeting fields. Owned by the goal post engine-goal-cutover so
		 * the engine reads "what to study" + "what to focus / skip" from a single
		 * source. NULL was rejected in favor of NOT NULL DEFAULT [] to keep the
		 * read path branch-free; an empty list means "no narrowing." Backfilled
		 * from each user's active study_plan by `scripts/db/backfill-goal-targeting.ts`
		 * during the cutover.
		 */
		focusDomains: jsonb('focus_domains').$type<Domain[]>().notNull().default([]),
		skipDomains: jsonb('skip_domains').$type<Domain[]>().notNull().default([]),
		skipNodes: jsonb('skip_nodes').$type<string[]>().notNull().default([]),
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		goalUserStatusIdx: index('goal_user_status_idx').on(t.userId, t.status),
		// Goals list orders by (is_primary DESC, updated_at DESC) per user;
		// covered by this composite so the dashboard sort is index-backed
		// after a goal edit instead of falling back to an in-memory sort.
		goalUserUpdatedIdx: index('goal_user_updated_idx').on(t.userId, t.updatedAt),
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

/**
 * Instructor-authored course -- peer primitive to {@link syllabus}. See ADR
 * 016 refinement (2026-05-08) and LEARNING_PHILOSOPHY principle 11. Mutable
 * (no edition lock); composes into goals via {@link goalCourse}.
 *
 * The cert-vs-course overlay is a render-time lens computation
 * (`courseWithCertOverlayLens`); it is NOT authored on this row -- a course
 * carries no `cert_alignment` field. Alignment is the learner's goal, not
 * the course author's declaration.
 */
export const course = studySchema.table(
	'course',
	{
		id: text('id').primaryKey(),
		slug: text('slug').notNull(),
		kind: text('kind').notNull(),
		title: text('title').notNull(),
		description: text('description').notNull().default(''),
		status: text('status').notNull().default(COURSE_STATUSES.ACTIVE),
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		courseSlugUnique: uniqueIndex('course_slug_unique').on(t.slug),
		courseKindStatusIdx: index('course_kind_status_idx').on(t.kind, t.status),
		kindCheck: check('course_kind_check', sql.raw(`"kind" IN (${inList(COURSE_KIND_VALUES)})`)),
		statusCheck: check('course_status_check', sql.raw(`"status" IN (${inList(COURSE_STATUS_VALUES)})`)),
		slugShapeCheck: check('course_slug_shape_check', sql.raw(`"slug" ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'`)),
	}),
);

/**
 * One node in a course tree. Two structural levels: top-level `section`
 * rows (no parent, no knowledge_node_id) and child `step` rows (parent
 * points at a section, knowledge_node_id required). Steps are leaves;
 * sections are not.
 *
 * `level` / `parent_id` / `knowledge_node_id` / `is_leaf` consistency is
 * enforced by `course_step_consistency_check` (single CHECK covering both
 * legal shapes). The seed pipeline hashes the canonicalized YAML into
 * `content_hash` so an unchanged file produces zero writes.
 *
 * The FK to `knowledge_node` is RESTRICT on delete: nodes are referenced
 * from cards, syllabi, and other courses; the author must explicitly
 * remove the course step before the node can vanish.
 */
export const courseStep = studySchema.table(
	'course_step',
	{
		id: text('id').primaryKey(),
		courseId: text('course_id')
			.notNull()
			.references(() => course.id, { onDelete: 'cascade' }),
		parentId: text('parent_id').references((): AnyPgColumn => courseStep.id, {
			onDelete: 'cascade',
		}),
		level: text('level').notNull(),
		ordinal: integer('ordinal').notNull(),
		code: text('code').notNull(),
		title: text('title').notNull(),
		bodyMd: text('body_md').notNull().default(''),
		knowledgeNodeId: text('knowledge_node_id').references(() => knowledgeNode.id, { onDelete: 'restrict' }),
		isLeaf: boolean('is_leaf').notNull().default(false),
		contentHash: text('content_hash'),
		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		courseStepCourseCodeUnique: uniqueIndex('course_step_course_code_unique').on(t.courseId, t.code),
		// Tree walk: parent -> children, ordered by ordinal.
		courseStepTreeIdx: index('course_step_tree_idx').on(t.courseId, t.parentId, t.ordinal),
		// Reverse lookup: "what course steps reference this knowledge node?"
		courseStepNodeIdx: index('course_step_node_idx').on(t.knowledgeNodeId),
		levelCheck: check('course_step_level_check', sql.raw(`"level" IN (${inList(COURSE_STEP_LEVEL_VALUES)})`)),
		// Combined consistency rule: section rows have no parent, no node, are
		// not leaves; step rows have a parent, have a node, and are leaves.
		consistencyCheck: check(
			'course_step_consistency_check',
			sql.raw(
				`(("level" = 'section' AND "parent_id" IS NULL AND "knowledge_node_id" IS NULL AND "is_leaf" = false) OR ("level" = 'step' AND "parent_id" IS NOT NULL AND "knowledge_node_id" IS NOT NULL AND "is_leaf" = true))`,
			),
		),
		ordinalCheck: check('course_step_ordinal_check', sql.raw(`"ordinal" >= 0`)),
	}),
);

/**
 * Many-to-many between goals and courses. Mirrors {@link goalSyllabus} in
 * shape. The session engine's `getGoalNodeUnion` walks
 * `goal_course -> course_step (level='step') -> knowledge_node_id` and
 * merges with goal_syllabus + goal_node into one deduped node set.
 */
export const goalCourse = studySchema.table(
	'goal_course',
	{
		goalId: text('goal_id')
			.notNull()
			.references(() => goal.id, { onDelete: 'cascade' }),
		courseId: text('course_id')
			.notNull()
			.references(() => course.id, { onDelete: 'restrict' }),
		weight: real('weight').notNull().default(1.0),
		seedOrigin: text('seed_origin'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.goalId, t.courseId] }),
		// Reverse: "what goals reference this course?"
		goalCourseByCourseIdx: index('goal_course_by_course_idx').on(t.courseId),
		weightRangeCheck: check(
			'goal_course_weight_check',
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
export type CourseRow = typeof course.$inferSelect;
export type NewCourseRow = typeof course.$inferInsert;
export type CourseStepRow = typeof courseStep.$inferSelect;
export type NewCourseStepRow = typeof courseStep.$inferInsert;
export type GoalCourseRow = typeof goalCourse.$inferSelect;
export type NewGoalCourseRow = typeof goalCourse.$inferInsert;

/**
 * Per-user, per-key preference store.
 *
 * Owned by the study-home WP. v1 keys are `study.home.citation_order`
 * and `study.home.map_tab`; WP 3 reuses the table for
 * `study.knowledge.render_mode`. Composite PK (`user_id`, `key`) means
 * upsert is one `INSERT ... ON CONFLICT DO UPDATE`. `value` is jsonb
 * so future preferences can carry richer shapes without a migration.
 *
 * Cascade on user delete: a vanished user takes its preferences with
 * it. Per-key validation (closed value sets) is enforced in the BC
 * `setUserPref`, not by a CHECK on this table -- the closed sets evolve
 * faster than schema migrations.
 */
export const userPref = studySchema.table(
	'user_pref',
	{
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade' }),
		key: text('key').notNull(),
		value: jsonb('value').notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.userId, t.key] }),
		// Reverse: "every user that has set this preference key" (for ops /
		// migration scripts). Cheap GIN-free btree on a low-cardinality column.
		userPrefKeyIdx: index('user_pref_key_idx').on(t.key),
	}),
);

export type UserPrefRow = typeof userPref.$inferSelect;
export type NewUserPrefRow = typeof userPref.$inferInsert;

// ---------------------------------------------------------------------------
// wp-notes-primitive -- platform-wide note primitive.
//
// A note is a markdown thought attached to optional context (reference,
// section, knowledge node, course, goal, syllabus node) plus free-form
// tags. None-of-context = freestanding note. Notes survive "where did I
// write that" because every relevant FK is captured. Follow-ups capture
// intent without becoming a task manager. See
// `docs/work-packages/wp-notes-primitive/spec.md`.
//
// `knowledge_node_id` is intentionally a free-form text column today --
// the knowledge graph FK lands when the platform-wide `study.knowledge_node`
// FK semantics stabilise (already RESTRICT-on-delete from `course_step`,
// so a note row that points at a deleted node would be a problem we don't
// want to inherit yet). The other five context columns FK with
// `set null` so a context delete leaves the note (and its body) intact.
// ---------------------------------------------------------------------------
export const note = studySchema.table(
	'note',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

		/** Markdown body. Required (an empty note is a bug, not a feature). */
		bodyMd: text('body_md').notNull(),

		/** Optional title. When empty, the viewer derives one from the first line. */
		title: text('title').notNull().default(''),

		/**
		 * Quoted excerpt -- the passage the note responds to, snapshotted at
		 * note creation. Survives source re-extraction. Empty when the note
		 * isn't about a specific passage.
		 */
		quotedExcerpt: text('quoted_excerpt').notNull().default(''),

		// -- Context FKs. Any combination may be set. None set = freestanding. --

		referenceId: text('reference_id').references(() => reference.id, { onDelete: 'set null' }),
		referenceSectionId: text('reference_section_id').references(() => referenceSection.id, {
			onDelete: 'set null',
		}),

		/**
		 * Knowledge-graph node FK. Wired when the knowledge schema lands; for
		 * now this is a free-form text id with no FK constraint (the column
		 * gets the FK in a follow-up when knowledge nodes ship a stable
		 * delete contract).
		 */
		knowledgeNodeId: text('knowledge_node_id'),

		courseId: text('course_id').references(() => course.id, { onDelete: 'set null' }),
		goalId: text('goal_id').references(() => goal.id, { onDelete: 'set null' }),
		syllabusNodeId: text('syllabus_node_id').references(() => syllabusNode.id, { onDelete: 'set null' }),

		/** Free-form tags. */
		tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),

		/** Optional follow-up. Empty = no follow-up. */
		followUpMd: text('follow_up_md').notNull().default(''),
		followUpDoneAt: timestamp('follow_up_done_at', { withTimezone: true }),

		/** Soft-archive. Notes are never hard-deleted by the UI. */
		archivedAt: timestamp('archived_at', { withTimezone: true }),

		seedOrigin: text('seed_origin'),
		...timestamps(),
	},
	(t) => ({
		userIdx: index('note_user_idx').on(t.userId, t.createdAt),
		// Per-context partial indexes -- only rows where the FK is set.
		// Keeps the index pages small for what's almost always a sparse
		// column on a given note.
		refIdx: index('note_reference_idx').on(t.referenceId).where(sql`reference_id IS NOT NULL`),
		sectionIdx: index('note_section_idx').on(t.referenceSectionId).where(sql`reference_section_id IS NOT NULL`),
		goalIdx: index('note_goal_idx').on(t.goalId).where(sql`goal_id IS NOT NULL`),
		courseIdx: index('note_course_idx').on(t.courseId).where(sql`course_id IS NOT NULL`),
		knowledgeIdx: index('note_knowledge_idx').on(t.knowledgeNodeId).where(sql`knowledge_node_id IS NOT NULL`),
		syllabusIdx: index('note_syllabus_idx').on(t.syllabusNodeId).where(sql`syllabus_node_id IS NOT NULL`),
		// GIN over the tags array so `tags && ARRAY['x']` and `tags @> ARRAY['x']`
		// hit an index instead of seq-scanning.
		tagsGin: index('note_tags_gin_idx').using('gin', t.tags),
		// Open follow-ups inbox: `where follow_up_md != '' and follow_up_done_at
		// is null and archived_at is null`. Partial keeps the index small.
		followUpOpenIdx: index('note_follow_up_open_idx')
			.on(t.userId, t.createdAt)
			.where(sql`follow_up_md != '' AND follow_up_done_at IS NULL AND archived_at IS NULL`),
		// "All notes" default view excludes archived; partial-index that case
		// so the hot path doesn't pay for archived rows in the index pages.
		archivedOpenIdx: index('note_user_open_idx').on(t.userId, t.createdAt).where(sql`archived_at IS NULL`),
		bodyLengthCheck: check('note_body_length_check', sql.raw(`char_length("body_md") <= ${NOTE_BODY_MAX_LENGTH}`)),
		bodyNotEmptyCheck: check('note_body_not_empty_check', sql.raw(`char_length("body_md") > 0`)),
		titleLengthCheck: check('note_title_length_check', sql.raw(`char_length("title") <= ${NOTE_TITLE_MAX_LENGTH}`)),
		excerptLengthCheck: check(
			'note_excerpt_length_check',
			sql.raw(`char_length("quoted_excerpt") <= ${NOTE_EXCERPT_MAX_LENGTH}`),
		),
		followUpLengthCheck: check(
			'note_follow_up_length_check',
			sql.raw(`char_length("follow_up_md") <= ${NOTE_FOLLOW_UP_MAX_LENGTH}`),
		),
		tagsCountCheck: check(
			'note_tags_count_check',
			sql.raw(`array_length("tags", 1) IS NULL OR array_length("tags", 1) <= ${NOTE_TAGS_MAX}`),
		),
		// Each tag string capped to NOTE_TAG_MAX_LENGTH at the BC layer
		// (Zod schema in notes.ts). Postgres CHECK can't use a subquery, and
		// per-element bounded validation belongs in the BC anyway -- the DB
		// guards array length (above) and that's enough at the schema layer.
		// `follow_up_done_at` may only be set when there's a follow-up to mark done.
		followUpDoneRequiresFollowUp: check(
			'note_follow_up_done_requires_follow_up_check',
			sql.raw(`"follow_up_done_at" IS NULL OR "follow_up_md" != ''`),
		),
	}),
);

export type NoteRow = typeof note.$inferSelect;
export type NewNoteRow = typeof note.$inferInsert;

// ---------------------------------------------------------------------------
// wp-flightbag-rich-reader -- annotations + card drafts.
//
// `study.reference_section_annotation` is one row per highlight, note-anchor,
// or card-draft-anchor. The kind enum + color enum live in
// `@ab/constants/annotations`; the schema CHECK constraints reference those
// value lists.
//
// `study.card_draft` holds prefilled-card content awaiting the user's
// promote / discard decision in `/memory/drafts`. When promoted the resulting
// `study.card.id` is stamped into `promoted_to_card_id` so the audit trail
// links the draft to the live card.
//
// The two tables FK each other via the `card_draft_id` and `note_id`
// columns on `referenceSectionAnnotation`. `card_draft` is declared first;
// the annotation table's FK back to `card_draft.id` uses `foreignKey()` in
// the table-meta callback so the type-checker sees the reference late.
// ---------------------------------------------------------------------------
export const cardDraft = studySchema.table(
	'card_draft',
	{
		id: text('id').primaryKey(), // draft_<ULID>
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

		/** Pre-filled card fields. User edits before promotion. */
		front: text('front').notNull().default(''),
		back: text('back').notNull().default(''),
		domain: text('domain'),
		cardType: text('card_type').notNull().default('basic'),
		kind: text('kind').notNull().default('recall'),
		tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),

		/** Optional context FKs (mirror note schema). */
		referenceSectionId: text('reference_section_id').references(() => referenceSection.id, { onDelete: 'set null' }),
		/**
		 * Free-form knowledge-graph node id (mirror of note.knowledgeNodeId
		 * shape). Wired without a Drizzle FK so the existing knowledge-node
		 * delete contract isn't disturbed.
		 */
		knowledgeNodeId: text('knowledge_node_id'),
		courseId: text('course_id').references(() => course.id, { onDelete: 'set null' }),
		goalId: text('goal_id').references(() => goal.id, { onDelete: 'set null' }),

		/**
		 * When promoted, the resulting card row id is stamped here for audit +
		 * UI flash. The card row itself is created by `promoteDraftToCard`
		 * via the existing `createCard` BC; the FK is intentionally NOT
		 * declared so a cascade on the card row doesn't erase the draft's
		 * audit trail.
		 */
		promotedToCardId: text('promoted_to_card_id'),
		promotedAt: timestamp('promoted_at', { withTimezone: true }),

		...timestamps(),
	},
	(t) => ({
		// Hot path: "open drafts inbox for user X." Partial index over
		// `promoted_at IS NULL` so the index pages stay tight as drafts
		// promote.
		userOpenIdx: index('card_draft_user_open_idx').on(t.userId, t.createdAt).where(sql`promoted_at IS NULL`),
		userIdx: index('card_draft_user_idx').on(t.userId, t.createdAt),
	}),
);

export type CardDraftRow = typeof cardDraft.$inferSelect;
export type NewCardDraftRow = typeof cardDraft.$inferInsert;

export const referenceSectionAnnotation = studySchema.table(
	'reference_section_annotation',
	{
		id: text('id').primaryKey(), // ann_<ULID>
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		referenceSectionId: text('reference_section_id')
			.notNull()
			.references(() => referenceSection.id, { onDelete: 'cascade' }),

		/** One of `ANNOTATION_KIND_VALUES`. */
		kind: text('kind').notNull(),

		/**
		 * Highlight color when `kind = 'highlight'`; null for the other
		 * kinds. Validated against `HIGHLIGHT_COLOR_VALUES`.
		 */
		color: text('color'),

		/** Plain-text excerpt as it appeared at annotation time (re-anchor fallback). */
		anchorText: text('anchor_text').notNull(),
		/** UTF-16 offset in the section's plain-text projection at annotation time. */
		anchorStart: integer('anchor_start').notNull(),
		anchorEnd: integer('anchor_end').notNull(),

		/** Optional contextual prefix/suffix snippets used by the re-anchor matcher. */
		prefixContext: text('prefix_context').notNull().default(''),
		suffixContext: text('suffix_context').notNull().default(''),

		/**
		 * Forward link to the resulting note when `kind = 'note_anchor'`. FK
		 * so a note delete cascades the anchor row away (the highlight
		 * underline becomes meaningless without its note).
		 */
		noteId: text('note_id').references(() => note.id, { onDelete: 'cascade' }),

		/**
		 * Forward link to the resulting card draft when
		 * `kind = 'card_draft_anchor'`. FK so a draft delete cascades the
		 * anchor row away.
		 */
		cardDraftId: text('card_draft_id').references(() => cardDraft.id, { onDelete: 'cascade' }),

		...timestamps(),
	},
	(t) => ({
		userSectionIdx: index('reference_section_annotation_user_section_idx').on(t.userId, t.referenceSectionId),
		sectionIdx: index('reference_section_annotation_section_idx').on(t.referenceSectionId),
		userKindIdx: index('reference_section_annotation_user_kind_idx').on(t.userId, t.kind),
		userCreatedIdx: index('reference_section_annotation_user_created_idx').on(t.userId, t.createdAt),
		kindCheck: check(
			'reference_section_annotation_kind_check',
			sql.raw(`"kind" IN (${inList(ANNOTATION_KIND_VALUES)})`),
		),
		colorCheck: check(
			'reference_section_annotation_color_check',
			sql.raw(`"color" IS NULL OR "color" IN (${inList(HIGHLIGHT_COLOR_VALUES)})`),
		),
		// Highlight rows must carry a color; non-highlight rows must not.
		highlightColorRequired: check(
			'reference_section_annotation_highlight_color_required',
			sql.raw(`("kind" = 'highlight') = ("color" IS NOT NULL)`),
		),
		// Per-kind FK invariants:
		// `note_anchor` -> `note_id` set; `card_draft_anchor` -> `card_draft_id`
		// set; `highlight` -> both null.
		noteAnchorRequiresNote: check(
			'reference_section_annotation_note_anchor_requires_note',
			sql.raw(`("kind" = 'note_anchor') = ("note_id" IS NOT NULL)`),
		),
		cardDraftAnchorRequiresDraft: check(
			'reference_section_annotation_card_draft_anchor_requires_draft',
			sql.raw(`("kind" = 'card_draft_anchor') = ("card_draft_id" IS NOT NULL)`),
		),
		anchorTextLengthCheck: check(
			'reference_section_annotation_anchor_text_length_check',
			sql.raw(`char_length("anchor_text") > 0 AND char_length("anchor_text") <= ${ANNOTATION_ANCHOR_TEXT_MAX_LENGTH}`),
		),
		prefixContextLengthCheck: check(
			'reference_section_annotation_prefix_context_length_check',
			sql.raw(`char_length("prefix_context") <= ${ANNOTATION_CONTEXT_MAX_LENGTH}`),
		),
		suffixContextLengthCheck: check(
			'reference_section_annotation_suffix_context_length_check',
			sql.raw(`char_length("suffix_context") <= ${ANNOTATION_CONTEXT_MAX_LENGTH}`),
		),
		anchorRangeCheck: check(
			'reference_section_annotation_anchor_range_check',
			sql.raw(`"anchor_start" >= 0 AND "anchor_end" >= "anchor_start"`),
		),
	}),
);

export type ReferenceSectionAnnotationRow = typeof referenceSectionAnnotation.$inferSelect;
export type NewReferenceSectionAnnotationRow = typeof referenceSectionAnnotation.$inferInsert;
