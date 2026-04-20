import { requireAuth } from '@ab/auth';
import { getRepDashboard } from '@ab/bc-study';
import { DEFAULT_USER_TIMEZONE } from '@ab/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	// Dashboard day-boundary stats ("today") are computed in the learner's
	// local timezone. Per-user tz isn't plumbed through auth yet, so this
	// falls back to `DEFAULT_USER_TIMEZONE`. When user settings land, swap
	// `DEFAULT_USER_TIMEZONE` for the user's configured tz here.
	const stats = await getRepDashboard(user.id, undefined, new Date(), DEFAULT_USER_TIMEZONE);
	return { stats };
};
