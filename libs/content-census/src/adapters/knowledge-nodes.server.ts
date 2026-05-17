// @browser-globals: server-only -- never imported by client .svelte
/**
 * The knowledge-nodes census adapter -- the Phase-3 full reference adapter.
 *
 * Walks `course/knowledge/**` for every `node.md`, reads its `:::phase`
 * directives, its `:::cards` decks, and its frontmatter graph edges, and
 * derives:
 *
 *   - a `complete` / `draft` / `skeleton` state per the ADR-011
 *     discovery-first content model (Layer 1),
 *   - the explained metrics over that distribution (Layer 1),
 *   - a real gap view -- skeleton nodes, cardless nodes, draft nodes,
 *     dangling cross-links, and orphan nodes -- each carrying the
 *     what / why / do triad (Phase-3 Layer-1 analysis),
 *   - a value-ranked next-list, ordered by the `study_priority` signal
 *     already on each node's frontmatter.
 *
 * Derived-state rule (design.md):
 *   - `skeleton` -- no phase carries authored prose; the body is the
 *     scaffolded `<!-- Skeleton -->` shell only.
 *   - `draft`    -- some phases are authored, but either fewer than all
 *     seven, or the Discover+Reveal pair is incomplete. The discovery-first
 *     arc cannot be delivered.
 *   - `complete` -- all seven phases authored, Discover and Reveal included.
 *
 * Layer-2 scope note: the per-node content-intent `intent` block (ADR 028)
 * is NOT read here -- ADR 028 is still `proposed`, so no node carries that
 * frontmatter and authoring it would jump an unapproved contract. The gap
 * view and next-list below derive entirely from node content already on
 * disk. When ADR 028 is accepted, Layer-2 intent refines the next-list's
 * value ranking (today proxied from `study_priority`).
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import {
	KNOWLEDGE_EDGE_YAML_KEY_VALUES,
	KNOWLEDGE_NODE_COMPLETE_PHASE_MIN,
	KNOWLEDGE_NODE_REQUIRED_PHASES,
	ROUTES,
	STUDY_PRIORITIES,
} from '@ab/constants';
import type { CensusGap, CensusItem, CensusMetric, CensusNextItem, CorpusCensus, DocLink } from '../types';
import {
	authoredPhases,
	countCardBlocks,
	frontmatterString,
	frontmatterStringArray,
	parseMarkdownFile,
	walkMarkdown,
} from './markdown.server';

const KNOWLEDGE_DIR = 'course/knowledge';

/** Derived states a knowledge node can hold. */
const STATE_COMPLETE = 'complete';
const STATE_DRAFT = 'draft';
const STATE_SKELETON = 'skeleton';

const KNOWLEDGE_DOCS: DocLink[] = [
	{
		label: 'ADR 011 -- Knowledge graph learning system',
		href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/011-knowledge-graph-learning-system/decision.md'),
		role: 'Defines the atomic-node model and the seven-phase discovery-first content arc this census measures.',
	},
	{
		label: 'ADR 028 -- Content-intent frontmatter',
		href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/028-content-intent-frontmatter.md'),
		role: 'The proposed Layer-2 intent block; once accepted, each node carries planned / wanted authoring intent that refines the next-list ranking.',
	},
	{
		label: 'Content census -- Phase 3 tasks',
		href: ROUTES.HANGAR_DOCS_PATH('docs/work-packages/hangar-content-census/tasks.md'),
		role: 'Tracks the per-corpus depth work; the gap view below is the knowledge-nodes Phase-3 Layer-1 analysis.',
	},
	{
		label: 'Knowledge graph -- node directory',
		href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
		role: 'The on-disk corpus: one node.md per node, grouped by domain.',
	},
];

/** One knowledge node, fully read for the census + gap analysis. */
interface NodeRecord {
	/** Repo-relative path to the node.md. */
	path: string;
	/** Frontmatter `id`, or the path when the file has no id. */
	id: string;
	/** Frontmatter `title`, or the id when the file has no title. */
	title: string;
	/** The phases that carry authored prose. */
	authoredPhases: string[];
	/** The number of `:::cards` cards in the body. */
	cardCount: number;
	/** The derived complete / draft / skeleton state. */
	state: string;
	/** Frontmatter `study_priority` (critical / standard / stretch), or null. */
	studyPriority: string | null;
	/** Outgoing edge targets keyed by the frontmatter edge key. */
	edges: Record<string, string[]>;
}

