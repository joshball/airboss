import { requireAuth } from '@ab/auth';
import { getSession, getSessionSummary, SessionNotFoundError } from '@ab/bc-study';
import { ROUTES } from '@ab/constants';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Summary load is read-only. The runner's `finish` action is the single writer
 * that ends a session; landing on this route for an open session redirects the
 * learner back to the runner so they can finish explicitly (load functions do
 * not participate in CSRF and prefetchers / link previews would otherwise end
 * sessions invisibly).
 */
export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const session = await getSession(event.params.id, user.id);
	if (!session) throw error(404, { message: 'Session not found' });

	if (session.completedAt === null) {
		throw redirect(303, ROUTES.SESSION(session.id));
	}

	try {
		const summary = await getSessionSummary(session.id, user.id);
		return { summary };
	} catch (err) {
		if (err instanceof SessionNotFoundError) throw error(404, { message: 'Session not found' });
		throw err;
	}
};
