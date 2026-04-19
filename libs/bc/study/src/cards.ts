/**
 * Card BC functions.
 *
 * Own the card lifecycle: create, read, update status, and read-back with
 * per-user scheduler state. FSRS math lives in srs.ts; these functions only
 * persist the pre/post-scheduling state.
 */

import {
	CARD_STATUSES,
	type CardStatus,
	type CardType,
	CONTENT_SOURCES,
	type ContentSource,
	type Domain,
	REVIEW_BATCH_SIZE,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { generateCardId } from '@ab/utils';
import { and, asc, desc, eq, ilike, inArray, lte, or } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type CardRow, type CardStateRow, card, cardState } from './schema';
import { fsrsInitialState } from './srs';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Full card view that pairs static card data with per-user scheduler state. */
export interface CardWithState {
	card: CardRow;
	state: CardStateRow;
}

export interface CreateCardInput {
	userId: string;
	front: string;
	back: string;
	domain: Domain;
	cardType: CardType;
	tags?: string[];
	sourceType?: ContentSource;
	sourceRef?: string | null;
	isEditable?: boolean;
}

export interface UpdateCardInput {
	front?: string;
	back?: string;
	domain?: Domain;
	cardType?: CardType;
	tags?: string[];
}

export interface CardFilters {
	domain?: Domain;
	cardType?: CardType;
	sourceType?: ContentSource;
	status?: CardStatus | CardStatus[];
	search?: string;
	limit?: number;
	offset?: number;
}

/** Create a new card and its initial card_state row. Runs inside a transaction. */
export async function createCard(input: CreateCardInput, db: Db = defaultDb): Promise<CardRow> {
	const sourceType = input.sourceType ?? CONTENT_SOURCES.PERSONAL;
	if (sourceType !== CONTENT_SOURCES.PERSONAL && !input.sourceRef) {
		throw new Error('source_ref is required when source_type is not personal');
	}

	return await db.transaction(async (tx) => {
		const id = generateCardId();
		const now = new Date();
		const initial = fsrsInitialState(now);

		const [inserted] = await tx
			.insert(card)
			.values({
				id,
				userId: input.userId,
				front: input.front,
				back: input.back,
				domain: input.domain,
				tags: input.tags ?? [],
				cardType: input.cardType,
				sourceType,
				sourceRef: input.sourceRef ?? null,
				isEditable: input.isEditable ?? sourceType === CONTENT_SOURCES.PERSONAL,
				status: CARD_STATUSES.ACTIVE,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		await tx.insert(cardState).values({
			cardId: inserted.id,
			userId: input.userId,
			stability: initial.stability,
			difficulty: initial.difficulty,
			state: initial.state,
			dueAt: initial.dueAt,
			lastReviewId: null,
			reviewCount: 0,
			lapseCount: 0,
		});

		return inserted;
	});
}

/**
 * Update a card's editable fields. Refuses to update non-editable cards
 * (course/product-provided content). Updates updatedAt.
 */
export async function updateCard(
	cardId: string,
	userId: string,
	patch: UpdateCardInput,
	db: Db = defaultDb,
): Promise<CardRow> {
	const [existing] = await db
		.select()
		.from(card)
		.where(and(eq(card.id, cardId), eq(card.userId, userId)))
		.limit(1);
	if (!existing) throw new Error(`Card ${cardId} not found for user ${userId}`);
	if (!existing.isEditable) throw new Error(`Card ${cardId} is not editable`);

	const [updated] = await db
		.update(card)
		.set({
			...patch,
			updatedAt: new Date(),
		})
		.where(and(eq(card.id, cardId), eq(card.userId, userId)))
		.returning();

	return updated;
}

/** Fetch a single card and its scheduler state. Returns null when not found. */
export async function getCard(cardId: string, userId: string, db: Db = defaultDb): Promise<CardWithState | null> {
	const rows = await db
		.select({ card, state: cardState })
		.from(card)
		.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
		.where(and(eq(card.id, cardId), eq(card.userId, userId)))
		.limit(1);
	const row = rows[0];
	if (!row) return null;
	return { card: row.card, state: row.state };
}

/**
 * Load cards that are due now for a user. Batch-limited, ordered by due-time
 * ascending. Skips suspended/archived cards. Suitable for driving the review
 * queue.
 */
export async function getDueCards(
	userId: string,
	limit: number = REVIEW_BATCH_SIZE,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<CardWithState[]> {
	const rows = await db
		.select({ card, state: cardState })
		.from(cardState)
		.innerJoin(card, and(eq(card.id, cardState.cardId), eq(card.userId, cardState.userId)))
		.where(and(eq(cardState.userId, userId), lte(cardState.dueAt, now), eq(card.status, CARD_STATUSES.ACTIVE)))
		.orderBy(asc(cardState.dueAt))
		.limit(limit);

	return rows.map((r) => ({ card: r.card, state: r.state }));
}

/**
 * Browse cards for a user with optional filters. Default order: most recently
 * updated first. Default status filter: everything except archived.
 */
export async function getCards(userId: string, filters: CardFilters = {}, db: Db = defaultDb): Promise<CardRow[]> {
	const statusFilter = filters.status
		? Array.isArray(filters.status)
			? filters.status
			: [filters.status]
		: [CARD_STATUSES.ACTIVE, CARD_STATUSES.SUSPENDED];

	const clauses = [eq(card.userId, userId), inArray(card.status, statusFilter)];

	if (filters.domain) clauses.push(eq(card.domain, filters.domain));
	if (filters.cardType) clauses.push(eq(card.cardType, filters.cardType));
	if (filters.sourceType) clauses.push(eq(card.sourceType, filters.sourceType));
	if (filters.search && filters.search.trim().length > 0) {
		const pattern = `%${filters.search.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
		const front = ilike(card.front, pattern);
		const back = ilike(card.back, pattern);
		const cond = or(front, back);
		if (cond) clauses.push(cond);
	}

	const q = db
		.select()
		.from(card)
		.where(and(...clauses))
		.orderBy(desc(card.updatedAt));

	if (filters.limit !== undefined) q.limit(filters.limit);
	if (filters.offset !== undefined) q.offset(filters.offset);

	return await q;
}

/** Set a card's status (active/suspended/archived). */
export async function setCardStatus(
	cardId: string,
	userId: string,
	status: CardStatus,
	db: Db = defaultDb,
): Promise<CardRow> {
	const [updated] = await db
		.update(card)
		.set({ status, updatedAt: new Date() })
		.where(and(eq(card.id, cardId), eq(card.userId, userId)))
		.returning();
	if (!updated) throw new Error(`Card ${cardId} not found for user ${userId}`);
	return updated;
}
