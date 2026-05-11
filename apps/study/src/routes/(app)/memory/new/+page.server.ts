import { requireAuth } from '@ab/auth';
import {
	type CardRow,
	createCard,
	getCardDraft,
	markDraftPromoted,
	newCardSchema,
	SourceRefRequiredError,
} from '@ab/bc-study/server';
import { type CARD_KIND_VALUES, type CARD_TYPE_VALUES, type DOMAIN_VALUES, QUERY_PARAMS, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:memory-new');

/** Parse comma-separated tags input into a cleaned string[]. */
function parseTags(raw: string): string[] {
	return raw
		.split(',')
		.map((t) => t.trim())
		.filter((t) => t.length > 0);
}

export const load: PageServerLoad = async (event) => {
	const { url } = event;
	const draftId = url.searchParams.get(QUERY_PARAMS.DRAFT);

	// When `?draft=<id>` is supplied, look up the draft scoped to the
	// signed-in user and pre-fill the form. The draft is *not* promoted
	// here -- only on form submit -- so a navigated-away tab leaves the
	// draft in `/memory/drafts`.
	let draftPrefill: {
		id: string;
		front: string;
		back: string;
		domain: string;
		cardType: string;
		kind: string;
		tags: string[];
	} | null = null;
	if (draftId !== null) {
		const user = requireAuth(event);
		const row = await getCardDraft(draftId, user.id);
		if (!row) throw error(404, 'Draft not found.');
		if (row.promotedAt !== null) throw error(410, 'Draft already promoted.');
		draftPrefill = {
			id: row.id,
			front: row.front,
			back: row.back,
			domain: row.domain ?? '',
			cardType: row.cardType,
			kind: row.kind,
			tags: row.tags,
		};
	}

	return {
		seed: {
			domain: draftPrefill?.domain ?? url.searchParams.get(QUERY_PARAMS.DOMAIN) ?? '',
			cardType: draftPrefill?.cardType ?? url.searchParams.get(QUERY_PARAMS.CARD_TYPE) ?? '',
			kind: draftPrefill?.kind ?? url.searchParams.get(QUERY_PARAMS.CARD_KIND) ?? '',
			tags: draftPrefill?.tags.join(', ') ?? url.searchParams.get(QUERY_PARAMS.TAGS) ?? '',
			front: draftPrefill?.front ?? '',
			back: draftPrefill?.back ?? '',
		},
		draft: draftPrefill,
	};
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireAuth(event);
		const { request, locals, url } = event;

		const form = await request.formData();
		const rawFront = String(form.get('front') ?? '');
		const rawBack = String(form.get('back') ?? '');
		const rawDomain = String(form.get('domain') ?? '');
		const rawCardType = String(form.get('cardType') ?? '');
		const rawKindField = form.get('kind');
		const rawKind = rawKindField === null ? undefined : String(rawKindField);
		const rawTags = String(form.get('tags') ?? '');
		const rawDraftField = form.get(QUERY_PARAMS.DRAFT);
		// Carry the draft id either via the form (preferred -- survives a
		// re-submit from a fail() result) or the URL query param.
		const draftId =
			(rawDraftField !== null && String(rawDraftField).length > 0 ? String(rawDraftField) : null) ??
			url.searchParams.get(QUERY_PARAMS.DRAFT);

		const input = {
			front: rawFront,
			back: rawBack,
			domain: rawDomain,
			cardType: rawCardType,
			kind: rawKind,
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
		let created: CardRow;
		try {
			created = await createCard({
				userId: user.id,
				front: parsed.data.front,
				back: parsed.data.back,
				// zod's enum() widens to string; newCardSchema guarantees membership.
				domain: parsed.data.domain as (typeof DOMAIN_VALUES)[number],
				cardType: parsed.data.cardType as (typeof CARD_TYPE_VALUES)[number],
				kind: parsed.data.kind as (typeof CARD_KIND_VALUES)[number] | undefined,
				tags: parsed.data.tags,
			});
		} catch (err) {
			if (err instanceof SourceRefRequiredError) {
				return fail(400, { values: input, fieldErrors: { _: err.message } });
			}
			log.error(
				'create card failed',
				{ requestId: locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { values: input, fieldErrors: { _: 'Could not create card.' } });
		}

		// If the form was launched from /memory/drafts (?draft=<id>), stamp
		// the draft as promoted now that the card exists. Best-effort: a
		// failure here doesn't roll back the card -- the user can manually
		// discard a stale draft from the inbox.
		if (draftId !== null) {
			try {
				await markDraftPromoted(draftId, user.id, created.id);
			} catch (err) {
				log.error(
					'stamp draft as promoted failed',
					{ requestId: locals.requestId, userId: user.id, draftId },
					err instanceof Error ? err : undefined,
				);
			}
		}

		if (saveAndAdd) {
			// Preserve the domain + tags so the next card stays in context.
			const next = new URLSearchParams({
				[QUERY_PARAMS.CREATED]: created.id,
				[QUERY_PARAMS.DOMAIN]: parsed.data.domain,
				[QUERY_PARAMS.CARD_TYPE]: parsed.data.cardType,
			});
			if (parsed.data.kind) {
				next.set(QUERY_PARAMS.CARD_KIND, parsed.data.kind);
			}
			if (parsed.data.tags && parsed.data.tags.length > 0) {
				next.set(QUERY_PARAMS.TAGS, parsed.data.tags.join(','));
			}
			redirect(303, `${ROUTES.MEMORY_NEW}?${next.toString()}`);
		}
		redirect(303, ROUTES.MEMORY_CARD(created.id));
	},
} satisfies Actions;
