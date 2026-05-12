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
	CARD_KIND_VALUES,
	CARD_KINDS,
	CARD_STATUSES,
	type CardKind,
	type CardStatus,
	type CardType,
	CONTENT_SOURCES,
	type ContentSource,
	type Domain,
	type QuestionTier,
	REVIEW_BATCH_SIZE,
	SNOOZE_REASONS,
	type SourceAuthority,
} from '@ab/constants';
import { escapeLikePattern } from '@ab/db';
import { db as defaultDb } from '@ab/db/connection';
import { generateCardId } from '@ab/utils';
import { and, asc, desc, eq, ilike, inArray, isNull, lte, or, type SQL, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { SourceRefRequiredError } from './errors';
import { type CardRow, type CardStateRow, card, cardSnooze, cardState } from './schema';
import { fsrsInitialState } from './srs';
import { newCardSchema, updateCardSchema } from './validation';

// Re-exported so `import { SourceRefRequiredError } from './cards'` (and the
// barrel) keeps working. The canonical class lives in `./errors` so the same
// shape is shared with `scenarios.ts`; previously two identically-named
// classes collided at the barrel and `instanceof` checks silently missed
// the scenarios case (chunk-2 dx review).
export { SourceRefRequiredError };

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

/**
 * Raised when a card-kind value is not in `CARD_KIND_VALUES`. Defensive:
 * `newCardSchema` / `updateCardSchema` are the primary defense, but the BC
 * also rejects so cross-BC callers and scripts that bypass the zod schema
 * still hit a typed failure.
 */
export class InvalidCardKindError extends Error {
	constructor(public readonly kind: string) {
		super(`Invalid card kind: ${kind}. Expected one of ${CARD_KIND_VALUES.join(', ')}.`);
		this.name = 'InvalidCardKindError';
	}
}

const CARD_KIND_VALUE_SET = new Set<string>(CARD_KIND_VALUES);

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
	/**
	 * Knowledge-axis kind (recall vs calculation). Distinct from cardType
	 * (presentation form). Drives the per-evidence-kind partition in
	 * mastery.ts. Defaults to `recall` when omitted.
	 */
	kind?: CardKind;
	tags?: string[];
	sourceType?: ContentSource;
	sourceRef?: string | null;
	isEditable?: boolean;
	/**
	 * Optional knowledge-graph node id. When set, the card is linked to the
	 * graph and picks up node-scoped review and mastery aggregation.
	 */
	nodeId?: string | null;
	/**
	 * Audience tier (card-question-tier WP). Promotes the FAA-vs-CFI
	 * distinction from free-form `tags[]` into a typed first-class field.
	 * Omit / null = unclassified.
	 */
	questionTier?: QuestionTier | null;
	/**
	 * Structured citations backing this card's answer (card-question-tier
	 * WP). Each element is `{ kind, cite }`; the kind drives badge / icon
	 * rendering on future surfaces, the cite is the human pointer. Omit /
	 * null = no structured citations.
	 */
	sourceAuthority?: SourceAuthority[] | null;
	/**
	 * ACS task-element codes the card maps to (card-question-tier WP).
	 * Each element matches `ACS_CODE_PATTERN`. Omit / null = no ACS
	 * mapping.
	 */
	acsCodes?: string[] | null;
}

export interface UpdateCardInput {
	front?: string;
	back?: string;
	domain?: Domain;
	cardType?: CardType;
	kind?: CardKind;
	tags?: string[];
	/** card-question-tier WP. Pass `null` to clear, undefined to leave alone. */
	questionTier?: QuestionTier | null;
	sourceAuthority?: SourceAuthority[] | null;
	acsCodes?: string[] | null;
}

