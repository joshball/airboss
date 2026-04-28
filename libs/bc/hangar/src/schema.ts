/**
 * Hangar BC Drizzle schema -- runtime mirror of the TOML content registry,
 * plus the job queue, job log, and sync ledger that drives the hangar
 * admin app.
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
 *   - `job` + `jobLog` are generic enough to carry every hangar workload
 *     (sync-to-disk today, fetch/upload/extract/build/diff/validate/
 *     size-report in wp-hangar-sources-v1).
 *   - `syncLog` is append-only; one row per sync attempt with the commit
 *     SHA (and PR URL in `pr` mode) so conflict detection can cheaply
 *     compare the last-known good SHA against the current on-disk TOML.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	HANGAR_SYNC_MODE_VALUES,
	JOB_KIND_VALUES,
	JOB_LOG_STREAM_VALUES,
	JOB_STATUS_VALUES,
	SCHEMAS,
	SOURCE_TYPE_VALUES,
	SYNC_OUTCOME_VALUES,
} from '@ab/constants';
import { timestamps } from '@ab/db';
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

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
		refUpdatedIdx: index('hangar_reference_updated_idx').on(t.updatedAt),
		refLiveIdx: index('hangar_reference_live_idx').on(t.id).where(sql`${t.deletedAt} IS NULL`),
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
		/** Where the downloaded binary lives under `data/sources/`. */
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
		sourceLiveIdx: index('hangar_source_live_idx').on(t.id).where(sql`${t.deletedAt} IS NULL`),
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
	},
	(t) => ({
		syncActorIdx: index('hangar_sync_log_actor_idx').on(t.actorId, t.startedAt),
		syncOutcomeIdx: index('hangar_sync_log_outcome_idx').on(t.outcome, t.startedAt),
		syncKindCheck: check('hangar_sync_log_kind_check', sql.raw(`"kind" IN (${inList(HANGAR_SYNC_MODE_VALUES)})`)),
		syncOutcomeCheck: check('hangar_sync_log_outcome_check', sql.raw(`"outcome" IN (${inList(SYNC_OUTCOME_VALUES)})`)),
	}),
);

// -------- job queue --------

export const hangarJob = hangarSchema.table(
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

// -------- job log --------

export const hangarJobLog = hangarSchema.table(
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
		jobLogJobIdx: index('hangar_job_log_job_idx').on(t.jobId, t.seq),
		jobLogStreamCheck: check('hangar_job_log_stream_check', sql.raw(`"stream" IN (${inList(JOB_LOG_STREAM_VALUES)})`)),
	}),
);

export type HangarReferenceRow = typeof hangarReference.$inferSelect;
export type NewHangarReferenceRow = typeof hangarReference.$inferInsert;
export type HangarSourceRow = typeof hangarSource.$inferSelect;
export type NewHangarSourceRow = typeof hangarSource.$inferInsert;
export type HangarSyncLogRow = typeof hangarSyncLog.$inferSelect;
export type NewHangarSyncLogRow = typeof hangarSyncLog.$inferInsert;
export type HangarJobRow = typeof hangarJob.$inferSelect;
export type NewHangarJobRow = typeof hangarJob.$inferInsert;
export type HangarJobLogRow = typeof hangarJobLog.$inferSelect;
export type NewHangarJobLogRow = typeof hangarJobLog.$inferInsert;
