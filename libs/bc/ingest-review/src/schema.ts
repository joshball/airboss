/**
 * Ingest-Review BC schema.
 *
 * Two tables in the existing `hangar` Postgres namespace (per design.md
 * "Why a new BC instead of extending libs/bc/hangar"). The BC owns these
 * rows even though they share the namespace; routing is by table, not by
 * schema.
 *
 *   - `hangar.ingest_issue` is the producer-facing table. One row per
 *     `(kind, external_id)` pair; producers upsert keyed on that pair.
 *     Re-running a producer on a re-extracted handbook updates the
 *     payload + `last_seen_at` and leaves `first_seen_at` alone.
 *
 *   - `hangar.ingest_override` carries one row per resolved issue. The
 *     plugin picks the action; the BC writes the row. History is in
 *     `audit.audit_log` (one entry per write through `auditWrite`).
 *
 * Indexes are mandatory from day one even though the live count is 21:
 * the moment a future plugin (regulations, knowledge-graph drift) starts
 * producing thousands of rows the queue's filtered list query has to
 * stay cheap. CHECK constraints route through `inList(...)` so adding
 * a new corpus / kind / action is one file (`@ab/constants`).
 */

import { bauthUser } from '@ab/auth/schema';
import { hangarSchema } from '@ab/bc-hangar/schema';
import {
	CORPUS_VALUES,
	INGEST_ISSUE_KIND_VALUES,
	INGEST_OVERRIDE_ACTION_VALUES,
	INGEST_STATUS_VALUES,
} from '@ab/constants';
import { inList, timestamps } from '@ab/db';
import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Producer-emitted issue row. One per `(kind, external_id)` pair. The
 * `external_id` is the producer's stable handle on the underlying
 * artifact (a `warnings.json` row id today); `payload` carries any
 * producer-specific blob the candidate finder + UI need without an
 * out-of-band lookup (e.g. caption text, page number, candidate set).
 *
 * `status` is the lifecycle dial:
 *
 *   - `unresolved` -- producer wrote it; no override yet.
 *   - `resolved`   -- an `ingest_override` row exists for this issue.
 *   - `stale`      -- producer's last run did not re-emit this
 *                     `external_id`; override (if any) is preserved.
 *   - `dismissed`  -- human flipped the row off the queue without
 *                     writing an override (noise, false positive).
 */
export const ingestIssue = hangarSchema.table(
	'ingest_issue',
	{
		/** `isiss_<ulid>` -- prefixed via `@ab/utils` `createId(INGEST_ISSUE_ID_PREFIX)`. */
		id: text('id').primaryKey(),
		/** One of `CORPUS_VALUES`. Drives plugin scoping. */
		corpus: text('corpus').notNull(),
		/** Producer-defined source slug (e.g. `ifh`, `phak`, `14-cfr-91`). */
		sourceId: text('source_id').notNull(),
		/** Edition handle (e.g. `FAA-H-8083-15B`); null for non-versioned corpora. */
		edition: text('edition'),
		/** 1-indexed PDF page where applicable; null when the issue is page-less. */
		pageNum: integer('page_num'),
		/** One of `INGEST_ISSUE_KIND_VALUES`. Plugin-registry key. */
		kind: text('kind').notNull(),
		/**
		 * Stable producer-side id. For handbook orphans this is the
		 * `warnings.json` row id (`b8fa45834d84872b` etc.). The
		 * `(kind, external_id)` pair is the upsert key.
		 */
		externalId: text('external_id').notNull(),
		/** Producer-defined; opaque to the queue. */
		payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
		/** Lifecycle status. Default `unresolved` on insert. */
		status: text('status').notNull().default('unresolved'),
		firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
		lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
		...timestamps(),
	},
	(t) => ({
		/**
		 * Upsert key. The producer never invents new ids when re-running on
		 * the same source; the same `(kind, external_id)` pair updates the
		 * existing row.
		 */
		uqKindExternal: uniqueIndex('hangar_ingest_issue_kind_external_id_uq').on(t.kind, t.externalId),
		/** Hot path: queue filter `(corpus, source_id, status)`. */
		ixCorpusSource: index('hangar_ingest_issue_corpus_source_ix').on(t.corpus, t.sourceId, t.status),
		/** Status-only filter for the dashboard summary tile. */
		ixStatus: index('hangar_ingest_issue_status_ix').on(t.status),
		corpusCheck: check('hangar_ingest_issue_corpus_chk', sql.raw(`"corpus" IN (${inList(CORPUS_VALUES)})`)),
		kindCheck: check('hangar_ingest_issue_kind_chk', sql.raw(`"kind" IN (${inList(INGEST_ISSUE_KIND_VALUES)})`)),
		statusCheck: check('hangar_ingest_issue_status_chk', sql.raw(`"status" IN (${inList(INGEST_STATUS_VALUES)})`)),
	}),
);

/**
 * One row per resolved issue. The unique index on `issue_id` keeps the
 * "one current override per issue" invariant; history lives in
 * `audit.audit_log` via the BC's `applyOverride` writer.
 */
export const ingestOverride = hangarSchema.table(
	'ingest_override',
	{
		/** `iover_<ulid>` -- prefixed via `@ab/utils` `createId(INGEST_OVERRIDE_ID_PREFIX)`. */
		id: text('id').primaryKey(),
		issueId: text('issue_id')
			.notNull()
			.references(() => ingestIssue.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		/** One of `INGEST_OVERRIDE_ACTION_VALUES`. Plugin enforces per-kind validity. */
		action: text('action').notNull(),
		/** Producer-defined; e.g. `{ image_xref, image_page }` for `pair`. */
		payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
		/**
		 * User who recorded the override. SET NULL on user delete so the
		 * audit row survives a user purge; the override row stays on the
		 * issue, the actor is just lost.
		 */
		createdByUserId: text('created_by_user_id').references(() => bauthUser.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => ({
		/** One current override per issue; replaces on second write. */
		uqIssue: uniqueIndex('hangar_ingest_override_issue_id_uq').on(t.issueId),
		/** FK-supporting index for `created_by_user_id` set-null cascade. */
		ixCreatedBy: index('hangar_ingest_override_created_by_ix').on(t.createdByUserId),
		actionCheck: check(
			'hangar_ingest_override_action_chk',
			sql.raw(`"action" IN (${inList(INGEST_OVERRIDE_ACTION_VALUES)})`),
		),
	}),
);

export type IngestIssueRow = typeof ingestIssue.$inferSelect;
export type NewIngestIssueRow = typeof ingestIssue.$inferInsert;
export type IngestOverrideRow = typeof ingestOverride.$inferSelect;
export type NewIngestOverrideRow = typeof ingestOverride.$inferInsert;
