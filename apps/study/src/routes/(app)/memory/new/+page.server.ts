import { createCard, newCardSchema } from '@ab/bc-study';
import { type CARD_TYPE_VALUES, type DOMAIN_VALUES, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { fail, redirect } from '@sveltejs/kit';
import type { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:memory-new');

/** Parse comma-separated tags input into a cleaned string[]. */
function parseTags(raw: string): string[] {
	return raw
		.split(',')
		.map((t) => t.trim())
		.filter((t) => t.length > 0);
}

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) redirect(302, ROUTES.LOGIN);

		const form = await request.formData();
		const rawFront = String(form.get('front') ?? '');
		const rawBack = String(form.get('back') ?? '');
		const rawDomain = String(form.get('domain') ?? '');
		const rawCardType = String(form.get('cardType') ?? '');
		const rawTags = String(form.get('tags') ?? '');

		const input = {
			front: rawFront,
			back: rawBack,
			domain: rawDomain,
			cardType: rawCardType,
			tags: parseTags(rawTags),
		};

		const parsed = newCardSchema.safeParse(input);
		if (!parsed.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				const key = issue.path.join('.') || '_';
				if (!fieldErrors[key]) fieldErrors[key] = issue.message;
			}
			return fail(400, { values: input, fieldErrors });
		}

		const saveAndAdd = form.get('intent') === 'save-and-add';

		try {
			const created = await createCard({
				userId: user.id,
				front: parsed.data.front,
				back: parsed.data.back,
				// zod's enum() widens to string; newCardSchema guarantees membership.
				domain: parsed.data.domain as (typeof DOMAIN_VALUES)[number],
				cardType: parsed.data.cardType as (typeof CARD_TYPE_VALUES)[number],
				tags: parsed.data.tags,
			});

			if (saveAndAdd) {
				redirect(303, `${ROUTES.MEMORY_NEW}?created=${encodeURIComponent(created.id)}`);
			}
			redirect(303, ROUTES.MEMORY_CARD(created.id));
		} catch (err) {
			if (err instanceof Response) throw err;
			if (err instanceof Error && err.message.startsWith('source_ref')) {
				return fail(400, { values: input, fieldErrors: { _: err.message } });
			}
			// SvelteKit's redirect() throws -- let those propagate.
			if (typeof err === 'object' && err !== null && 'status' in err && 'location' in err) throw err;

			log.error(
				'createCard threw',
				{ requestId: locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { values: input, fieldErrors: { _: 'Could not save the card. Please try again.' } });
		}
	},
} satisfies Actions;

// Satisfy the bundler when zod import is otherwise unused in this file.
export type NewCardInput = z.infer<typeof newCardSchema>;
