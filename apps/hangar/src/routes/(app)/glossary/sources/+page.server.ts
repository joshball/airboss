import { requireRole } from '@ab/auth';
import { JOB_KINDS, QUERY_PARAMS, type ReferenceSourceType, ROLES, ROUTES, SOURCE_TYPE_VALUES } from '@ab/constants';
import { enqueueJob } from '@ab/hangar-jobs';
import { narrow } from '@ab/utils';
import { fail, isRedirect, redirect } from '@sveltejs/kit';
import { listSources } from '$lib/server/registry';
import type { Actions, PageServerLoad } from './$types';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const { url } = event;

	const search = url.searchParams.get(QUERY_PARAMS.SEARCH)?.trim() ?? '';
	const type = narrow<ReferenceSourceType>(url.searchParams.get(QUERY_PARAMS.SOURCE), SOURCE_TYPE_VALUES);
	const format = url.searchParams.get('format') ?? null;
	const dirtyOnly = url.searchParams.get('dirty') === '1';
	const pageRaw = Number.parseInt(url.searchParams.get(QUERY_PARAMS.PAGE) ?? '1', 10);
	const pageNum = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
	const offset = (pageNum - 1) * PAGE_SIZE;

	const result = await listSources({
		search: search || undefined,
		type,
		format: format ?? undefined,
		dirtyOnly,
		limit: PAGE_SIZE,
		offset,
	});

	const sources = result.rows.map((row) => ({
		id: row.id,
		rev: row.rev,
		title: row.title,
		type: row.type,
		version: row.version,
		format: row.format,
		dirty: row.dirty,
		updatedAt: row.updatedAt.toISOString(),
	}));

	return {
		sources,
		filters: { search, type, format, dirtyOnly },
		dirtyCount: result.dirtyCount,
		page: pageNum,
		pageSize: PAGE_SIZE,
		total: result.total,
		totalPages: Math.max(1, Math.ceil(result.total / PAGE_SIZE)),
	};
};

export const actions: Actions = {
	syncAll: async (event) => {
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
			return fail(500, { error: err instanceof Error ? err.message : 'failed to enqueue sync job' });
		}
	},
};
