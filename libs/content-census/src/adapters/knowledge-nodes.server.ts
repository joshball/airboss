// @browser-globals: server-only -- never imported by client .svelte
/**
 * The knowledge-nodes census adapter -- a Phase-2 Layer-1 adapter.
 *
 * Walks `course/knowledge/**` for every `node.md`, reads its `:::phase`
 * directives, and derives a `complete` / `draft` / `skeleton` state per the
 * ADR-011 discovery-first content model.
 *
 * Derived-state rule (design.md):
 *   - `skeleton` -- no phase carries authored prose; the body is the
 *     scaffolded `<!-- Skeleton -->` shell only.
 *   - `draft`    -- some phases are authored, but either fewer than all
 *     seven, or the Discover+Reveal pair is incomplete. The discovery-first
 *     arc cannot be delivered.
 *   - `complete` -- all seven phases authored, Discover and Reveal included.
 *
 * Gap view / intent view are honest Phase-3 placeholders (`census` mode).
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import { KNOWLEDGE_NODE_COMPLETE_PHASE_MIN, KNOWLEDGE_NODE_REQUIRED_PHASES, ROUTES } from '@ab/constants';
import type { CensusItem, CensusMetric, CorpusCensus, DocLink } from '../types';
import { layerTwoPending } from './layer-two.server';
import { authoredPhases, frontmatterString, parseMarkdownFile, walkMarkdown } from './markdown.server';

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
		role: 'The proposed Layer-2 intent block; once approved, each node carries planned / wanted authoring intent.',
	},
	{
		label: 'Knowledge graph -- node directory',
		href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
		role: 'The on-disk corpus: one node.md per node, grouped by domain.',
	},
];

/** Classify one node body into its derived state. */
function deriveState(authored: string[]): string {
	if (authored.length === 0) return STATE_SKELETON;
	const hasRequired = KNOWLEDGE_NODE_REQUIRED_PHASES.every((phase) => authored.includes(phase));
	if (authored.length >= KNOWLEDGE_NODE_COMPLETE_PHASE_MIN && hasRequired) return STATE_COMPLETE;
	return STATE_DRAFT;
}

/**
 * Build the knowledge-nodes census. Walks every `node.md`, derives its phase
 * authoring state, and reports the complete / draft / skeleton distribution.
 */
export function knowledgeNodesCensus(): CorpusCensus {
	const nodePaths = walkMarkdown(KNOWLEDGE_DIR, (basename) => basename === 'node.md');

	const items: CensusItem[] = [];
	for (const path of nodePaths) {
		const { frontmatter, body } = parseMarkdownFile(path);
		const id = frontmatterString(frontmatter, 'id') ?? path;
		const title = frontmatterString(frontmatter, 'title') ?? id;
		const authored = authoredPhases(body);
		const state = deriveState(authored);
		items.push({
			id,
			label: title,
			derivedState: state,
			detail: `${authored.length} of 7 phases authored`,
		});
	}

	const total = items.length;
	const complete = items.filter((item) => item.derivedState === STATE_COMPLETE).length;
	const draft = items.filter((item) => item.derivedState === STATE_DRAFT).length;
	const skeleton = items.filter((item) => item.derivedState === STATE_SKELETON).length;

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
			value: `${complete} / ${total}`,
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
			value: skeleton,
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
			value: draft,
			whatItMeasures:
				'How many nodes have some authored phases but fall short of complete -- either fewer than all seven phases, or a missing Discover or Reveal phase.',
			whyItMatters:
				'A draft node is partway through the arc. It can teach something, but the learner experience has gaps -- a missing Reveal leaves reasoning unconfirmed, a missing Practice leaves no retrieval rep. Draft nodes are the closest to shippable.',
			whatToDo: {
				text: 'Finish draft nodes phase by phase -- they need the least work to reach complete.',
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
		},
	];

	return {
		id: 'knowledge-nodes',
		label: 'Knowledge nodes',
		whatItIs:
			'Atomic ADR-011 learning nodes -- the discovery-first knowledge graph, one self-contained topic per node.md, grouped by domain.',
		whyItExists:
			"The knowledge graph is the platform's teaching substrate. Cards, scenarios, and the regulations course all cite nodes; a node is where a topic is explained in the discovery-first arc before any drill exercises it.",
		location: `${KNOWLEDGE_DIR}/**/node.md`,
		mode: 'census',
		stateRule:
			'A node is "skeleton" when no :::phase directive carries authored prose (the body is the generated shell); "draft" when some phases are authored but not all seven, or the Discover+Reveal pair is incomplete; "complete" when all seven phases are authored with Discover and Reveal both present.',
		docs: KNOWLEDGE_DOCS,
		items,
		metrics,
		gaps: [],
		next: [],
		layerTwoPending: layerTwoPending('Knowledge nodes'),
	};
}
