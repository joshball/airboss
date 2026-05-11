// @browser-globals: server-only -- never imported by client .svelte
/**
 * One-shot helper that runs every DB-backed palette loader in parallel and
 * returns the concatenated row list -- ready to feed into `searchGrouped()`'s
 * `injected` argument from a SvelteKit `+server.ts` endpoint.
 *
 * Loaders run with `Promise.all` so total latency stays bounded by the
 * slowest single loader (typically `handbook-sections`'s ilike over
 * `content_md`). Any loader that throws propagates -- the endpoint should
 * decide how to degrade (the canonical pattern is `try { ... } catch { return
 * [] }` so a transient DB error doesn't blank the palette).
 *
 * Server-only.
 */

import { parseQuery } from '../query-parser';
import type { PaletteHost, SearchResult } from '../schema/result-types';
import { loadAimSections } from './aim-sections';
import { loadCards } from './cards';
import { loadCfrSections } from './cfr-sections';
import { loadCourses } from './courses';
import { loadHandbookSections } from './handbook-sections';
import { loadKnowledgeNodes } from './knowledge-nodes';
import { loadPlans } from './plans';
import { loadReps } from './reps';

export async function loadPaletteInjected(rawQuery: string, host: PaletteHost): Promise<readonly SearchResult[]> {
	const parsed = parseQuery(rawQuery);
	const freeText = parsed.freeText.trim();
	if (freeText.length === 0 && parsed.filters.length === 0) return [];

	const [handbook, cfr, aim, knodes, cards, reps, plans, courses] = await Promise.all([
		loadHandbookSections(parsed, host),
		loadCfrSections(parsed, host),
		loadAimSections(parsed, host),
		loadKnowledgeNodes(parsed, host),
		loadCards(parsed, host),
		loadReps(parsed, host),
		loadPlans(parsed, host),
		loadCourses(parsed, host),
	]);

	return [...handbook, ...cfr, ...aim, ...knodes, ...cards, ...reps, ...plans, ...courses];
}