/** Classify one node body into its derived state. */
function deriveState(authored: string[]): string {
	if (authored.length === 0) return STATE_SKELETON;
	const hasRequired = KNOWLEDGE_NODE_REQUIRED_PHASES.every((phase) => authored.includes(phase));
	if (authored.length >= KNOWLEDGE_NODE_COMPLETE_PHASE_MIN && hasRequired) return STATE_COMPLETE;
	return STATE_DRAFT;
}

/** Read every node.md off disk into a `NodeRecord`. */
function readNodes(): NodeRecord[] {
	const nodePaths = walkMarkdown(KNOWLEDGE_DIR, (basename) => basename === 'node.md');
	const records: NodeRecord[] = [];
	for (const path of nodePaths) {
		const { frontmatter, body } = parseMarkdownFile(path);
		const id = frontmatterString(frontmatter, 'id') ?? path;
		const title = frontmatterString(frontmatter, 'title') ?? id;
		const phases = authoredPhases(body);
		const edges: Record<string, string[]> = {};
		for (const key of KNOWLEDGE_EDGE_YAML_KEY_VALUES) {
			edges[key] = frontmatterStringArray(frontmatter, key);
		}
		records.push({
			path,
			id,
			title,
			authoredPhases: phases,
			cardCount: countCardBlocks(body),
			state: deriveState(phases),
			studyPriority: frontmatterString(frontmatter, 'study_priority'),
			edges,
		});
	}
	return records;
}

/** One dangling edge -- a frontmatter reference to a node id that does not exist. */
interface DanglingEdge {
	/** The source node that emits the edge. */
	from: string;
	/** The frontmatter edge key (`requires`, `applied_by`, ...). */
	key: string;
	/** The target id that resolves to no node. */
	target: string;
}

/** Collect every frontmatter edge whose target id is not an authored node. */
function findDanglingEdges(nodes: readonly NodeRecord[], ids: ReadonlySet<string>): DanglingEdge[] {
	const dangling: DanglingEdge[] = [];
	for (const node of nodes) {
		for (const key of KNOWLEDGE_EDGE_YAML_KEY_VALUES) {
			for (const target of node.edges[key] ?? []) {
				if (!ids.has(target)) dangling.push({ from: node.id, key, target });
			}
		}
	}
	return dangling;
}

/**
 * An orphan node has zero outgoing edges AND zero incoming edges -- nothing
 * in the graph links to it and it links to nothing. `applied_by` / `taught_by`
 * are reverse keys: a node listing them is named *by* the listed node, so the
 * lister itself receives an incoming link. `related` is bidirectional, so a
 * node listing it also receives. Both keep this in sync with how the
 * knowledge build materialises edges.
 */
function findOrphans(nodes: readonly NodeRecord[]): NodeRecord[] {
	const incoming = new Map<string, number>();
	const bump = (id: string): void => {
		incoming.set(id, (incoming.get(id) ?? 0) + 1);
	};
	for (const node of nodes) {
		// Forward edges credit their target node.
		for (const target of node.edges.requires ?? []) bump(target);
		for (const target of node.edges.deepens ?? []) bump(target);
		for (const target of node.edges.related ?? []) bump(target);
		// Reverse edges (applied_by / taught_by) and the bidirectional mirror of
		// `related` all credit the lister itself with an incoming link.
		const selfIncoming =
			(node.edges.applied_by?.length ?? 0) + (node.edges.taught_by?.length ?? 0) + (node.edges.related?.length ?? 0);
		for (let i = 0; i < selfIncoming; i += 1) bump(node.id);
	}
	return nodes.filter((node) => {
		const outgoing = KNOWLEDGE_EDGE_YAML_KEY_VALUES.reduce((sum, key) => sum + (node.edges[key]?.length ?? 0), 0);
		return outgoing === 0 && (incoming.get(node.id) ?? 0) === 0;
	});
}

/**
 * Build the knowledge-nodes census. Walks every `node.md`, derives its phase
 * authoring state and card count, computes the explained metrics, the real
 * gap view, and the value-ranked next-list.
 */
