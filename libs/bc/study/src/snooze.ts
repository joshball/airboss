/**
 * Snooze BC -- learner actions that push a card out of the review queue
 * without polluting the FSRS signal.
 *
 * Four reason codes drive different lifecycles (see ADR / spec
 * `docs/work-packages/snooze-and-flag/spec.md`):
 *
 * - `bad-question`  -- comment required; `snooze_until` stays NULL while
 *   waiting on an author edit. When the underlying card is updated, the
 *   next-session card-scheduler marks `card_edited_at` so the re-entry
 *   banner fires once.
 * - `wrong-domain`  -- comment required; long snooze (60d default).
 * - `know-it-bored` -- no comment; short/medium/long duration by caller.
 * - `remove`        -- comment required; `snooze_until` NULL, partial
 *   UNIQUE index enforces one active remove per (card, user).
 *
 * Active-snooze semantics: `resolved_at IS NULL AND (snooze_until IS NULL
 * OR snooze_until > now())`. `getDueCards` and `getCards(status='removed')`
 * honour this shape.
 */

import {
	CARD_STATUSES,
	MS_PER_DAY,
	REVIEW_BATCH_SIZE,
	SNOOZE_DURATION_DAYS,
	SNOOZE_REASONS,
	SNOOZE_REASONS_REQUIRING_COMMENT,
	type SnoozeDurationLevel,
	type SnoozeReason,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { generateCardSnoozeId } from '@ab/utils';
import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { CardNotFoundError } from './cards';
import { type CardSnoozeRow, card, cardSnooze, cardState } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Raised when a caller picks a reason that requires a comment but omits it. */
export class SnoozeCommentRequiredError extends Error {
	constructor(public readonly reason: SnoozeReason) {
		super(`Snooze reason '${reason}' requires a comment`);
		this.name = 'SnoozeCommentRequiredError';
	}
}

/** Raised when a caller tries to snooze a card they already soft-removed. */
export class CardAlreadyRemovedError extends Error {
	constructor(
		public readonly cardId: string,
		public readonly userId: string,
	) {
		super(`Card ${cardId} is already removed for user ${userId}`);
		this.name = 'CardAlreadyRemovedError';
	}
}

/** Raised when a caller tries to resolve a snooze row that is already resolved or not found. */
export class SnoozeNotFoundError extends Error {
	constructor(public readonly snoozeId: string) {
		super(`Active snooze ${snoozeId} not found`);
		this.name = 'SnoozeNotFoundError';
	}
}

export interface SnoozeCardInput {
	cardId: string;
	userId: string;
	reason: SnoozeReason;
	comment?: string | null;
	/**
	 * Duration level for time-based reasons. Ignored for `remove` and for
	 * `bad-question` with indefinite wait-for-edit semantics. Required for
	 * `know-it-bored` and `wrong-domain`.
	 */
	durationLevel?: SnoozeDurationLevel | null;
	/**
	 * Marker that the caller wants `bad-question` to wait on an author edit
	 * rather than a fixed duration. When true AND reason=`bad-question`,
	 * `snooze_until` is left NULL. Ignored for other reasons.
	 */
	waitForEdit?: boolean;
}

/**
 * Ensure that the (card, user) pair is actually a card the user owns (or has
 * access to). Reuses the card_state row to avoid a second card-ownership
 * query; card_state exists iff the user has the card in their deck.
 */
async function ensureCardExistsForUser(db: Db, cardId: string, userId: string): Promise<void> {
	const [existing] = await db
		.select({ cardId: cardState.cardId })
		.from(cardState)
		.where(and(eq(cardState.cardId, cardId), eq(cardState.userId, userId)))
		.limit(1);
	if (!existing) throw new CardNotFoundError(cardId, userId);
}

/**
 * Snooze a card. Validates comment-requirement, resolves duration into a
 * `snooze_until` timestamp, and inserts one row.
 */
export async function snoozeCard(input: SnoozeCardInput, db: Db = defaultDb): Promise<CardSnoozeRow> {
	const comment = input.comment?.trim() ?? null;
	if ((SNOOZE_REASONS_REQUIRING_COMMENT as readonly SnoozeReason[]).includes(input.reason)) {
		if (!comment) throw new SnoozeCommentRequiredError(input.reason);
	}

	await ensureCardExistsForUser(db, input.cardId, input.userId);

	if (input.reason === SNOOZE_REASONS.REMOVE) {
		// Partial UNIQUE index enforces "one active remove per (card, user)"
		// at the DB; this check gives the caller a typed error instead of a
		// violation. Drizzle surfaces DB errors as opaque Error, so the
		// explicit read keeps the API honest.
		const [existingRemove] = await db
			.select({ id: cardSnooze.id })
			.from(cardSnooze)
			.where(
				and(
					eq(cardSnooze.cardId, input.cardId),
					eq(cardSnooze.userId, input.userId),
					eq(cardSnooze.reason, SNOOZE_REASONS.REMOVE),
					isNull(cardSnooze.resolvedAt),
				),
			)
			.limit(1);
		if (existingRemove) throw new CardAlreadyRemovedError(input.cardId, input.userId);
	}

	const now = new Date();
	let snoozeUntil: Date | null = null;
	let durationLevel: SnoozeDurationLevel | null = null;

	if (input.reason === SNOOZE_REASONS.REMOVE) {
		snoozeUntil = null;
		durationLevel = null;
	} else if (input.reason === SNOOZE_REASONS.BAD_QUESTION && input.waitForEdit) {
		// Indefinite; wait for the author to edit the card.
		snoozeUntil = null;
		durationLevel = input.durationLevel ?? null;
	} else if (input.durationLevel) {
		durationLevel = input.durationLevel;
		const days = SNOOZE_DURATION_DAYS[input.durationLevel];
		snoozeUntil = new Date(now.getTime() + days * MS_PER_DAY);
	} else {
		// No duration supplied and not a wait-for-edit row. Fall back to a
		// sensible default by reason so callers can opt into brevity.
		const days = SNOOZE_DURATION_DAYS.medium;
		durationLevel = 'medium';
		snoozeUntil = new Date(now.getTime() + days * MS_PER_DAY);
	}

	const [inserted] = await db
		.insert(cardSnooze)
		.values({
			id: generateCardSnoozeId(),
			cardId: input.cardId,
			userId: input.userId,
			reason: input.reason,
			comment,
			durationLevel,
			snoozeUntil,
			resolvedAt: null,
			cardEditedAt: null,
			createdAt: now,
		})
		.returning();
	return inserted;
}

export interface RemoveCardInput {
	cardId: string;
	userId: string;
	comment: string;
}

/**
 * Soft-remove a card (reason=`remove`). Thin wrapper around `snoozeCard` that
 * documents intent at call sites and enforces the comment requirement.
 */
export async function removeCard(input: RemoveCardInput, db: Db = defaultDb): Promise<CardSnoozeRow> {
	return snoozeCard(
		{
			cardId: input.cardId,
			userId: input.userId,
			reason: SNOOZE_REASONS.REMOVE,
			comment: input.comment,
		},
		db,
	);
}

export interface RestoreCardInput {
	snoozeId: string;
	userId: string;
}

/**
 * Restore a soft-removed card by resolving its active `remove` row. Only the
 * user who owns the row can resolve it; the partial UNIQUE index then allows
 * a future re-remove.
 */
export async function restoreCard(input: RestoreCardInput, db: Db = defaultDb): Promise<CardSnoozeRow> {
	const now = new Date();
	const [updated] = await db
		.update(cardSnooze)
		.set({ resolvedAt: now })
		.where(
			and(
				eq(cardSnooze.id, input.snoozeId),
				eq(cardSnooze.userId, input.userId),
				eq(cardSnooze.reason, SNOOZE_REASONS.REMOVE),
				isNull(cardSnooze.resolvedAt),
			),
		)
		.returning();
	if (!updated) throw new SnoozeNotFoundError(input.snoozeId);
	return updated;
}

/**
 * Restore a soft-removed card by (cardId, userId) instead of snoozeId. The
 * Browse "Restore" action has the card but not the snooze row id in hand, and
 * looking it up twice (list -> action) adds a round-trip for no benefit.
 */
export async function restoreCardByCard(cardId: string, userId: string, db: Db = defaultDb): Promise<CardSnoozeRow> {
	const now = new Date();
	const [updated] = await db
		.update(cardSnooze)
		.set({ resolvedAt: now })
		.where(
			and(
				eq(cardSnooze.cardId, cardId),
				eq(cardSnooze.userId, userId),
				eq(cardSnooze.reason, SNOOZE_REASONS.REMOVE),
				isNull(cardSnooze.resolvedAt),
			),
		)
		.returning();
	if (!updated) throw new SnoozeNotFoundError(`${cardId}:${userId}`);
	return updated;
}

/**
 * List the user's active snoozes. "Active" = not resolved AND
 * (indefinite OR snooze_until still in the future). The review queue filter
 * uses this list to exclude card ids from the FSRS due read.
 */
export async function getActiveSnoozes(
	userId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<CardSnoozeRow[]> {
	return db
		.select()
		.from(cardSnooze)
		.where(
			and(
				eq(cardSnooze.userId, userId),
				isNull(cardSnooze.resolvedAt),
				or(isNull(cardSnooze.snoozeUntil), gt(cardSnooze.snoozeUntil, now)),
			),
		);
}

/**
 * Resolve a `bad-question` snooze for (cardId, userId) when the learner
 * re-rates the card after the author edit. Called from the review submit
 * path; idempotent when no row exists or the row is already resolved.
 */
export async function resolveBadQuestionSnooze(cardId: string, userId: string, db: Db = defaultDb): Promise<void> {
	await db
		.update(cardSnooze)
		.set({ resolvedAt: new Date() })
		.where(
			and(
				eq(cardSnooze.cardId, cardId),
				eq(cardSnooze.userId, userId),
				eq(cardSnooze.reason, SNOOZE_REASONS.BAD_QUESTION),
				isNull(cardSnooze.resolvedAt),
			),
		);
}

/**
 * Mark any active `bad-question` snoozes for this card as "card edited since
 * snooze" so the review queue can re-surface the card with a banner. Called
 * from `updateCard` when the card is actually mutated (not from status-only
 * flips like suspend/archive).
 *
 * `snoozeUntil` is forced to `now` so the active-filter in `getActiveSnoozes`
 * drops the row, letting the scheduler consider the card again.
 */
export async function markCardEditedForActiveBadQuestionSnoozes(
	cardId: string,
	db: Db = defaultDb,
	editedAt: Date = new Date(),
): Promise<void> {
	await db
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

/**
 * Find the most recent unresolved `bad-question` snooze for (cardId, userId)
 * with `cardEditedAt` set. The review route uses this to decide whether to
 * render the re-entry banner over the card.
 *
 * Returns the row if it exists, otherwise null. The banner shows once; when
 * the learner submits a rating the review flow calls
 * `resolveBadQuestionSnooze` which flips `resolved_at` and suppresses future
 * appearances.
 */
export async function getUnresolvedReEntrySnooze(
	cardId: string,
	userId: string,
	db: Db = defaultDb,
): Promise<CardSnoozeRow | null> {
	const [row] = await db
		.select()
		.from(cardSnooze)
		.where(
			and(
				eq(cardSnooze.cardId, cardId),
				eq(cardSnooze.userId, userId),
				eq(cardSnooze.reason, SNOOZE_REASONS.BAD_QUESTION),
				isNull(cardSnooze.resolvedAt),
				sql`"card_edited_at" IS NOT NULL`,
			),
		)
		.orderBy(desc(cardSnooze.createdAt))
		.limit(1);
	return row ?? null;
}

export interface ReplacementCardResult {
	cardId: string;
	isNew: boolean;
}

/**
 * Same-domain replacement card for the "remove" action. First tries a due
 * card in the same domain that is not already in the session's `afterCardId`
 * context and not itself snoozed/removed; falls back to a new card in the
 * same domain if nothing is due. Returns null when neither exists so the
 * caller can shrink the session.
 */
export async function getReplacementCard(
	opts: { userId: string; afterCardId: string; domain: string },
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<ReplacementCardResult | null> {
	// Active snoozed / removed card ids to exclude from both legs.
	const snoozedIds = await getActiveSnoozes(opts.userId, db, now);
	const excludeIds = new Set<string>([opts.afterCardId, ...snoozedIds.map((s) => s.cardId)]);

	// Leg 1: same-domain due (inner join card+cardState). Intentionally
	// skip graph / cross-domain heuristics; the spec wants a boring,
	// predictable replacement.
	const dueRows = await db
		.select({
			cardId: card.id,
			dueAt: cardState.dueAt,
		})
		.from(cardState)
		.innerJoin(card, and(eq(card.id, cardState.cardId), eq(card.userId, cardState.userId)))
		.where(
			and(
				eq(card.userId, opts.userId),
				eq(card.domain, opts.domain),
				eq(card.status, CARD_STATUSES.ACTIVE),
				sql`"due_at" <= ${now.toISOString()}`,
			),
		)
		.orderBy(cardState.dueAt)
		.limit(REVIEW_BATCH_SIZE);

	for (const row of dueRows) {
		if (!excludeIds.has(row.cardId)) {
			return { cardId: row.cardId, isNew: false };
		}
	}

	// Leg 2: same-domain, never reviewed. `card_state.state = 'new'` marks
	// untouched cards. Filter by `card.status = 'active'` so suspended/archived
	// cards don't sneak through as replacements.
	const newRows = await db
		.select({ cardId: card.id })
		.from(cardState)
		.innerJoin(card, and(eq(card.id, cardState.cardId), eq(card.userId, cardState.userId)))
		.where(
			and(
				eq(card.userId, opts.userId),
				eq(card.domain, opts.domain),
				eq(card.status, CARD_STATUSES.ACTIVE),
				eq(cardState.state, 'new'),
			),
		)
		.orderBy(card.createdAt)
		.limit(REVIEW_BATCH_SIZE);

	for (const row of newRows) {
		if (!excludeIds.has(row.cardId)) {
			return { cardId: row.cardId, isNew: true };
		}
	}

	return null;
}
