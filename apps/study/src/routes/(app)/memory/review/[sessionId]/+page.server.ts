/**
 * `/memory/review/[sessionId]` -- session-scoped review surface
 * (review-sessions-url layer a "Resume").
 *
 * Identical chrome to the pre-session-URL review screen, but driven by a
 * `memory_review_session` row rather than a re-fetched due queue. Close the
 * tab and reopen this URL -> same card, same position, same tally so far.
 */

import { requireAuth } from '@ab/auth';
import {
	advanceReviewSession,
	CardNotFoundError,
	CardNotReviewableError,
	NoReviewToUndoError,
	ReviewSessionNotFoundError,
	type ReviewSessionState,
	resumeReviewSession,
	submitReview,
	submitReviewSchema,
	undoReview,
} from '@ab/bc-study';
import type { ConfidenceLevel, ReviewRating } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:memory-review-session');

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { params } = event;

	let state: ReviewSessionState;
	try {
		state = await resumeReviewSession(params.sessionId, user.id);
	} catch (err) {
		if (err instanceof ReviewSessionNotFoundError) {
			error(404, { message: 'Review session not found' });
		}
		throw err;
	}

	return {
		sessionId: state.session.id,
		position: state.position,
		totalCards: state.totalCards,
		isComplete: state.isComplete,
		startedAt: state.session.startedAt.toISOString(),
		domainFilter: state.session.deckSpec.domain ?? null,
		currentCard: state.currentCard
			? {
					id: state.currentCard.id,
					front: state.currentCard.front,
					back: state.currentCard.back,
					domain: state.currentCard.domain,
					cardType: state.currentCard.cardType,
					tags: state.currentCard.tags,
					state: state.currentCard.state,
					stability: state.currentCard.stability,
					difficulty: state.currentCard.difficulty,
					dueAt: state.currentCard.dueAt.toISOString(),
					promptConfidence: state.currentCard.promptConfidence,
				}
			: null,
	};
};

export const actions: Actions = {
	submit: async (event) => {
		const user = requireAuth(event);
		const { params, request, locals } = event;

		const form = await request.formData();
		const cardId = String(form.get('cardId') ?? '');
		const ratingRaw = form.get('rating');
		const confidenceRaw = form.get('confidence');
		const answerMsRaw = form.get('answerMs');

		if (!cardId) return fail(400, { error: 'cardId is required' });

		const parsed = submitReviewSchema.safeParse({
			rating: Number(ratingRaw),
			confidence: confidenceRaw == null || confidenceRaw === '' ? null : Number(confidenceRaw),
			answerMs: answerMsRaw == null || answerMsRaw === '' ? null : Number(answerMsRaw),
		});

		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid rating' });
		}

		try {
			const rev = await submitReview({
				cardId,
				userId: user.id,
				rating: parsed.data.rating as ReviewRating,
				confidence: parsed.data.confidence as ConfidenceLevel | null | undefined,
				answerMs: parsed.data.answerMs,
				reviewSessionId: params.sessionId,
			});
			await advanceReviewSession(params.sessionId, user.id);
			return {
				success: true as const,
				cardId,
				skipped: false as const,
				nextState: rev.state,
				dueAt: rev.dueAt.toISOString(),
				scheduledDays: rev.scheduledDays,
			};
		} catch (err) {
			if (err instanceof CardNotFoundError || err instanceof CardNotReviewableError) {
				// The card was deleted / suspended / archived between session
				// creation and this rating. Advance the session anyway so the
				// learner moves past the dead card.
				await advanceReviewSession(params.sessionId, user.id);
				return { success: true as const, cardId, skipped: true as const };
			}
			if (err instanceof ReviewSessionNotFoundError) {
				error(404, { message: 'Review session not found' });
			}
			log.error(
				'submitReview threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { cardId, sessionId: params.sessionId } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { success: false as const, cardId, error: 'Could not save review' });
		}
	},
	undoReview: async (event) => {
		const user = requireAuth(event);
		const { request, locals, params } = event;

		const form = await request.formData();
		const cardId = String(form.get('cardId') ?? '');
		if (!cardId) return fail(400, { error: 'cardId is required' });

		try {
			const undone = await undoReview(cardId, user.id);
			return {
				success: true as const,
				intent: 'undoReview' as const,
				cardId,
				undoneReviewId: undone.id,
			};
		} catch (err) {
			if (err instanceof CardNotFoundError) {
				return fail(404, { error: 'Card not found' });
			}
			if (err instanceof NoReviewToUndoError) {
				return fail(409, { error: 'Nothing to undo' });
			}
			log.error(
				'undoReview threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { cardId, sessionId: params.sessionId } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: 'Could not undo review' });
		}
	},
} satisfies Actions;
