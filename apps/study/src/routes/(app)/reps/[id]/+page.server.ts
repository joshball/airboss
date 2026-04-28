/**
 * Scenario detail -- `/reps/<id>`. Peer affordance with the card and node
 * detail pages so the session-start preview can expose every rep ID as a
 * real link. Presents the scenario's prompt + last-5 attempts + an entry
 * point for starting a fresh attempt via the standard reps flow.
 *
 * Scoped to the caller's user: the BC query filters by user_id so route
 * guessing cannot leak another learner's scenario text. 404 when the
 * scenario is missing or belongs to another user.
 *
 * Citations: scenarios are an authored content surface. Owners can attach
 * citations (regulations, AC paragraphs, knowledge nodes, external refs)
 * via the shared `CitationPicker`, mirroring the card-editor wiring shipped
 * in Bundle C of the content-citations work package. The page uses
 * `CITATION_SOURCE_TYPES.REP` because this is the reps surface URL; the
 * citations BC routes both `rep` and `scenario` to the same `study.scenario`
 * table (see `validateSourceExists`).
 */

import { requireAuth } from '@ab/auth';
import {
	CitationNotFoundError,
	CitationSourceNotFoundError,
	CitationTargetNotFoundError,
	CitationValidationError,
	type CitationWithTarget,
	createCitation,
	DuplicateCitationError,
	deleteCitation,
	getCitationsOf,
	getRecentAttemptsForScenario,
	getScenario,
	resolveCitationTargets,
} from '@ab/bc-study';
import { CITATION_SOURCE_TYPES, CITATION_TARGET_VALUES, type CitationTargetType } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:reps-detail');

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { params } = event;

	const [scenario, recentAttempts, citationRows] = await Promise.all([
		getScenario(params.id, user.id),
		getRecentAttemptsForScenario(params.id, user.id, 5),
		getCitationsOf(CITATION_SOURCE_TYPES.REP, params.id),
	]);

	if (!scenario) error(404, { message: 'Scenario not found' });

	const citations: CitationWithTarget[] = await resolveCitationTargets(citationRows);

	return {
		scenario,
		recentAttempts,
		citations,
	};
};

export const actions: Actions = {
	addCitation: async (event) => {
		const user = requireAuth(event);
		const { params, request, locals } = event;

		// Ownership: getScenario filters by userId, so a non-owner sees 404 here
		// before the citation BC ever runs. The BC layer also re-validates via
		// validateSourceExists, but the early guard keeps error responses crisp.
		const scenario = await getScenario(params.id, user.id);
		if (!scenario) error(404, { message: 'Scenario not found' });

		const form = await request.formData();
		const targetType = String(form.get('targetType') ?? '');
		const targetId = String(form.get('targetId') ?? '');
		const note = String(form.get('note') ?? '');

		if (!(CITATION_TARGET_VALUES as readonly string[]).includes(targetType)) {
			return fail(400, { intent: 'addCitation', fieldErrors: { _: 'Invalid target type.' } });
		}

		try {
			await createCitation({
				sourceType: CITATION_SOURCE_TYPES.REP,
				sourceId: params.id,
				targetType: targetType as CitationTargetType,
				targetId,
				citationContext: note,
				userId: user.id,
			});
		} catch (err) {
			if (err instanceof DuplicateCitationError) {
				return fail(409, {
					intent: 'addCitation',
					fieldErrors: { _: 'That reference is already cited on this rep.' },
				});
			}
			if (err instanceof CitationValidationError) {
				return fail(400, { intent: 'addCitation', fieldErrors: { _: err.message } });
			}
			if (err instanceof CitationSourceNotFoundError) {
				error(404, { message: 'Scenario not found' });
			}
			if (err instanceof CitationTargetNotFoundError) {
				return fail(400, { intent: 'addCitation', fieldErrors: { _: 'That reference could not be found.' } });
			}
			log.error(
				'createCitation threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { scenarioId: params.id, targetType, targetId } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { intent: 'addCitation', fieldErrors: { _: 'Could not add citation.' } });
		}

		return { success: true as const, intent: 'addCitation' as const };
	},

	removeCitation: async (event) => {
		const user = requireAuth(event);
		const { params, request, locals } = event;

		const form = await request.formData();
		const citationId = String(form.get('citationId') ?? '');
		if (!citationId) {
			return fail(400, { intent: 'removeCitation', fieldErrors: { _: 'Missing citation id.' } });
		}

		try {
			// deleteCitation enforces ownership via created_by = userId, so a
			// hostile actor with a guessed citation id cannot remove someone
			// else's citation even on a scenario they're viewing.
			await deleteCitation(citationId, user.id);
		} catch (err) {
			if (err instanceof CitationNotFoundError) {
				// Both "row missing" and "not owned by caller" surface as
				// CitationNotFoundError; treat as 404 so we don't conflate
				// ownership/missing with a server error.
				return fail(404, { intent: 'removeCitation', fieldErrors: { _: 'That citation was not found.' } });
			}
			log.error(
				'deleteCitation threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { scenarioId: params.id, citationId } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { intent: 'removeCitation', fieldErrors: { _: 'Could not remove citation.' } });
		}

		return { success: true as const, intent: 'removeCitation' as const };
	},
} satisfies Actions;
