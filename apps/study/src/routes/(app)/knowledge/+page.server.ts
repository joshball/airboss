import { requireAuth } from '@ab/auth';
import { getNodeMasteryMap, listNodesWithFacets } from '@ab/bc-study';
import {
	BROWSE_PAGE_SIZE,
	BROWSE_PAGE_SIZE_VALUES,
	type BrowsePageSize,
	CERT_VALUES,
	type Cert,
	DOMAIN_VALUES,
	type Domain,
	NODE_LIFECYCLE_VALUES,
	type NodeLifecycle,
	QUERY_PARAMS,
	STUDY_PRIORITY_VALUES,
	type StudyPriority,
} from '@ab/constants';
import { narrow } from '@ab/utils';
import type { PageServerLoad } from './$types';
import { KNOWLEDGE_GROUP_BY_VALUES, type KnowledgeGroupByValue } from './group-by';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { url } = event;

	const domain = narrow<Domain>(url.searchParams.get(QUERY_PARAMS.DOMAIN), DOMAIN_VALUES);
	const cert = narrow<Cert>(url.searchParams.get(QUERY_PARAMS.CERT), CERT_VALUES);
	const priority = narrow<StudyPriority>(url.searchParams.get(QUERY_PARAMS.PRIORITY), STUDY_PRIORITY_VALUES);
	const lifecycle = narrow<NodeLifecycle>(url.searchParams.get(QUERY_PARAMS.LIFECYCLE), NODE_LIFECYCLE_VALUES);

	const pageRaw = Number.parseInt(url.searchParams.get(QUERY_PARAMS.PAGE) ?? '1', 10);
	const pageNum = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

	const pageSizeRaw = Number.parseInt(url.searchParams.get(QUERY_PARAMS.PAGE_SIZE) ?? '', 10);
	const pageSize: BrowsePageSize = (BROWSE_PAGE_SIZE_VALUES as readonly number[]).includes(pageSizeRaw)
		? (pageSizeRaw as BrowsePageSize)
		: BROWSE_PAGE_SIZE;

	const groupBy: KnowledgeGroupByValue =
		narrow<KnowledgeGroupByValue>(url.searchParams.get(QUERY_PARAMS.GROUP_BY), KNOWLEDGE_GROUP_BY_VALUES) ?? 'domain';

	const { rows, facets } = await listNodesWithFacets({ domain, cert, priority, lifecycle });
	const total = rows.length;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const offset = (pageNum - 1) * pageSize;

	// Slice the page before the mastery lookup so we only fan out for what's
	// actually rendered. Cheap today (~30 nodes) but linear in graph size, so
	// this is the right shape as the graph scales toward Step 7's ~500 nodes.
	const pageRows = rows.slice(offset, offset + pageSize);
	const hasMore = offset + pageSize < total;

	const masteryMap = await getNodeMasteryMap(
		user.id,
		pageRows.map((r) => r.id),
	);

	const visible = pageRows.map((row) => {
		const mastery = masteryMap.get(row.id);
		return {
			id: row.id,
			title: row.title,
			domain: row.domain,
			estimatedTimeMinutes: row.estimatedTimeMinutes,
			lifecycle: row.lifecycle,
			minimumCert: row.minimumCert,
			studyPriority: row.studyPriority,
			displayScore: mastery?.displayScore ?? 0,
			mastered: mastery?.mastered ?? false,
		};
	});

	return {
		nodes: visible,
		filters: { domain, cert, priority, lifecycle },
		page: pageNum,
		hasMore,
		pageSize,
		total,
		totalPages,
		groupBy,
		facets,
	};
};
