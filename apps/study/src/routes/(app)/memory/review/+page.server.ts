/**
 * `/memory/review` -- session-creation entry point.
 *
 * The original Layer (a) "Resume" rev had `load` mint a `memory_review_session`
 * row directly and 303-redirect to `/memory/review/<id>`. That violated the
 * companion rule called out in `apps/study/src/routes/(app)/sessions/[id]/summary/+page.server.ts`:
 * load functions do not participate in CSRF, and prefetchers / link previews /
 * link-checker bots / browser tab restoration can all fire a GET on this URL
 * without user intent. Each phantom hit cluttered Saved Decks until the lazy
 * 14-day abandon pass swept it.
 *
 * This file's `load` is now strictly read-only with respect to
 * `memory_review_session` row creation:
 *
 * - `?deck=<base64url>` + a resumable run on the same hash -> render the
 *   "Resume your in-progress run?" prompt (Resume / Start fresh forms).
 * - `?deck=<base64url>` + no resumable run -> render a "Start review of this
 *   deck?" prompt with a single Start fresh form.
 * - no `?deck=` -> render a "Start review (all due cards)?" prompt with a
 *   single Start fresh form.
 *
 * Session creation lives only in the form actions:
 *
 * - `actions.resume` -- take an existing in-progress run on the deck hash and
 *   redirect to its session URL. Falls through to a fresh session if the
 *   resumable disappeared between prompt render and submit.
 * - `actions.fresh` -- always create a new session and redirect. Accepts an
 *   optional `deck` form field; absent = unfiltered (`{ domain: null }`).
 *
 * See `docs/work-packages/review-sessions-url/spec.md` decisions (2) + (4) and
 * `docs/work/reviews/2026-05-01-study-app-surfaces-backend.md` chunk-1 backend
 * CRITICAL.
 */

import { requireAuth } from '@ab/auth';
import type { ReviewSessionDeckSpec } from '@ab/bc-study';
import {
	abandonStaleSessions,
	computeDeckHash,
	DeckSpecDecodeError,
	decodeDeckSpec,
	encodeDeckSpec,
	findResumableSessionByDeckHash,
	normalizeDeckSpec,
	startReviewSession,
} from '@ab/bc-study';
import { DOMAIN_VALUES, QUERY_PARAMS, ROUTES } from '@ab/constants';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * Decode a `?deck=` value or 400 with a friendly message. `decodeDeckSpec`
 * throws `DeckSpecDecodeError` on malformed input; SvelteKit's `error()`
 * itself throws so the call ends the load function.
 */
function decodeDeckOr400(deckParam: string): ReviewSessionDeckSpec {
	try {
		return decodeDeckSpec(deckParam);
	} catch (err) {
		if (err instanceof DeckSpecDecodeError) {
			error(400, { message: 'Invalid deck spec in URL' });
		}
		throw err;
	}
}

/**
 * Decode a `?deck=` value submitted via form action. Returns a `fail()` body
 * sentinel-shaped object on malformed input; the caller checks via `'fail'
 * in result` before using `result` as a spec.
 */
function decodeDeckOrFail(
	deckParam: string,
): { ok: true; spec: ReviewSessionDeckSpec } | { ok: false; failure: ReturnType<typeof fail> } {
	if (!deckParam) return { ok: false, failure: fail(400, { error: 'Missing deck spec' }) };
	try {
		return { ok: true, spec: decodeDeckSpec(deckParam) };
	} catch (err) {
		if (err instanceof DeckSpecDecodeError) {
			return { ok: false, failure: fail(400, { error: 'Invalid deck spec' }) };
		}
		throw err;
	}
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);

	// Lazy cleanup: mark any now-stale active session as abandoned so the
	// dashboard "Resume your last run" tile + Saved Decks resumable badge
	// only surface genuinely fresh runs. Cheap UPDATE bounded by per-user row
	// count; safe on GET because it is idempotent state correction, not
	// session creation. The hazardous pattern (creating phantom session rows
	// from prefetch / preview hits) lives only in the form actions below.
	await abandonStaleSessions(user.id);

	const deckParam = event.url.searchParams.get(QUERY_PARAMS.DECK);
	if (deckParam) {
		// Normalize stale domain values BEFORE hashing so a bookmark whose
		// `domain` slug was renamed/removed degrades to "all domains" and
		// buckets with the user's other unfiltered runs in Saved Decks
		// instead of producing an empty session.
		const deckSpec = normalizeDeckSpec(decodeDeckOr400(deckParam), DOMAIN_VALUES);
		const deckHash = computeDeckHash(deckSpec);
		const resumable = await findResumableSessionByDeckHash(user.id, deckHash);
		if (resumable) {
			return {
				prompt: {
					deckParam,
					deckSpec,
					session: {
						id: resumable.id,
						currentIndex: resumable.currentIndex,
						totalCards: resumable.cardIdList.length,
						status: resumable.status,
						startedAt: resumable.startedAt.toISOString(),
						lastActivityAt: resumable.lastActivityAt.toISOString(),
					},
				},
				start: null,
			};
		}

		// No prior in-progress run for this deck: render a Start prompt that
		// posts to `actions.fresh` on user click. Never mint here -- a GET
		// prefetch must not produce a session row.
		return {
			prompt: null,
			start: { deckParam, deckSpec },
		};
	}

	// No `?deck=`: offer an unfiltered Start. Same posture -- never mint on
	// GET. The page renders a single Start button that posts to
	// `actions.fresh` with the unfiltered deck spec encoded into a hidden
	// field.
	const unfilteredSpec: ReviewSessionDeckSpec = { domain: null };
	return {
		prompt: null,
		start: { deckParam: encodeDeckSpec(unfilteredSpec), deckSpec: unfilteredSpec },
	};
};

export const actions: Actions = {
	resume: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const decoded = decodeDeckOrFail(String(form.get(QUERY_PARAMS.DECK) ?? ''));
		if (!decoded.ok) return decoded.failure;

		const spec = normalizeDeckSpec(decoded.spec, DOMAIN_VALUES);
		const deckHash = computeDeckHash(spec);
		const resumable = await findResumableSessionByDeckHash(user.id, deckHash);
		if (!resumable) {
			// The session completed (or fell out of the resumable window)
			// between prompt render and submit. Fall back to a fresh run so
			// the user isn't stuck on a dead form.
			const created = await startReviewSession({ userId: user.id, deckSpec: spec });
			redirect(303, ROUTES.MEMORY_REVIEW_SESSION(created.id));
		}
		redirect(303, ROUTES.MEMORY_REVIEW_SESSION(resumable.id));
	},
	/**
	 * Always create a new session and redirect to its URL. Accepts an optional
	 * `deck` form field; absent = unfiltered start (`{ domain: null }`). The
	 * Start prompt rendered by `load()` for the no-`?deck` branch posts here
	 * with the encoded unfiltered spec; the deck-scoped prompts post the
	 * decoded `?deck=` value forward.
	 */
	fresh: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const deckParam = String(form.get(QUERY_PARAMS.DECK) ?? '');
		let spec: ReviewSessionDeckSpec;
		if (deckParam) {
			const decoded = decodeDeckOrFail(deckParam);
			if (!decoded.ok) return decoded.failure;
			spec = normalizeDeckSpec(decoded.spec, DOMAIN_VALUES);
		} else {
			spec = { domain: null };
		}
		const created = await startReviewSession({ userId: user.id, deckSpec: spec });
		redirect(303, ROUTES.MEMORY_REVIEW_SESSION(created.id));
	},
} satisfies Actions;
