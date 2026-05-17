/**
 * `/content/[corpus]` -- the per-corpus census drill-down. Phase 1 of the
 * `hangar-content-census` work package.
 *
 * Looks up the one adapter for `[corpus]` via `@ab/content-census/server`
 * and returns its `CorpusCensus`. ONE generic `+page.svelte` renders every
 * corpus -- the heterogeneity is absorbed by the adapter, not the UI.
 *
 * As of content-census Phase 2 every corpus in `CORPUS_REGISTRY` ships a
 * real Layer-1 adapter; the `stubCensus` fallback is retained only as a
 * defensive default for a corpus registered before its adapter lands. An
 * unknown `[corpus]` id 404s.
 *
 * The adapters read the filesystem; this file is server-only by SvelteKit
 * convention so the `/server` import is safe.
 */

import { requireRole } from '@ab/auth';
import { ROLES } from '@ab/constants';
import { CORPUS_IDS, type CorpusCensus, type CorpusId } from '@ab/content-census';
import { censusFor } from '@ab/content-census/server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export interface ContentCensusCorpusData {
	census: CorpusCensus;
}

function isCorpusId(value: string): value is CorpusId {
	return (CORPUS_IDS as readonly string[]).includes(value);
}

export const load: PageServerLoad = (event): ContentCensusCorpusData => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const { corpus } = event.params;
	if (!isCorpusId(corpus)) {
		error(404, `Unknown content corpus: ${corpus}`);
	}
	return { census: censusFor(corpus) };
};
