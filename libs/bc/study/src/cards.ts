/**
 * Card BC functions.
 *
 * Own the card lifecycle: create, read, update status, and read-back with
 * per-user scheduler state. FSRS math lives in srs.ts; these functions only
 * persist the pre/post-scheduling state.
 *
 * Inputs are validated here (in addition to the route layer) so cross-BC
 * callers and scripts can't inject invalid values.
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
import { db as defaultDb, escapeLikePattern } from '@ab/db';
import { generateCardId } from '@ab/utils';
import { and, asc, desc, eq, ilike, inArray, lte, or, type SQL } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type CardRow, type CardStateRow, card, cardState } from './schema';
import { fsrsInitialState } from './srs';
import { newCardSchema, updateCardSchema } from './validation';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Raised when a card can't be found for the given user. */
export class CardNotFoundError extends Error {
	constructor(
		public readonly cardId: string,
		public readonly userId: string,
	) {
		super(`Card ${cardId} not found for user ${userId}`);
		this.name = 'CardNotFoundError';
	}
}

/** Raised when caller tries to edit a card that is not editable (course/product cards). */
export class CardNotEditableError extends Error {
	constructor(public readonly cardId: string) {
		super(`Card ${cardId} is not editable`);
		this.name = 'CardNotEditableError';
	}
}

/** Raised when sourceType requires sourceRef but none was supplied. */
export class SourceRefRequiredError extends Error {
	constructor() {
		super('source_ref is required when source_type is not personal');
		this.name = 'SourceRefRequiredError';
	}
}

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
	/**
	 * Optional knowledge-graph node id. When set, the card is linked to the
	 * graph and picks up node-scoped review and mastery aggregation.
	 */
	nodeId?: string | null;
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
	/** Scope results to cards attached to a knowledge-graph node. */
	nodeId?: string;
	limit?: number;
	offset?: number;
}

/** Create a new card and its initial card_state row. Runs inside a transaction. */
export async function createCard(input: CreateCardInput, db: Db = defaultDb): Promise<CardRow> {
	const parsed = newCardSchema.parse({
		front: input.front,
		back: input.back,
		domain: input.domain,
		cardType: input.cardType,
		tags: input.tags,
		sourceType: input.sourceType,
		sourceRef: input.sourceRef,
		isEditable: input.isEditable,
	});
	const sourceType = (parsed.sourceType ?? CONTENT_SOURCES.PERSONAL) as ContentSource;
	if (sourceType !== CONTENT_SOURCES.PERSONAL && !parsed.sourceRef) {
		throw new SourceRefRequiredError();
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
				front: parsed.front,
				back: parsed.back,
				domain: parsed.domain as Domain,
				tags: parsed.tags ?? [],
				cardType: parsed.cardType as CardType,
				sourceType,
				sourceRef: parsed.sourceRef ?? null,
				nodeId: input.nodeId ?? null,
				isEditable: parsed.isEditable ?? sourceType === CONTENT_SOURCES.PERSONAL,
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
			lastReviewedAt: null,
			reviewCount: 0,
			lapseCount: 0,
		});

		return inserted;
	});
}

/**
 * Update a card's editable fields. Refuses to update non-editable cards
 * (course/product-provided content). Only the fields declared in
 * UpdateCardInput are copied -- status, sourceType, userId, and isEditable
 * cannot be changed via this path.
 */
