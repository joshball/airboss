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
import { HANGAR_SYNC_MODE_VALUES, ROLE_VALUES, SCHEMAS, SOURCE_TYPE_VALUES, SYNC_OUTCOME_VALUES } from '@ab/constants';
import { timestamps } from '@ab/db';
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

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
