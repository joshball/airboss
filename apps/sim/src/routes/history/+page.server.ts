/**
 * Sim history dashboard server load.
 *
 * Surfaces the authenticated learner's recent sim attempts (newest first)
 * with the heavy `tape` column excluded -- callers that need a tape for a
 * specific row hit `/history/[attemptId]` and pay for it there.
 *
 * Anonymous visits redirect to study sign-in. The `bauth_session_token`
 * cookie is shared across the `.airboss.test` parent domain, so the user
 * lands back on sim with a populated session after authenticating.
 */

import { listRecentSimAttempts } from '@ab/bc-sim/persistence';
import { SIM_HISTORY } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import { studyLoginUrl } from '$lib/server/study-login';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, studyLoginUrl(url));
	}

	const attempts = await listRecentSimAttempts(locals.user.id, SIM_HISTORY.LIST_LIMIT);

	return {
		attempts: attempts.map((row) => ({
			id: row.id,
			scenarioId: row.scenarioId,
			outcome: row.outcome,
			reason: row.reason,
			elapsedSeconds: row.elapsedSeconds,
			gradeTotal: row.gradeTotal,
			endedAt: row.endedAt,
		})),
	};
};
