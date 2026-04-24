/**
 * `/memory/review` -- session-creation entry point (review-sessions-url layer a).
 *
 * Per `docs/work-packages/review-sessions-url/spec.md`, every review run has
 * a durable id. The stateless queue that used to live at `/memory/review`
 * is gone: on load we abandon stale sessions, create a fresh
 * `memory_review_session`, and redirect to `/memory/review/<sessionId>`.
 * The session-scoped route owns the review chrome + rating submits.
 */

import { requireAuth } from '@ab/auth';
import { abandonStaleSessions, startReviewSession } from '@ab/bc-study';
import { DOMAIN_VALUES, type Domain, QUERY_PARAMS, ROUTES } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Narrow an arbitrary `?domain=` query value into the `Domain` union, or
 * return `null` when the value is absent or unrecognized. Matches the
 * tolerance of the pre-session-URL review entry point so stale bookmarks
 * don't error out.
 */
function parseDomain(raw: string | null): Domain | null {
	if (!raw) return null;
	return (DOMAIN_VALUES as readonly string[]).includes(raw) ? (raw as Domain) : null;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);

	// Lazy cleanup: mark any now-stale active session as abandoned so the
	// dashboard "Resume your last run" tile only surfaces genuinely fresh
	// runs. Cheap; bounded by per-user row count.
	await abandonStaleSessions(user.id);

	const domain = parseDomain(event.url.searchParams.get(QUERY_PARAMS.DOMAIN));
	const session = await startReviewSession({
		userId: user.id,
		deckSpec: { domain },
	});

	redirect(303, ROUTES.MEMORY_REVIEW_SESSION(session.id));
};
