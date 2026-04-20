import { requireAuth } from '@ab/auth';
import { getDashboardPayload } from '@ab/bc-study';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	// Single entry point -- BC aggregator fans out per-panel queries in parallel
	// via `Promise.allSettled`. The view handles `{ value }` vs `{ error }`
	// panel-level tuples so a single failing query does not blank the page.
	const payload = await getDashboardPayload(user.id);
	return { payload };
};
