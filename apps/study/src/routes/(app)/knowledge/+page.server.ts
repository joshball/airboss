import { requireAuth } from '@ab/auth';
import { getNodeMasteryMap, listNodesForBrowse } from '@ab/bc-study';
import {
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
import type { PageServerLoad } from './$types';

function narrow<T extends string>(value: string | null, allowed: readonly string[]): T | undefined {
	if (!value) return undefined;
	return allowed.includes(value) ? (value as T) : undefined;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { url } = event;

	const domain = narrow<Domain>(url.searchParams.get(QUERY_PARAMS.DOMAIN), DOMAIN_VALUES);
	const cert = narrow<Cert>(url.searchParams.get(QUERY_PARAMS.CERT), CERT_VALUES);
	const priority = narrow<RelevancePriority>(url.searchParams.get(QUERY_PARAMS.PRIORITY), RELEVANCE_PRIORITY_VALUES);
	const lifecycle = narrow<NodeLifecycle>(url.searchParams.get(QUERY_PARAMS.LIFECYCLE), NODE_LIFECYCLE_VALUES);

	const rows = await listNodesForBrowse({ domain, cert, priority, lifecycle });

	// Batched mastery: one fan-out of three round-trips regardless of node
	// count, not 3-per-node as the previous per-row `getNodeMastery` loop.
	const masteryMap = await getNodeMasteryMap(
		user.id,
		rows.map((r) => r.id),
	);

	const withMastery = rows.map((row) => {
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

	// Group by domain for the render layer. Domain order follows the source
	// listing (already alphabetical by domain).
	const byDomain = new Map<string, typeof withMastery>();
	for (const node of withMastery) {
		const bucket = byDomain.get(node.domain);
		if (bucket) bucket.push(node);
		else byDomain.set(node.domain, [node]);
	}

	return {
		groups: Array.from(byDomain.entries()).map(([domainKey, nodes]) => ({ domain: domainKey, nodes })),
		filters: { domain, cert, priority, lifecycle },
		totalNodes: withMastery.length,
	};
};
