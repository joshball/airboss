import { getCard, review, setCardStatus, updateCard, updateCardSchema } from '@ab/bc-study';
import {
	CARD_STATUS_VALUES,
	CARD_STATUSES,
	type CARD_TYPE_VALUES,
	type CardStatus,
	type DOMAIN_VALUES,
	ROUTES,
} from '@ab/constants';
import { db } from '@ab/db';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:memory-card');

function parseTags(raw: string): string[] {
	return raw
		.split(',')
		.map((t) => t.trim())
		.filter((t) => t.length > 0);
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = locals.user;
	if (!user) redirect(302, ROUTES.LOGIN);

	const found = await getCard(params.id, user.id);
	if (!found) error(404, { message: 'Card not found' });

	const recentReviews = await db
		.select({
			id: review.id,
			rating: review.rating,
			confidence: review.confidence,
			stability: review.stability,
			difficulty: review.difficulty,
			state: review.state,
			reviewedAt: review.reviewedAt,
			dueAt: review.dueAt,
			scheduledDays: review.scheduledDays,
		})
		.from(review)
		.where(eq(review.cardId, params.id))
		.orderBy(desc(review.reviewedAt))
		.limit(10);

	return {
		card: found.card,
		state: found.state,
		recentReviews,
	};
};

export const actions: Actions = {
	update: async ({ params, request, locals }) => {
		const user = locals.user;
		if (!user) redirect(302, ROUTES.LOGIN);

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
			if (err instanceof Error && err.message.includes('not editable')) {
				return fail(403, { values: input, fieldErrors: { _: 'This card is not editable.' }, intent: 'update' });
			}
			if (err instanceof Error && err.message.includes('not found')) {
				error(404, { message: 'Card not found' });
			}
			log.error(
				'updateCard threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { cardId: params.id } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { values: input, fieldErrors: { _: 'Could not save changes.' }, intent: 'update' });
		}

		redirect(303, ROUTES.MEMORY_CARD(params.id));
	},

	setStatus: async ({ params, request, locals }) => {
		const user = locals.user;
		if (!user) redirect(302, ROUTES.LOGIN);

		const form = await request.formData();
		const target = String(form.get('status') ?? '');
		if (!(CARD_STATUS_VALUES as readonly string[]).includes(target)) {
			return fail(400, { intent: 'setStatus', fieldErrors: { _: 'Invalid status' } });
		}

		try {
			await setCardStatus(params.id, user.id, target as CardStatus);
		} catch (err) {
			if (err instanceof Error && err.message.includes('not found')) {
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
} satisfies Actions;
