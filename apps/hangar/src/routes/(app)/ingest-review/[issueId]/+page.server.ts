/**
 * `/ingest-review/[issueId]` detail page + form actions.
 *
 * Loader: hydrates the issue, current override (if any), and the
 * candidate set the plugin's `findCandidates` reshapes from the live
 * manifest (so the page survives a re-extract without re-emitting the
 * issue).
 *
 * Form actions: one per documented action in
 * `INGEST_REVIEW.ACTIONS`. Every action calls the plugin's
 * `validateAction` and `applyOverride` in sequence so the BC writes are
 * uniform across kinds.
 */

import { requireRole } from '@ab/auth';
import type { IssueRecord } from '@ab/bc-ingest-review';
import {
	applyOverride,
	dismissIssue,
	getCurrentOverride,
	getIssue,
	getPlugin,
	InvalidActionPayloadError,
	IssueNotFoundError,
	reopenIssue,
} from '@ab/bc-ingest-review/server';
import { INGEST_REVIEW, type IngestOverrideAction, ROLES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:ingest-review-detail');

/**
 * Narrow `IssueRecord<unknown>` (the BC's storage projection) to
 * `IssueRecord<Record<string, unknown>>` (the plugin contract's payload
 * shape). The BC stores `payload` as `unknown` because it never inspects
 * it; the plugin owns the schema. This cast is the boundary between the
 * two type worlds.
 */
function asPluginIssue(issue: IssueRecord): IssueRecord<Record<string, unknown>> {
	return issue as IssueRecord<Record<string, unknown>>;
}

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const issueId = event.params.issueId;
	if (!issueId) error(404, 'issue id missing');
	const issue = await getIssue(issueId).catch((err: unknown) => {
		if (err instanceof IssueNotFoundError) error(404, err.message);
		throw err;
	});
	const plugin = getPlugin(issue.kind);
	const currentOverride = await getCurrentOverride(issue.id);
	const candidates = await plugin.findCandidates(asPluginIssue(issue), {
		corpus: issue.corpus,
		sourceId: issue.sourceId,
		edition: issue.edition,
		repoRoot: process.cwd(),
	});
	return { issue, currentOverride, candidates };
};

async function applyActionFromForm(event: Parameters<Actions['pair']>[0], action: IngestOverrideAction) {
	const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const issueId = event.params.issueId;
	if (!issueId) return fail(400, { ok: false, error: 'issue id missing' });
	const formData = await event.request.formData();
	const payloadJson = (formData.get('payload') as string | null) ?? '{}';
	let payload: Record<string, unknown>;
	try {
		const parsed: unknown = JSON.parse(payloadJson);
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			return fail(400, { ok: false, error: 'payload must be a JSON object' });
		}
		payload = parsed as Record<string, unknown>;
	} catch (err) {
		const cause = err instanceof Error ? err.message : String(err);
		return fail(400, { ok: false, error: `payload parse failed: ${cause}` });
	}
	let issue: IssueRecord;
	try {
		issue = await getIssue(issueId);
	} catch (err) {
		if (err instanceof IssueNotFoundError) {
			return fail(404, { ok: false, error: 'This issue no longer exists.' });
		}
		throw err;
	}
	const plugin = getPlugin(issue.kind);
	try {
		plugin.validateAction(asPluginIssue(issue), { action, payload });
	} catch (err) {
		if (err instanceof InvalidActionPayloadError) {
			return fail(400, { ok: false, error: err.message });
		}
		throw err;
	}
	try {
		await applyOverride({
			issueId,
			action: { action, payload },
			actorUserId: user.id,
		});
	} catch (err) {
		// A failed override write must stay inside the review flow, not
		// escalate to a full-page 500. Log the raw cause, return a fixed string.
		log.error(
			'applyOverride failed',
			{ requestId: event.locals.requestId, userId: user.id },
			err instanceof Error ? err : undefined,
		);
		return fail(500, { ok: false, error: 'Could not apply the override. Please try again.' });
	}
	return { ok: true };
}

export const actions: Actions = {
	pair: (event) => applyActionFromForm(event, INGEST_REVIEW.ACTIONS.PAIR),
	markNoFigure: (event) => applyActionFromForm(event, INGEST_REVIEW.ACTIONS.MARK_NO_FIGURE),
	markFalseCaption: (event) => applyActionFromForm(event, INGEST_REVIEW.ACTIONS.MARK_FALSE_CAPTION),
	markExtraneous: (event) => applyActionFromForm(event, INGEST_REVIEW.ACTIONS.MARK_EXTRANEOUS),
	markDecorative: (event) => applyActionFromForm(event, INGEST_REVIEW.ACTIONS.MARK_DECORATIVE),
	dismiss: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const issueId = event.params.issueId;
		if (!issueId) return fail(400, { ok: false, error: 'issue id missing' });
		try {
			await dismissIssue(issueId, user.id);
		} catch (err) {
			if (err instanceof IssueNotFoundError) {
				return fail(404, { ok: false, error: 'This issue no longer exists.' });
			}
			log.error(
				'dismissIssue failed',
				{ requestId: event.locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { ok: false, error: 'Could not dismiss the issue. Please try again.' });
		}
		return { ok: true };
	},
	reopen: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const issueId = event.params.issueId;
		if (!issueId) return fail(400, { ok: false, error: 'issue id missing' });
		try {
			await reopenIssue(issueId, user.id);
		} catch (err) {
			if (err instanceof IssueNotFoundError) {
				return fail(404, { ok: false, error: 'This issue no longer exists.' });
			}
			log.error(
				'reopenIssue failed',
				{ requestId: event.locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { ok: false, error: 'Could not reopen the issue. Please try again.' });
		}
		return { ok: true };
	},
};
