/**
 * Layout loader for the `/program` surface (study-app-ia-cleanup Phase 2).
 *
 * Two responsibilities:
 *
 * 1. Fan out the `getPrimaryGoal` + `getActivePlan` queries that every sub-tab
 *    needs to decide whether the Goal / Plan tabs are populated and which
 *    detail row to land on. SvelteKit invalidates the layout load on every
 *    route change inside `/program/*` so the tab strip stays consistent.
 * 2. Compute the default sub-tab via `resolveDefaultProgramTab` so the
 *    `/program` index page can issue a server-side redirect with no client
 *    flicker.
 */

import { requireAuth } from '@ab/auth';
import { getActivePlan, getPrimaryGoal } from '@ab/bc-study';
import { resolveDefaultProgramTab } from '$lib/program/default-tab';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = requireAuth(event);
	const [primaryGoal, activePlan] = await Promise.all([getPrimaryGoal(user.id), getActivePlan(user.id)]);
	return {
		primaryGoal: primaryGoal ? { id: primaryGoal.id, title: primaryGoal.title } : null,
		activePlan: activePlan ? { id: activePlan.id } : null,
		defaultTab: resolveDefaultProgramTab({ hasGoal: primaryGoal !== null }),
	};
};
