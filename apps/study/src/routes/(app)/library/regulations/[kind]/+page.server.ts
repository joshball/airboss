/**
 * `/library/regulations/[kind]` -- one regulations bucket.
 *
 * Inside each bucket the references are split into structural groups:
 *   - 14 CFR / 49 CFR: by Part (slug `14cfr91` -> Part 91).
 *   - AIM: by chapter when section data exists, else AIM umbrella + PCG.
 *   - AC: by series (slug `ac-91-23` -> series 91), per spec the live series
 *     buckets are 00, 60, 61, 90, 91, 120, 150.
 *   - NTSB: single umbrella card.
 *
 * Each group renders as a card linking to `/library/regulations/[kind]/[group]`.
 *
 * Loader is a thin adapter: parse the `[kind]` slug, call the
 * `getRegulationsView` BC aggregator, return its payload. The view-shape
 * computation lives in `libs/bc/study/src/regulations.ts`.
 */

import { requireAuth } from '@ab/auth';
import { parseRegulationKind } from '@ab/aviation';
import { getRegulationsView } from '@ab/bc-study';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const kind = parseRegulationKind(event.params.kind);
	if (!kind) {
		throw error(404, `Unknown regulations kind: ${event.params.kind}`);
	}

	const view = await getRegulationsView({ view: 'group', kind });
	return {
		kind: view.kind,
		kindLabel: view.kindLabel,
		groups: view.groups,
		umbrellas: view.umbrellas,
	};
};
