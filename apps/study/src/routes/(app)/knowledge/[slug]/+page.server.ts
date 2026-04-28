import { requireAuth } from '@ab/auth';
import {
	type CitationWithSource,
	getCitedBy,
	getNodeMastery,
	getNodesByIds,
	getNodeView,
	type KnowledgeEdgeRow,
	type KnowledgeNodeRow,
	lifecycleFromContent,
	listReferences,
	resolveCitationSources,
	resolveCitationUrl,
	splitContentPhases,
} from '@ab/bc-study';
import { CITATION_TARGET_TYPES, KNOWLEDGE_EDGE_TYPES, KNOWLEDGE_PHASE_ORDER, type KnowledgePhase } from '@ab/constants';
import type { Citation } from '@ab/types';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface EdgeSummary {
	toNodeId: string;
	edgeType: string;
	targetExists: boolean;
	title: string | null;
}

/**
 * Citation entry as the page renders it: the original `Citation` plus the
 * resolved URL. Legacy freeform citations carry `resolvedUrl: null` and render
 * as plain text. Structured handbook citations whose `reference_id` resolves
 * carry the `/handbooks/...` URL. Structured handbook citations whose
 * `reference_id` does not resolve carry `resolvedUrl: null`; the UI flags
 * those as "(citation broken)" by inspecting the citation's `kind`.
 */
export interface ResolvedCitation {
	citation: Citation;
	resolvedUrl: string | null;
}

/** Group edges by KNOWLEDGE_EDGE_TYPES value. Preserves author order. */
function groupEdgesByType(edges: KnowledgeEdgeRow[]): Map<string, KnowledgeEdgeRow[]> {
	const map = new Map<string, KnowledgeEdgeRow[]>();
	for (const edge of edges) {
		const bucket = map.get(edge.edgeType);
		if (bucket) bucket.push(edge);
		else map.set(edge.edgeType, [edge]);
	}
	return map;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { params } = event;
	const slug = params.slug;

	const view = await getNodeView(slug, user.id);
	if (!view) {
		error(404, `Knowledge node not found: ${slug}`);
	}

	const { node, edges, inboundEdges } = view;

	// Resolve titles for outbound edges (we render the target) and inbound edges
	// (we render the source). De-duplicate into a single round-trip.
	const linkedIds = new Set<string>();
	for (const e of edges) linkedIds.add(e.toNodeId);
	for (const e of inboundEdges) linkedIds.add(e.fromNodeId);
	const linked = await getNodesByIds(Array.from(linkedIds));
	const titlesById = new Map<string, string>(linked.map((r: KnowledgeNodeRow) => [r.id, r.title]));

	const outbound = groupEdgesByType(edges);
	const inbound = groupEdgesByType(inboundEdges);

	function outboundOfType(type: string): EdgeSummary[] {
		return (outbound.get(type) ?? []).map((e) => ({
			toNodeId: e.toNodeId,
			edgeType: e.edgeType,
			targetExists: e.targetExists,
			title: titlesById.get(e.toNodeId) ?? null,
		}));
	}

	function inboundOfType(type: string): EdgeSummary[] {
		return (inbound.get(type) ?? []).map((e) => ({
			toNodeId: e.fromNodeId,
			edgeType: e.edgeType,
			targetExists: true,
			title: titlesById.get(e.fromNodeId) ?? null,
		}));
	}

	const phaseBodies = splitContentPhases(node.contentMd);
	const phases: Array<{ phase: KnowledgePhase; body: string | null }> = KNOWLEDGE_PHASE_ORDER.map((phase) => ({
		phase,
		body: phaseBodies[phase] ?? null,
	}));

	const mastery = await getNodeMastery(user.id, node.id);
	const lifecycle = lifecycleFromContent(node.contentMd);

	// "Cited by": every content row that cites this knowledge node. Source-side
	// resolution gives us a display label per row (card front / scenario title /
	// node title) and an `exists` flag we render as a missing chip.
	const citedByRows = await getCitedBy(CITATION_TARGET_TYPES.KNOWLEDGE_NODE, node.id);
	const citedBy: CitationWithSource[] = await resolveCitationSources(citedByRows);

	// Bidirectional citation: resolve every entry in `node.references` to a URL
	// when possible. v1 only resolves `kind='handbook'` -- legacy freeform and
	// every other structured kind return null. The reference table is small
	// (handful of rows v1) so loading it once per request is cheap.
	// `node.references` is typed as the legacy shape on the column today; the
	// JSONB column itself accepts both shapes per the spec, so we widen to
	// `Citation[]` for resolution.
	const allReferences = await listReferences({ includeSuperseded: true });
	const rawCitations = node.references as unknown as Citation[];
	const resolvedReferences: ResolvedCitation[] = rawCitations.map((citation) => ({
		citation,
		resolvedUrl: resolveCitationUrl(citation, allReferences),
	}));

	return {
		node: {
			id: node.id,
			title: node.title,
			domain: node.domain,
			crossDomains: node.crossDomains,
			knowledgeTypes: node.knowledgeTypes,
			technicalDepth: node.technicalDepth,
			stability: node.stability,
			minimumCert: node.minimumCert,
			studyPriority: node.studyPriority,
			modalities: node.modalities,
			estimatedTimeMinutes: node.estimatedTimeMinutes,
			reviewTimeMinutes: node.reviewTimeMinutes,
			references: resolvedReferences,
			assessmentMethods: node.assessmentMethods,
			masteryCriteria: node.masteryCriteria,
		},
		phases,
		edges: {
			requires: outboundOfType(KNOWLEDGE_EDGE_TYPES.REQUIRES),
			deepens: outboundOfType(KNOWLEDGE_EDGE_TYPES.DEEPENS),
			// Authoring `applied_by` on the source node stores an `applies` edge
			// whose source is the applier. Render inbound.
			appliedBy: inboundOfType(KNOWLEDGE_EDGE_TYPES.APPLIES),
			// Same inversion for `taught_by` -> teaches edges.
			taughtBy: inboundOfType(KNOWLEDGE_EDGE_TYPES.TEACHES),
			related: outboundOfType(KNOWLEDGE_EDGE_TYPES.RELATED),
		},
		mastery,
		lifecycle,
		citedBy,
	};
};
