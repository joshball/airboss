import { requireRole } from '@ab/auth';
import { ROLES, ROUTES } from '@ab/constants';
import { cancelJob, getJob, readJobLog } from '@ab/hangar-jobs';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:job-detail');

const INITIAL_LOG_LIMIT = 500;

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const job = await getJob(event.params.id);
	if (!job) throw error(404, `job '${event.params.id}' not found`);

	const lines = await readJobLog(job.id, { limit: INITIAL_LOG_LIMIT });

	return {
		job: {
			id: job.id,
			kind: job.kind,
			status: job.status,
			targetType: job.targetType,
			targetId: job.targetId,
			actorId: job.actorId,
			progress: job.progress as { step?: number; total?: number; message?: string; extra?: unknown },
			result: job.result,
			error: job.error,
			payload: job.payload,
			createdAt: job.createdAt.toISOString(),
			startedAt: job.startedAt?.toISOString() ?? null,
			finishedAt: job.finishedAt?.toISOString() ?? null,
		},
		logs: lines.map((line) => ({
			id: line.id,
			seq: line.seq,
			stream: line.stream,
			line: line.line,
			at: line.at.toISOString(),
		})),
		latestSeq: lines.length === 0 ? -1 : (lines[lines.length - 1]?.seq ?? -1),
	};
};

export const actions: Actions = {
	cancel: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		try {
			await cancelJob(event.params.id, user.id);
		} catch (err) {
			log.error(
				'cancelJob failed',
				{ requestId: event.locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: 'cancel failed' });
		}
		redirect(303, ROUTES.HANGAR_JOB_DETAIL(event.params.id));
	},
};
