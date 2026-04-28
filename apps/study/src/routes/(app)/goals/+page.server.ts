import { requireAuth } from '@ab/auth';
import { type GoalRow, listGoals } from '@ab/bc-study';
import { GOAL_STATUSES, type GoalStatus } from '@ab/constants';
import type { PageServerLoad } from './$types';

export interface GoalsByStatus {
	active: GoalRow[];
	paused: GoalRow[];
	completed: GoalRow[];
	abandoned: GoalRow[];
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const all = await listGoals(user.id);

	const grouped: GoalsByStatus = { active: [], paused: [], completed: [], abandoned: [] };
	for (const goal of all) {
		const bucket = goal.status as GoalStatus;
		if (bucket === GOAL_STATUSES.ACTIVE) grouped.active.push(goal);
		else if (bucket === GOAL_STATUSES.PAUSED) grouped.paused.push(goal);
		else if (bucket === GOAL_STATUSES.COMPLETED) grouped.completed.push(goal);
		else if (bucket === GOAL_STATUSES.ABANDONED) grouped.abandoned.push(goal);
	}
	// Primary always pinned at top of active.
	grouped.active.sort((a, b) => {
		if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
		return b.updatedAt.getTime() - a.updatedAt.getTime();
	});
	return { grouped };
};
