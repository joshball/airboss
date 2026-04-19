/**
 * Drizzle schema for the `study` Postgres namespace.
 *
 * Owns cards, review history, and materialized per-user/per-card state.
 * IDs are `prefix_ULID` via @ab/utils generateCardId / generateReviewId.
 */

import { SCHEMAS } from '@ab/constants';
import {
	boolean,
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

export const card = studySchema.table(
	'card',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').notNull(),
		front: text('front').notNull(),
		back: text('back').notNull(),
		domain: text('domain').notNull(),
		tags: jsonb('tags').notNull().default([]),
		cardType: text('card_type').notNull(),
		sourceType: text('source_type').notNull().default('personal'),
		sourceRef: text('source_ref'),
		isEditable: boolean('is_editable').notNull().default(true),
		status: text('status').notNull().default('active'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		cardUserStatusIdx: index('card_user_status_idx').on(t.userId, t.status),
		cardUserDomainIdx: index('card_user_domain_idx').on(t.userId, t.domain),
		cardUserCreatedIdx: index('card_user_created_idx').on(t.userId, t.createdAt),
	}),
);

export const review = studySchema.table(
	'review',
	{
		id: text('id').primaryKey(),
		cardId: text('card_id')
			.notNull()
			.references(() => card.id, { onDelete: 'cascade' }),
		userId: text('user_id').notNull(),
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
	}),
);

export const cardState = studySchema.table(
	'card_state',
	{
		cardId: text('card_id')
			.notNull()
			.references(() => card.id, { onDelete: 'cascade' }),
		userId: text('user_id').notNull(),
		stability: real('stability').notNull(),
		difficulty: real('difficulty').notNull(),
		state: text('state').notNull(),
		dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
		lastReviewId: text('last_review_id').references(() => review.id, { onDelete: 'set null' }),
		reviewCount: integer('review_count').notNull().default(0),
		lapseCount: integer('lapse_count').notNull().default(0),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.cardId, t.userId] }),
		cardStateUserDueIdx: index('card_state_user_due_idx').on(t.userId, t.dueAt),
	}),
);

export type CardRow = typeof card.$inferSelect;
export type NewCardRow = typeof card.$inferInsert;
export type ReviewRow = typeof review.$inferSelect;
export type NewReviewRow = typeof review.$inferInsert;
export type CardStateRow = typeof cardState.$inferSelect;
export type NewCardStateRow = typeof cardState.$inferInsert;
