import { requireAuth } from '@ab/auth';
import {
	CardNotFoundError,
	CardNotReviewableError,
	completeSession,
	getCard,
	getScenario,
	getSession,
	getSessionItemResults,
	InvalidOptionError,
	recordItemResult,
	ScenarioNotAttemptableError,
	ScenarioNotFoundError,
	SessionNotFoundError,
	submitAttempt,
	submitAttemptSchema,
	submitReview,
	submitReviewSchema,
} from '@ab/bc-study';
import {
	CONFIDENCE_LEVEL_VALUES,
	type ConfidenceLevel,
	QUERY_PARAMS,
	type ReviewRating,
	ROUTES,
	SESSION_ITEM_KINDS,
	SESSION_SKIP_KIND_VALUES,
	type SessionItemKind,
	type SessionReasonCode,
	type SessionSkipKind,
	type SessionSlice,
} from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:session-runner');

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const session = await getSession(event.params.id, user.id);
	if (!session) throw error(404, { message: 'Session not found' });
	if (session.completedAt !== null) {
		throw redirect(303, ROUTES.SESSION_SUMMARY(session.id));
	}

	const results = await getSessionItemResults(session.id, user.id);

	// Find the first unresolved slot (no completedAt); that's the current item.
	// Submit / skip actions always act on this slot so the queue cannot be
	// spoofed via URL. `?item=` is a display pointer only: a clamped hint that
	// the client mirrors into the URL for shareability and refresh-resilience.
	const current = results.find((r) => r.completedAt === null) ?? null;

	const itemMax = results.length - 1;
	const itemParam = Number.parseInt(event.url.searchParams.get(QUERY_PARAMS.ITEM) ?? '', 10);
	const itemClamped = Number.isFinite(itemParam)
		? Math.max(0, Math.min(itemMax, itemParam))
		: (current?.slotIndex ?? 0);

	// Per-item flow phases. `read` lets the learner see the prompt without
	// committing; `confidence` optionally captures a self-rating; `answer`
	// reveals the answer / picks an option. Narrow against the valid set so a
	// bogus `?step=foo` falls back cleanly to `read`.
	const SESSION_ITEM_PHASES = ['read', 'confidence', 'answer'] as const;
	type SessionItemPhase = (typeof SESSION_ITEM_PHASES)[number];
	const stepParam = event.url.searchParams.get(QUERY_PARAMS.STEP);
	const initialStep: SessionItemPhase = (SESSION_ITEM_PHASES as readonly string[]).includes(stepParam ?? '')
		? (stepParam as SessionItemPhase)
		: 'read';

	// Hydrate the current item's content if it's a card or rep so the UI can
	// render front/back / situation / options without a second fetch.
	let hydrated:
		| { kind: 'card'; front: string; back: string; domain: string; tags: string[] }
		| {
				kind: 'rep';
				title: string;
				situation: string;
				options: Array<{ id: string; text: string }>;
				teachingPoint: string;
				domain: string;
				regReferences: string[];
		  }
		| { kind: 'node_start'; nodeId: string; title: string; slug: string }
		| null = null;

	if (current?.itemKind === SESSION_ITEM_KINDS.CARD && current.cardId) {
		const row = await getCard(current.cardId, user.id);
		if (row) {
			hydrated = {
				kind: 'card',
				front: row.card.front,
				back: row.card.back,
				domain: row.card.domain,
				tags: row.card.tags ?? [],
			};
		}
	} else if (current?.itemKind === SESSION_ITEM_KINDS.REP && current.scenarioId) {
		const row = await getScenario(current.scenarioId, user.id);
		if (row) {
			hydrated = {
				kind: 'rep',
				title: row.title,
				situation: row.situation,
				options: row.options.map((o) => ({ id: o.id, text: o.text })),
				teachingPoint: row.teachingPoint,
				domain: row.domain,
				regReferences: row.regReferences ?? [],
			};
		}
	} else if (current?.itemKind === SESSION_ITEM_KINDS.NODE_START && current.nodeId) {
		// Slug IS the node id in the knowledge graph (ADR 011).
		hydrated = {
			kind: 'node_start',
			nodeId: current.nodeId,
			slug: current.nodeId,
			title: current.nodeId,
		};
	}

	return {
		session,
		results,
		current,
		hydrated,
		initialItem: itemClamped,
		initialStep,
	};
};

