import { requireAuth } from '@ab/auth';
import {
	CitationNotFoundError,
	CitationSourceNotFoundError,
	CitationTargetNotFoundError,
	CitationValidationError,
	type CitationWithTarget,
	createCitation,
	DuplicateCitationError,
	deleteCitation,
	getCitationsOf,
	resolveCitationTargets,
} from '@ab/bc-citations';
import {
	CardNotEditableError,
	CardNotFoundError,
	getCard,
	getCardCrossReferences,
	getRecentReviewsForCard,
	setCardStatus,
	updateCard,
	updateCardSchema,
} from '@ab/bc-study';
import {
	CARD_STATUS_VALUES,
	CARD_STATUSES,
	type CARD_TYPE_VALUES,
	type CardStatus,
	CITATION_SOURCE_TYPES,
	CITATION_TARGET_VALUES,
	type CitationTargetType,
	type DOMAIN_VALUES,
	ROUTES,
} from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:memory-card');

function parseTags(raw: string): string[] {
	return raw
		.split(',')
		.map((t) => t.trim())
		.filter((t) => t.length > 0);
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { params } = event;

	// Keyed on params.id; no dependency between the legs, so fire in parallel.
	// Citations are from Bundle C; cross-refs are from Bundle B; both hydrate
	// the owner detail page on first paint.
	const [found, recentReviews, citationRows, crossRefs] = await Promise.all([
		getCard(params.id, user.id),
		getRecentReviewsForCard(params.id, user.id, 10),
		getCitationsOf(CITATION_SOURCE_TYPES.CARD, params.id),
		getCardCrossReferences(params.id, user.id),
	]);
	if (!found) error(404, { message: 'Card not found' });

	const citations: CitationWithTarget[] = await resolveCitationTargets(citationRows);

	return {
		card: found.card,
		state: found.state,
		recentReviews,
		citations,
		crossRefs,
	};
};

export const actions: Actions = {
	update: async (event) => {
		const user = requireAuth(event);
		const { params, request, locals } = event;

		const form = await request.formData();
		const input = {
			front: String(form.get('front') ?? ''),
			back: String(form.get('back') ?? ''),
			domain: String(form.get('domain') ?? ''),
			cardType: String(form.get('cardType') ?? ''),
			tags: parseTags(String(form.get('tags') ?? '')),
		};

		const parsed = updateCardSchema.safeParse(input);
		if (!parsed.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				const key = issue.path.join('.') || '_';
				if (!fieldErrors[key]) fieldErrors[key] = issue.message;
			}
			return fail(400, { values: input, fieldErrors, intent: 'update' });
		}

		try {
			await updateCard(params.id, user.id, {
				front: parsed.data.front,
				back: parsed.data.back,
				domain: parsed.data.domain as (typeof DOMAIN_VALUES)[number],
				cardType: parsed.data.cardType as (typeof CARD_TYPE_VALUES)[number],
				tags: parsed.data.tags,
			});
		} catch (err) {
			if (err instanceof CardNotEditableError) {
				return fail(403, { values: input, fieldErrors: { _: 'This card is not editable.' }, intent: 'update' });
			}
			if (err instanceof CardNotFoundError) {
				error(404, { message: 'Card not found' });
			}
			log.error(
				'updateCard threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { cardId: params.id } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { values: input, fieldErrors: { _: 'Could not save changes.' }, intent: 'update' });
		}

		// Edit-then-stay: the client swaps back to read mode and shows a
		// self-dismissing toast. See DESIGN_PRINCIPLES.md #7.
		return { success: true as const, intent: 'update' as const, message: 'Card saved.' };
	},

	setStatus: async (event) => {
		const user = requireAuth(event);
		const { params, request, locals } = event;

		const form = await request.formData();
		const target = String(form.get('status') ?? '');
		if (!(CARD_STATUS_VALUES as readonly string[]).includes(target)) {
			return fail(400, { intent: 'setStatus', fieldErrors: { _: 'Invalid status' } });
		}

		try {
			await setCardStatus(params.id, user.id, target as CardStatus);
		} catch (err) {
			if (err instanceof CardNotFoundError) {
				error(404, { message: 'Card not found' });
			}
			log.error(
				'setCardStatus threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { cardId: params.id, status: target } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { intent: 'setStatus', fieldErrors: { _: 'Could not update status.' } });
		}

		if (target === CARD_STATUSES.ARCHIVED) {
			redirect(303, ROUTES.MEMORY_BROWSE);
		}
		redirect(303, ROUTES.MEMORY_CARD(params.id));
	},

	addCitation: async (event) => {
		const user = requireAuth(event);
		const { params, request, locals } = event;

		const form = await request.formData();
		const targetType = String(form.get('targetType') ?? '');
		const targetId = String(form.get('targetId') ?? '');
		const note = String(form.get('note') ?? '');

		if (!(CITATION_TARGET_VALUES as readonly string[]).includes(targetType)) {
			return fail(400, { intent: 'addCitation', fieldErrors: { _: 'Invalid target type.' } });
		}

		try {
			await createCitation({
				sourceType: CITATION_SOURCE_TYPES.CARD,
				sourceId: params.id,
				targetType: targetType as CitationTargetType,
				targetId,
				citationContext: note,
				userId: user.id,
			});
		} catch (err) {
			if (err instanceof DuplicateCitationError) {
				return fail(409, {
					intent: 'addCitation',
					fieldErrors: { _: 'That reference is already cited on this card.' },
				});
			}
			if (err instanceof CitationValidationError) {
				return fail(400, { intent: 'addCitation', fieldErrors: { _: err.message } });
			}
			if (err instanceof CitationSourceNotFoundError) {
				error(404, { message: 'Card not found' });
			}
			if (err instanceof CitationTargetNotFoundError) {
				return fail(400, { intent: 'addCitation', fieldErrors: { _: 'That reference could not be found.' } });
			}
			log.error(
				'createCitation threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { cardId: params.id, targetType, targetId } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { intent: 'addCitation', fieldErrors: { _: 'Could not add citation.' } });
		}

		return { success: true as const, intent: 'addCitation' as const };
	},

	removeCitation: async (event) => {
		const user = requireAuth(event);
		const { params, request, locals } = event;

		const form = await request.formData();
		const citationId = String(form.get('citationId') ?? '');
		if (!citationId) {
			return fail(400, { intent: 'removeCitation', fieldErrors: { _: 'Missing citation id.' } });
		}

		try {
			await deleteCitation(citationId, user.id);
		} catch (err) {
			if (err instanceof CitationNotFoundError) {
				// `deleteCitation` raises CitationNotFoundError both when the row is
				// missing and when the caller does not own it. Surface as 404 so the
				// learner sees a clean "already gone" rather than a server error.
				return fail(404, { intent: 'removeCitation', fieldErrors: { _: 'That citation was not found.' } });
			}
			log.error(
				'deleteCitation threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { cardId: params.id, citationId } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { intent: 'removeCitation', fieldErrors: { _: 'Could not remove citation.' } });
		}

		return { success: true as const, intent: 'removeCitation' as const };
	},
} satisfies Actions;
