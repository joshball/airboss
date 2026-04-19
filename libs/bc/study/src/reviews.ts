/**
 * Review submission.
 *
 * Single entry point: submitReview. Reads the current card_state, runs FSRS,
 * inserts a new review row, and upserts the card_state within one transaction.
 * Also implements a 5-second idempotency guard against double-submit.
 */

import {
	CARD_STATES,
	type CardState,
	type ConfidenceLevel,
	REVIEW_DEDUPE_WINDOW_MS,
	type ReviewRating,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { generateReviewId } from '@ab/utils';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { card, cardState, type ReviewRow, review } from './schema';
import { fsrsSchedule } from './srs';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export interface SubmitReviewInput {
	cardId: string;
	userId: string;
	rating: ReviewRating;
	confidence?: ConfidenceLevel | null;
	answerMs?: number | null;
}

/**
 * Submit a review for a card and advance its scheduler state.
 *
 * Idempotency: if a review for (cardId, userId) was inserted within the last
 * REVIEW_DEDUPE_WINDOW_MS, returns that existing row rather than inserting a
 * new one. Protects against double-submit from rapid clicks / retries.
 */
export async function submitReview(input: SubmitReviewInput, db: Db = defaultDb): Promise<ReviewRow> {
	const now = new Date();
	const windowStart = new Date(now.getTime() - REVIEW_DEDUPE_WINDOW_MS);

	return await db.transaction(async (tx) => {
		// Idempotency check.
		const [recent] = await tx
			.select()
			.from(review)
			.where(and(eq(review.cardId, input.cardId), eq(review.userId, input.userId), gte(review.reviewedAt, windowStart)))
			.orderBy(desc(review.reviewedAt))
			.limit(1);
		if (recent) return recent;

		// Confirm the card belongs to the user and load its state.
		const rows = await tx
			.select({ card, state: cardState })
			.from(card)
			.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
			.where(and(eq(card.id, input.cardId), eq(card.userId, input.userId)))
			.limit(1);
		const row = rows[0];
		if (!row) throw new Error(`Card ${input.cardId} not found for user ${input.userId}`);

		const prevState = row.state.state as CardState;

		const result = fsrsSchedule(
			{
				stability: row.state.stability,
				difficulty: row.state.difficulty,
				state: prevState,
				dueAt: row.state.dueAt,
				lastReview: null, // ts-fsrs uses dueAt - scheduledDays internally; pass null here
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
				reviewCount: row.state.reviewCount + 1,
				lapseCount: newLapseCount,
			})
			.where(and(eq(cardState.cardId, input.cardId), eq(cardState.userId, input.userId)));

		return inserted;
	});
}
