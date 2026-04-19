import { requireAuth } from '@ab/auth';
import {
	getNextScenarios,
	InvalidOptionError,
	ScenarioNotAttemptableError,
	ScenarioNotFoundError,
	submitAttempt,
	submitAttemptSchema,
} from '@ab/bc-study';
import { CONFIDENCE_SAMPLE_RATE, type ConfidenceLevel, REP_BATCH_SIZE } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:reps-session');

/**
 * Deterministic 0..1 score for (scenarioId, dayKey). Same djb2 variant the
 * card-review flow uses so reps and cards sample on the same rhythm. The
 * property that matters: a given scenario on a given day is always
 * prompted or never prompted.
 */
function deterministicUnit(key: string): number {
	let h = 5381;
	for (let i = 0; i < key.length; i++) {
		h = ((h << 5) + h + key.charCodeAt(i)) | 0;
	}
	return ((h >>> 0) % 10_000) / 10_000;
}

function shouldPromptConfidence(scenarioId: string, sessionDate: Date): boolean {
	const dayKey = sessionDate.toISOString().slice(0, 10);
	return deterministicUnit(`${scenarioId}:${dayKey}`) < CONFIDENCE_SAMPLE_RATE;
}

/**
 * Deterministic Fisher-Yates shuffle seeded from (scenarioId, session
 * start timestamp). The spec mandates "randomized on every display" but
 * SvelteKit rerenders on form result, so we derive order from a stable
 * per-session seed rather than Math.random() -- otherwise every rating
 * submit reshuffles the options behind the user.
 */
function shuffleOptions<T extends { id: string }>(options: T[], seed: string): T[] {
	const arr = [...options];
	let h = 5381;
	for (let i = 0; i < seed.length; i++) {
		h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
	}
	// xorshift from the hash to pull quasi-uniform indices.
	let state = h >>> 0;
	function next(): number {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return (state >>> 0) / 0xffffffff;
	}
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(next() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);

	const now = new Date();
	const sessionId = now.getTime().toString();
	const queue = await getNextScenarios(user.id, {}, REP_BATCH_SIZE);

	const batch = queue.map((sc) => ({
		id: sc.id,
		title: sc.title,
		situation: sc.situation,
		teachingPoint: sc.teachingPoint,
		domain: sc.domain,
		difficulty: sc.difficulty,
		phaseOfFlight: sc.phaseOfFlight,
		regReferences: sc.regReferences ?? [],
		// Options shuffled per scenario so position doesn't leak the answer.
		options: shuffleOptions(sc.options, `${sessionId}:${sc.id}`),
		promptConfidence: shouldPromptConfidence(sc.id, now),
	}));

	return {
		batch,
		sessionId,
		startedAt: now.toISOString(),
	};
};

export const actions: Actions = {
	submit: async (event) => {
		const user = requireAuth(event);
		const { request, locals } = event;

		const form = await request.formData();
		const scenarioId = String(form.get('scenarioId') ?? '');
		const chosenOption = String(form.get('chosenOption') ?? '');
		const confidenceRaw = form.get('confidence');
		const answerMsRaw = form.get('answerMs');

		if (!scenarioId) return fail(400, { error: 'scenarioId is required' });

		const parsed = submitAttemptSchema.safeParse({
			scenarioId,
			chosenOption,
			confidence: confidenceRaw == null || confidenceRaw === '' ? null : Number(confidenceRaw),
			answerMs: answerMsRaw == null || answerMsRaw === '' ? null : Number(answerMsRaw),
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid submission' });
		}

		try {
			const attempt = await submitAttempt({
				scenarioId,
				userId: user.id,
				chosenOption: parsed.data.chosenOption,
				confidence: parsed.data.confidence as ConfidenceLevel | null | undefined,
				answerMs: parsed.data.answerMs,
			});
			return {
				success: true as const,
				scenarioId,
				attemptId: attempt.id,
				chosenOption: attempt.chosenOption,
				isCorrect: attempt.isCorrect,
				skipped: false as const,
			};
		} catch (err) {
			// Spec edge case: scenario deleted mid-session, or archived in
			// another tab between load and submit. Skip, advance.
			if (err instanceof ScenarioNotFoundError || err instanceof ScenarioNotAttemptableError) {
				return { success: true as const, scenarioId, skipped: true as const };
			}
			if (err instanceof InvalidOptionError) {
				return fail(400, { error: 'Selected option is not on this scenario.' });
			}
			log.error(
				'submitAttempt threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { scenarioId } },
				err instanceof Error ? err : undefined,
			);
			error(500, { message: 'Could not save rep attempt' });
		}
	},
} satisfies Actions;
