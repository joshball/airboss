import { requireRole } from '@ab/auth';
import { JOB_KIND_VALUES, JOB_STATUS_VALUES, type JobKind, type JobStatus, ROLES } from '@ab/constants';
import { listJobs } from '@ab/hangar-jobs';
import { narrow } from '@ab/utils';
import type { PageServerLoad } from './$types';

const LIMIT = 100;

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const { url } = event;
	const kind = narrow<JobKind>(url.searchParams.get('kind'), JOB_KIND_VALUES);
	const status = narrow<JobStatus>(url.searchParams.get('status'), JOB_STATUS_VALUES);

	const rows = await listJobs({ kind, status, limit: LIMIT });

	return {
		jobs: rows.map((row) => ({
			id: row.id,
			kind: row.kind,
			targetType: row.targetType,
			targetId: row.targetId,
			status: row.status,
			actorId: row.actorId,
			progress: row.progress as { step?: number; total?: number; message?: string },
			createdAt: row.createdAt.toISOString(),
			startedAt: row.startedAt?.toISOString() ?? null,
			finishedAt: row.finishedAt?.toISOString() ?? null,
		})),
		filters: { kind, status },
		limit: LIMIT,
	};
};
