import { requireAuth } from '@ab/auth';
import { completeSession, getSession, getSessionSummary, SessionNotFoundError } from '@ab/bc-study';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const session = await getSession(event.params.id, user.id);
	if (!session) throw error(404, { message: 'Session not found' });

	// Mark completed if the user arrived at summary with unresolved items
	// (spec: Finish early takes them here). Idempotent.
	if (session.completedAt === null) {
		await completeSession(session.id, user.id);
	}

	try {
		const summary = await getSessionSummary(session.id, user.id);
		return { summary };
	} catch (err) {
		if (err instanceof SessionNotFoundError) throw error(404, { message: 'Session not found' });
		throw err;
	}
};
