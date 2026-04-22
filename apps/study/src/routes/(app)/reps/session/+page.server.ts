import { requireAuth } from '@ab/auth';
import {
	getNextScenarios,
	getRepAttemptsForSession,
	getScenariosByIds,
	InvalidOptionError,
	ScenarioNotAttemptableError,
	ScenarioNotFoundError,
	submitAttempt,
	submitAttemptSchema,
} from '@ab/bc-study';
import { CONFIDENCE_SAMPLE_RATE, QUERY_PARAMS, REP_BATCH_SIZE } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
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

/**
 * Validate a client-supplied session id / scenario id / timestamp. The id only
 * seeds the shuffle hash and the `ids` list bounds the batch lookup; nothing
 * on the server trusts them for authorization (scenarios are refetched scoped
 * to the authenticated user). The patterns still bound the values so a
 * malformed URL can't poison downstream logging or the seed function.
 */
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const SCENARIO_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Server-derived slot shape. Each pinned scenario is either:
 *   - `resolvable` -- scenario still active; may or may not carry an
 *     `attempt` (the user's in-session answer),
 *   - `skipped` -- scenario was archived / hard-deleted between the pin and
 *     this load. The UI renders a "skipped" slot and advances past it.
 */
export interface ResolvedSlot {
	kind: 'resolvable';
	scenario: {
		id: string;
		title: string;
		situation: string;
		teachingPoint: string;
		domain: string;
		difficulty: string;
		phaseOfFlight: string | null;
		regReferences: string[];
		options: Array<{ id: string; text: string; outcome: string; whyNot: string | null; isCorrect: boolean }>;
		promptConfidence: boolean;
	};
	attempt: {
		id: string;
		chosenOption: string;
		isCorrect: boolean;
		confidence: number | null;
		attemptedAt: string;
	} | null;
}

export interface SkippedSlot {
	kind: 'skipped';
	scenarioId: string;
}

export type Slot = ResolvedSlot | SkippedSlot;

/**
 * Build the pinned-URL shape. Called on first load (no `ids` in query) to
 * compute a fresh batch, persist the scenario ids + startedAt into the URL
 * via redirect, and return the user to the same route with stable state.
 */
function buildPinnedUrl(pathname: string, sessionId: string, scenarioIds: string[], startedAt: Date): string {
	const params = new URLSearchParams();
	params.set('s', sessionId);
	params.set('startedAt', startedAt.toISOString());
	params.set('ids', scenarioIds.join(','));
	return `${pathname}?${params.toString()}`;
}

/** URL-persisted per-item flow phase. */
const REP_ITEM_PHASES = ['read', 'confidence', 'answer'] as const;
type RepItemPhase = (typeof REP_ITEM_PHASES)[number];

interface LoadResult {
	sessionId: string;
	startedAt: string;
	slots: Slot[];
	currentIndex: number;
	total: number;
	initialItem: number;
	initialStep: RepItemPhase;
}

export const load: PageServerLoad = async (event): Promise<LoadResult> => {
	const user = requireAuth(event);
	const now = new Date();

	const urlSession = event.url.searchParams.get('s');
	const urlIds = event.url.searchParams.get('ids');
	const urlStartedAt = event.url.searchParams.get('startedAt');

	const sessionId = urlSession && SESSION_ID_PATTERN.test(urlSession) ? urlSession : now.getTime().toString();

	// First load: no pinned batch. Pull a fresh queue from the BC, persist
	// the (ordered) scenario ids + start timestamp into the URL, and bounce
	// the user back in. Every subsequent load reads the pinned ids and
	// derives progress from rep_attempt rows -- refresh-mid-session resumes
	// the user at the first unanswered scenario automatically.
	if (!urlIds) {
		const queue = await getNextScenarios(user.id, {}, REP_BATCH_SIZE);
		if (queue.length === 0) {
			// Empty-batch path: no scenarios to pin. Return a stable shape
			// the UI renders as "Session complete".
			return {
				sessionId,
				startedAt: now.toISOString(),
				slots: [],
				currentIndex: 0,
				total: 0,
				initialItem: 0,
				initialStep: 'read',
			};
		}
		const pinned = queue.map((s) => s.id);
		throw redirect(303, buildPinnedUrl(event.url.pathname, sessionId, pinned, now));
	}

	// Parse + bound the pinned id list. Each id validated against the same
	// pattern scenario ids are generated with; out-of-pattern entries drop.
	const pinnedIds = urlIds
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0 && SCENARIO_ID_PATTERN.test(s))
		.slice(0, REP_BATCH_SIZE);

	// Parse startedAt; fall back to `now` if malformed so the page still
	// loads. Worst case of a bad startedAt: previously-recorded attempts
	// inside the window don't resolve against this session, so the user
	// re-answers. Correctness-neutral, never silently corrupts data.
	const parsedStartedAt = urlStartedAt ? new Date(urlStartedAt) : now;
	const startedAt = Number.isNaN(parsedStartedAt.getTime()) ? now : parsedStartedAt;

	if (pinnedIds.length === 0) {
		return {
			sessionId,
			startedAt: startedAt.toISOString(),
			slots: [],
			currentIndex: 0,
			total: 0,
			initialItem: 0,
			initialStep: 'read',
		};
	}

	// Fetch the pinned scenarios + user's in-session attempts in parallel.
	// `getScenariosByIds` may return fewer rows than requested (archived,
	// hard-deleted); we reconcile by iterating `pinnedIds` below.
	const [scenarios, attemptsByScenarioId] = await Promise.all([
		getScenariosByIds(pinnedIds, user.id),
		getRepAttemptsForSession(user.id, pinnedIds, startedAt),
	]);
	const scenarioById = new Map(scenarios.map((s) => [s.id, s]));

	const slots: Slot[] = pinnedIds.map((id) => {
		const sc = scenarioById.get(id);
		if (!sc) return { kind: 'skipped', scenarioId: id };
		const attempt = attemptsByScenarioId.get(id) ?? null;
		return {
			kind: 'resolvable',
			scenario: {
				id: sc.id,
				title: sc.title,
				situation: sc.situation,
				teachingPoint: sc.teachingPoint,
				domain: sc.domain,
				difficulty: sc.difficulty,
				phaseOfFlight: sc.phaseOfFlight,
				regReferences: sc.regReferences ?? [],
				// Shuffle seeded from the session id so option order stays
				// stable across reloads and form submits.
				options: shuffleOptions(sc.options, `${sessionId}:${sc.id}`),
				promptConfidence: shouldPromptConfidence(sc.id, startedAt),
			},
			attempt: attempt
				? {
						id: attempt.id,
						chosenOption: attempt.chosenOption,
						isCorrect: attempt.isCorrect,
						confidence: attempt.confidence,
						attemptedAt: attempt.attemptedAt.toISOString(),
					}
				: null,
		};
	});

	// First slot that is still attemptable and not yet answered. A `skipped`
	// slot is always "past"; a `resolvable` slot with a non-null attempt is
	// done. Returns slots.length when the batch is fully resolved -- the UI
	// renders the summary in that case.
	const currentIndex = slots.findIndex((s) => s.kind === 'resolvable' && s.attempt === null);
	const resolvedIndex = currentIndex === -1 ? slots.length : currentIndex;

	// Deep-link inputs: `?item=<0-based-index>` + `?step=<read|confidence|answer>`.
	// These are display pointers that the client mirrors via replaceState so a
	// mid-flow refresh resumes at the same slot + phase. Server-derived
	// resolvedIndex still bounds what's submittable.
	const itemMax = Math.max(0, slots.length - 1);
	const itemParam = Number.parseInt(event.url.searchParams.get(QUERY_PARAMS.ITEM) ?? '', 10);
	const initialItem = Number.isFinite(itemParam)
		? Math.max(0, Math.min(itemMax, itemParam))
		: Math.min(itemMax, resolvedIndex);
	const stepParam = event.url.searchParams.get(QUERY_PARAMS.STEP);
	const initialStep: RepItemPhase = (REP_ITEM_PHASES as readonly string[]).includes(stepParam ?? '')
		? (stepParam as RepItemPhase)
		: 'read';

	return {
		sessionId,
		startedAt: startedAt.toISOString(),
		slots,
		currentIndex: resolvedIndex,
		total: slots.length,
		initialItem,
		initialStep,
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
				// BC narrows via submitAttemptSchema; no cast needed.
				confidence: parsed.data.confidence,
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
