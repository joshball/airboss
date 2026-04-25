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
	type CardSchedulerState,
	FeedbackCommentRequiredError,
	fsrsPreviewAll,
	getReplacementCard,
	getUnresolvedReEntrySnooze,
	NoReviewToUndoError,
	ReviewSessionNotFoundError,
	type ReviewSessionState,
	removeCard,
	replaceSessionAtIndex,
	resumeReviewSession,
	SnoozeCommentRequiredError,
	shrinkSessionAtIndex,
	snoozeCard,
	submitFeedback,
	submitReview,
	submitReviewSchema,
	undoReview,
} from '@ab/bc-study';
import {
	CARD_FEEDBACK_SIGNAL_VALUES,
	type CardFeedbackSignal,
	type CardState,
	type ConfidenceLevel,
	REVIEW_RATING_VALUES,
	type ReviewRating,
	SNOOZE_DURATION_LEVEL_VALUES,
	SNOOZE_REASON_VALUES,
	SNOOZE_REASONS,
	type SnoozeDurationLevel,
	type SnoozeReason,
} from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:memory-review-session');

function previewIntervalsFor(state: ReviewSessionState['currentCard'], now: Date): Record<ReviewRating, number> | null {
	if (!state) return null;
	const schedulerState: CardSchedulerState = {
		stability: state.stability,
		difficulty: state.difficulty,
		state: state.state as CardState,
		dueAt: state.dueAt,
		lastReview: state.lastReview,
		reviewCount: state.reviewCount,
		lapseCount: state.lapseCount,
	};
	const previews = fsrsPreviewAll(schedulerState, now);
	const out = {} as Record<ReviewRating, number>;
	for (const r of REVIEW_RATING_VALUES) {
		out[r] = previews[r].dueAt.getTime();
	}
	return out;
}

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

	const now = new Date();
	const previewDueAtMs = previewIntervalsFor(state.currentCard, now);

	let reEntryBanner: { snoozeId: string; cardEditedAt: string } | null = null;
	if (state.currentCard) {
		const row = await getUnresolvedReEntrySnooze(state.currentCard.id, user.id);
		if (row?.cardEditedAt) {
			reEntryBanner = { snoozeId: row.id, cardEditedAt: row.cardEditedAt.toISOString() };
		}
	}

	return {
		sessionId: state.session.id,
		position: state.position,
		totalCards: state.totalCards,
		isComplete: state.isComplete,
		startedAt: state.session.startedAt.toISOString(),
		domainFilter: state.session.deckSpec.domain ?? null,
		nowMs: now.getTime(),
		reEntryBanner,
		previewDueAtMs,
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
	snooze: async (event) => {
		const user = requireAuth(event);
		const { params, request, locals } = event;

		const form = await request.formData();
		const cardId = String(form.get('cardId') ?? '');
		const reasonRaw = String(form.get('reason') ?? '');
		const comment = String(form.get('comment') ?? '');
		const durationRaw = String(form.get('durationLevel') ?? '');
		const waitForEdit = String(form.get('waitForEdit') ?? '') === 'true';
		const domain = String(form.get('domain') ?? '');

		if (!cardId) return fail(400, { error: 'cardId is required' });
		if (!(SNOOZE_REASON_VALUES as readonly string[]).includes(reasonRaw)) {
			return fail(400, { error: 'Unknown snooze reason' });
		}
		const reason = reasonRaw as SnoozeReason;

		const durationLevel: SnoozeDurationLevel | null =
			durationRaw && (SNOOZE_DURATION_LEVEL_VALUES as readonly string[]).includes(durationRaw)
				? (durationRaw as SnoozeDurationLevel)
				: null;

		try {
			if (reason === SNOOZE_REASONS.REMOVE) {
				await removeCard({ cardId, userId: user.id, comment });
				const replacement = domain ? await getReplacementCard({ userId: user.id, afterCardId: cardId, domain }) : null;
				if (replacement) {
					await replaceSessionAtIndex(params.sessionId, user.id, replacement.cardId);
				} else {
					await shrinkSessionAtIndex(params.sessionId, user.id);
				}
				return { success: true as const, intent: 'snooze' as const, replaced: Boolean(replacement) };
			}

			await snoozeCard({
				cardId,
				userId: user.id,
				reason,
				comment: comment || null,
				durationLevel,
				waitForEdit: reason === SNOOZE_REASONS.BAD_QUESTION ? waitForEdit : false,
			});
			await shrinkSessionAtIndex(params.sessionId, user.id);
			return { success: true as const, intent: 'snooze' as const, replaced: false };
		} catch (err) {
			if (err instanceof SnoozeCommentRequiredError) {
				return fail(400, { error: 'A comment is required for this reason.' });
			}
			if (err instanceof CardNotFoundError) {
				return fail(404, { error: 'Card not found' });
			}
			if (err instanceof ReviewSessionNotFoundError) {
				error(404, { message: 'Review session not found' });
			}
			log.error(
				'snoozeCard threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { cardId, sessionId: params.sessionId, reason } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: 'Could not snooze card' });
		}
	},
	feedback: async (event) => {
		const user = requireAuth(event);
		const { request, locals, params } = event;

		const form = await request.formData();
		const cardId = String(form.get('cardId') ?? '');
		const signalRaw = String(form.get('signal') ?? '');
		const comment = String(form.get('comment') ?? '');

		if (!cardId) return fail(400, { error: 'cardId is required' });
		if (!(CARD_FEEDBACK_SIGNAL_VALUES as readonly string[]).includes(signalRaw)) {
			return fail(400, { error: 'Unknown feedback signal' });
		}
		const signal = signalRaw as CardFeedbackSignal;

		try {
			await submitFeedback({ cardId, userId: user.id, signal, comment: comment || null });
			return { success: true as const, intent: 'feedback' as const, signal };
		} catch (err) {
			if (err instanceof FeedbackCommentRequiredError) {
				return fail(400, { error: 'A comment is required for this feedback.' });
			}
			if (err instanceof CardNotFoundError) {
				return fail(404, { error: 'Card not found' });
			}
			log.error(
				'submitFeedback threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { cardId, sessionId: params.sessionId, signal } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: 'Could not save feedback' });
		}
	},
} satisfies Actions;
