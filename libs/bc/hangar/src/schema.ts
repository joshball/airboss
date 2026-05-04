/**
 * Hangar BC Drizzle schema -- runtime mirror of the TOML content registry
 * plus the sync ledger.
 *
 * Design intent (matches wp-hangar-registry spec):
 *   - `reference` / `source` are the runtime mirror of
 *     `libs/db/seed/{glossary,sources}.toml`. On hangar boot the TOML is
 *     parsed and rows upserted keyed by id; the `dirty` flag tracks
 *     rows with in-memory DB edits that have not been synced back to
 *     disk.
 *   - Optimistic concurrency via `rev` (int). Every write must match the
 *     submitted `rev`; the server increments on success and returns 409
 *     with a diff on mismatch.
 *   - `syncLog` is append-only; one row per sync attempt with the commit
 *     SHA (and PR URL in `pr` mode) so conflict detection can cheaply
 *     compare the last-known good SHA against the current on-disk TOML.
 *
 * The job queue tables (`hangar.job`, `hangar.job_log`) used to live here
 * but moved to `@ab/hangar-jobs` to break the bc-hangar -> hangar-jobs ->
 * bc-hangar package cycle. They still sit in the same Postgres `hangar`
 * namespace (the migrations created them there); only the Drizzle
 * definition relocated.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	FRONTMATTER_REVIEW_STATUS_VALUES,
	FRONTMATTER_STATUS_VALUES,
	HANGAR_SYNC_MODE_VALUES,
	PRODUCT_AREA_VALUES,
	REVIEW_KIND_VALUES,
	REVIEW_OUTCOME_VALUES,
	ROLE_VALUES,
	SCHEMAS,
	SESSION_OUTCOME_VALUES,
	SOURCE_TYPE_VALUES,
	SYNC_OUTCOME_VALUES,
	TASK_TYPE_VALUES,
} from '@ab/constants';
import { timestamps } from '@ab/db';
import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	customType,
	index,
	integer,
	jsonb,
	pgSchema,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core';

/** Render a string array as a SQL `IN (...)` value list. */
const inList = (values: readonly string[]) => values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');

/**
 * Shape of the `media` jsonb column on `hangar.source` (wp-hangar-non-textual).
 * Mirrors `SourceMedia` in `@ab/aviation`; duplicated here so the schema stays
 * free of any `@ab/aviation` dependency.
 */
export interface HangarSourceMedia {
	thumbnailPath: string;
	thumbnailSha256: string;
	thumbnailSizeBytes: number;
	archiveEntries: ReadonlyArray<{ name: string; sizeBytes: number }>;
	generator: string;
}

/**
 * Shape of the `edition` jsonb column on `hangar.source` (wp-hangar-non-textual).
 * Mirrors `SourceEdition` in `@ab/aviation`.
 */
export interface HangarSourceEdition {
	effectiveDate: string;
	editionNumber: number | null;
	resolvedUrl: string;
	resolvedAt: string;
}

export const hangarSchema = pgSchema(SCHEMAS.HANGAR);

/**
 * Postgres `tsvector` column. Drizzle's pg-core doesn't ship a `tsvector`
 * builder; this `customType` declares the SQL type so generated columns
 * (`docs_search_index.tsv`) and GIN indexes type-check uniformly. Reads stay
 * `string` because we never project the tsvector into application code -- it
 * exists to back the GIN index + `tsv @@ plainto_tsquery(...)` predicate.
 */
const tsvector = customType<{ data: string }>({
	dataType() {
		return 'tsvector';
	},
});

// -------- reference mirror --------

/**
 * Runtime mirror of `libs/db/seed/glossary.toml`. Authoritative writes go
 * here; the sync service serialises the DB state back to TOML on demand.
 */
