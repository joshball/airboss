/**
 * `/content` -- the content census overview. Phase 1 of the
 * `hangar-content-census` work package.
 *
 * Calls every registered corpus adapter via `@ab/content-census/server`
 * (`censusAll()`), reduces each `CorpusCensus` to its headline overview row,
 * and returns the rows for the row-per-corpus table. wx-catalog has a full
 * Phase-1 reference adapter; the other 13 corpora render through the honest
 * stub adapter until Phase 2.
 *
 * The adapters read the filesystem (`node:fs`); this file is server-only by
 * SvelteKit convention, so the `/server` import is safe and is excluded from
 * the client-eligible scan. The `.svelte` component receives only the
 * browser-safe `CensusOverviewRow[]`.
 */

import { requireRole } from '@ab/auth';
import { ROLES } from '@ab/constants';
import { type CensusOverviewRow, toOverviewRow } from '@ab/content-census';
import { censusAll } from '@ab/content-census/server';
import type { PageServerLoad } from './$types';

export interface ContentCensusData {
	rows: CensusOverviewRow[];
}

export const load: PageServerLoad = (event): ContentCensusData => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const rows = censusAll().map(toOverviewRow);
	return { rows };
};
