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
import { JOB_KINDS, ROLES, ROUTES } from '@ab/constants';
import { db, hangarJob, hangarSource } from '@ab/db';
import { enqueueJob } from '@ab/hangar-jobs';
import { createLogger } from '@ab/utils';
import { error, fail, isRedirect, redirect } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:source-diff');

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const [source] = await db.select().from(hangarSource).where(eq(hangarSource.id, event.params.id)).limit(1);
	if (!source) throw error(404, `source '${event.params.id}' not found`);

	const [latestDiff] = await db
		.select()
		.from(hangarJob)
		.where(
			and(
				eq(hangarJob.kind, JOB_KINDS.DIFF_SOURCE),
				eq(hangarJob.targetId, event.params.id),
				eq(hangarJob.status, 'complete'),
			),
		)
		.orderBy(desc(hangarJob.finishedAt))
		.limit(1);

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
		try {
			const job = await enqueueJob({
				kind: JOB_KINDS.DIFF_SOURCE,
				targetType: 'hangar.source',
				targetId: event.params.id,
				actorId: user.id,
				payload: { sourceId: event.params.id },
			});
			redirect(303, ROUTES.HANGAR_JOB_DETAIL(job.id));
		} catch (err) {
			if (isRedirect(err)) throw err;
			log.error(
				'enqueue diff failed',
				{ requestId: event.locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: err instanceof Error ? err.message : 'failed to enqueue diff job' });
		}
	},

	commit: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		try {
			const job = await enqueueJob({
				kind: JOB_KINDS.SYNC_TO_DISK,
				targetType: 'registry',
				targetId: 'registry',
				actorId: user.id,
				payload: {},
			});
			redirect(303, ROUTES.HANGAR_JOB_DETAIL(job.id));
		} catch (err) {
			if (isRedirect(err)) throw err;
			log.error(
				'commit diff sync failed',
				{ requestId: event.locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: err instanceof Error ? err.message : 'failed to enqueue sync job' });
		}
	},
};
