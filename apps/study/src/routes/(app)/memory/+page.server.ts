import { requireAuth } from '@ab/auth';
import { getDashboardStats } from '@ab/bc-study';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const stats = await getDashboardStats(user.id);
	return { stats };
};
