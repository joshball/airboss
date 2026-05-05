/**
 * `/program/coverage` -- read-only summary of the user's qual / goal / plan
 * coverage (study-app-ia-cleanup Phase 2).
 *
 * Phase 2 ships a minimal projection: counts of qualifications the user is
 * working on, total goals, plan presence. Future WPs deepen this into the
 * gap-coverage matrix described in design.md (areas covered by the active
 * plan vs. uncovered, by qual). Today's loader returns just the seed shape
 * so the tab renders without an empty page.
 */

import { requireAuth } from '@ab/auth';
import { getActivePlan, getPrimaryGoal, listGoals } from '@ab/bc-study';
import type { PageServerLoad } from './$types';

export interface ProgramCoverageData {
	hasGoal: boolean;
	hasPlan: boolean;
	goalCount: number;
	primaryGoalTitle: string | null;
}

export const load: PageServerLoad = async (event): Promise<ProgramCoverageData> => {
	const user = requireAuth(event);
	const [primaryGoal, activePlan, goals] = await Promise.all([
		getPrimaryGoal(user.id),
		getActivePlan(user.id),
		listGoals(user.id),
	]);
	return {
		hasGoal: primaryGoal !== null,
		hasPlan: activePlan !== null,
		goalCount: goals.length,
		primaryGoalTitle: primaryGoal?.title ?? null,
	};
};
