import { requireAuth } from '@ab/auth';
import { abandonStaleSessions, getDashboardStats, getLatestResumableSession } from '@ab/bc-study';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	// Lazy abandon pass so the resumable-session read reflects the 14-day
	// cutoff without a background job (see review-sessions-url spec).
	await abandonStaleSessions(user.id);

	const [stats, resumable] = await Promise.all([getDashboardStats(user.id), getLatestResumableSession(user.id)]);
	return {
		stats,
		resumableSession: resumable
			? {
					id: resumable.id,
					status: resumable.status,
					currentIndex: resumable.currentIndex,
					totalCards: resumable.cardIdList.length,
					lastActivityAt: resumable.lastActivityAt.toISOString(),
				}
			: null,
	};
};
