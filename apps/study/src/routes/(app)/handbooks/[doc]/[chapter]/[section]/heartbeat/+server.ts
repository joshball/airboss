/**
 * `POST /handbooks/[doc]/[chapter]/[section]/heartbeat`
 *
 * Client-tick endpoint for the section reader's read-time accumulator.
 *
 * The client posts `{ delta: <seconds-since-last-tick> }` every
 * `HANDBOOK_HEARTBEAT_INTERVAL_SEC` while the page is visible. Each tick adds
 * the (capped) delta to `handbook_read_state.total_seconds_visible` and
 * refreshes `last_read_at`. First write also auto-flips status
 * `unread -> reading` -- the only auto-transition the spec allows.
 *
 * Validation:
 *   - body must parse as JSON
 *   - `delta` must be a positive integer
 *   - `delta >= HANDBOOK_HEARTBEAT_MIN_DELTA_SEC` (anti-flood floor)
 *   - server caps the recorded value at `HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4`
 *     (absorbs sleep/wake spikes) -- enforced inside `recordHeartbeat`
 *
 * Returns 204 on success; 400 on validation failure with a JSON body
 * `{ error: <message> }`. Auth required per the parent `(app)` group.
 */

import { requireAuth } from '@ab/auth';
import {
	getHandbookSection,
	getReferenceByDocument,
	handbookHeartbeatInputSchema,
	recordHeartbeat,
} from '@ab/bc-study';
import { HANDBOOK_HEARTBEAT_MIN_DELTA_SEC, QUERY_PARAMS } from '@ab/constants';
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

	const documentSlug = event.params.doc;
	const chapterCode = event.params.chapter;
	const sectionCode = event.params.section;
	const editionParam = event.url.searchParams.get(QUERY_PARAMS.EDITION) ?? undefined;

	const ref = await getReferenceByDocument(documentSlug, { edition: editionParam }).catch(() => null);
	if (!ref) throw error(404, `Handbook not found: ${documentSlug}`);

	const view = await getHandbookSection(ref.id, chapterCode, sectionCode).catch(() => null);
	if (!view) throw error(404, `Section not found: ${documentSlug} / ${chapterCode}.${sectionCode}`);

	await recordHeartbeat(user.id, view.section.id, delta);
	return new Response(null, { status: 204 });
};
