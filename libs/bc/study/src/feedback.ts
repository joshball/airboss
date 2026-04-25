/**
 * Card feedback BC -- per-user per-card content quality signals.
 *
 * Separate from both `review` (recall rating) and `cardSnooze` (schedule
 * action). Signals are `like`/`dislike`/`flag`. Dislike and flag require a
 * comment; flag rows surface in the same author-review queue as
 * `bad-question` snoozes via a future UNION (admin surface, not this WP).
 */

import { CARD_FEEDBACK_SIGNALS_REQUIRING_COMMENT, type CardFeedbackSignal } from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { generateCardFeedbackId } from '@ab/utils';
import { and, desc, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { CardNotFoundError } from './cards';
import { type CardFeedbackRow, cardFeedback, cardState } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Raised when a caller picks a signal that requires a comment but omits it. */
export class FeedbackCommentRequiredError extends Error {
	constructor(public readonly signal: CardFeedbackSignal) {
		super(`Feedback signal '${signal}' requires a comment`);
		this.name = 'FeedbackCommentRequiredError';
	}
}

export interface SubmitFeedbackInput {
	cardId: string;
	userId: string;
	signal: CardFeedbackSignal;
	comment?: string | null;
}

async function ensureCardExistsForUser(db: Db, cardId: string, userId: string): Promise<void> {
	const [existing] = await db
		.select({ cardId: cardState.cardId })
		.from(cardState)
		.where(and(eq(cardState.cardId, cardId), eq(cardState.userId, userId)))
		.limit(1);
	if (!existing) throw new CardNotFoundError(cardId, userId);
}

/**
 * Submit one feedback row for (card, user). Multiple rows per pair allowed:
 * the learner may like a card today and flag it a week later after finding
 * a better version.
 */
export async function submitFeedback(input: SubmitFeedbackInput, db: Db = defaultDb): Promise<CardFeedbackRow> {
	const comment = input.comment?.trim() ?? null;
	if ((CARD_FEEDBACK_SIGNALS_REQUIRING_COMMENT as readonly CardFeedbackSignal[]).includes(input.signal)) {
		if (!comment) throw new FeedbackCommentRequiredError(input.signal);
	}

	await ensureCardExistsForUser(db, input.cardId, input.userId);

	const [inserted] = await db
		.insert(cardFeedback)
		.values({
			id: generateCardFeedbackId(),
			cardId: input.cardId,
			userId: input.userId,
			signal: input.signal,
			comment,
			createdAt: new Date(),
		})
		.returning();
	return inserted;
}

/**
 * Get the learner's most recent feedback signal for a card, if any. The
 * review chrome uses this to render the active state on the feedback pill
 * row.
 */
export async function getLatestFeedback(
	cardId: string,
	userId: string,
	db: Db = defaultDb,
): Promise<CardFeedbackRow | null> {
	const [row] = await db
		.select()
		.from(cardFeedback)
		.where(and(eq(cardFeedback.cardId, cardId), eq(cardFeedback.userId, userId)))
		.orderBy(desc(cardFeedback.createdAt))
		.limit(1);
	return row ?? null;
}