interface SlotRefs {
	slotIndex: number;
	itemKind: SessionItemKind;
	slice: SessionSlice;
	reasonCode: SessionReasonCode;
	cardId: string | null;
	scenarioId: string | null;
	nodeId: string | null;
	reasonDetail: string | null;
}

async function loadSlot(sessionId: string, userId: string, slotIndex: number): Promise<SlotRefs> {
	const results = await getSessionItemResults(sessionId, userId);
	const slot = results.find((r) => r.slotIndex === slotIndex);
	if (!slot) throw error(404, { message: `Slot ${slotIndex} not found in session ${sessionId}` });
	return {
		slotIndex: slot.slotIndex,
		itemKind: slot.itemKind as SessionItemKind,
		slice: slot.slice as SessionSlice,
		reasonCode: slot.reasonCode as SessionReasonCode,
		cardId: slot.cardId,
		scenarioId: slot.scenarioId,
		nodeId: slot.nodeId,
		reasonDetail: slot.reasonDetail,
	};
}

export const actions: Actions = {
	submitReview: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const slotIndex = Number(form.get('slotIndex'));
		const ratingRaw = form.get('rating');
		const confidenceRaw = form.get('confidence');
		const answerMsRaw = form.get('answerMs');

		if (!Number.isInteger(slotIndex)) return fail(400, { error: 'slotIndex required' });

		const slot = await loadSlot(event.params.id, user.id, slotIndex);
		if (slot.itemKind !== SESSION_ITEM_KINDS.CARD || !slot.cardId) {
			return fail(400, { error: 'slot is not a card' });
		}

		const parsed = submitReviewSchema.safeParse({
			rating: Number(ratingRaw),
			confidence: confidenceRaw == null || confidenceRaw === '' ? null : Number(confidenceRaw),
			answerMs: answerMsRaw == null || answerMsRaw === '' ? null : Number(answerMsRaw),
		});
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid rating' });

		try {
			const rev = await submitReview({
				cardId: slot.cardId,
				userId: user.id,
				rating: parsed.data.rating as ReviewRating,
				confidence: (parsed.data.confidence ?? null) as ConfidenceLevel | null,
				answerMs: parsed.data.answerMs,
			});
			await recordItemResult(event.params.id, user.id, {
				slotIndex: slot.slotIndex,
				itemKind: slot.itemKind,
				slice: slot.slice,
				reasonCode: slot.reasonCode,
				cardId: slot.cardId,
				reviewId: rev.id,
				reasonDetail: slot.reasonDetail,
			});
			return { success: true as const };
		} catch (err) {
			if (err instanceof CardNotFoundError || err instanceof CardNotReviewableError) {
				// Card vanished; mark the slot as a "today" skip with a source-deleted hint.
				await recordItemResult(event.params.id, user.id, {
					slotIndex: slot.slotIndex,
					itemKind: slot.itemKind,
					slice: slot.slice,
					reasonCode: slot.reasonCode,
					cardId: slot.cardId,
					skipKind: 'today',
					reasonDetail: 'Card no longer reviewable',
				});
				return { success: true as const, skipped: true as const };
			}
			log.error(
				'submitReview from session threw',
				{ requestId: event.locals.requestId, userId: user.id, metadata: { sessionId: event.params.id } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: 'Could not save review' });
		}
	},

	submitRep: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const slotIndex = Number(form.get('slotIndex'));
		const chosenOption = String(form.get('chosenOption') ?? '');
		const confidenceRaw = form.get('confidence');
		const answerMsRaw = form.get('answerMs');

		if (!Number.isInteger(slotIndex)) return fail(400, { error: 'slotIndex required' });

		const slot = await loadSlot(event.params.id, user.id, slotIndex);
		if (slot.itemKind !== SESSION_ITEM_KINDS.REP || !slot.scenarioId) {
			return fail(400, { error: 'slot is not a rep' });
		}

		const parsed = submitAttemptSchema.safeParse({
			scenarioId: slot.scenarioId,
			chosenOption,
			confidence: confidenceRaw == null || confidenceRaw === '' ? null : Number(confidenceRaw),
			answerMs: answerMsRaw == null || answerMsRaw === '' ? null : Number(answerMsRaw),
		});
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid submission' });
		// Validate confidence bound against the canonical set so the BC gets a
		// typed ConfidenceLevel rather than a float.
		const confidenceValue =
			parsed.data.confidence != null && (CONFIDENCE_LEVEL_VALUES as readonly number[]).includes(parsed.data.confidence)
				? (parsed.data.confidence as ConfidenceLevel)
				: null;

		try {
			const att = await submitAttempt({
				scenarioId: slot.scenarioId,
				userId: user.id,
				chosenOption: parsed.data.chosenOption,
				confidence: confidenceValue,
				answerMs: parsed.data.answerMs,
			});
			// Rep outcome persists on the slot row itself (ADR 012) -- no
			// separate attempt row.
			await recordItemResult(event.params.id, user.id, {
				slotIndex: slot.slotIndex,
				itemKind: slot.itemKind,
				slice: slot.slice,
				reasonCode: slot.reasonCode,
				scenarioId: slot.scenarioId,
				chosenOption: att.chosenOption,
				isCorrect: att.isCorrect,
				confidence: att.confidence as ConfidenceLevel | null,
				answerMs: att.answerMs,
				reasonDetail: slot.reasonDetail,
			});
			return { success: true as const, isCorrect: att.isCorrect, chosenOption: att.chosenOption };
		} catch (err) {
			if (err instanceof ScenarioNotFoundError || err instanceof ScenarioNotAttemptableError) {
				await recordItemResult(event.params.id, user.id, {
					slotIndex: slot.slotIndex,
					itemKind: slot.itemKind,
					slice: slot.slice,
					reasonCode: slot.reasonCode,
					scenarioId: slot.scenarioId,
					skipKind: 'today',
					reasonDetail: 'Scenario no longer attemptable',
				});
				return { success: true as const, skipped: true as const };
			}
			if (err instanceof InvalidOptionError) return fail(400, { error: 'Selected option is not on this scenario' });
			log.error(
				'submitAttempt from session threw',
				{ requestId: event.locals.requestId, userId: user.id, metadata: { sessionId: event.params.id } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: 'Could not save rep attempt' });
		}
	},

	completeNode: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const slotIndex = Number(form.get('slotIndex'));
		if (!Number.isInteger(slotIndex)) return fail(400, { error: 'slotIndex required' });
		const slot = await loadSlot(event.params.id, user.id, slotIndex);
		if (slot.itemKind !== SESSION_ITEM_KINDS.NODE_START) return fail(400, { error: 'slot is not a node_start' });

		await recordItemResult(event.params.id, user.id, {
			slotIndex: slot.slotIndex,
			itemKind: slot.itemKind,
			slice: slot.slice,
			reasonCode: slot.reasonCode,
			nodeId: slot.nodeId,
			reasonDetail: slot.reasonDetail ?? 'Marked as started',
		});
		return { success: true as const };
	},

	skip: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const slotIndex = Number(form.get('slotIndex'));
		const skipKindRaw = String(form.get('skipKind') ?? 'today');
		if (!Number.isInteger(slotIndex)) return fail(400, { error: 'slotIndex required' });
		if (!(SESSION_SKIP_KIND_VALUES as readonly string[]).includes(skipKindRaw)) {
			return fail(400, { error: 'Invalid skip kind' });
		}
		const slot = await loadSlot(event.params.id, user.id, slotIndex);

		await recordItemResult(event.params.id, user.id, {
			slotIndex: slot.slotIndex,
			itemKind: slot.itemKind,
			slice: slot.slice,
			reasonCode: slot.reasonCode,
			cardId: slot.cardId,
			scenarioId: slot.scenarioId,
			nodeId: slot.nodeId,
			skipKind: skipKindRaw as SessionSkipKind,
			reasonDetail: slot.reasonDetail,
		});
		return { success: true as const };
	},

	finish: async (event) => {
		const user = requireAuth(event);
		try {
			await completeSession(event.params.id, user.id);
		} catch (err) {
			if (err instanceof SessionNotFoundError) throw error(404, { message: 'Session not found' });
			throw err;
		}
		throw redirect(303, ROUTES.SESSION_SUMMARY(event.params.id));
	},
} satisfies Actions;
