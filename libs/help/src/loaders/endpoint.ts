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
 *   - Auth: optional. When `event.locals.user.id` exists, mine.* loaders
 *     populate; otherwise mine.* returns empty.
 *   - Limit: PALETTE_QUERY_MAX_LENGTH chars on the query; over-length input
 *     is truncated (not rejected) so a fast typist doesn't get a 400.
 *
 * Server-only -- imports `@ab/db/connection` transitively via the loaders.
 */

import { type AppSurface, PALETTE_QUERY_MAX_LENGTH } from '@ab/constants';
import type { RequestEvent } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import type { PaletteHost } from '../schema/result-types';
import { loadPaletteInjected } from './all';

export async function handlePaletteSearch(event: RequestEvent, surface: AppSurface): Promise<Response> {
	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'invalid json body');
	}
	if (typeof body !== 'object' || body === null) throw error(400, 'invalid body shape');
	const q = (body as { q?: unknown }).q;
	if (typeof q !== 'string') throw error(400, 'missing q');

	const trimmed = q.trim().slice(0, PALETTE_QUERY_MAX_LENGTH);
	const host: PaletteHost = {
		surface,
		userId: event.locals.user?.id,
	};

	const results = await loadPaletteInjected(trimmed, host);
	return json({ results });
}
