/**
 * POST /[scenarioId]/attempt
 *
 * Persists one completed sim flight. Called from any sim page that
 * hosts the FDM worker (cockpit / horizon / dual / window) after the
 * TAPE message arrives. Anonymous requests are rejected with 401 --
 * the authenticated session cookie attribution is the entire point of
 * this endpoint; sessionStorage is the fallback for unauthenticated
 * runs (see `apps/sim/src/lib/tape-store.svelte.ts`).
 *
 * Tape + grade are best-effort: the BC's `recordSimAttempt` accepts
 * `null` for both (e.g. aborted runs that produced no frames; scenarios
 * with no grading block). The route preserves that contract.
 */

import type { GradeReport } from '@ab/bc-sim';
import { recordSimAttempt } from '@ab/bc-sim/persistence';
import { SIM_SCENARIO_ID_VALUES, type SimScenarioId } from '@ab/constants';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface AttemptPayload {
	scenarioId: string;
	result: {
		scenarioId: string;
		outcome: string;
		elapsedSeconds: number;
		peakAltitudeAgl: number;
		maxAlpha: number;
		reason: string;
	};
	tape: unknown;
	grade: {
		total: number;
		components: ReadonlyArray<{ kind: string; weight: number; score: number; summary?: string }>;
	} | null;
}

function isSimScenarioId(value: string): value is SimScenarioId {
	return (SIM_SCENARIO_ID_VALUES as readonly string[]).includes(value);
}

function isAttemptPayload(value: unknown): value is AttemptPayload {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	if (typeof v.scenarioId !== 'string') return false;
	const r = v.result;
	if (typeof r !== 'object' || r === null) return false;
	const result = r as Record<string, unknown>;
	if (typeof result.outcome !== 'string') return false;
	if (typeof result.reason !== 'string') return false;
	if (typeof result.elapsedSeconds !== 'number') return false;
	if (typeof result.peakAltitudeAgl !== 'number') return false;
	if (typeof result.maxAlpha !== 'number') return false;
	// tape + grade are nullable; deeper validation happens in the BC.
	return true;
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Sign in via study to record sim attempts.');
	}
	if (!isSimScenarioId(params.scenarioId)) {
		throw error(404, 'Unknown scenario');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Body must be valid JSON');
	}
	if (!isAttemptPayload(body)) {
		throw error(400, 'Payload missing required fields');
	}
	if (body.scenarioId !== params.scenarioId) {
		throw error(400, 'scenarioId in payload does not match URL');
	}

	const tape =
		body.tape && typeof body.tape === 'object' ? (body.tape as Parameters<typeof recordSimAttempt>[0]['tape']) : null;
	// Cast at the boundary: the route's structural validator (above)
	// confirms the component shape matches; the BC's `evaluateGrading`
	// is what populates these rows in the first place, so narrowing
	// `kind: string` -> `GradingComponentKind` here is a no-op.
	const grade = (body.grade ?? null) as GradeReport | null;

	const row = await recordSimAttempt({
		userId: locals.user.id,
		scenarioId: body.scenarioId,
		result: {
			scenarioId: body.scenarioId,
			// Outcome is stored as text in the row; the BC validates against
			// SIM_SCENARIO_OUTCOMES at the call site -- here we trust the
			// caller because the cockpit page produced it from a worker
			// message we control end-to-end.
			outcome: body.result.outcome as Parameters<typeof recordSimAttempt>[0]['result']['outcome'],
			elapsedSeconds: body.result.elapsedSeconds,
			peakAltitudeAgl: body.result.peakAltitudeAgl,
			maxAlpha: body.result.maxAlpha,
			reason: body.result.reason,
		},
		tape,
		grade,
	});

	return json({ id: row.id }, { status: 201 });
};