export const hangarReference = hangarSchema.table(
	'reference',
	{
		/** Stable reference id (e.g. `cfr-14-91-155`, `term-metar`). */
		id: text('id').primaryKey(),
		/** Optimistic lock. Incremented on every successful write. */
		rev: integer('rev').notNull().default(1),
		/** Canonical display label. */
		displayName: text('display_name').notNull(),
		/** Alternate labels / nicknames. Stored as a JSON string array. */
		aliases: jsonb('aliases').$type<readonly string[]>().notNull().default([]),
		/** Plain-English explainer in Markdown. Multiline. */
		paraphrase: text('paraphrase').notNull(),
		/** Full 5-axis tag bag (see `@ab/aviation` ReferenceTags). */
		tags: jsonb('tags').$type<Record<string, unknown>>().notNull(),
		/** Source citations. `SourceCitation[]` serialised as JSON. */
		sources: jsonb('sources').$type<readonly Record<string, unknown>[]>().notNull().default([]),
		/** Related reference ids; enforced symmetrically by validator. */
		related: jsonb('related').$type<readonly string[]>().notNull().default([]),
		/** Hand-authored attribution. */
		author: text('author'),
		/** ISO-8601 date of last human review. Drives "stale" warning. */
		reviewedAt: text('reviewed_at'),
		/** Verbatim block (source-exact text + version). */
		verbatim: jsonb('verbatim').$type<Record<string, unknown> | null>(),
		/** True when DB state diverges from on-disk TOML. Cleared by sync. */
		dirty: boolean('dirty').notNull().default(false),
		/** User who last wrote this row. */
		updatedBy: text('updated_by').references(() => bauthUser.id, { onDelete: 'set null', onUpdate: 'cascade' }),
		/** Soft-delete marker; rows stay referenceable but are hidden from UI. */
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		...timestamps(),
	},
	(t) => ({
		// Partial: dirty rows are the only ones the sync service queries.
		refDirtyIdx: index('hangar_reference_dirty_idx').on(t.dirty).where(sql`${t.dirty} = true`),
		// Live rows are the BC's hot list; partial-on-deleted-at pairs with
		// the BC's `updatedAt desc` sort to keep the partial useful (the
		// previous `(id) WHERE deleted_at IS NULL` partial was redundant
		// with the PK -- chunk-6 schema MIN).
		refUpdatedIdx: index('hangar_reference_updated_idx').on(t.updatedAt).where(sql`${t.deletedAt} IS NULL`),
	}),
);

// -------- source mirror --------

export const hangarSource = hangarSchema.table(
	'source',
	{
		id: text('id').primaryKey(),
		rev: integer('rev').notNull().default(1),
		/** One of `REFERENCE_SOURCE_TYPES`. Drives extractor dispatch. */
		type: text('type').notNull(),
		title: text('title').notNull(),
		version: text('version').notNull(),
		url: text('url').notNull(),
		/**
		 * Path to the downloaded binary, relative to the hangar blob root
		 * (`<cache>/hangar-blobs/`). Resolved via `resolveHangarBlobRoot()`.
		 */
		path: text('path').notNull(),
		format: text('format').notNull(),
		/** SHA-256 of the downloaded binary; `pending-download` sentinel. */
		checksum: text('checksum').notNull(),
		/** ISO-8601 download timestamp; `pending-download` sentinel. */
		downloadedAt: text('downloaded_at').notNull(),
		/** Byte size when on disk. Null until downloaded. */
		sizeBytes: integer('size_bytes'),
		/** Locator shape hint for UI forms (see `SourceCitation.locator`). */
		locatorShape: jsonb('locator_shape').$type<Record<string, unknown> | null>(),
		/**
		 * Per-kind media sidecar; populated for `binary-visual` sources at ingest
		 * time (thumbnail path, archive manifest, generator tool used). Null for
		 * text sources. See wp-hangar-non-textual design.md.
		 */
		media: jsonb('media').$type<HangarSourceMedia | null>(),
		/**
		 * Edition tracking for sources with scheduled refreshes (sectionals,
		 * plates, ACS revisions). Null until the first fetch captures the
		 * effective date + resolved URL.
		 */
		edition: jsonb('edition').$type<HangarSourceEdition | null>(),
		dirty: boolean('dirty').notNull().default(false),
		updatedBy: text('updated_by').references(() => bauthUser.id, { onDelete: 'set null', onUpdate: 'cascade' }),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		...timestamps(),
	},
	(t) => ({
		sourceTypeIdx: index('hangar_source_type_idx').on(t.type),
		// Partial: dirty rows are the only ones the sync service queries.
		sourceDirtyIdx: index('hangar_source_dirty_idx').on(t.dirty).where(sql`${t.dirty} = true`),
		// Replaces the redundant `(id) WHERE deleted_at IS NULL` partial:
		// the BC's `listLiveSources` consumer orders by `updatedAt desc`,
		// so a partial-on-deleted-at index keyed on `updatedAt` actually
		// pays back. Chunk-6 schema MIN.
		sourceUpdatedIdx: index('hangar_source_updated_idx').on(t.updatedAt).where(sql`${t.deletedAt} IS NULL`),
		sourceTypeCheck: check('hangar_source_type_check', sql.raw(`"type" IN (${inList(SOURCE_TYPE_VALUES)})`)),
	}),
);

