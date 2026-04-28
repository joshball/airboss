import { requireRole } from '@ab/auth';
import {
	type AviationTopic,
	type CertApplicability,
	FLIGHT_RULES_VALUES,
	type FlightRules,
	JOB_KINDS,
	KNOWLEDGE_KIND_VALUES,
	type KnowledgeKind,
	QUERY_PARAMS,
	type ReferencePhaseOfFlight,
	type ReferenceSourceType,
	ROLES,
	ROUTES,
	SOURCE_TYPE_VALUES,
} from '@ab/constants';
import { enqueueJob } from '@ab/hangar-jobs';
import { narrow } from '@ab/utils';
import { fail, isRedirect, redirect } from '@sveltejs/kit';
import { listReferences } from '$lib/server/registry';
import type { Actions, PageServerLoad } from './$types';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const { url } = event;

	const search = url.searchParams.get(QUERY_PARAMS.SEARCH)?.trim() ?? '';
	const sourceType = narrow<ReferenceSourceType>(url.searchParams.get(QUERY_PARAMS.SOURCE), SOURCE_TYPE_VALUES);
	const knowledgeKind = narrow<KnowledgeKind>(url.searchParams.get(QUERY_PARAMS.KIND), KNOWLEDGE_KIND_VALUES);
	const flightRules = narrow<FlightRules>(url.searchParams.get(QUERY_PARAMS.RULES), FLIGHT_RULES_VALUES);
	const dirtyOnly = url.searchParams.get(QUERY_PARAMS.DIRTY) === '1';

	const pageRaw = Number.parseInt(url.searchParams.get(QUERY_PARAMS.PAGE) ?? '1', 10);
	const pageNum = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
	const offset = (pageNum - 1) * PAGE_SIZE;

	const result = await listReferences({
		search: search || undefined,
		sourceType,
		knowledgeKind,
		flightRules,
		dirtyOnly,
		limit: PAGE_SIZE,
		offset,
	});

	// Map to a narrower client shape so we don't ship full row bodies over the wire.
	const references = result.rows.map((row) => {
		const tags = row.tags as {
			sourceType?: ReferenceSourceType;
			knowledgeKind?: KnowledgeKind;
			flightRules?: FlightRules;
			aviationTopic?: readonly AviationTopic[];
			certApplicability?: readonly CertApplicability[];
			phaseOfFlight?: readonly ReferencePhaseOfFlight[];
		};
		return {
			id: row.id,
			rev: row.rev,
			displayName: row.displayName,
			dirty: row.dirty,
			sourceType: tags.sourceType ?? null,
			knowledgeKind: tags.knowledgeKind ?? null,
			flightRules: tags.flightRules ?? null,
			aviationTopics: tags.aviationTopic ?? [],
			certApplicability: tags.certApplicability ?? [],
			updatedAt: row.updatedAt.toISOString(),
		};
	});

	return {
		references,
		filters: { search, sourceType, knowledgeKind, flightRules, dirtyOnly },
		dirtyCount: result.dirtyCount,
		page: pageNum,
		pageSize: PAGE_SIZE,
		total: result.total,
		totalPages: Math.max(1, Math.ceil(result.total / PAGE_SIZE)),
	};
};

export const actions: Actions = {
	/**
	 * Enqueue a sync-to-disk job over every dirty reference + source.
	 * The worker (`apps/hangar/src/lib/server/jobs.ts`) picks it up;
	 * the UI redirects to /jobs/[id] so the author can watch the log.
	 */
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
			if (err instanceof Response) throw err;
			// SvelteKit redirects throw -- rethrow so they propagate.
			if (isRedirect(err)) throw err;
			return fail(500, { error: err instanceof Error ? err.message : 'failed to enqueue sync job' });
		}
	},
};
