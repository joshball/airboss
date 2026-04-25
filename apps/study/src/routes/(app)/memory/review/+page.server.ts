/**
 * `/memory/review` -- session-creation entry point.
 *
 * Layer (a) "Resume" (PR #128) made every review run a durable session row
 * and turned this route into "create + redirect to /memory/review/<id>".
 *
 * Layer (b) "Redo" (this PR) layers the bookmarkable filter: when the URL
 * carries `?deck=<base64url>` the route decodes the spec, looks for an
 * existing in-progress run on the same `deck_hash` for this user, and
 * either:
 *
 * - renders the "Resume your in-progress run?" prompt (Resume / Start fresh),
 * - or, if no resumable run exists, immediately creates a fresh session
 *   from the decoded deck spec and redirects to `/memory/review/<id>`.
 *
 * The legacy `?domain=<slug>` shortcut still works (used by
 * `MEMORY_REVIEW_FOR_NODE` and stale bookmarks) and creates a session
 * directly without a prompt.
 *
 * See `docs/work-packages/review-sessions-url/spec.md` decisions (2) + (4).
 */

import { requireAuth } from '@ab/auth';
import type { ReviewSessionDeckSpec } from '@ab/bc-study';
import {
	abandonStaleSessions,
	computeDeckHash,
	DeckSpecDecodeError,
	decodeDeckSpec,
	findResumableSessionByDeckHash,
	normalizeDeckSpec,
	startReviewSession,
} from '@ab/bc-study';
import { DOMAIN_VALUES, type Domain, QUERY_PARAMS, ROUTES } from '@ab/constants';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * Narrow an arbitrary `?domain=` query value into the `Domain` union, or
 * return `null` when the value is absent or unrecognized. Tolerant of stale
 * bookmarks; an unknown slug becomes "all domains" rather than a 400.
 */
function parseDomain(raw: string | null): Domain | null {
	if (!raw) return null;
	return (DOMAIN_VALUES as readonly string[]).includes(raw) ? (raw as Domain) : null;
}

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
	// only surface genuinely fresh runs. Cheap; bounded by per-user row count.
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
			};
		}

		// No prior in-progress run for this deck: create + redirect, same as
		// the no-`?deck` path.
		const created = await startReviewSession({ userId: user.id, deckSpec });
		redirect(303, ROUTES.MEMORY_REVIEW_SESSION(created.id));
	}

	const domain = parseDomain(event.url.searchParams.get(QUERY_PARAMS.DOMAIN));
	const session = await startReviewSession({
		userId: user.id,
		deckSpec: { domain },
	});

	redirect(303, ROUTES.MEMORY_REVIEW_SESSION(session.id));
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
	fresh: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const decoded = decodeDeckOrFail(String(form.get(QUERY_PARAMS.DECK) ?? ''));
		if (!decoded.ok) return decoded.failure;

		const spec = normalizeDeckSpec(decoded.spec, DOMAIN_VALUES);
		const created = await startReviewSession({ userId: user.id, deckSpec: spec });
		redirect(303, ROUTES.MEMORY_REVIEW_SESSION(created.id));
	},
} satisfies Actions;
