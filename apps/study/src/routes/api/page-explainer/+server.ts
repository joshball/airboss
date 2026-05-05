/**
 * Page-explainer dismissal endpoint.
 *
 * `POST /api/page-explainer` body `{ pageKey: string, dismissed: boolean }`
 * upserts the dismissal flag for the calling user. The single
 * `study.page_explainer.dismissed` `user_pref` row holds a JSON map of
 * `{ [pageKey]: true }` so we never have to grow the closed key set in
 * `USER_PREF_KEYS` as new pages mount explainers.
 *
 * Auth-gated; only the owning user can change their own dismissals.
 * Validation: `pageKey` is a non-empty string, `dismissed` is a bool.
 * Returns `{ ok: true }` on success. The component does not need the
 * full updated map back -- it owns its own optimistic state.
 */

import { requireAuth } from '@ab/auth';
import { setPageExplainerDismissal } from '@ab/bc-study';
import { db } from '@ab/db/connection';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const bodySchema = z.object({
	pageKey: z.string().min(1).max(128),
	dismissed: z.boolean(),
});

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		throw error(400, 'invalid JSON body');
	}
	const parsed = bodySchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'invalid body shape');

	await setPageExplainerDismissal(user.id, parsed.data.pageKey, parsed.data.dismissed, db);
	return json({ ok: true });
};
