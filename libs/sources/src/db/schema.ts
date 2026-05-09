/**
 * Drizzle schema for the `sources_registry` Postgres namespace.
 *
 * Owns the persistent audit trail and per-entry edition history of the
 * `@ab/sources` registry. The two tables here mirror the in-memory shapes in
 * `libs/sources/src/registry/lifecycle.ts` (`PromotionBatch`) and
 * `libs/sources/src/types.ts` (`Edition`).
 *
 * Source of truth: ADR 019 §2.1, §2.4, §6.1.
 *
 * Phase 1 of the WP `promotion-batches-persistence` ships only the schema +
 * migration. The read path (`getEditionsMap`) and write path
 * (`recordPromotion` / `recordDePromotion`) move to Postgres in Phase 2 and
 * Phase 3 respectively. Until then, these tables are unused at runtime; the
 * migration just lands the columns + indexes so the later phases drop in
 * cleanly.
 *
 * IDs are `prefix_ULID` strings produced by `createId()` from `@ab/utils`
 * (`batch_<ulid>` for `promotion_batches`, `edition_<ulid>` for `editions`).
 * They live in `text` columns to match the convention across the rest of the
 * monorepo (auth, study, audit, hangar, sim).
 */

import { PROMOTION_STATE_VALUES, SCHEMAS, SOURCE_LIFECYCLE_VALUES } from '@ab/constants';
import { inList } from '@ab/db';
import { sql } from 'drizzle-orm';
import { check, foreignKey, index, jsonb, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const sourcesRegistrySchema = pgSchema(SCHEMAS.SOURCES_REGISTRY);

// ---------------------------------------------------------------------------
// promotion_batches -- ADR 019 §2.4
// ---------------------------------------------------------------------------

/**
 * One row per `recordPromotion` / `recordDePromotion` call. Append-only audit
 * trail; nothing in this table is ever updated or deleted (the FK on
 * `previous_batch_id` enforces this with ON DELETE RESTRICT).
 *
 * `scope` is a JSONB array of `airboss-ref:` URI strings (the Phase 1
 * structural shape; Phase 3's transactional writer populates it).
 */
export const promotionBatches = sourcesRegistrySchema.table(
	'promotion_batches',
	{
		/** `batch_<ulid>` via `createId('batch')`. */
		id: text('id').primaryKey(),
		/** Corpus key (e.g. `regs`, `handbooks`, `aim`, `ac`). Free-form text; no FK. */
		corpus: text('corpus').notNull(),
		/** Reviewer ULID. Free-form text; reviewers aren't FK'd to bauth_user yet. */
		reviewerId: text('reviewer_id').notNull(),
		/** Server clock when the promotion was committed. */
		promotionDate: timestamp('promotion_date', { withTimezone: true }).notNull(),
		/**
		 * Frozen list of `airboss-ref:` URI strings the batch transitioned. Stored
		 * as a JSONB array of strings; `SourceId` is a branded string type but the
		 * branding is erased at runtime so JSONB validates as plain text.
		 */
		scope: jsonb('scope').$type<readonly string[]>().notNull(),
		/** Human-readable description of where the proposal originated (PR link, ingestion run id, etc.). */
		inputSource: text('input_source').notNull(),
		/** PROMOTION_STATE_VALUES: `promoted` | `de-promoted`. */
		state: text('state').notNull(),
		/** Lifecycle the scope was in before the batch (SOURCE_LIFECYCLE_VALUES). */
		fromLifecycle: text('from_lifecycle').notNull(),
		/** Lifecycle the scope transitioned to (SOURCE_LIFECYCLE_VALUES). */
		toLifecycle: text('to_lifecycle').notNull(),
		/**
		 * For `state = 'de-promoted'`, the id of the original `promoted` batch
		 * being rolled back. Self-referential FK -- ON DELETE RESTRICT because the
		 * audit trail is append-only.
		 */
		previousBatchId: text('previous_batch_id'),
	},
	(t) => ({
		/**
		 * Self-referential FK with RESTRICT. Drizzle's `.references()` shorthand
		 * defaults to NO ACTION, but we want explicit RESTRICT so a future
		 * migration that tries to delete a batch surfaces an error rather than
		 * silently corrupting the de-promotion chain.
		 */
		previousBatchFk: foreignKey({
			columns: [t.previousBatchId],
			foreignColumns: [t.id],
			name: 'promotion_batches_previous_batch_fk',
		}).onDelete('restrict'),
		/** List a corpus's promotion history newest-first (the dashboard query). */
		corpusDateIdx: index('promotion_batches_corpus_date_idx').on(t.corpus, t.promotionDate.desc()),
		/** De-promotion link traversal: "show me the events that rolled back this batch." */
		previousBatchIdx: index('promotion_batches_previous_batch_idx').on(t.previousBatchId),
		/** Per-reviewer audit ("what has this reviewer promoted?"). */
		reviewerDateIdx: index('promotion_batches_reviewer_date_idx').on(t.reviewerId, t.promotionDate.desc()),
		stateCheck: check('promotion_batches_state_check', sql.raw(`"state" IN (${inList(PROMOTION_STATE_VALUES)})`)),
		fromLifecycleCheck: check(
			'promotion_batches_from_lifecycle_check',
			sql.raw(`"from_lifecycle" IN (${inList(SOURCE_LIFECYCLE_VALUES)})`),
		),
		toLifecycleCheck: check(
			'promotion_batches_to_lifecycle_check',
			sql.raw(`"to_lifecycle" IN (${inList(SOURCE_LIFECYCLE_VALUES)})`),
		),
	}),
);

// ---------------------------------------------------------------------------
// editions -- ADR 019 §6.1
// ---------------------------------------------------------------------------

/**
 * Shape of the optional metadata blob attached to an edition. Today only
 * `aliases` is defined (per ADR 019 §6.1's `AliasEntry` array), but the
 * column is open-shaped so future per-corpus extras (effective dates,
 * publisher metadata) can land without a migration.
 */
export interface EditionMetadata {
	readonly aliases?: readonly EditionAliasEntry[];
}

/** ADR 019 §6.1 `AliasEntry`. Encoded into the JSONB blob with `kind` discriminator. */
export interface EditionAliasEntry {
	readonly from: string;
	readonly to: string | readonly string[];
	readonly kind: 'silent' | 'content-change' | 'cross-section' | 'split' | 'merge';
}

/**
 * Per-`SOURCES`-entry edition history. One row per known edition. The
 * partial index `WHERE retired_at IS NULL` powers the hot "current edition
 * for this entry" lookup that the renderer uses on every page render.
 *
 * `sourceId` is the canonical `airboss-ref:` URI string (with `?at=`
 * stripped). Not FK'd: SOURCES is a code-resident static table, not a
 * Postgres table.
 */
export const editions = sourcesRegistrySchema.table(
	'editions',
	{
		/** `edition_<ulid>` via `createId('edition')`. */
		id: text('id').primaryKey(),
		/** Canonical SOURCES key. */
		sourceId: text('source_id').notNull(),
		/** Human-readable edition label (e.g. `FAA-H-8083-25C`, `2026-04`, `141`). */
		editionLabel: text('edition_label').notNull(),
		/** When the edition was published upstream. Nullable for editions whose date is unknown. */
		publishedAt: timestamp('published_at', { withTimezone: true }),
		/** Set when the edition is no longer current. NULL for the active edition. */
		retiredAt: timestamp('retired_at', { withTimezone: true }),
		/** Open-shaped JSONB metadata. Today: aliases per ADR 019 §6.1. */
		metadata: jsonb('metadata').$type<EditionMetadata>(),
	},
	(t) => ({
		/** Chronological walk per entry: "show me every edition we have for source X." */
		sourceDateIdx: index('editions_source_date_idx').on(t.sourceId, t.publishedAt),
		/**
		 * Partial index for the "current edition" query. Drops every retired row
		 * so the index stays tight and the renderer's per-render lookup is a
		 * one-row B-tree probe rather than a full scan.
		 */
		sourceCurrentIdx: index('editions_source_current_idx').on(t.sourceId).where(sql`retired_at IS NULL`),
		/**
		 * Per-source-id label uniqueness. ADR 026 hangs the registry on the
		 * "exactly one row per `(source_id, edition_label)`" invariant -- the
		 * resolver returns a single row for `getEditionByLabel`, the NOT EXISTS
		 * subqueries in `library-by-cert.ts` / `references.ts` assume the lookup
		 * is single-valued, and `markPriorEditionsRetired` relies on the
		 * "single current row" guarantee. Enforced at the schema layer instead
		 * of trusting seed discipline.
		 *
		 * Doubles as the covering index for `getEditionByLabel(sourceId, label)`.
		 */
		sourceLabelUniqueIdx: uniqueIndex('editions_source_label_uq').on(t.sourceId, t.editionLabel),
		/**
		 * Partial index for the inverse-of-current path: the NOT EXISTS subquery
		 * in `notSupersededInRegistry` filters `retired_at IS NOT NULL` to ask
		 * "is this `(source_id, edition_label)` retired?". The
		 * `editions_source_current_idx` partial index above is built on the
		 * complementary predicate (`IS NULL`) and cannot be reused, so this
		 * index keeps the per-row probe on the library-by-cert hot path off a
		 * full scan.
		 */
		sourceLabelSupersededIdx: index('editions_source_label_superseded_idx')
			.on(t.sourceId, t.editionLabel)
			.where(sql`retired_at IS NOT NULL`),
	}),
);

export type PromotionBatchRow = typeof promotionBatches.$inferSelect;
export type NewPromotionBatchRow = typeof promotionBatches.$inferInsert;
export type EditionRow = typeof editions.$inferSelect;
export type NewEditionRow = typeof editions.$inferInsert;
