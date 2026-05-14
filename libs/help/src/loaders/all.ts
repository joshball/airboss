// @browser-globals: server-only -- never imported by client .svelte
/**
 * One-shot helper that runs every DB-backed palette loader in parallel and
 * returns the concatenated row list -- ready to feed into `searchGrouped()`'s
 * `injected` argument from a SvelteKit `+server.ts` endpoint.
 *
 * Loaders run with `Promise.allSettled` so a single loader failure (DB blip,
 * connection drop, query plan timeout) degrades that one loader's slice to
 * empty rather than killing the entire fan-out. Each rejected loader is
 * logged so the operator sees the failure server-side without forcing a 500
 * onto the client. The endpoint wraps the whole call in another try/catch
 * as a belt-and-braces against unexpected throw paths.
 *
 * Server-only.
 */

import { createLogger } from '@ab/utils';
import { classifyIntent } from '../intent-classifier';
import { parseQuery } from '../query-parser';
import type { PaletteHost, SearchResult } from '../schema/result-types';
import { loadAimSections } from './aim-sections';
import { loadCards } from './cards';
import { loadCfrSections } from './cfr-sections';
import { loadCourses } from './courses';
import { loadFtsPassages } from './fts-passages';
import { loadGlossaryTerms } from './glossary-terms';
import { loadHandbookSections } from './handbook-sections';
import { loadKnowledgeNodes } from './knowledge-nodes';
import { loadPlans } from './plans';
import { loadReps } from './reps';

const log = createLogger('palette');

type LoaderName =
	| 'handbook'
	| 'cfr'
	| 'aim'
	| 'glossary'
	| 'knodes'
	| 'cards'
	| 'reps'
	| 'plans'
	| 'courses'
	| 'fts-passages';

/**
 * Fan out every DB-backed loader for the active intent. For I-1 / I-2 (scoped
 * / broad) the section + knowledge ilike loaders run; for I-3 (phrase-FTS)
 * we swap them out for the single `loadFtsPassages` query, which produces the
 * same row types (handbook chapter, CFR section, AIM section, knowledge node)
 * with `passageHighlight` populated via `ts_headline`. The mine.* and course
 * loaders run in every intent because their bodies don't fit the FTS shape.
 */
export async function loadPaletteInjected(rawQuery: string, host: PaletteHost): Promise<readonly SearchResult[]> {
	const parsed = parseQuery(rawQuery);
	const freeText = parsed.freeText.trim();
	if (freeText.length === 0 && parsed.filters.length === 0) return [];

	// `classifyIntent` reads `parsed.filters` + `freeText` only; the
	// autocomplete-committed flag is a UI-only signal and never reaches the
	// server. We pass `false` here.
	const intent = classifyIntent(parsed, false);
	const usePhraseFts = intent === 'phrase-fts';

	const sectionPromises: Promise<readonly SearchResult[]>[] = usePhraseFts
		? [loadFtsPassages({ needle: freeText, userId: host.userId })]
		: [
				loadHandbookSections(parsed, host),
				loadCfrSections(parsed, host),
				loadAimSections(parsed, host),
				loadGlossaryTerms(parsed, host),
				loadKnowledgeNodes(parsed, host),
			];

	const settled = await Promise.allSettled<readonly SearchResult[]>([
		...sectionPromises,
		loadCards(parsed, host),
		loadReps(parsed, host),
		loadPlans(parsed, host),
		loadCourses(parsed, host),
	]);

	const names: readonly LoaderName[] = usePhraseFts
		? ['fts-passages', 'cards', 'reps', 'plans', 'courses']
		: ['handbook', 'cfr', 'aim', 'glossary', 'knodes', 'cards', 'reps', 'plans', 'courses'];
	const merged: SearchResult[] = [];
	for (let i = 0; i < settled.length; i += 1) {
		const result = settled[i];
		if (!result) continue;
		if (result.status === 'fulfilled') {
			merged.push(...result.value);
			continue;
		}
		const name = names[i] ?? `#${i}`;
		const reason = result.reason instanceof Error ? result.reason : undefined;
		log.error(`loader ${name} rejected`, { userId: host.userId, metadata: { loader: name } }, reason);
	}
	return merged;
}