// -------- sync ledger --------

export const hangarSyncLog = hangarSchema.table(
	'sync_log',
	{
		id: text('id').primaryKey(),
		/** User who initiated the sync. Null for system-scheduled syncs. */
		actorId: text('actor_id').references(() => bauthUser.id, { onDelete: 'set null', onUpdate: 'cascade' }),
		/** One of `HANGAR_SYNC_MODES`. */
		kind: text('kind').notNull(),
		/** List of files written. Serialised `string[]`. */
		files: jsonb('files').$type<readonly string[]>().notNull().default([]),
		/** Git commit SHA produced. */
		commitSha: text('commit_sha'),
		/** PR URL when `kind = pr`. */
		prUrl: text('pr_url'),
		/** One of `SYNC_OUTCOMES`. */
		outcome: text('outcome').notNull(),
		/** Human-readable commit message / failure reason. */
		message: text('message').notNull(),
		/**
		 * Per-id `rev` snapshot captured at the end of a successful sync.
		 * Shape: `{ references: { [id]: rev }, sources: { [id]: rev } }`.
		 * `detectConflict` compares current `rev`s against the most recent
		 * successful sync's snapshot to surface writes that happened after
		 * the last sync saw the row.
		 */
		revSnapshot: jsonb('rev_snapshot').$type<{
			readonly references: Readonly<Record<string, number>>;
			readonly sources: Readonly<Record<string, number>>;
		} | null>(),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		finishedAt: timestamp('finished_at', { withTimezone: true }),
		// Convention parity with every other hangar table: `created_at` /
		// `updated_at` even on append-only rows so admin tooling that filters
		// "last touched" works uniformly. Closes chunk-6 schema NIT.
		...timestamps(),
	},
	(t) => ({
		syncActorIdx: index('hangar_sync_log_actor_idx').on(t.actorId, t.startedAt),
		syncOutcomeIdx: index('hangar_sync_log_outcome_idx').on(t.outcome, t.startedAt),
		// Closes chunk-6 schema MIN: enable "recent syncs of kind = pr"
		// admin-history filters without falling back to a full scan.
		syncKindIdx: index('hangar_sync_log_kind_idx').on(t.kind, t.startedAt),
		syncKindCheck: check('hangar_sync_log_kind_check', sql.raw(`"kind" IN (${inList(HANGAR_SYNC_MODE_VALUES)})`)),
		syncOutcomeCheck: check('hangar_sync_log_outcome_check', sql.raw(`"outcome" IN (${inList(SYNC_OUTCOME_VALUES)})`)),
	}),
);

// -------- invitation --------

/**
 * Admin-controlled invitation to onboard a new user. The invite link
 * carries an opaque random token (the row's `token` column); when the
 * recipient clicks it the study app's `/invite/[token]` route looks up
 * the row, creates a `bauth_user` with the proposed role, marks the
 * invite accepted, and signs the new user in.
 *
 * Lives in the hangar schema (not auth) because invites are an admin /
 * authoring concern, not a better-auth construct. Better-auth's
 * organization plugin ships a similar surface but carries multi-tenancy
 * machinery this product doesn't want -- decision called out in the
 * `hangar-invite-flow` spec.
 *
 * State machine:
 *
 *   - Pending  -- accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
 *   - Expired  -- accepted_at IS NULL AND revoked_at IS NULL AND expires_at <= now()
 *   - Accepted -- accepted_at IS NOT NULL
 *   - Revoked  -- revoked_at IS NOT NULL
 *
 * The unique partial index keeps "two pending invites for the same email"
 * impossible without making the row-history (accepted/revoked invites for
 * the same email) collide. See spec In Scope #1 + decision (f).
 */
