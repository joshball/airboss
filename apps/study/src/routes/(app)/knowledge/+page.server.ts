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
	RELEVANCE_PRIORITY_VALUES,
	type RelevancePriority,
} from '@ab/constants';
import { narrow } from '@ab/utils';
import type { PageServerLoad } from './$types';

const KNOWLEDGE_GROUP_BY_VALUES = ['domain', 'cert', 'priority', 'lifecycle', 'none'] as const;
type KnowledgeGroupBy = (typeof KNOWLEDGE_GROUP_BY_VALUES)[number];

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { url } = event;

	const domain = narrow<Domain>(url.searchParams.get(QUERY_PARAMS.DOMAIN), DOMAIN_VALUES);
	const cert = narrow<Cert>(url.searchParams.get(QUERY_PARAMS.CERT), CERT_VALUES);
	const priority = narrow<RelevancePriority>(url.searchParams.get(QUERY_PARAMS.PRIORITY), RELEVANCE_PRIORITY_VALUES);
	const lifecycle = narrow<NodeLifecycle>(url.searchParams.get(QUERY_PARAMS.LIFECYCLE), NODE_LIFECYCLE_VALUES);

	const pageRaw = Number.parseInt(url.searchParams.get(QUERY_PARAMS.PAGE) ?? '1', 10);
	const pageNum = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

	const pageSizeRaw = Number.parseInt(url.searchParams.get(QUERY_PARAMS.PAGE_SIZE) ?? '', 10);
	const pageSize: BrowsePageSize = (BROWSE_PAGE_SIZE_VALUES as readonly number[]).includes(pageSizeRaw)
		? (pageSizeRaw as BrowsePageSize)
		: BROWSE_PAGE_SIZE;

	const groupBy: KnowledgeGroupBy =
		narrow<KnowledgeGroupBy>(url.searchParams.get(QUERY_PARAMS.GROUP_BY), KNOWLEDGE_GROUP_BY_VALUES) ?? 'domain';

	const { rows, facets } = await listNodesWithFacets({ domain, cert, priority, lifecycle });
	const total = rows.length;

	const masteryMap = await getNodeMasteryMap(
		user.id,
		rows.map((r) => r.id),
	);

	const enriched = rows.map((row) => {
		const mastery = masteryMap.get(row.id);
		return {
			id: row.id,
			title: row.title,
			domain: row.domain,
			estimatedTimeMinutes: row.estimatedTimeMinutes,
			lifecycle: row.lifecycle,
			certs: row.certs,
			priorities: row.priorities,
			displayScore: mastery?.displayScore ?? 0,
			mastered: mastery?.mastered ?? false,
		};
	});

	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const offset = (pageNum - 1) * pageSize;
	const visible = enriched.slice(offset, offset + pageSize);
	const hasMore = offset + pageSize < total;

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

export type KnowledgeGroupByValue = KnowledgeGroupBy;
export const KNOWLEDGE_GROUP_BY_OPTIONS = KNOWLEDGE_GROUP_BY_VALUES;
