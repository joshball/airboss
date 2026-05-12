// @browser-globals: server-only -- never imported by client .svelte
/**
 * Shared SvelteKit `+server.ts` handler for the palette search endpoint. Each
 * app mounts a tiny `+server.ts` that delegates to `handlePaletteSearch()` --
 * that file lives under `apps/<surface>/src/routes/api/palette/search/`. Per-app
 * surface tag is supplied by the mounting endpoint via the `surface` argument.
 *
 * Contract:
 *   - Request: `POST /api/palette/search` with `{ q: string }` JSON body.
 *   - Response: `{ results: SearchResult[] }` -- ready to feed into
 *     `searchGrouped()`'s `injected` arg from the client.
 *   - Auth: required. Anonymous callers receive 401 -- the palette is a
 *     signed-in surface (the mine.* family is the headline feature and is
 *     empty for anon users). Closing the door on anonymous traffic also
 *     keeps idle bots from spinning up the eight-query fan-out.
 *   - Limit: PALETTE_QUERY_MAX_LENGTH chars on the query; over-length input
 *     is truncated (not rejected) so a fast typist doesn't get a 400.
 *
 * Error handling: any loader failure is logged and degrades to `{ results: []
 * }` so a transient DB error doesn't blank the entire palette UI. The client
 * still has the synchronous facade rows from aviation refs / help pages /
 * external tools.
 *
 * Server-only -- imports `@ab/db/connection` transitively via the loaders.
 */

import { type AppSurface, PALETTE_QUERY_MAX_LENGTH } from '@ab/constants';
import { createLogger } from '@ab/utils';
import type { RequestEvent } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import type { PaletteHost } from '../schema/result-types';
import { loadPaletteInjected } from './all';

const log = createLogger('palette');

export async function handlePaletteSearch(event: RequestEvent, surface: AppSurface): Promise<Response> {
	const userId = event.locals.user?.id;
	if (!userId) throw error(401, 'authentication required');

	let body: unknown;
	try {
		body = await event.request.json();
	} catch (err) {
		log.warn('invalid json body', {
			userId,
			metadata: { error: err instanceof Error ? err.message : String(err) },
		});
		throw error(400, 'invalid json body');
	}
	if (typeof body !== 'object' || body === null) throw error(400, 'invalid body shape');
	const q = (body as { q?: unknown }).q;
	if (typeof q !== 'string') throw error(400, 'missing q');

	const trimmed = q.trim().slice(0, PALETTE_QUERY_MAX_LENGTH);
	const host: PaletteHost = {
		surface,
		userId,
	};

	try {
		const results = await loadPaletteInjected(trimmed, host);
		return json({ results });
	} catch (err) {
		// A loader failure (DB blip, connection drop) degrades to an empty
		// merge rather than blanking the palette. The synchronous in-process
		// facade still surfaces aviation refs + help pages + external tools.
		log.error('loader fan-out failed', { userId }, err instanceof Error ? err : undefined);
		return json({ results: [] });
	}
}
