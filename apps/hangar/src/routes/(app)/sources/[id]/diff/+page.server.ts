/**
 * /sources/[id]/diff -- verbatim diff view for the most-recent diff job.
 *
 * GET: pulls the latest `diff-source` complete job for this target and renders
 * its captured stdout as diff output. If no recent diff exists, offers a form
 * that enqueues one.
 *
 * POST ?/enqueue: schedules a fresh diff job and redirects to /jobs/[id].
 * POST ?/commit: enqueues a sync-to-disk job; operator "accepts" the diff by
 * letting the next sync propagate the current generated files to git.
 */

import { requireRole } from '@ab/auth';
import { getLatestCompleteJobForTarget, getSource } from '@ab/bc-hangar/server';
import { JOB_KINDS, ROLES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error } from '@sveltejs/kit';
import { enqueueAndRedirect } from '$lib/server/enqueue-and-redirect';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:source-diff');

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const source = await getSource(event.params.id);
	if (!source) throw error(404, `source '${event.params.id}' not found`);

	const latestDiff = await getLatestCompleteJobForTarget(JOB_KINDS.DIFF_SOURCE, event.params.id);

	const diffResult = latestDiff?.result as { text?: string; lines?: number } | null;
	const diffText = typeof diffResult?.text === 'string' ? diffResult.text : null;

	return {
		source: { id: source.id, title: source.title },
		latestDiff: latestDiff
			? {
					id: latestDiff.id,
					finishedAt: latestDiff.finishedAt?.toISOString() ?? null,
					lines: diffResult?.lines ?? 0,
				}
			: null,
		diffText,
	};
};

export const actions: Actions = {
	enqueue: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		return enqueueAndRedirect(
			event,
			{
				kind: JOB_KINDS.DIFF_SOURCE,
				targetType: 'hangar.source',
				targetId: event.params.id,
				actorId: user.id,
				payload: { sourceId: event.params.id },
			},
			{ logger: log, failureMessage: 'failed to enqueue diff job' },
		);
	},

	commit: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		return enqueueAndRedirect(
			event,
			{
				kind: JOB_KINDS.SYNC_TO_DISK,
				targetType: 'registry',
				targetId: 'registry',
				actorId: user.id,
				payload: {},
			},
			{ logger: log, failureMessage: 'failed to enqueue sync job' },
		);
	},
};
