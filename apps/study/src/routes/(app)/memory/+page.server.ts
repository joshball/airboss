import { getDashboardStats } from '@ab/bc-study';
import { ROUTES } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) redirect(302, ROUTES.LOGIN);

	const stats = await getDashboardStats(user.id);
	return { stats };
};
