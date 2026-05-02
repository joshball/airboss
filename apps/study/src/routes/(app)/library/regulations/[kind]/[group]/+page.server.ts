/**
 * `/library/regulations/[kind]/[group]` -- one Part / Chapter / AC series.
 *
 * Forward-compatible loader: if the matching reference has any inline
 * section rows, the BC aggregator returns them in the section-list view.
 * Otherwise the umbrella card list is what renders, so the page never 404s
 * just because inline content hasn't been ingested yet.
 *
 * The unknown-group case (a slug-shape valid input that doesn't resolve to
 * any reference and doesn't match a published bucket) does 404 -- that's a
 * typo'd URL, not a missing-content gap.
 *
 * Loader is a thin adapter: parse the `[kind]/[group]` slugs, call the
 * `getRegulationsView` BC aggregator, return its payload. The view-shape
 * computation (per-kind grouping rules, umbrella mapping, section TOC probe)
 * lives in `libs/bc/study/src/regulations.ts`.
 */

import { requireAuth } from '@ab/auth';
import { parseRegulationGroup, parseRegulationKind } from '@ab/aviation';
import { getRegulationsView, RegulationsViewNotFoundError } from '@ab/bc-study';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const kind = parseRegulationKind(event.params.kind);
	if (!kind) {
		throw error(404, `Unknown regulations kind: ${event.params.kind}`);
	}
	const group = parseRegulationGroup(kind, event.params.group);
	if (!group) {
		throw error(404, `Invalid group slug: ${event.params.group}`);
	}

	try {
		const view = await getRegulationsView({ view: 'section', kind, group });
		return {
			kind: view.kind,
			kindLabel: view.kindLabel,
			group: view.group,
			groupLabel: view.groupLabel,
			umbrellas: view.umbrellas,
			sections: view.sections,
		};
	} catch (err) {
		if (err instanceof RegulationsViewNotFoundError) throw error(404, err.message);
		throw err;
	}
};
