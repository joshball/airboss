import { requireAuth } from '@ab/auth';
import { getRepDashboard } from '@ab/bc-study';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const stats = await getRepDashboard(user.id);
	return { stats };
};
