/**
 * Client-side attempt poster.
 *
 * The cockpit / horizon / dual / window pages call `postAttempt` after
 * the FDM worker emits TAPE. The endpoint persists the row when the
 * user is authenticated; anonymous calls return 401, in which case
 * sessionStorage is the fallback (already wired in tape-store).
 *
 * Failure is silent end-to-end on the page side -- a flap-router blip,
 * an expired session, or DB hiccup must never crash a debrief flow.
 * The tape + grade still land in sessionStorage, so the debrief view
 * still loads.
 */

import type { GradeReport, ReplayTape, ScenarioRunResult } from '@ab/bc-sim';
import { ROUTES, type SimScenarioId } from '@ab/constants';

export interface PostAttemptInput {
	scenarioId: SimScenarioId;
	result: ScenarioRunResult;
	tape: ReplayTape | null;
	grade: GradeReport | null;
}

export interface PostAttemptResult {
	persisted: boolean;
	id?: string;
	status?: number;
}

export async function postAttempt(input: PostAttemptInput): Promise<PostAttemptResult> {
	if (typeof fetch === 'undefined') return { persisted: false };
	try {
		const res = await fetch(`${ROUTES.SIM_SCENARIO(input.scenarioId)}/attempt`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				scenarioId: input.scenarioId,
				result: {
					scenarioId: input.result.scenarioId,
					outcome: input.result.outcome,
					elapsedSeconds: input.result.elapsedSeconds,
					peakAltitudeAgl: input.result.peakAltitudeAgl,
					maxAlpha: input.result.maxAlpha,
					reason: input.result.reason,
				},
				tape: input.tape,
				grade: input.grade,
			}),
		});
		if (!res.ok) return { persisted: false, status: res.status };
		const body = (await res.json()) as { id?: string };
		return { persisted: true, id: body.id, status: res.status };
	} catch {
		return { persisted: false };
	}
}
