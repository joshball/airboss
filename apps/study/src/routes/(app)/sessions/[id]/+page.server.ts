import { requireAuth } from '@ab/auth';
import {
	addSkipDomain,
	addSkipNode,
	CardNotFoundError,
	CardNotReviewableError,
	completeSession,
	getActivePlan,
	getCard,
	getScenario,
	getSession,
	getSessionItemResults,
	InvalidOptionError,
	recordItemResult,
	ScenarioNotAttemptableError,
	ScenarioNotFoundError,
	SessionNotFoundError,
	setCardStatus,
	setScenarioStatus,
	submitAttempt,
	submitAttemptSchema,
	submitReview,
	submitReviewSchema,
} from '@ab/bc-study';
import {
	CARD_STATUSES,
	CONFIDENCE_LEVEL_VALUES,
	type ConfidenceLevel,
	DOMAIN_VALUES,
	type Domain,
	QUERY_PARAMS,
	type ReviewRating,
	ROUTES,
	SCENARIO_STATUSES,
	SESSION_ITEM_KINDS,
	SESSION_ITEM_PHASE_VALUES,
	SESSION_ITEM_PHASES,
	SESSION_SKIP_KIND_VALUES,
	SESSION_SKIP_KINDS,
	type SessionItemKind,
	type SessionItemPhase,
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
	const stepParam = event.url.searchParams.get(QUERY_PARAMS.STEP);
	const initialStep: SessionItemPhase = (SESSION_ITEM_PHASE_VALUES as readonly string[]).includes(stepParam ?? '')
		? (stepParam as SessionItemPhase)
		: SESSION_ITEM_PHASES.READ;

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

/**
 * Guard for every mutating action: a completed session is read-only. A stale
 * form (back button, duplicate tab) landing on this route could otherwise write
 * a slot result after the summary was already computed, silently invalidating
 * it. Returns the session row on success so callers can skip a re-fetch.
 */
async function requireOpenSession(sessionId: string, userId: string): Promise<SessionRowLike> {
	const sess = await getSession(sessionId, userId);
	if (!sess) throw error(404, { message: 'Session not found' });
	if (sess.completedAt !== null) {
		throw redirect(303, ROUTES.SESSION_SUMMARY(sess.id));
	}
	return { id: sess.id, userId: sess.userId };
}

interface SessionRowLike {
	id: string;
	userId: string;
}

/**
 * Resolve the domain of a slot's attached card/scenario -- used when the user
 * picks SKIP_KINDS.TOPIC to add the right entry to plan.skip_domains. Reads
 * from the BC so the route doesn't need to poke at the schema directly.
 */
async function resolveSlotDomain(userId: string, slot: SlotRefs): Promise<Domain | null> {
	if (slot.itemKind === SESSION_ITEM_KINDS.CARD && slot.cardId) {
		const row = await getCard(slot.cardId, userId);
		const d = row?.card.domain;
		return d && (DOMAIN_VALUES as readonly string[]).includes(d) ? (d as Domain) : null;
	}
	if (slot.itemKind === SESSION_ITEM_KINDS.REP && slot.scenarioId) {
		const row = await getScenario(slot.scenarioId, userId);
		const d = row?.domain;
		return d && (DOMAIN_VALUES as readonly string[]).includes(d) ? (d as Domain) : null;
	}
	return null;
}

export const actions: Actions = {
	submitReview: async (event) => {
		const user = requireAuth(event);
		await requireOpenSession(event.params.id, user.id);
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
		await requireOpenSession(event.params.id, user.id);
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
		await requireOpenSession(event.params.id, user.id);
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

	/**
	 * Three-way skip semantics per SESSION_SKIP_KINDS docstring:
	 *   - `today`: session-scoped; no plan mutation, no content mutation.
	 *   - `topic`: adds the slot's node (when present) to plan.skip_nodes,
	 *     falling back to the slot's domain -> plan.skip_domains otherwise.
	 *   - `permanent`: does the `topic` mutation PLUS suspends the underlying
	 *     card / scenario. Node slots add the node id to plan.skip_nodes
	 *     exactly as `topic` does -- there is no "suspend a node" concept.
	 *
	 * The session_item_result row is written first; plan/content mutations are
	 * best-effort after that. A failure on the side-effect path is logged but
	 * does not reverse the slot result -- the user already consumed the slot
	 * and the engine's next run will reconcile via the plan/content state it
	 * can read.
	 */
	skip: async (event) => {
		const user = requireAuth(event);
		await requireOpenSession(event.params.id, user.id);
		const form = await event.request.formData();
		const slotIndex = Number(form.get('slotIndex'));
		const skipKindRaw = String(form.get('skipKind') ?? 'today');
		if (!Number.isInteger(slotIndex)) return fail(400, { error: 'slotIndex required' });
		if (!(SESSION_SKIP_KIND_VALUES as readonly string[]).includes(skipKindRaw)) {
			return fail(400, { error: 'Invalid skip kind' });
		}
		const skipKind = skipKindRaw as SessionSkipKind;
		const slot = await loadSlot(event.params.id, user.id, slotIndex);

		await recordItemResult(event.params.id, user.id, {
			slotIndex: slot.slotIndex,
			itemKind: slot.itemKind,
			slice: slot.slice,
			reasonCode: slot.reasonCode,
			cardId: slot.cardId,
			scenarioId: slot.scenarioId,
			nodeId: slot.nodeId,
			skipKind,
			reasonDetail: slot.reasonDetail,
		});

		if (skipKind === SESSION_SKIP_KINDS.TODAY) {
			return { success: true as const };
		}

		// Both `topic` and `permanent` mutate the plan; `permanent` additionally
		// suspends the underlying content row. Fetch the active plan once; bail
		// gracefully if the user has no active plan (shouldn't happen in a
		// running session, but the BC contract tolerates it).
		const plan = await getActivePlan(user.id);

		try {
			if (plan) {
				if (slot.nodeId) {
					await addSkipNode(plan.id, user.id, slot.nodeId);
				} else {
					const domain = await resolveSlotDomain(user.id, slot);
					if (domain) {
						await addSkipDomain(plan.id, user.id, domain);
					}
				}
			}

			if (skipKind === SESSION_SKIP_KINDS.PERMANENT) {
				if (slot.itemKind === SESSION_ITEM_KINDS.CARD && slot.cardId) {
					await setCardStatus(slot.cardId, user.id, CARD_STATUSES.SUSPENDED);
				} else if (slot.itemKind === SESSION_ITEM_KINDS.REP && slot.scenarioId) {
					await setScenarioStatus(slot.scenarioId, user.id, SCENARIO_STATUSES.SUSPENDED);
				}
				// Node-start slots have no content row to suspend; the skipNode
				// mutation above is the full persistence.
			}
		} catch (err) {
			log.error(
				'skip action side-effects threw',
				{
					requestId: event.locals.requestId,
					userId: user.id,
					metadata: { sessionId: event.params.id, slotIndex, skipKind },
				},
				err instanceof Error ? err : undefined,
			);
			// Don't fail the whole request; the slot is already recorded. The
			// engine will reconcile from whatever plan/content state actually
			// persisted on the next run.
		}

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
