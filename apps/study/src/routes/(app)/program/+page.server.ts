/**
 * `/program` index loader (study-app-ia-cleanup Phase 2).
 *
 * Resolves the requested sub-tab and redirects to its child route. The
 * `?tab=` query param wins; an absent or invalid value falls back to
 * `defaultTab` from the layout load (Goal when the user has one, else
 * Quals).
 *
 * The redirect lives in the loader (not a `+page.svelte` `goto`) so direct
 * deep links to `/program?tab=plan` resolve server-side without a flash of
 * empty page.
 */

import { PROGRAM_TABS, QUERY_PARAMS, ROUTES } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import { parseProgramTab } from '$lib/program/default-tab';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const parent = await event.parent();
	const requested = parseProgramTab(event.url.searchParams.get(QUERY_PARAMS.PROGRAM_TAB));
	const tab = requested ?? parent.defaultTab;
	switch (tab) {
		case PROGRAM_TABS.QUALS:
			throw redirect(303, ROUTES.PROGRAM_QUALS);
		case PROGRAM_TABS.GOAL:
			throw redirect(303, parent.primaryGoal ? ROUTES.PROGRAM_GOAL(parent.primaryGoal.id) : ROUTES.PROGRAM_GOALS);
		case PROGRAM_TABS.PLAN:
			throw redirect(303, parent.activePlan ? ROUTES.PROGRAM_PLAN(parent.activePlan.id) : ROUTES.PROGRAM_PLANS);
		case PROGRAM_TABS.COVERAGE:
			throw redirect(303, ROUTES.PROGRAM_COVERAGE);
	}
};