export async function updateCard(
	cardId: string,
	userId: string,
	patch: UpdateCardInput,
	db: Db = defaultDb,
): Promise<CardRow> {
	const parsed = updateCardSchema.parse(patch);

	const [existing] = await db
		.select()
		.from(card)
		.where(and(eq(card.id, cardId), eq(card.userId, userId)))
		.limit(1);
	if (!existing) throw new CardNotFoundError(cardId, userId);
	if (!existing.isEditable) throw new CardNotEditableError(cardId);

	// Whitelist explicitly so Drizzle can't accept extra keys slipped in by a
	// caller that bypasses TypeScript.
	const update: Partial<CardRow> = { updatedAt: new Date() };
	if (parsed.front !== undefined) update.front = parsed.front;
	if (parsed.back !== undefined) update.back = parsed.back;
	if (parsed.domain !== undefined) update.domain = parsed.domain as Domain;
	if (parsed.cardType !== undefined) update.cardType = parsed.cardType as CardType;
	if (parsed.tags !== undefined) update.tags = parsed.tags;

	const [updated] = await db
		.update(card)
		.set(update)
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

/** Options accepted by `getDueCards` alongside the batch limit. */
export interface DueCardsOptions {
	limit?: number;
	/**
	 * When set, narrow the queue to cards attached to this knowledge node.
	 * Cards without a node are excluded even if due; the caller asked for
	 * a node-scoped session.
	 */
	nodeId?: string;
}

/**
 * Load cards that are due now for a user. Batch-limited, ordered by due-time
 * ascending. Skips suspended/archived cards. Suitable for driving the review
 * queue.
 *
 * The second positional parameter accepts either a plain number (legacy
 * callers that only supply a batch limit) or an options bag that can also
 * carry a `nodeId` filter. Passing no second argument uses the default batch
 * size and no node filter.
 */
export async function getDueCards(
	userId: string,
	limitOrOptions: number | DueCardsOptions = REVIEW_BATCH_SIZE,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<CardWithState[]> {
	const options: DueCardsOptions = typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : limitOrOptions;
	const limit = options.limit ?? REVIEW_BATCH_SIZE;

	const clauses: SQL[] = [
		eq(cardState.userId, userId),
		lte(cardState.dueAt, now),
		eq(card.status, CARD_STATUSES.ACTIVE),
	];
	if (options.nodeId) clauses.push(eq(card.nodeId, options.nodeId));

	const rows = await db
		.select({ card, state: cardState })
		.from(cardState)
		.innerJoin(card, and(eq(card.id, cardState.cardId), eq(card.userId, cardState.userId)))
		.where(and(...clauses))
		.orderBy(asc(cardState.dueAt))
		.limit(limit);

	return rows.map((r) => ({ card: r.card, state: r.state }));
}

/**
 * Browse cards for a user with optional filters. Default order: most recently
 * updated first. Default status filter: active only. Pass an explicit status
 * filter to include suspended or archived cards.
 */
export async function getCards(userId: string, filters: CardFilters = {}, db: Db = defaultDb): Promise<CardRow[]> {
	const statusFilter = filters.status
		? Array.isArray(filters.status)
			? filters.status
			: [filters.status]
		: [CARD_STATUSES.ACTIVE];

	const clauses: SQL[] = [eq(card.userId, userId), inArray(card.status, statusFilter)];

	if (filters.domain) clauses.push(eq(card.domain, filters.domain));
	if (filters.cardType) clauses.push(eq(card.cardType, filters.cardType));
	if (filters.sourceType) clauses.push(eq(card.sourceType, filters.sourceType));
	if (filters.nodeId) clauses.push(eq(card.nodeId, filters.nodeId));
	if (filters.search && filters.search.trim().length > 0) {
		const pattern = `%${escapeLikePattern(filters.search.trim())}%`;
		const cond = or(ilike(card.front, pattern), ilike(card.back, pattern));
		if (cond) clauses.push(cond);
	}

	// Drizzle's query builder returns a new object per chained call; reassign
	// rather than mutate so limit/offset are actually applied.
	let q = db
		.select()
		.from(card)
		.where(and(...clauses))
		.orderBy(desc(card.updatedAt))
		.$dynamic();

	if (filters.limit !== undefined && filters.limit > 0) q = q.limit(filters.limit);
	if (filters.offset !== undefined && filters.offset > 0) q = q.offset(filters.offset);

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
	if (!updated) throw new CardNotFoundError(cardId, userId);
	return updated;
}
