/**
 * Drizzle schema for `study.content_citations`.
 *
 * One polymorphic row connects a source content row (card, rep, scenario,
 * knowledge node) to a reference target (regulation node, advisory circular,
 * external URL, knowledge node). Referential integrity is soft:
 * `source_type` / `target_type` enumerate which table the paired id points at
 * but no per-type FK exists, because (B) nullable-FK fan-out and (C) per-type
 * tables both lose the symmetric "cited by" query surface the spec requires.
 * The application layer (the citation BC functions) is the write gate -- it
 * verifies the row exists and is owned before inserting.
 *
 * Schema placement: the table lives in the existing `study` Postgres schema
 * so migrations flow through the same drizzle output as cards / scenarios /
 * knowledge nodes. The `studySchema` Drizzle namespace is reused from the
 * sibling `../schema.ts` so we don't redeclare it here.
 */

import { bauthUser } from '@ab/auth/schema';
import { CITATION_SOURCE_VALUES, CITATION_TARGET_VALUES } from '@ab/constants';
import { timestamps } from '@ab/db';
import { sql } from 'drizzle-orm';
import { check, index, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { studySchema } from '../schema';

function inList(values: readonly string[]): string {
	return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
}

export const contentCitation = studySchema.table(
	'content_citations',
	{
		/** `ccit_` prefixed ULID. */
		id: text('id').primaryKey(),
		/** One of CITATION_SOURCE_TYPES. Enforced by CHECK + app-layer guard. */
		sourceType: text('source_type').notNull(),
		/** Id of the source row; meaning depends on `source_type`. */
		sourceId: text('source_id').notNull(),
		/** One of CITATION_TARGET_TYPES. */
		targetType: text('target_type').notNull(),
		/** Id of the reference row; meaning depends on `target_type`. */
		targetId: text('target_id').notNull(),
		/**
		 * Optional author note explaining why the citation exists ("basis for
		 * the exception answer" / "context for the hard-deck"). Trimmed + capped
		 * at CITATION_CONTEXT_MAX_LENGTH by the BC before insert. NULL means
		 * no note was supplied.
		 */
		citationContext: text('citation_context'),
		/**
		 * Authoring user. `cascade` matches every other user-scoped table: if
		 * the user is removed, their citations go with their content.
		 */
		createdBy: text('created_by')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		...timestamps(),
	},
	(t) => ({
		// General source-side and target-side lookups. Both directions need to
		// be fast: `getCitationsOf` probes by (source_type, source_id) and
		// `getCitedBy` probes by (target_type, target_id).
		bySourceIdx: index('content_citation_source_idx').on(t.sourceType, t.sourceId),
		byTargetIdx: index('content_citation_target_idx').on(t.targetType, t.targetId),
		// Partial indexes for the hot paths: the card editor renders its
		// citations on every detail-page load, and the regulation "Cited by"
		// panel is the anchor read on the reg-node detail page.
		cardSourcePartialIdx: index('content_citation_card_source_idx').on(t.sourceId).where(sql`source_type = 'card'`),
		regulationTargetPartialIdx: index('content_citation_regulation_target_idx')
			.on(t.targetId)
			.where(sql`target_type = 'regulation_node'`),
		// The unique constraint prevents duplicate citations. BC code catches
		// the Postgres 23505 violation and surfaces a user-friendly "already
		// cited" message instead of a 500.
		sourceTargetUnique: uniqueIndex('content_citation_source_target_unique').on(
			t.sourceType,
			t.sourceId,
			t.targetType,
			t.targetId,
		),
		sourceTypeCheck: check(
			'content_citation_source_type_check',
			sql.raw(`"source_type" IN (${inList(CITATION_SOURCE_VALUES)})`),
		),
		targetTypeCheck: check(
			'content_citation_target_type_check',
			sql.raw(`"target_type" IN (${inList(CITATION_TARGET_VALUES)})`),
		),
		// Mirror the CITATION_CONTEXT_MAX_LENGTH guard at the DB level so a
		// rogue insert path can't exceed the 500-char cap.
		citationContextLengthCheck: check(
			'content_citation_context_length_check',
			sql.raw(`"citation_context" IS NULL OR char_length("citation_context") <= 500`),
		),
	}),
);

export type ContentCitationRow = typeof contentCitation.$inferSelect;
export type NewContentCitationRow = typeof contentCitation.$inferInsert;