export const hangarInvitation = hangarSchema.table(
	'invitation',
	{
		/** `inv_<ulid>` -- prefixed via `@ab/utils` `createId('inv')`. */
		id: text('id').primaryKey(),
		/**
		 * Recipient email. Lowercased on insert by the BC writer so the
		 * unique partial index hit is case-insensitive without a separate
		 * functional index.
		 */
		email: text('email').notNull(),
		/**
		 * Role the new user will be created with. One of `ROLE_VALUES`,
		 * minus `admin` (decision (e)) -- the BC create helper validates
		 * this, but the DB CHECK still allows admin so the column can
		 * carry historical rows + a future spec change without a schema
		 * round-trip.
		 */
		proposedRole: text('proposed_role').notNull(),
		/**
		 * Opaque bearer token. base64url-encoded random bytes
		 * (`INVITATION_TOKEN_BYTES` from `@ab/constants`). Lookup is a
		 * unique-index hit; no JWT, no signed envelope.
		 */
		token: text('token').notNull().unique(),
		/** Admin who created the invitation. */
		invitedByUserId: text('invited_by_user_id').references(() => bauthUser.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
		/** Computed at insert time as `invitedAt + INVITATION_DEFAULT_EXPIRY_DAYS`. */
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		acceptedAt: timestamp('accepted_at', { withTimezone: true }),
		/** `bauth_user.id` of the user the recipient created on accept. */
		acceptedUserId: text('accepted_user_id').references(() => bauthUser.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		revokedByUserId: text('revoked_by_user_id').references(() => bauthUser.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		...timestamps(),
	},
	(t) => ({
		// Hot path: accept-route lookup -- the route hits this index on
		// every click of an invite link. `unique()` above already creates
		// a covering index; this declaration would be redundant.
		// Hot path: list-pending tab + status filtering on the admin list.
		invitationStatusIdx: index('hangar_invitation_status_idx').on(t.acceptedAt, t.revokedAt, t.expiresAt),
		// Hot path: per-recipient history queries from the user-detail page.
		invitationEmailIdx: index('hangar_invitation_email_idx').on(t.email),
		// Hot path: admin's "what did I just send?" view.
		invitationInvitedAtIdx: index('hangar_invitation_invited_at_idx').on(t.invitedAt),
		// Decision (f): block two pending invites for the same email at
		// the DB level. Partial index allows accepted/revoked rows to
		// coexist with a fresh pending row for the same recipient.
		invitationPendingEmailUniqueIdx: uniqueIndex('hangar_invitation_pending_email_unique_idx')
			.on(t.email)
			.where(sql`${t.acceptedAt} IS NULL AND ${t.revokedAt} IS NULL`),
		invitationProposedRoleCheck: check(
			'hangar_invitation_proposed_role_check',
			sql.raw(`"proposed_role" IN (${inList(ROLE_VALUES)})`),
		),
	}),
);

export type HangarReferenceRow = typeof hangarReference.$inferSelect;
export type NewHangarReferenceRow = typeof hangarReference.$inferInsert;
export type HangarSourceRow = typeof hangarSource.$inferSelect;
export type NewHangarSourceRow = typeof hangarSource.$inferInsert;
export type HangarSyncLogRow = typeof hangarSyncLog.$inferSelect;
export type NewHangarSyncLogRow = typeof hangarSyncLog.$inferInsert;
export type HangarInvitationRow = typeof hangarInvitation.$inferSelect;
export type NewHangarInvitationRow = typeof hangarInvitation.$inferInsert;

// -------- review queue (hangar-review-queue WP) --------
//
// One review surface over many kinds of reviewable artifacts: WP specs, WP
// test plans, references, knowledge nodes, and ad-hoc tasks. The board groups
// items into buckets (queries) and columns (Backlog -> In Progress -> Review
// -> Done). Sessions capture per-walker progress; steps capture per-row
// outcomes inside a session.
//
// All literal sets (kinds, outcomes, frontmatter statuses, columns) are
// enforced via CHECK constraints sourced from `@ab/constants`.

/**
 * Snapshot of a review item's underlying frontmatter beyond the two
 * first-class status fields (`frontmatter_status`, `review_status`). Holds
 * arbitrary extra keys ("title", "type", "owner", ...) so per-kind UI can
 * surface custom metadata without a schema round trip. Loader-written.
 *
 * The two first-class status fields used to live inside this jsonb (with
 * `frontmatterStatus` / `reviewStatus` keys) but were lifted to top-level
 * `review_item` columns so each gets a real CHECK constraint sourced from
 * `@ab/constants` and the bucket filter SQL doesn't need `cached_status->>`
 * casting. See Phase 1 schema review.
 */
export interface CachedFrontmatterFields {
	readonly otherFields: Readonly<Record<string, string>>;
}

/**
 * Bucket filter predicate. v1 supports the structured shape (kind +
 * frontmatter status filters); the `advanced` field carries a free-form
 * jsonb predicate for power users (validated server-side before insert /
 * update).
 */
export interface BucketFilterCriteria {
	readonly kind?: string;
	readonly frontmatterStatus?: ReadonlyArray<'unread' | 'reading' | 'done'>;
	readonly reviewStatus?: ReadonlyArray<'pending' | 'done'>;
	/** Optional jsonb predicate, e.g. `{ "cachedFields": { "otherFields.area": "ifr" } }`. */
	readonly advanced?: Readonly<Record<string, unknown>>;
}

/**
 * Hangar Review board. One row per board; the seed `getOrCreateBoard()`
 * helper creates a single `Hangar Review` board on first visit. Multi-board
 * support is reserved for when multi-user lands.
 */
export const hangarBoard = hangarSchema.table(
	'board',
	{
		/** `brd_<ulid>` -- prefixed via `@ab/utils` `generateHangarBoardId()`. */
		id: text('id').primaryKey(),
		/** Display name (`Hangar Review` by default). */
		name: text('name').notNull(),
		...timestamps(),
	},
	(t) => ({
		boardNameUnique: uniqueIndex('hangar_board_name_unique_idx').on(t.name),
	}),
);

/**
 * Board column. Render order is `sortOrder` ascending, left to right. Default
 * columns (`Backlog`, `In Progress`, `Review`, `Done`) are seeded by
 * `seedDefaultColumns()` on first board create.
 */
export const hangarBoardColumn = hangarSchema.table(
	'board_column',
	{
		/** `bcol_<ulid>` -- prefixed via `@ab/utils` `generateHangarBoardColumnId()`. */
		id: text('id').primaryKey(),
		boardId: text('board_id')
			.notNull()
			.references(() => hangarBoard.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		name: text('name').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps(),
	},
	(t) => ({
		boardColumnBoardIdx: index('hangar_board_column_board_idx').on(t.boardId, t.sortOrder),
		boardColumnNameUnique: uniqueIndex('hangar_board_column_name_unique_idx').on(t.boardId, t.name),
	}),
);

/**
 * Review kind registry. Pre-seeded with `REVIEW_KIND_VALUES`; future kinds
 * land via a `seedReviewKinds()` migration. The discovery rule is stored as
 * jsonb so a reviewer can adjust per-kind behavior without a code change.
 *
 * `id` is the kind discriminator (e.g. `wp_spec`); CHECK guards it against
 * `REVIEW_KIND_VALUES`. `defaultColumnMapping` (per spec) is a jsonb map from
 * derived `frontmatter_status` -> board-column name (e.g. `{ unread: 'Backlog',
 * reading: 'In Progress', done: 'Done' }`); the board uses it to derive a
 * column for unpinned items. Null defers to a hard-coded default.
 */
export const hangarReviewKind = hangarSchema.table(
	'review_kind',
	{
		/** Kind discriminator: one of `REVIEW_KIND_VALUES`. */
		id: text('id').primaryKey(),
		label: text('label').notNull(),
		/** Per-kind status -> column-name map. Null = use built-in default. */
		defaultColumnMapping: jsonb('default_column_mapping').$type<Readonly<Record<string, string>> | null>(),
		/** Discovery-rule shape; see `review-discovery.ts`. Optional. */
		discoveryRule: jsonb('discovery_rule').$type<Record<string, unknown> | null>(),
		...timestamps(),
	},
	(_t) => ({
		reviewKindCheck: check('hangar_review_kind_id_check', sql.raw(`"id" IN (${inList(REVIEW_KIND_VALUES)})`)),
	}),
);

/**
 * Review bucket. A named query over `review_item` rows that renders as a
 * single bucket card on the board. The board derives the column for each
 * bucket from item state; bucket admin (Phase 7) lets a user CRUD these.
 */
export const hangarReviewBucket = hangarSchema.table(
	'review_bucket',
	{
		/** `rbkt_<ulid>` -- prefixed via `@ab/utils` `generateHangarReviewBucketId()`. */
		id: text('id').primaryKey(),
		boardId: text('board_id')
			.notNull()
			.references(() => hangarBoard.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		name: text('name').notNull(),
		/** One of `REVIEW_KIND_VALUES`. */
		kindId: text('kind_id')
			.notNull()
			.references(() => hangarReviewKind.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
		/** Structured + optional advanced jsonb predicate. */
		filterCriteria: jsonb('filter_criteria').$type<BucketFilterCriteria>().notNull().default({}),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps(),
	},
	(t) => ({
		bucketBoardIdx: index('hangar_review_bucket_board_idx').on(t.boardId, t.sortOrder),
		bucketNameUnique: uniqueIndex('hangar_review_bucket_name_unique_idx').on(t.boardId, t.name),
	}),
);

/**
 * Review item. One row per reviewable artifact: a WP spec, a test plan, a
 * reference TOC, a knowledge node, an ad-hoc task. The loader upserts items
 * keyed by `(kindId, ref)`; soft-delete via `deletedAt` keeps session
 * history reachable when a temporarily-renamed file resurfaces.
 *
 * `frontmatterStatus` and `reviewStatus` are the two first-class fields
 * lifted out of the underlying file's frontmatter (`status:`, `review_status:`)
 * so the bucket filter SQL stays simple and a CHECK constraint guards the
 * literal sets. `cachedFields` is the open-ended jsonb bag for everything
 * else (title overrides, type, owner, ...). The board doesn't reparse
 * markdown per render -- the loader writes all three on every scan.
 *
 * `pinnedColumnId` is the user's drag-drop pin; NULL means derive the
 * column from `frontmatterStatus` via `review_kind.defaultColumnMapping`.
 */
export const hangarReviewItem = hangarSchema.table(
	'review_item',
	{
		/** `ritem_<ulid>` -- prefixed via `@ab/utils` `generateHangarReviewItemId()`. */
		id: text('id').primaryKey(),
		boardId: text('board_id')
			.notNull()
			.references(() => hangarBoard.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		/** User-pinned column. NULL means derive from `frontmatterStatus`. */
		pinnedColumnId: text('pinned_column_id').references(() => hangarBoardColumn.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		/** One of `REVIEW_KIND_VALUES`. */
		kindId: text('kind_id')
			.notNull()
			.references(() => hangarReviewKind.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
		/**
		 * Loader-assigned reference. Path for filesystem kinds (`wp_spec`,
		 * `wp_test_plan`, `knowledge_node`); database id for `reference_toc`;
		 * synthetic `task_<ulid>` for ad-hoc tasks (mirrors the `boardTask` row).
		 */
		ref: text('ref').notNull(),
		title: text('title').notNull(),
		/** One of `FRONTMATTER_STATUS_VALUES` (or NULL when the file lacks `status:`). */
		frontmatterStatus: text('frontmatter_status'),
		/** One of `FRONTMATTER_REVIEW_STATUS_VALUES` (or NULL when the file lacks `review_status:`). */
		reviewStatus: text('review_status'),
		/** Open-ended frontmatter bag (everything beyond the two first-class fields). */
		cachedFields: jsonb('cached_fields').$type<CachedFrontmatterFields>().notNull().default({ otherFields: {} }),
		cachedAt: timestamp('cached_at', { withTimezone: true }).notNull().defaultNow(),
		sortOrder: integer('sort_order').notNull().default(0),
		/** Soft-delete marker; loader prunes missing artifacts to this. */
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		...timestamps(),
	},
	(t) => ({
		// Hot path: per-kind queries (bucket filter), sorted by recency. The
		// `(boardId)` single-column index was dropped: the unique
		// `(boardId, kindId, ref)` partial index covers `WHERE boardId = ?`
		// queries via its leading column.
		itemKindIdx: index('hangar_review_item_kind_idx').on(t.kindId, t.updatedAt).where(sql`${t.deletedAt} IS NULL`),
		// Loader upsert key: `(boardId, kindId, ref)` is unique among live rows.
		itemRefUnique: uniqueIndex('hangar_review_item_ref_unique_idx')
			.on(t.boardId, t.kindId, t.ref)
			.where(sql`${t.deletedAt} IS NULL`),
		// Hot path: bucket filter on a single status (e.g. unread WP specs).
		itemFrontmatterStatusIdx: index('hangar_review_item_frontmatter_status_idx')
			.on(t.boardId, t.frontmatterStatus)
			.where(sql`${t.deletedAt} IS NULL`),
		itemReviewStatusIdx: index('hangar_review_item_review_status_idx')
			.on(t.boardId, t.reviewStatus)
			.where(sql`${t.deletedAt} IS NULL`),
		itemFrontmatterStatusCheck: check(
			'hangar_review_item_frontmatter_status_check',
			sql.raw(`"frontmatter_status" IS NULL OR "frontmatter_status" IN (${inList(FRONTMATTER_STATUS_VALUES)})`),
		),
		itemReviewStatusCheck: check(
			'hangar_review_item_review_status_check',
			sql.raw(`"review_status" IS NULL OR "review_status" IN (${inList(FRONTMATTER_REVIEW_STATUS_VALUES)})`),
		),
	}),
);

/**
 * Review session. One attempt at reviewing an item. Closes on Pause (with
 * `finishedAt` still NULL but the session marked paused on the next open) or
 * on Finish (`finishedAt` + `outcome` populated). Resumable: the next open
 * walker reuses the open session for `(itemId, userId)`.
 */
export const hangarReviewSession = hangarSchema.table(
	'review_session',
	{
		/** `rses_<ulid>` -- prefixed via `@ab/utils` `generateHangarReviewSessionId()`. */
		id: text('id').primaryKey(),
		itemId: text('item_id')
			.notNull()
			.references(() => hangarReviewItem.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		finishedAt: timestamp('finished_at', { withTimezone: true }),
		/** One of `SESSION_OUTCOME_VALUES`; NULL while open. */
		outcome: text('outcome'),
		note: text('note').notNull().default(''),
		...timestamps(),
	},
	(t) => ({
		// Hot path: open-session lookup for the walker.
		sessionItemUserIdx: index('hangar_review_session_item_user_idx').on(t.itemId, t.userId, t.startedAt),
		// Only one OPEN session per (item, user); finished sessions are unbounded.
		sessionOpenUnique: uniqueIndex('hangar_review_session_open_unique_idx')
			.on(t.itemId, t.userId)
			.where(sql`${t.finishedAt} IS NULL`),
		sessionOutcomeCheck: check(
			'hangar_review_session_outcome_check',
			sql.raw(`"outcome" IS NULL OR "outcome" IN (${inList(SESSION_OUTCOME_VALUES)})`),
		),
	}),
);

/**
 * Review step. One row per checklist row inside a session. The walker uses
 * `(sessionId, stepRef)` as its idempotency key so re-saving the same step
 * overwrites the prior outcome / note.
 */
export const hangarReviewStep = hangarSchema.table(
	'review_step',
	{
		/** `rstp_<ulid>` -- prefixed via `@ab/utils` `generateHangarReviewStepId()`. */
		id: text('id').primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => hangarReviewSession.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		/** Author-defined step index inside the test plan (1-based). */
		stepIndex: integer('step_index').notNull(),
		/**
		 * Stable hash of the step's source location -- `sha256(filePath || '|' ||
		 * h2 || '|' || rowIndex)` truncated to 12 chars. Renumbering a test plan
		 * invalidates the prior steps cleanly rather than silently re-mapping
		 * outcomes onto the wrong row.
		 */
		stepRef: text('step_ref').notNull(),
		/** One of `REVIEW_OUTCOME_VALUES`. */
		outcome: text('outcome').notNull(),
		note: text('note').notNull().default(''),
		...timestamps(),
	},
	(t) => ({
		stepSessionIdx: index('hangar_review_step_session_idx').on(t.sessionId, t.stepIndex),
		stepRefUnique: uniqueIndex('hangar_review_step_ref_unique_idx').on(t.sessionId, t.stepRef),
		stepOutcomeCheck: check(
			'hangar_review_step_outcome_check',
			sql.raw(`"outcome" IN (${inList(REVIEW_OUTCOME_VALUES)})`),
		),
	}),
);

/**
 * Ad-hoc task. Distinct from `review_item.kind = 'ad_hoc'`: this row holds
 * the task body (description, type, productArea, assignee), and the matching
 * `review_item` row points at it via `ref = 'task_<id>'` so the board's drag
 * + filter substrate works uniformly for tasks and reviews.
 */
export const hangarBoardTask = hangarSchema.table(
	'board_task',
	{
		/** `task_<ulid>` -- prefixed via `@ab/utils` `generateHangarBoardTaskId()`. */
		id: text('id').primaryKey(),
		boardId: text('board_id')
			.notNull()
			.references(() => hangarBoard.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		columnId: text('column_id').references(() => hangarBoardColumn.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		title: text('title').notNull(),
		description: text('description').notNull().default(''),
		/** One of `TASK_TYPE_VALUES`. */
		type: text('type').notNull(),
		/** One of `PRODUCT_AREA_VALUES`. */
		productArea: text('product_area').notNull(),
		assigneeId: text('assignee_id').references(() => bauthUser.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		createdBy: text('created_by').references(() => bauthUser.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps(),
	},
	(t) => ({
		taskBoardIdx: index('hangar_board_task_board_idx').on(t.boardId, t.sortOrder),
		taskTypeCheck: check('hangar_board_task_type_check', sql.raw(`"type" IN (${inList(TASK_TYPE_VALUES)})`)),
		taskProductAreaCheck: check(
			'hangar_board_task_product_area_check',
			sql.raw(`"product_area" IN (${inList(PRODUCT_AREA_VALUES)})`),
		),
	}),
);

/**
 * Docs full-text-search index. Loader walks `DOCS_SEARCH_ROOTS`, parses
 * frontmatter, and upserts a row per markdown file. The `tsv` column is a
 * STORED generated column so PostgreSQL maintains it on insert / update.
 *
 * `path` is the repo-relative path (e.g. `docs/work-packages/hangar-review-queue/spec.md`)
 * and serves as the primary key. Title comes from frontmatter `title:` >
 * first H1 > path basename. Body is the full markdown body (frontmatter stripped).
 *
 * No FK to `review_item`: the FTS index is filesystem-keyed (path PK), and
 * a single docs file can produce zero or many `review_item` rows depending
 * on which discovery rules match (a WP dir produces both `wp_spec` and
 * `wp_test_plan` items from spec.md + test-plan.md). Both tables are
 * populated from one loader pass and pruned independently.
 */
export const hangarDocsSearchIndex = hangarSchema.table(
	'docs_search_index',
	{
		path: text('path').primaryKey(),
		title: text('title').notNull(),
		body: text('body').notNull(),
		frontmatter: jsonb('frontmatter').$type<Readonly<Record<string, string>>>().notNull().default({}),
		// Generated `tsvector`. Drizzle's `generatedAlwaysAs` defaults to
		// STORED mode, which is what Postgres needs for an indexed generated
		// column. The setweight + coalesce combo boosts title matches over
		// body matches via `ts_rank`. Keep the expression in lockstep with
		// the migration the snapshot generates -- both reference the same
		// language + weighting.
		tsv: tsvector('tsv').generatedAlwaysAs(
			sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')`,
		),
		...timestamps(),
	},
	(t) => ({
		// Hot path: search query hits the GIN index over `tsv`.
		docsSearchTsvIdx: index('hangar_docs_search_tsv_idx').using('gin', t.tsv),
	}),
);

// CHECK guards against the centralized constants. These run on every insert
// + update so a typo in app code surfaces as a constraint violation, not a
// silent bad-row.
export type HangarBoardRow = typeof hangarBoard.$inferSelect;
export type NewHangarBoardRow = typeof hangarBoard.$inferInsert;
export type HangarBoardColumnRow = typeof hangarBoardColumn.$inferSelect;
export type NewHangarBoardColumnRow = typeof hangarBoardColumn.$inferInsert;
export type HangarReviewKindRow = typeof hangarReviewKind.$inferSelect;
export type NewHangarReviewKindRow = typeof hangarReviewKind.$inferInsert;
export type HangarReviewBucketRow = typeof hangarReviewBucket.$inferSelect;
export type NewHangarReviewBucketRow = typeof hangarReviewBucket.$inferInsert;
export type HangarReviewItemRow = typeof hangarReviewItem.$inferSelect;
export type NewHangarReviewItemRow = typeof hangarReviewItem.$inferInsert;
export type HangarReviewSessionRow = typeof hangarReviewSession.$inferSelect;
export type NewHangarReviewSessionRow = typeof hangarReviewSession.$inferInsert;
export type HangarReviewStepRow = typeof hangarReviewStep.$inferSelect;
export type NewHangarReviewStepRow = typeof hangarReviewStep.$inferInsert;
export type HangarBoardTaskRow = typeof hangarBoardTask.$inferSelect;
export type NewHangarBoardTaskRow = typeof hangarBoardTask.$inferInsert;
export type HangarDocsSearchIndexRow = typeof hangarDocsSearchIndex.$inferSelect;
export type NewHangarDocsSearchIndexRow = typeof hangarDocsSearchIndex.$inferInsert;

// Frontmatter status / review_status are enforced inside `cachedStatus` by
// the BC writer; CHECK on a deeply nested jsonb path is fragile. Keeping
// the imports here so the BC's writers reference the same source of truth.
void FRONTMATTER_STATUS_VALUES;
void FRONTMATTER_REVIEW_STATUS_VALUES;
