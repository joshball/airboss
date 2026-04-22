/**
 * Review submission.
 *
 * Single entry point: submitReview. Reads the current card_state, runs FSRS,
 * inserts a new review row, and upserts the card_state within one transaction.
 *
 * Two important integrity properties:
 *
 *   - Idempotency: a duplicate call within REVIEW_DEDUPE_WINDOW_MS returns the
 *     existing review row instead of inserting a new one. The card_state row
 *     is locked FOR UPDATE at the start of the tx so concurrent submits
 *     serialize, preventing both from seeing "no recent review" and inserting.
 *
 *   - Correct elapsed_days: the FSRS scheduler needs the actual lastReviewedAt
 *     to compute elapsed days (otherwise it emits elapsed_days=0 and takes the
 *     short-term-stability path on every review). We denormalize lastReviewedAt
 *     on card_state specifically to avoid an extra review-history lookup here.
 */

import {
	CARD_STATES,
	CARD_STATUSES,
	type CardState,
	type ConfidenceLevel,
	REVIEW_DEDUPE_WINDOW_MS,
	type ReviewRating,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { generateReviewId } from '@ab/utils';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { CardNotFoundError } from './cards';
import { card, cardState, type ReviewRow, review } from './schema';
import { fsrsInitialState, fsrsSchedule } from './srs';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Raised when trying to review a card whose status is not active. */
export class CardNotReviewableError extends Error {
	constructor(
		public readonly cardId: string,
		public readonly status: string,
	) {
		super(`Card ${cardId} is ${status} and cannot be reviewed`);
		this.name = 'CardNotReviewableError';
	}
}

export interface SubmitReviewInput {
	cardId: string;
	userId: string;
	rating: ReviewRating;
	confidence?: ConfidenceLevel | null;
	answerMs?: number | null;
}

export async function submitReview(input: SubmitReviewInput, db: Db = defaultDb): Promise<ReviewRow> {
	const now = new Date();
	const windowStart = new Date(now.getTime() - REVIEW_DEDUPE_WINDOW_MS);

	return await db.transaction(async (tx) => {
		// Lock the card_state row for this (card, user) so concurrent submits
		// serialize. Confirms the card exists for the user at the same time.
		const stateRows = await tx
			.select({ card, state: cardState })
			.from(cardState)
			.innerJoin(card, and(eq(card.id, cardState.cardId), eq(card.userId, cardState.userId)))
			.where(and(eq(cardState.cardId, input.cardId), eq(cardState.userId, input.userId)))
			.for('update')
			.limit(1);
		const row = stateRows[0];
		if (!row) throw new CardNotFoundError(input.cardId, input.userId);

		// Refuse reviews for cards whose lifecycle status blocks review. The
		// server trusts the DB, not a stale client state that may still show
		// the card in its queue.
		if (row.card.status !== CARD_STATUSES.ACTIVE) {
			throw new CardNotReviewableError(input.cardId, row.card.status);
		}

		// Idempotency: another submit within the window returns that row.
		// The row lock above guarantees this check sees any committed insert
		// from a concurrent transaction on the same (card, user). The review
		// insert and card_state update share this tx, so a return here leaves
		// the scheduler in a consistent state.
		const [recent] = await tx
			.select()
			.from(review)
			.where(and(eq(review.cardId, input.cardId), eq(review.userId, input.userId), gte(review.reviewedAt, windowStart)))
			.orderBy(desc(review.reviewedAt))
			.limit(1);
		if (recent) return recent;

		const prevState = row.state.state as CardState;

		const result = fsrsSchedule(
			{
				stability: row.state.stability,
				difficulty: row.state.difficulty,
				state: prevState,
				dueAt: row.state.dueAt,
				lastReview: row.state.lastReviewedAt ?? null,
				reviewCount: row.state.reviewCount,
				lapseCount: row.state.lapseCount,
			},
			input.rating,
			now,
		);

		// Insert the new review row.
		const reviewId = generateReviewId();
		const [inserted] = await tx
			.insert(review)
			.values({
				id: reviewId,
				cardId: input.cardId,
				userId: input.userId,
				rating: input.rating,
				confidence: input.confidence ?? null,
				stability: result.stability,
				difficulty: result.difficulty,
				elapsedDays: result.elapsedDays,
				scheduledDays: result.scheduledDays,
				state: result.state,
				dueAt: result.dueAt,
				reviewedAt: now,
				answerMs: input.answerMs ?? null,
			})
			.returning();

		// lapseCount bumps when a card moves from review into relearning.
		const newLapseCount =
			prevState === CARD_STATES.REVIEW && result.state === CARD_STATES.RELEARNING
				? row.state.lapseCount + 1
				: row.state.lapseCount;

		await tx
			.update(cardState)
			.set({
				stability: result.stability,
				difficulty: result.difficulty,
				state: result.state,
				dueAt: result.dueAt,
				lastReviewId: reviewId,
				lastReviewedAt: now,
				reviewCount: row.state.reviewCount + 1,
				lapseCount: newLapseCount,
			})
			.where(and(eq(cardState.cardId, input.cardId), eq(cardState.userId, input.userId)));

		return inserted;
	});
}

/** Raised when undo is requested but no matching review row exists. */
export class NoReviewToUndoError extends Error {
	constructor(
		public readonly cardId: string,
		public readonly userId: string,
	) {
		super(`No review to undo for card ${cardId}, user ${userId}`);
		this.name = 'NoReviewToUndoError';
	}
}

/**
 * Undo the most-recent review for a (card, user) pair and restore `card_state`
 * to what it was before that review.
 *
 * The last `review` row is deleted. The card_state is rebuilt from whichever
 * row now tops the review history: that row's post-review scheduler output
 * becomes the current state. If no prior review exists, state falls back to
 * the FSRS initial state.
 *
 * This is a safety net for the review-rating undo window. Callers are expected
 * to invoke this within a few seconds of `submitReview`; the function itself
 * does not enforce a window.
 */
export async function undoReview(cardId: string, userId: string, db: Db = defaultDb): Promise<ReviewRow> {
	return await db.transaction(async (tx) => {
		// Lock card_state; guarantees serialization against another concurrent submit.
		const stateRows = await tx
			.select({ state: cardState })
			.from(cardState)
			.where(and(eq(cardState.cardId, cardId), eq(cardState.userId, userId)))
			.for('update')
			.limit(1);
		const stateRow = stateRows[0];
		if (!stateRow) throw new CardNotFoundError(cardId, userId);

		const [latest] = await tx
			.select()
			.from(review)
			.where(and(eq(review.cardId, cardId), eq(review.userId, userId)))
			.orderBy(desc(review.reviewedAt))
			.limit(1);
		if (!latest) throw new NoReviewToUndoError(cardId, userId);

		await tx.delete(review).where(eq(review.id, latest.id));

		const [priorReview] = await tx
			.select()
			.from(review)
			.where(and(eq(review.cardId, cardId), eq(review.userId, userId)))
			.orderBy(desc(review.reviewedAt))
			.limit(1);

		// lapseCount: back out a relearning lapse that the deleted review caused.
		const wasLapse =
			latest.state === CARD_STATES.RELEARNING && (priorReview?.state ?? CARD_STATES.NEW) === CARD_STATES.REVIEW;
		const newLapseCount = wasLapse ? Math.max(0, stateRow.state.lapseCount - 1) : stateRow.state.lapseCount;
		const newReviewCount = Math.max(0, stateRow.state.reviewCount - 1);

		if (priorReview) {
			await tx
				.update(cardState)
				.set({
					stability: priorReview.stability,
					difficulty: priorReview.difficulty,
					state: priorReview.state,
					dueAt: priorReview.dueAt,
					lastReviewId: priorReview.id,
					lastReviewedAt: priorReview.reviewedAt,
					reviewCount: newReviewCount,
					lapseCount: newLapseCount,
				})
				.where(and(eq(cardState.cardId, cardId), eq(cardState.userId, userId)));
		} else {
			// No prior reviews -- restore to the brand-new FSRS state.
			const initial = fsrsInitialState();
			await tx
				.update(cardState)
				.set({
					stability: initial.stability,
					difficulty: initial.difficulty,
					state: initial.state,
					dueAt: initial.dueAt,
					lastReviewId: null,
					lastReviewedAt: null,
					reviewCount: 0,
					lapseCount: 0,
				})
				.where(and(eq(cardState.cardId, cardId), eq(cardState.userId, userId)));
		}

		return latest;
	});
}
