/**
 * `/memory/drafts` -- card-draft inbox
 * (wp-flightbag-rich-reader Phase 3).
 *
 * Lists open drafts (`promoted_at IS NULL`) queued from the flightbag
 * selection toolbar's "Card later" action. Each row offers Edit + promote
 * (links to `/memory/new?draft=<id>`), Promote as-is (one-click create
 * card from the prefill), or Discard.
 *
 * The "Promote as-is" form action calls `promoteDraftToCard` directly,
 * which fails when the draft is missing required fields (domain, front,
 * back). Those drafts route through Edit + promote instead.
 */

import { requireAuth } from '@ab/auth';
import {
	CardDraftAlreadyPromotedError,
	CardDraftNotFoundError,
	discardCardDraft,
	getReferenceSectionById,
	listOpenCardDrafts,
	promoteDraftToCard,
} from '@ab/bc-study/server';
import { ROUTES } from '@ab/constants';
import { type SourceId, urlForReference } from '@ab/sources';
import { createLogger } from '@ab/utils';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:card-drafts');

export interface DraftListRow {
	id: string;
	front: string;
	back: string;
	domain: string | null;
	tags: readonly string[];
	createdAt: string;
	referenceSectionId: string | null;
	sourceTitle: string | null;
	sourceUrl: string | null;
	canPromoteAsIs: boolean;
	editHref: string;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const drafts = await listOpenCardDrafts(user.id, { limit: 100 });

	const rows: DraftListRow[] = await Promise.all(
		drafts.map(async (draft) => {
			let sourceTitle: string | null = null;
			let sourceUrl: string | null = null;
			if (draft.referenceSectionId) {
				const section = await getReferenceSectionById(draft.referenceSectionId).catch(() => null);
				if (section) {
					sourceTitle = `${section.title} (${section.code})`;
					try {
						sourceUrl = urlForReference(section.airbossRef as SourceId);
					} catch {
						sourceUrl = null;
					}
				}
			}
			return {
				id: draft.id,
				front: draft.front,
				back: draft.back,
				domain: draft.domain,
				tags: draft.tags,
				createdAt: draft.createdAt instanceof Date ? draft.createdAt.toISOString() : new Date().toISOString(),
				referenceSectionId: draft.referenceSectionId,
				sourceTitle,
				sourceUrl,
				canPromoteAsIs: draft.front.trim().length > 0 && draft.back.trim().length > 0 && Boolean(draft.domain),
				editHref: `${ROUTES.MEMORY_NEW}?draft=${encodeURIComponent(draft.id)}`,
			};
		}),
	);

	return {
		drafts: rows,
	};
};

export const actions: Actions = {
	promote: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const draftId = String(form.get('draftId') ?? '');
		if (draftId.length === 0) return fail(400, { error: 'Missing draft id.' });
		let cardId: string;
		try {
			({ cardId } = await promoteDraftToCard(draftId, user.id));
		} catch (err) {
			if (err instanceof CardDraftNotFoundError) return fail(404, { error: 'Draft not found.' });
			if (err instanceof CardDraftAlreadyPromotedError) return fail(409, { error: 'Already promoted.' });
			// A draft missing required fields (domain / front / back) cannot be
			// promoted as-is; the UI disables the button via `canPromoteAsIs`, so
			// this path is reached only by a stale form. Any other Error is an
			// unexpected server fault -- log the raw text, never surface it.
			log.error(
				'promote draft failed',
				{ requestId: event.locals.requestId, userId: user.id, metadata: { draftId } },
				err instanceof Error ? err : undefined,
			);
			return fail(400, { error: 'This draft is missing required fields. Edit it before promoting.' });
		}
		throw redirect(303, ROUTES.MEMORY_CARD(cardId));
	},
	discard: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const draftId = String(form.get('draftId') ?? '');
		if (draftId.length === 0) return fail(400, { error: 'Missing draft id.' });
		try {
			await discardCardDraft(draftId, user.id);
			return { ok: true };
		} catch (err) {
			if (err instanceof CardDraftNotFoundError) return fail(404, { error: 'Draft not found.' });
			throw err;
		}
	},
} satisfies Actions;
