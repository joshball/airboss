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
import { HOSTS, ROUTES, SIM_HISTORY } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

function studyLoginUrl(currentUrl: URL): string {
	// Sim runs at sim.airboss.test in dev, sim.air-boss.org in prod. The
	// study host is always the sibling subdomain, so derive the target
	// from the request host: replace the leading subdomain with `study`.
	// Falls back to the dev study host when we can't parse a sibling
	// (e.g. the request came in on `127.0.0.1`).
	const fallback = `${currentUrl.protocol}//${HOSTS.STUDY}${ROUTES.LOGIN}`;
	const host = currentUrl.host;
	const dotIdx = host.indexOf('.');
	if (dotIdx <= 0) return fallback;
	const parent = host.slice(dotIdx + 1);
	return `${currentUrl.protocol}//study.${parent}${ROUTES.LOGIN}`;
}

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
