import { requireAuth } from '@ab/auth';
import {
	abandonStaleSessions,
	encodeDeckSpec,
	getDashboardStats,
	getLatestResumableSession,
	listSavedDecks,
} from '@ab/bc-study';
import type { PageServerLoad } from './$types';

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
			resumable: deck.resumable,
		})),
	};
};
