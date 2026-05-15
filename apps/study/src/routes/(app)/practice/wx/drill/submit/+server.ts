/**
 * POST `/practice/wx/drill/submit`
 *
 * Record one attempt: grade the answer (pure), update the mastery ledger
 * (state machine + DB upsert), return correctness + rationale + any
 * state transition the route can surface to the user.
 *
 * Body shape:
 *
 *   { sessionId, product, rawExample, family, subFamily, tokenShown,
 *     questionForm, answer, responseMs, acrossSession,
 *     decode, why?, expectedOptionKey?, acceptable? }
 *
 * The browser already has the annotation (`decode` / `why`) from the
 * `/start` response, so it ships them back rather than the server
 * re-deriving them. Acceptable answers + expected option key follow the
 * same convention.
 */

import { requireAuth } from '@ab/auth';
import { gradeAttempt, recordAttempt } from '@ab/bc-wx-practice/server';
import {
	WX_PRACTICE_QUESTION_FORM_VALUES,
	WX_PRODUCT_VALUES,
	type WxPracticeQuestionForm,
	type WxProduct,
} from '@ab/constants';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const PRODUCT_SET = new Set<string>(WX_PRODUCT_VALUES);
const QUESTION_FORM_SET = new Set<string>(WX_PRACTICE_QUESTION_FORM_VALUES);

interface SubmitBody {
	sessionId?: unknown;
	product?: unknown;
	rawExample?: unknown;
	family?: unknown;
	subFamily?: unknown;
	tokenShown?: unknown;
	questionForm?: unknown;
	answer?: unknown;
	responseMs?: unknown;
	acrossSession?: unknown;
	decode?: unknown;
	why?: unknown;
	expectedOptionKey?: unknown;
	acceptable?: unknown;
}

function asString(v: unknown, field: string): string {
	if (typeof v !== 'string') throw error(400, `${field} must be a string.`);
	return v;
}

function asProduct(v: unknown): WxProduct {
	if (typeof v !== 'string' || !PRODUCT_SET.has(v)) throw error(400, `Unknown product: ${String(v)}.`);
	return v as WxProduct;
}

function asQuestionForm(v: unknown): WxPracticeQuestionForm {
	if (typeof v !== 'string' || !QUESTION_FORM_SET.has(v)) throw error(400, `Unknown questionForm: ${String(v)}.`);
	return v as WxPracticeQuestionForm;
}

function asInt(v: unknown, field: string): number {
	if (typeof v !== 'number' || !Number.isInteger(v) || v < 0)
		throw error(400, `${field} must be a non-negative integer.`);
	return v;
}

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);
	let body: SubmitBody;
	try {
		body = (await event.request.json()) as SubmitBody;
	} catch {
		throw error(400, 'Body must be JSON.');
	}

	const sessionId = asString(body.sessionId, 'sessionId');
	const product = asProduct(body.product);
	const rawExample = asString(body.rawExample, 'rawExample');
	const family = asString(body.family, 'family');
	const subFamily =
		body.subFamily === null || body.subFamily === undefined ? null : asString(body.subFamily, 'subFamily');
	const tokenShown = asString(body.tokenShown, 'tokenShown');
	const questionForm = asQuestionForm(body.questionForm);
	const answer = asString(body.answer, 'answer');
	const responseMs = asInt(body.responseMs, 'responseMs');
	const acrossSession = typeof body.acrossSession === 'boolean' ? body.acrossSession : true;
	const decode = asString(body.decode, 'decode');
	const why = body.why === null || body.why === undefined ? undefined : asString(body.why, 'why');
	const expectedOptionKey =
		body.expectedOptionKey === null || body.expectedOptionKey === undefined
			? undefined
			: asString(body.expectedOptionKey, 'expectedOptionKey');
	const acceptable = Array.isArray(body.acceptable)
		? body.acceptable.map((a, i) => asString(a, `acceptable[${i}]`))
		: undefined;

	const grade = gradeAttempt({
		annotation: { token: tokenShown, family, decode, why },
		questionForm,
		answer,
		acceptable,
		expectedOptionKey,
	});

	const result = await recordAttempt({
		userId: user.id,
		sessionId,
		product,
		rawExample,
		family,
		subFamily,
		tokenShown,
		questionForm,
		correct: grade.correct,
		answer,
		responseMs,
		acrossSession,
	});

	return json({
		correct: grade.correct,
		rationale: grade.rationale,
		transition: result.transition,
		mastery: {
			attempts: result.mastery.attempts,
			correct: result.mastery.correct,
			state: result.mastery.state,
			streakAcrossSessions: result.mastery.streakAcrossSessions,
		},
	});
};
