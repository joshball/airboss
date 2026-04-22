import { requireAuth } from '@ab/auth';
import { CardNotFoundError, CardNotReviewableError, getDueCards, submitReview, submitReviewSchema } from '@ab/bc-study';
import {
	type ConfidenceLevel,
	DOMAIN_VALUES,
	type Domain,
	QUERY_PARAMS,
	REVIEW_BATCH_SIZE,
	type ReviewRating,
} from '@ab/constants';
import { createLogger } from '@ab/utils';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:memory-review');

/**
 * Narrow an arbitrary `?domain=` query value into the `Domain` union, or
 * return `undefined` when the value is absent or unrecognized. Keeps the
 * review page tolerant of stale deep links without returning an error.
 */
function parseDomain(raw: string | null): Domain | undefined {
	if (!raw) return undefined;
	return (DOMAIN_VALUES as readonly string[]).includes(raw) ? (raw as Domain) : undefined;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);

	const now = new Date();
	const domain = parseDomain(event.url.searchParams.get(QUERY_PARAMS.DOMAIN));
	const due = await getDueCards(user.id, { limit: REVIEW_BATCH_SIZE, domain });

	// Prompt confidence on every card (no sampling). The session runner does
	// the same; keeping the two flows in lockstep avoids calibration-bucket
	// bias based on which review surface the learner uses more.
	const batch = due.map((row) => ({
		id: row.card.id,
		front: row.card.front,
		back: row.card.back,
		domain: row.card.domain,
		cardType: row.card.cardType,
		tags: row.card.tags ?? [],
		state: row.state.state,
		stability: row.state.stability,
		difficulty: row.state.difficulty,
		dueAt: row.state.dueAt,
		promptConfidence: true,
	}));

	return {
		batch,
		startedAt: now.toISOString(),
		domainFilter: domain ?? null,
	};
};

export const actions: Actions = {
	submit: async (event) => {
		const user = requireAuth(event);
		const { request, locals } = event;

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
			});
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
				// Spec edge case: "Card deleted during review session -- skip, advance."
				// Also covers: card was suspended/archived in another tab between
				// batch load and submit.
				return { success: true as const, cardId, skipped: true as const };
			}
			log.error(
				'submitReview threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { cardId } },
				err instanceof Error ? err : undefined,
			);
			// `fail` (not `error`) so the learner stays on the review page with
			// the batch intact and can retry. Consistent with session/[id] runner
			// and plans/* / memory/new / memory/[id] actions. `skipped` and
			// `nextState`/`dueAt`/`scheduledDays` are omitted on the error branch
			// so the template can widen its success-only consumers with `'error' in form`.
			return fail(500, { success: false as const, cardId, error: 'Could not save review' });
		}
	},
} satisfies Actions;
