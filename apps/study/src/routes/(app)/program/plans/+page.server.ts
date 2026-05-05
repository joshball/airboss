import { requireAuth } from '@ab/auth';
import { getActivePlan, getPlans } from '@ab/bc-study/server';
import { PLAN_STATUSES } from '@ab/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const [activePlan, allPlans] = await Promise.all([getActivePlan(user.id), getPlans(user.id)]);
	const archived = allPlans.filter((p) => p.status !== PLAN_STATUSES.ACTIVE);
	return { activePlan, archived };
};
