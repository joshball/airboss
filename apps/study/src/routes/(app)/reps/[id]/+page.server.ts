/**
 * Scenario detail -- `/reps/<id>`. Peer affordance with the card and node
 * detail pages so the session-start preview can expose every rep ID as a
 * real link. Presents the scenario's prompt + last-5 attempts + an entry
 * point for starting a fresh attempt via the standard reps flow.
 *
 * Scoped to the caller's user: the BC query filters by user_id so route
 * guessing cannot leak another learner's scenario text. 404 when the
 * scenario is missing or belongs to another user.
 */

import { requireAuth } from '@ab/auth';
import { getRecentAttemptsForScenario, getScenario } from '@ab/bc-study';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { params } = event;

	const [scenario, recentAttempts] = await Promise.all([
		getScenario(params.id, user.id),
		getRecentAttemptsForScenario(params.id, user.id, 5),
	]);

	if (!scenario) error(404, { message: 'Scenario not found' });

	return {
		scenario,
		recentAttempts,
	};
};
