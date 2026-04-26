import { requireAuth } from '@ab/auth';
import {
	abandonStaleSessions,
	deleteSavedDeck,
	encodeDeckSpec,
	getDashboardStats,
	getLatestResumableSession,
	listSavedDecks,
	renameSavedDeck,
	SavedDeckLabelTooLongError,
} from '@ab/bc-study';
import { ROUTES, SAVED_DECK_COPY } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:memory-dashboard');

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	// Lazy abandon pass so the resumable-session read reflects the 14-day
	// cutoff without a background job (see review-sessions-url spec).
	await abandonStaleSessions(user.id);

	const [stats, resumable, savedDecks] = await Promise.all([
		getDashboardStats(user.id),
		getLatestResumableSession(user.id),
		listSavedDecks(user.id),
	]);

	return {
		stats,
		resumableSession: resumable
			? {
					id: resumable.id,
					status: resumable.status,
					currentIndex: resumable.currentIndex,
					totalCards: resumable.cardIdList.length,
					lastActivityAt: resumable.lastActivityAt.toISOString(),
				}
			: null,
		// Saved decks are implicit -- every distinct `deck_hash` the user has
		// run becomes a Saved Decks entry. Encoding the spec server-side keeps
		// the SHA-1 + base64url contract entirely off the client. See
		// `docs/work-packages/review-sessions-url/spec.md` Layer (b) Redo.
		savedDecks: savedDecks.map((deck) => ({
			deckHash: deck.deckHash,
			deckSpec: deck.deckSpec,
			deckParam: encodeDeckSpec(deck.deckSpec),
			lastVisitedAt: deck.lastVisitedAt.toISOString(),
			sessionCount: deck.sessionCount,
			label: deck.label,
			resumable: deck.resumable,
		})),
	};
};

export const actions: Actions = {
	/**
	 * Rename a saved deck. Empty / whitespace-only label clears the override
	 * (the dashboard falls back to the auto-derived summary). Length-bounded
	 * by `SAVED_DECK_LABEL_MAX_LENGTH`; longer labels return a 400 with the
	 * SavedDeckLabelTooLongError surfaced via `fieldErrors._`.
	 */
	renameDeck: async (event) => {
		const user = requireAuth(event);
		const { request, locals } = event;
		const form = await request.formData();
		const deckHash = String(form.get('deckHash') ?? '');
		const labelRaw = String(form.get('label') ?? '');

		if (!deckHash) {
			return fail(400, { intent: 'renameDeck', fieldErrors: { _: SAVED_DECK_COPY.NOT_FOUND } });
		}

		try {
			await renameSavedDeck(user.id, deckHash, labelRaw);
		} catch (err) {
			if (err instanceof SavedDeckLabelTooLongError) {
				return fail(400, {
					intent: 'renameDeck',
					deckHash,
					fieldErrors: { label: SAVED_DECK_COPY.LABEL_TOO_LONG },
				});
			}
			log.error(
				'renameSavedDeck threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { deckHash } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { intent: 'renameDeck', deckHash, fieldErrors: { _: 'Could not rename deck.' } });
		}

		// PRG: redirect back to /memory so the new label re-renders without a
		// re-submission warning on refresh. Matches the pattern used by the
		// other mutating actions in this app.
		redirect(303, ROUTES.MEMORY);
	},

	/**
	 * Soft-delete (dismiss) a saved deck. Underlying review-session history
	 * is kept; only the dashboard entry disappears. Idempotent.
	 */
	deleteDeck: async (event) => {
		const user = requireAuth(event);
		const { request, locals } = event;
		const form = await request.formData();
		const deckHash = String(form.get('deckHash') ?? '');

		if (!deckHash) {
			return fail(400, { intent: 'deleteDeck', fieldErrors: { _: SAVED_DECK_COPY.NOT_FOUND } });
		}

		try {
			await deleteSavedDeck(user.id, deckHash);
		} catch (err) {
			log.error(
				'deleteSavedDeck threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { deckHash } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { intent: 'deleteDeck', deckHash, fieldErrors: { _: 'Could not delete deck.' } });
		}

		redirect(303, ROUTES.MEMORY);
	},
} satisfies Actions;