export interface CardFilters {
	domain?: Domain;
	cardType?: CardType;
	kind?: CardKind;
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
		kind: input.kind,
		tags: input.tags,
		sourceType: input.sourceType,
		sourceRef: input.sourceRef,
		isEditable: input.isEditable,
		questionTier: input.questionTier,
		sourceAuthority: input.sourceAuthority,
		acsCodes: input.acsCodes,
	});
	const sourceType = (parsed.sourceType ?? CONTENT_SOURCES.PERSONAL) as ContentSource;
	if (sourceType !== CONTENT_SOURCES.PERSONAL && !parsed.sourceRef) {
		throw new SourceRefRequiredError();
	}
	const kind = (parsed.kind ?? CARD_KINDS.RECALL) as CardKind;
	if (!CARD_KIND_VALUE_SET.has(kind)) {
		// Defensive: the zod schema rejects unknown values upstream, but a
		// caller bypassing zod (e.g. a script that constructs a CreateCardInput
		// from raw user input) still hits a typed failure here.
		throw new InvalidCardKindError(kind);
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
				kind,
				sourceType,
				sourceRef: parsed.sourceRef ?? null,
				nodeId: input.nodeId ?? null,
				isEditable: parsed.isEditable ?? sourceType === CONTENT_SOURCES.PERSONAL,
				status: CARD_STATUSES.ACTIVE,
				questionTier: (parsed.questionTier ?? null) as QuestionTier | null,
				sourceAuthority: (parsed.sourceAuthority ?? null) as SourceAuthority[] | null,
				acsCodes: parsed.acsCodes ?? null,
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

	// Wrap the card UPDATE and the bad-question snooze sweep in one
	// transaction so a failure on the second write rolls back the first.
	// Without the wrap a partial failure leaves the card content patched
	// but stale snooze rows still pointing at the old text -- the
	// re-entry banner would never fire and the row drifts silently.
	return await db.transaction(async (tx) => {
		const [existing] = await tx
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
		if (parsed.kind !== undefined) {
			const kind = parsed.kind as CardKind;
			if (!CARD_KIND_VALUE_SET.has(kind)) throw new InvalidCardKindError(kind);
			update.kind = kind;
		}
		if (parsed.tags !== undefined) update.tags = parsed.tags;
		// card-question-tier WP. Pass-through with `null` semantics: undefined
		// means "leave it alone," null means "explicitly clear it." The Zod
		// `nullish()` modifier on the input schema preserves the distinction.
		if (parsed.questionTier !== undefined) update.questionTier = (parsed.questionTier ?? null) as QuestionTier | null;
		if (parsed.sourceAuthority !== undefined) {
			update.sourceAuthority = (parsed.sourceAuthority ?? null) as SourceAuthority[] | null;
		}
		if (parsed.acsCodes !== undefined) update.acsCodes = parsed.acsCodes ?? null;

		const [updated] = await tx
			.update(card)
			.set(update)
			.where(and(eq(card.id, cardId), eq(card.userId, userId)))
			.returning();

		// Mark any active `bad-question` snoozes so the re-entry banner fires
		// the next time this card surfaces in a review. Only triggers on real
		// content changes (front/back/domain/cardType/kind/tags) -- the whitelist
		// above already screens out status-only flips. `kind` flips reframe the
		// question (recall vs calculation) so they count as content changes.
		// Provenance flips (`questionTier`, `sourceAuthority`, `acsCodes`) do
		// NOT count as content changes -- the answer text is unchanged so any
		// active "bad question" snooze should stay active.
		const contentChanged =
			parsed.front !== undefined ||
			parsed.back !== undefined ||
			parsed.domain !== undefined ||
			parsed.cardType !== undefined ||
			parsed.kind !== undefined ||
			parsed.tags !== undefined;
		if (contentChanged) {
			const editedAt = new Date();
			await tx
				.update(cardSnooze)
				.set({ cardEditedAt: editedAt, snoozeUntil: editedAt })
				.where(
					and(
						eq(cardSnooze.cardId, cardId),
						eq(cardSnooze.reason, SNOOZE_REASONS.BAD_QUESTION),
						isNull(cardSnooze.resolvedAt),
						isNull(cardSnooze.cardEditedAt),
					),
				);
		}

		return updated;
	});
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
	/**
	 * When set, narrow the queue to cards in this domain. Used by calibration
	 * CTAs that deep-link "Practice {domain}" into a domain-scoped review.
	 */
	domain?: Domain;
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
	if (options.domain) clauses.push(eq(card.domain, options.domain));

	// Exclude active snoozes via a correlated NOT EXISTS so the query stays a
	// single round-trip and we don't have to materialize a card-id list. A
	// row is active when it is unresolved AND (indefinite OR still in the
	// future). This filters both time-based snoozes and soft-removed cards.
	const notActivelySnoozed = sql`NOT EXISTS (
		SELECT 1 FROM ${cardSnooze}
		WHERE ${cardSnooze.cardId} = ${card.id}
		  AND ${cardSnooze.userId} = ${cardState.userId}
		  AND ${cardSnooze.resolvedAt} IS NULL
		  AND (${cardSnooze.snoozeUntil} IS NULL OR ${cardSnooze.snoozeUntil} > ${now.toISOString()})
	)`;
	clauses.push(notActivelySnoozed);

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
 *
 * Joins per-user `cardState` so browse rows can render the same schedule
 * signals the detail page shows (state, due, stability, last reviewed). The
 * join is an inner join because `createCard` always inserts a paired
 * `cardState` row inside a transaction -- a card without scheduler state is
 * a data-integrity bug, not an expected state.
 */
export async function getCards(
	userId: string,
	filters: CardFilters = {},
	db: Db = defaultDb,
): Promise<CardWithState[]> {
	const statusFilter = filters.status
		? Array.isArray(filters.status)
			? filters.status
			: [filters.status]
		: [CARD_STATUSES.ACTIVE];

	const clauses: SQL[] = [eq(card.userId, userId), inArray(card.status, statusFilter)];

	if (filters.domain) clauses.push(eq(card.domain, filters.domain));
	if (filters.cardType) clauses.push(eq(card.cardType, filters.cardType));
	if (filters.kind) clauses.push(eq(card.kind, filters.kind));
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
		.select({ card, state: cardState })
		.from(card)
		.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
		.where(and(...clauses))
		.orderBy(desc(card.updatedAt))
		.$dynamic();

	if (filters.limit !== undefined && filters.limit > 0) q = q.limit(filters.limit);
	if (filters.offset !== undefined && filters.offset > 0) q = q.offset(filters.offset);

	const rows = await q;
	return rows.map((r) => ({ card: r.card, state: r.state }));
}

/**
 * Count-only companion to `getCards`. Accepts the same `CardFilters` shape
 * (minus `limit`/`offset`, which don't apply to counts) and returns the
 * total-matching-rows integer the browse page needs for pagination display.
 * Lives alongside `getCards` so both read paths share the filter semantics:
 * a drift between the list and the count would show up as "Page 3 of 2".
 */
export async function getCardsCount(
	userId: string,
	filters: Omit<CardFilters, 'limit' | 'offset'> = {},
	db: Db = defaultDb,
): Promise<number> {
	const statusFilter = filters.status
		? Array.isArray(filters.status)
			? filters.status
			: [filters.status]
		: [CARD_STATUSES.ACTIVE];

	const clauses: SQL[] = [eq(card.userId, userId), inArray(card.status, statusFilter)];

	if (filters.domain) clauses.push(eq(card.domain, filters.domain));
	if (filters.cardType) clauses.push(eq(card.cardType, filters.cardType));
	if (filters.kind) clauses.push(eq(card.kind, filters.kind));
	if (filters.sourceType) clauses.push(eq(card.sourceType, filters.sourceType));
	if (filters.nodeId) clauses.push(eq(card.nodeId, filters.nodeId));
	if (filters.search && filters.search.trim().length > 0) {
		const pattern = `%${escapeLikePattern(filters.search.trim())}%`;
		const cond = or(ilike(card.front, pattern), ilike(card.back, pattern));
		if (cond) clauses.push(cond);
	}

	const [row] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(card)
		.where(and(...clauses));
	return Number(row?.total ?? 0);
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

/**
 * Row shape returned by `getRemovedCards` -- a card paired with its scheduler
 * state and the snooze row that represents the removal so the UI can render
 * the Restore affordance (and expose the comment / removed-at timestamp).
 */
export interface RemovedCardRow {
	card: CardRow;
	state: CardStateRow;
	snoozeId: string;
	removedAt: Date;
	comment: string | null;
}

export interface RemovedCardsFilters {
	domain?: Domain;
	cardType?: CardType;
	kind?: CardKind;
	sourceType?: ContentSource;
	search?: string;
	limit?: number;
	offset?: number;
}

/**
 * Load cards the user has soft-removed (active `card_snooze(reason='remove')`
 * rows). Mirrors `getCards` filter surface so the Browse `Removed` filter
 * reuses the same domain / type / source / search controls, but the data
 * source is the snooze row + its joined card + state.
 */
export async function getRemovedCards(
	userId: string,
	filters: RemovedCardsFilters = {},
	db: Db = defaultDb,
): Promise<RemovedCardRow[]> {
	const clauses: SQL[] = [
		eq(cardSnooze.userId, userId),
		eq(cardSnooze.reason, SNOOZE_REASONS.REMOVE),
		isNull(cardSnooze.resolvedAt),
		eq(card.userId, userId),
	];
	if (filters.domain) clauses.push(eq(card.domain, filters.domain));
	if (filters.cardType) clauses.push(eq(card.cardType, filters.cardType));
	if (filters.kind) clauses.push(eq(card.kind, filters.kind));
	if (filters.sourceType) clauses.push(eq(card.sourceType, filters.sourceType));
	if (filters.search && filters.search.trim().length > 0) {
		const pattern = `%${escapeLikePattern(filters.search.trim())}%`;
		const cond = or(ilike(card.front, pattern), ilike(card.back, pattern));
		if (cond) clauses.push(cond);
	}

	let q = db
		.select({
			card,
			state: cardState,
			snoozeId: cardSnooze.id,
			removedAt: cardSnooze.createdAt,
			comment: cardSnooze.comment,
		})
		.from(cardSnooze)
		.innerJoin(card, eq(card.id, cardSnooze.cardId))
		.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
		.where(and(...clauses))
		.orderBy(desc(cardSnooze.createdAt))
		.$dynamic();

	if (filters.limit !== undefined && filters.limit > 0) q = q.limit(filters.limit);
	if (filters.offset !== undefined && filters.offset > 0) q = q.offset(filters.offset);

	const rows = await q;
	return rows.map((r) => ({
		card: r.card,
		state: r.state,
		snoozeId: r.snoozeId,
		removedAt: r.removedAt,
		comment: r.comment,
	}));
}

/** Count companion to `getRemovedCards`. Same filter shape minus pagination. */
export async function getRemovedCardsCount(
	userId: string,
	filters: Omit<RemovedCardsFilters, 'limit' | 'offset'> = {},
	db: Db = defaultDb,
): Promise<number> {
	const clauses: SQL[] = [
		eq(cardSnooze.userId, userId),
		eq(cardSnooze.reason, SNOOZE_REASONS.REMOVE),
		isNull(cardSnooze.resolvedAt),
		eq(card.userId, userId),
	];
	if (filters.domain) clauses.push(eq(card.domain, filters.domain));
	if (filters.cardType) clauses.push(eq(card.cardType, filters.cardType));
	if (filters.kind) clauses.push(eq(card.kind, filters.kind));
	if (filters.sourceType) clauses.push(eq(card.sourceType, filters.sourceType));
	if (filters.search && filters.search.trim().length > 0) {
		const pattern = `%${escapeLikePattern(filters.search.trim())}%`;
		const cond = or(ilike(card.front, pattern), ilike(card.back, pattern));
		if (cond) clauses.push(cond);
	}
	const [row] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(cardSnooze)
		.innerJoin(card, eq(card.id, cardSnooze.cardId))
		.where(and(...clauses));
	return Number(row?.total ?? 0);
}

/**
 * Per-facet bucket counts so the Browse filter UI can show "Domain (12)"
 * style hints next to each option. Each facet is computed against the
 * *other* active filters -- e.g. the `domain` facet counts respect the
 * user's chosen `cardType` / `sourceType` / `search` so the numbers
 * always tell the user "if I pick X, I'll see Y cards with my current
 * filters."
 *
 * Excludes the "removed" virtual status because removed cards live in
 * `card_snooze`, not `card`. The browse page calls this only for the
 * non-removed paths.
 */
export interface CardsFacetCounts {
	domain: Record<string, number>;
	cardType: Record<string, number>;
	sourceType: Record<string, number>;
	status: Record<string, number>;
}

export async function getCardsFacetCounts(
	userId: string,
	filters: Omit<CardFilters, 'limit' | 'offset'> = {},
	db: Db = defaultDb,
): Promise<CardsFacetCounts> {
	const baseClauses: SQL[] = [eq(card.userId, userId)];
	if (filters.nodeId) baseClauses.push(eq(card.nodeId, filters.nodeId));
	if (filters.search && filters.search.trim().length > 0) {
		const pattern = `%${escapeLikePattern(filters.search.trim())}%`;
		const cond = or(ilike(card.front, pattern), ilike(card.back, pattern));
		if (cond) baseClauses.push(cond);
	}

	const statusFilter = filters.status
		? Array.isArray(filters.status)
			? filters.status
			: [filters.status]
		: [CARD_STATUSES.ACTIVE];

	const withExcept = (exclude: 'domain' | 'cardType' | 'kind' | 'sourceType' | 'status'): SQL[] => {
		const c = [...baseClauses];
		if (exclude !== 'status') c.push(inArray(card.status, statusFilter));
		if (exclude !== 'domain' && filters.domain) c.push(eq(card.domain, filters.domain));
		if (exclude !== 'cardType' && filters.cardType) c.push(eq(card.cardType, filters.cardType));
		if (exclude !== 'kind' && filters.kind) c.push(eq(card.kind, filters.kind));
		if (exclude !== 'sourceType' && filters.sourceType) c.push(eq(card.sourceType, filters.sourceType));
		return c;
	};

	const [domainRows, typeRows, sourceRows, statusRows] = await Promise.all([
		db
			.select({ key: card.domain, n: sql<number>`count(*)::int` })
			.from(card)
			.where(and(...withExcept('domain')))
			.groupBy(card.domain),
		db
			.select({ key: card.cardType, n: sql<number>`count(*)::int` })
			.from(card)
			.where(and(...withExcept('cardType')))
			.groupBy(card.cardType),
		db
			.select({ key: card.sourceType, n: sql<number>`count(*)::int` })
			.from(card)
			.where(and(...withExcept('sourceType')))
			.groupBy(card.sourceType),
		db
			.select({ key: card.status, n: sql<number>`count(*)::int` })
			.from(card)
			.where(and(...withExcept('status')))
			.groupBy(card.status),
	]);

	const toRecord = (rows: Array<{ key: string; n: number }>): Record<string, number> => {
		const out: Record<string, number> = {};
		for (const r of rows) out[r.key] = Number(r.n);
		return out;
	};

	return {
		domain: toRecord(domainRows),
		cardType: toRecord(typeRows),
		sourceType: toRecord(sourceRows),
		status: toRecord(statusRows),
	};
}

/**
 * Read every active card on a given (user, node) filtered by knowledge kind
 * (recall vs calculation). Powers the per-evidence-kind partition in
 * `mastery.ts` and the `bun run db check card-kinds` audit script.
 *
 * Backed by the (user_id, kind) index so the lookup stays bounded even on a
 * large per-user card pool. evidence-kind-data-layer WP.
 */
export async function getCardsForNodeByKind(
	userId: string,
	nodeId: string,
	kind: CardKind,
	db: Db = defaultDb,
): Promise<CardRow[]> {
	if (!CARD_KIND_VALUE_SET.has(kind)) throw new InvalidCardKindError(kind);
	return await db
		.select()
		.from(card)
		.where(
			and(eq(card.userId, userId), eq(card.nodeId, nodeId), eq(card.kind, kind), eq(card.status, CARD_STATUSES.ACTIVE)),
		)
		.orderBy(asc(card.createdAt));
}
