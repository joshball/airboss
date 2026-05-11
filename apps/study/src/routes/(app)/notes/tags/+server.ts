/**
 * GET `/notes/tags` -- distinct tags for the signed-in user, used by the
 * `<TagChipInput>` autocomplete dropdown. Returns `{ tags: string[] }`
 * sorted alphabetically by lowercased value. Caches in the BC layer
 * (the SQL aggregation is the work; this endpoint is a thin shim).
 *
 * No params today. A future ?prefix= filter could push the LIKE into
 * SQL, but the result set is small enough to filter client-side -- we
 * skip the parameter to keep the cache hit-rate high.
 */

import { requireAuth } from '@ab/auth';
import { listDistinctTags } from '@ab/bc-study/server';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const user = requireAuth(event);
	const tags = await listDistinctTags(user.id);
	return json(
		{ tags },
		{
			headers: {
				// Per-user, short-lived: keystroke-frequency calls hit a fresh
				// browser cache for ~30s while the user types, then re-validate
				// after a window blur or background tab refocus. Acceptable -- a
				// new tag added in the same window appears after the next
				// search submit invalidates the cache anyway.
				'cache-control': 'private, max-age=30',
			},
		},
	);
};
