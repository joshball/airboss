/**
 * POST `/practice/wx/drill/end`
 *
 * Close out a drill session: stamp `wx_practice_session.endedAt`, then
 * return a per-family summary the client renders as the end-of-session
 * screen.
 *
 * Body: `{ sessionId }`
 *
 * Returns: `{ summary: SessionSummary }`.
 */

import { requireAuth } from '@ab/auth';
import { endSession, summarizeSession } from '@ab/bc-wx-practice/server';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface EndBody {
	sessionId?: unknown;
}

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);
	let body: EndBody;
	try {
		body = (await event.request.json()) as EndBody;
	} catch {
		throw error(400, 'Body must be JSON.');
	}
	if (typeof body.sessionId !== 'string' || body.sessionId.length === 0) {
		throw error(400, 'sessionId must be a non-empty string.');
	}

	const closed = await endSession({ sessionId: body.sessionId, userId: user.id });
	if (!closed) {
		throw error(404, 'Session not found.');
	}

	const summary = await summarizeSession(body.sessionId, user.id);
	return json({ summary });
};