export function knowledgeNodesCensus(): CorpusCensus {
	const nodes = readNodes();
	const ids = new Set(nodes.map((node) => node.id));

	const items: CensusItem[] = nodes.map((node) => ({
		id: node.id,
		label: node.title,
		derivedState: node.state,
		detail: `${node.authoredPhases.length} of 7 phases authored, ${node.cardCount} ${
			node.cardCount === 1 ? 'card' : 'cards'
		}`,
	}));

	const total = items.length;
	const completeNodes = nodes.filter((node) => node.state === STATE_COMPLETE);
	const draftNodes = nodes.filter((node) => node.state === STATE_DRAFT);
	const skeletonNodes = nodes.filter((node) => node.state === STATE_SKELETON);
	// A cardless node has an authored body but a zero-card deck. Skeleton
	// nodes are also cardless, but a skeleton needs its prose first, not a
	// deck -- it is already flagged by its own gap. The cardless gap is the
	// readable-but-undrillable tail: nodes a learner can read but the
	// spaced-rep scheduler can never resurface.
	const cardlessNodes = nodes.filter((node) => node.state !== STATE_SKELETON && node.cardCount === 0);
	const danglingEdges = findDanglingEdges(nodes, ids);
	const danglingSources = new Set(danglingEdges.map((edge) => edge.from));
	const orphanNodes = findOrphans(nodes);

	const criticalSkeletons = skeletonNodes.filter((node) => node.studyPriority === STUDY_PRIORITIES.CRITICAL);
	const criticalCardless = cardlessNodes.filter((node) => node.studyPriority === STUDY_PRIORITIES.CRITICAL);

	const metrics: CensusMetric[] = [
		{
			key: 'nodes',
			label: 'Knowledge nodes',
			value: total,
			whatItMeasures:
				'The number of atomic ADR-011 learning nodes on disk -- one node.md per node, each one self-contained topic in the discovery-first knowledge graph.',
			whyItMatters:
				'This is the breadth of the graph. Every topic a learner can study, every node a card or scenario can cite, has to exist here first. A topic with no node is a topic the platform cannot teach.',
			whatToDo: {
				text: 'Author a new node with bun scripts/knowledge-new.ts, then fill its seven phases.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/011-knowledge-graph-learning-system/decision.md'),
			},
		},
		{
			key: 'complete',
			label: 'Complete nodes',
			value: `${completeNodes.length} / ${total}`,
			whatItMeasures:
				'How many nodes have all seven phases authored with real prose, Discover and Reveal included. A complete node can deliver the full discovery-first arc end to end.',
			whyItMatters:
				'Only a complete node teaches the way ADR 011 intends -- lead with the problem, let the learner reason, reveal the rule as confirmation. An incomplete node either dead-ends mid-arc or skips the reasoning the pedagogy depends on.',
			whatToDo: {
				text: 'Bring draft and skeleton nodes up to complete by authoring their missing phases, Discover and Reveal first.',
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
		},
		{
			key: 'skeleton',
			label: 'Skeleton nodes',
			value: skeletonNodes.length,
			whatItMeasures:
				'How many nodes have a frontmatter record and a phase scaffold but zero authored prose -- the body is still the generated `<!-- Skeleton -->` shell.',
			whyItMatters:
				'A skeleton node exists in the graph and can be linked and counted, but it teaches nothing. A learner who routes to it hits an empty page; it is a placeholder masquerading as content until its phases are written.',
			whatToDo: {
				text: "Prioritise skeleton nodes for authoring -- they are the graph's emptiest cells. Start with the Discover and Reveal phases.",
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
		},
		{
			key: 'draft',
			label: 'Draft nodes',
			value: draftNodes.length,
			whatItMeasures:
				'How many nodes have some authored phases but fall short of complete -- either fewer than all seven phases, or a missing Discover or Reveal phase.',
			whyItMatters:
				'A draft node is partway through the arc. It can teach something, but the learner experience has gaps -- a missing Reveal leaves reasoning unconfirmed, a missing Practice leaves no retrieval rep. Draft nodes are the closest to shippable.',
			whatToDo: {
				text: 'Finish draft nodes phase by phase -- they need the least work to reach complete.',
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
		},
		{
			key: 'cardless',
			label: 'Cardless authored nodes',
			value: cardlessNodes.length,
			whatItMeasures:
				'How many nodes have an authored body (draft or complete) but carry no `:::cards` deck at all -- readable content with no retrieval-practice layer.',
			whyItMatters:
				'A node with prose but no cards can be read once and is then never resurfaced. Reading builds recognition; only cards enter the spaced-repetition rotation and build durable recall. A cardless node is studied and then quietly forgotten.',
			whatToDo: {
				text: 'Add a :::cards deck to the Practice phase of every authored-but-cardless node, critical-priority topics first.',
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
		},
		{
			key: 'dangling-edges',
			label: 'Dangling cross-links',
			value: danglingEdges.length,
			whatItMeasures:
				'How many frontmatter graph edges (requires / deepens / related / applied_by / taught_by) name a node id that does not resolve to an authored node on disk.',
			whyItMatters:
				'The knowledge graph is a navigation surface -- a dangling edge is a broken link. A learner following a prerequisite or "deepens" link reaches nothing, and the knowledge build emits an unresolved-edge warning for every one.',
			whatToDo: {
				text: 'Author the missing target nodes, or remove the stale edge from the source node frontmatter.',
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
		},
	];

	const gaps: CensusGap[] = [];

	if (skeletonNodes.length > 0) {
		gaps.push({
			title: `${skeletonNodes.length} nodes are skeletons -- a record with no teaching content`,
			whatItMeasures: `${skeletonNodes.length} of ${total} nodes carry frontmatter and a phase scaffold but zero authored prose -- the body is still the generated \`<!-- Skeleton -->\` shell. ${criticalSkeletons.length} of them are study-priority critical.`,
			whyItMatters:
				'A skeleton node counts toward the graph and can be linked, but it teaches nothing. A learner who routes to one -- often from a prerequisite edge on a node they are studying -- hits a blank page. Skeletons on checkride-critical topics are the most damaging: the topic looks covered and is not.',
			whatToDo: {
				text: `Author the ${skeletonNodes.length} skeleton nodes, the ${criticalSkeletons.length} critical-priority ones first, Discover and Reveal phases ahead of the rest.`,
				href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/011-knowledge-graph-learning-system/decision.md'),
			},
			severity: 'structural',
		});
	}

	if (cardlessNodes.length > 0) {
		gaps.push({
			title: `${cardlessNodes.length} authored nodes have no cards -- readable but never drilled`,
			whatItMeasures: `${cardlessNodes.length} nodes have a draft or complete body but carry no \`:::cards\` deck. ${criticalCardless.length} of them are study-priority critical. (Skeleton nodes are excluded -- they need prose before a deck.)`,
			whyItMatters:
				'A cardless node can be read but never enters the spaced-repetition rotation. The learner meets the topic once, and with no card to resurface it the knowledge decays unmeasured -- reading builds recognition, only retrieval practice builds recall. The node looks done on the inventory but leaves the recall gap wide open.',
			whatToDo: {
				text: `Add a :::cards deck to each of the ${cardlessNodes.length} cardless nodes, the ${criticalCardless.length} critical-priority topics first, so every authored node has a retrieval-practice layer.`,
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
			severity: 'thin',
		});
	}

	if (draftNodes.length > 0) {
		gaps.push({
			title: `${draftNodes.length} ${draftNodes.length === 1 ? 'node is a draft' : 'nodes are drafts'} -- the discovery-first arc is incomplete`,
			whatItMeasures: `${draftNodes.length} of ${total} nodes have some authored phases but fall short of complete -- fewer than all seven phases, or a missing Discover or Reveal phase.`,
			whyItMatters:
				'A draft node teaches something but with a hole in the arc. A missing Reveal leaves the learner reasoning unconfirmed; a missing Practice leaves no retrieval rep. The pedagogy ADR 011 specifies depends on the full arc, and a draft delivers it only partially.',
			whatToDo: {
				text: `Finish the ${draftNodes.length} draft ${draftNodes.length === 1 ? 'node' : 'nodes'} phase by phase -- they are the closest to shippable and need the least work to reach complete.`,
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
			severity: 'thin',
		});
	}

	if (danglingEdges.length > 0) {
		const exampleEdges = danglingEdges
			.slice(0, 3)
			.map((edge) => `${edge.from} ${edge.key} -> ${edge.target}`)
			.join('; ');
		gaps.push({
			title: `${danglingEdges.length} cross-links dangle -- edges to nodes that do not exist`,
			whatItMeasures: `${danglingEdges.length} frontmatter graph edges across ${danglingSources.size} source nodes name a target id that resolves to no authored node. Examples: ${exampleEdges}.`,
			whyItMatters:
				'The knowledge graph is a navigation surface. A dangling edge is a broken link: a learner following a prerequisite or "deepens" pointer reaches nothing, and the knowledge-graph build emits an unresolved-edge warning for every one. They accumulate silently because the build treats them as warnings, not errors.',
			whatToDo: {
				text: `Resolve the ${danglingEdges.length} dangling edges -- author the missing target nodes, or remove the stale edges from the ${danglingSources.size} source nodes' frontmatter.`,
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
			severity: 'structural',
		});
	}

	if (orphanNodes.length > 0) {
		gaps.push({
			title: `${orphanNodes.length} nodes are orphans -- isolated from the graph`,
			whatItMeasures: `${orphanNodes.length} nodes carry no outgoing edges and receive no incoming edges -- nothing links to them and they link to nothing.`,
			whyItMatters:
				'An orphan node is unreachable by graph navigation. A learner only finds it by direct search; it never surfaces as a prerequisite, a "deepens" target, or a related link, so it sits outside every learning path the graph defines.',
			whatToDo: {
				text: `Wire the ${orphanNodes.length} orphan nodes into the graph -- add the prerequisite, deepens, or related edges that place each one on a learning path.`,
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
			severity: 'thin',
		});
	}

	// Next-list ranking. Layer 2 (ADR 028) will carry an explicit per-node
	// `value` signal; until that ADR is accepted, the ranking proxies value
	// from what is already on disk -- `study_priority`. A skeleton on a
	// critical topic is the highest-value authoring target: the most learners
	// hit it and it teaches nothing today.
	const next: CensusNextItem[] = [];

	if (criticalSkeletons.length > 0) {
		next.push({
			text: `Author the ${criticalSkeletons.length} critical-priority skeleton nodes`,
			rationale:
				'A skeleton on a checkride-critical topic is the worst cell in the graph -- the topic looks covered, a prerequisite edge routes a learner to it, and the page is blank. Highest teaching value per node authored.',
			href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/011-knowledge-graph-learning-system/decision.md'),
			value: 'high',
		});
	}

	if (danglingEdges.length > 0) {
		next.push({
			text: `Resolve the ${danglingEdges.length} dangling cross-links`,
			rationale: `Broken graph navigation across ${danglingSources.size} nodes. Low effort -- author the missing target or drop the stale edge -- and it removes every unresolved-edge warning the knowledge build emits.`,
			href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			value: 'high',
		});
	}

	if (criticalCardless.length > 0) {
		next.push({
			text: `Add a :::cards deck to the ${criticalCardless.length} critical-priority cardless nodes`,
			rationale:
				'Each deck moves a readable-only node into the spaced-repetition rotation. Critical-priority topics first -- those are the ones a learner most needs to retain, not just recognise.',
			href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			value: 'standard',
		});
	}

	const nonCriticalSkeletons = skeletonNodes.length - criticalSkeletons.length;
	if (nonCriticalSkeletons > 0) {
		next.push({
			text: `Author the remaining ${nonCriticalSkeletons} non-critical skeleton nodes`,
			rationale:
				'After the critical skeletons, the standard- and stretch-priority skeletons close the rest of the empty-cell gap. They still teach nothing today; they are just lower-traffic.',
			href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			value: 'standard',
		});
	}

	if (draftNodes.length > 0) {
		next.push({
			text: `Finish the ${draftNodes.length} draft ${draftNodes.length === 1 ? 'node' : 'nodes'}' missing phases`,
			rationale:
				'Draft nodes already teach -- completing the arc (Reveal, Practice) is the least work per node and closes the smallest gap between "partially useful" and "fully delivers the ADR-011 arc".',
			href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			value: 'standard',
		});
	}

	if (orphanNodes.length > 0) {
		next.push({
			text: `Wire the ${orphanNodes.length} orphan nodes into the graph`,
			rationale:
				'An orphan is reachable only by direct search. Adding the edges that place it on a learning path is a low-effort enhancement, not a blocker.',
			href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			value: 'low',
		});
	}

	return {
		id: 'knowledge-nodes',
		label: 'Knowledge nodes',
		whatItIs:
			'Atomic ADR-011 learning nodes -- the discovery-first knowledge graph, one self-contained topic per node.md, grouped by domain.',
		whyItExists:
			"The knowledge graph is the platform's teaching substrate. Cards, scenarios, and the regulations course all cite nodes; a node is where a topic is explained in the discovery-first arc before any drill exercises it.",
		location: `${KNOWLEDGE_DIR}/**/node.md`,
		mode: 'full',
		stateRule:
			'A node is "skeleton" when no :::phase directive carries authored prose (the body is the generated shell); "draft" when some phases are authored but not all seven, or the Discover+Reveal pair is incomplete; "complete" when all seven phases are authored with Discover and Reveal both present.',
		docs: KNOWLEDGE_DOCS,
		items,
		metrics,
		gaps,
		next,
	};
}
