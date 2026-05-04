/**
 * `POST /api/section/[id]/heartbeat`
 *
 * Client-tick endpoint for the flightbag's per-section reading-time
 * accumulator. The reader posts `{ delta: <seconds-since-last-tick> }` every
 * `HANDBOOK_HEARTBEAT_INTERVAL_SEC` while the page is visible. Each tick
 * adds the (capped) delta to `study.reference_section_read_state.total_seconds_visible`
 * and refreshes `last_read_at`. First write also flips status `unread ->
 * reading` -- the only auto-transition the spec allows.
 *
 * Authentication: cross-subdomain `bauth_session_token` cookie populated by
 * `apps/flightbag/src/hooks.server.ts` from the shared `@ab/auth` realm.
 * `requireAuth` redirects unauthenticated callers to the study sign-in flow
 * with `redirectTo` pointing back at the originating reader page.
 *
 * TODO(ADR-024): once the entitlement primitive lands in `@ab/auth`, swap
 * `requireAuth(event)` here for `requireEntitlement(event, 'flightbag:read')`.
 * The route shape is the same; the call site change is mechanical.
 *
 * Validation:
 *   - body must parse as JSON
 *   - `delta` must be a positive integer
 *   - `delta >= HANDBOOK_HEARTBEAT_MIN_DELTA_SEC` (anti-flood floor)
 *   - server caps the recorded value at `HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4`
 *     (absorbs sleep/wake spikes); enforced at the route boundary so a
 *     scripted caller can't consume an unbounded write per posted delta.
 *
 * Returns 204 on success; 400 on validation failure with `{ error: <message> }`.
 * 404 when the section id doesn't exist (so a stale page can't write read
 * state for an unknown row). 401 when the session cookie isn't valid.
 */

import { requireAuth } from '@ab/auth';
import { getReferenceSectionById, handbookHeartbeatInputSchema, recordHeartbeat } from '@ab/bc-study';
import { HANDBOOK_HEARTBEAT_INTERVAL_SEC, HANDBOOK_HEARTBEAT_MIN_DELTA_SEC } from '@ab/constants';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Body must be JSON.' }, { status: 400 });
	}

	const parsed = handbookHeartbeatInputSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: 'Body must be `{ delta: positive integer }`.' }, { status: 400 });
	}
	const { delta } = parsed.data;

	if (delta < HANDBOOK_HEARTBEAT_MIN_DELTA_SEC) {
		return json({ error: `Heartbeat delta below minimum (${HANDBOOK_HEARTBEAT_MIN_DELTA_SEC}s).` }, { status: 400 });
	}
	const HEARTBEAT_MAX_DELTA_SEC = HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4;
	if (delta > HEARTBEAT_MAX_DELTA_SEC) {
		return json({ error: `Heartbeat delta above maximum (${HEARTBEAT_MAX_DELTA_SEC}s).` }, { status: 400 });
	}

	const sectionId = event.params.id;
	if (!sectionId) throw error(400, 'Missing section id.');

	// Confirm the section exists before crediting -- prevents a stale page
	// (or hostile caller) from writing read-state rows for unknown ids that
	// would later orphan if/when section ingestion replaces the row.
	const section = await getReferenceSectionById(sectionId);
	if (!section) throw error(404, 'Section not found.');

	await recordHeartbeat(user.id, sectionId, delta);
	return new Response(null, { status: 204 });
};
