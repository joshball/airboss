import { requireAuth } from '@ab/auth';
import {
	type CitationWithSource,
	getCitedBy,
	getNodeMastery,
	getNodesByIds,
	getNodeView,
	type KnowledgeEdgeRow,
	type KnowledgeEdgeRowWithTarget,
	type KnowledgeNodeRow,
	lifecycleFromContent,
	listReferences,
	type ResolvedCitation,
	resolveCitationSources,
	resolveCitationsForRender,
	splitContentPhases,
} from '@ab/bc-study/server';
import { CITATION_TARGET_TYPES, KNOWLEDGE_EDGE_TYPES, KNOWLEDGE_PHASE_ORDER, type KnowledgePhase } from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface EdgeSummary {
	toNodeId: string;
	edgeType: string;
	targetExists: boolean;
	title: string | null;
}

export type { ResolvedCitation };

/** Group edges (outbound, with `targetExists`) by KNOWLEDGE_EDGE_TYPES value. */
function groupOutboundByType(edges: KnowledgeEdgeRowWithTarget[]): Map<string, KnowledgeEdgeRowWithTarget[]> {
	const map = new Map<string, KnowledgeEdgeRowWithTarget[]>();
	for (const edge of edges) {
		const bucket = map.get(edge.edgeType);
		if (bucket) bucket.push(edge);
		else map.set(edge.edgeType, [edge]);
	}
	return map;
}

/** Group inbound edges (no `targetExists` -- the source row always exists). */
function groupInboundByType(edges: KnowledgeEdgeRow[]): Map<string, KnowledgeEdgeRow[]> {
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

	const outbound = groupOutboundByType(edges);
	const inbound = groupInboundByType(inboundEdges);

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

	// Bidirectional citation resolution. The JSONB column accepts three shapes
	// today (legacy `{source, detail, note}`, in-type structured with `kind`,
	// new amendment 2026-05 `ref:`-shape with sentinel fields). We widen to
	// `unknown[]` and let `resolveCitationsForRender` discriminate. The
	// reference table is small (handful of rows v1) so loading it once per
	// request is cheap; we include superseded rows so prior-edition pinned
	// citations still resolve.
	const allReferences = await listReferences({ includeSuperseded: true });
	const rawCitations = node.references as unknown as ReadonlyArray<unknown>;
	const resolvedReferences: ResolvedCitation[] = resolveCitationsForRender(rawCitations, allReferences);

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
