/**
 * Per-attempt detail server load.
 *
 * Fetches one `sim_attempt` row -- including the heavy `tape` column and
 * the per-component `grade` JSON -- so the page can render the full
 * grading breakdown for one flight.
 *
 * Ownership is enforced by the BC: `loadSimAttempt(id, userId)` returns
 * `null` when the row belongs to a different user, so URL guessing
 * surfaces a 404 rather than another learner's tape.
 */

import { loadSimAttempt } from '@ab/bc-sim/persistence';
import { error, redirect } from '@sveltejs/kit';
import { studyLoginUrl } from '$lib/server/study-login';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) {
		throw redirect(303, studyLoginUrl(url));
	}

	const row = await loadSimAttempt(params.attemptId, locals.user.id);
	if (!row) {
		throw error(404, 'Attempt not found.');
	}

	// Tape is large -- the detail page does not render frames yet, so drop
	// it before serialising. The full debrief surface (with scrubber) is a
	// separate route; this page focuses on the grading recap.
	return {
		attempt: {
			id: row.id,
			scenarioId: row.scenarioId,
			outcome: row.outcome,
			reason: row.reason,
			elapsedSeconds: row.elapsedSeconds,
			gradeTotal: row.gradeTotal,
			grade: row.grade,
			endedAt: row.endedAt,
		},
	};
};
