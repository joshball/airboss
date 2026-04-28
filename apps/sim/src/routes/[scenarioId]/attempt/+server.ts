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
import {
	SIM_SCENARIO_ID_VALUES,
	SIM_SCENARIO_OUTCOME_VALUES,
	type SimScenarioId,
} from '@ab/constants';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

/** Defensive caps so a malicious payload can't store unbounded text or arrays. */
const REASON_MAX_LENGTH = 200;
const GRADE_COMPONENT_MAX = 32;
const GRADE_SUMMARY_MAX = 200;

const attemptResultSchema = z.object({
	scenarioId: z.string().min(1),
	outcome: z.enum(SIM_SCENARIO_OUTCOME_VALUES as readonly [string, ...string[]]),
	elapsedSeconds: z.number().finite().nonnegative(),
	peakAltitudeAgl: z.number().finite(),
	maxAlpha: z.number().finite(),
	reason: z.string().max(REASON_MAX_LENGTH),
});

const gradeComponentSchema = z.object({
	kind: z.string().min(1).max(64),
	weight: z.number().finite(),
	score: z.number().finite(),
	summary: z.string().max(GRADE_SUMMARY_MAX).optional(),
});

const gradeSchema = z
	.object({
		total: z.number().finite(),
		components: z.array(gradeComponentSchema).max(GRADE_COMPONENT_MAX),
	})
	.nullable();

const attemptPayloadSchema = z.object({
	scenarioId: z.string().min(1),
	result: attemptResultSchema,
	tape: z.unknown(),
	grade: gradeSchema,
});

function isSimScenarioId(value: string): value is SimScenarioId {
	return (SIM_SCENARIO_ID_VALUES as readonly string[]).includes(value);
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
	const parsed = attemptPayloadSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, 'Payload missing required fields');
	}
	const payload = parsed.data;
	if (payload.scenarioId !== params.scenarioId) {
		throw error(400, 'scenarioId in payload does not match URL');
	}

	const tape =
		payload.tape && typeof payload.tape === 'object'
			? (payload.tape as Parameters<typeof recordSimAttempt>[0]['tape'])
			: null;
	// Cast at the boundary: Zod confirmed the structural shape; component
	// `kind` strings are narrowed to GradingComponentKind by the BC. The
	// worker is browser code and is therefore not trusted -- the schema
	// above is what enforces the contract.
	const grade = (payload.grade ?? null) as GradeReport | null;

	const row = await recordSimAttempt({
		userId: locals.user.id,
		scenarioId: payload.scenarioId,
		result: {
			scenarioId: payload.scenarioId,
			outcome: payload.result.outcome as Parameters<typeof recordSimAttempt>[0]['result']['outcome'],
			elapsedSeconds: payload.result.elapsedSeconds,
			peakAltitudeAgl: payload.result.peakAltitudeAgl,
			maxAlpha: payload.result.maxAlpha,
			reason: payload.result.reason,
		},
		tape,
		grade,
	});

	return json({ id: row.id }, { status: 201 });
};
