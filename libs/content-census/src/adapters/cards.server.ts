// @browser-globals: server-only -- never imported by client .svelte
/**
 * The cards census adapter -- a Phase-2 Layer-1 adapter.
 *
 * Spaced-repetition cards are not their own files: they live as YAML list
 * items inside `:::cards` directive blocks embedded in knowledge-node
 * markdown. The unit of this census is the NODE -- each node is one
 * inventory item, classified by how many cards its deck carries.
 *
 * Derived-state rule (design.md):
 *   - `rich` -- the node's deck has NODE_CARD_RICH_MIN cards or more.
 *   - `thin` -- the deck has one or more cards but fewer than the threshold.
 *   - `none` -- the node carries no `:::cards` block, or an empty one.
 *
 * Gap view / intent view are honest Phase-3 placeholders (`census` mode).
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import { NODE_CARD_RICH_MIN, ROUTES } from '@ab/constants';
import type { CensusItem, CensusMetric, CorpusCensus, DocLink } from '../types';
import { layerTwoPending } from './layer-two.server';
import { countCardBlocks, frontmatterString, parseMarkdownFile, walkMarkdown } from './markdown.server';

const KNOWLEDGE_DIR = 'course/knowledge';

const STATE_RICH = 'rich';
const STATE_THIN = 'thin';
const STATE_NONE = 'none';

const CARDS_DOCS: DocLink[] = [
	{
		label: 'ADR 011 -- Knowledge graph learning system',
		href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/011-knowledge-graph-learning-system/decision.md'),
		role: 'Defines knowledge nodes; the Practice phase of a node is where its :::cards deck lives.',
	},
	{
		label: 'Markdown directive registry',
		href: ROUTES.HANGAR_DOCS_PATH('libs/constants/src/markdown-directives.ts'),
		role: 'Specifies the :::cards directive -- a YAML-payload body the spaced-repetition seeder reads at build time.',
	},
	{
		label: 'Knowledge graph -- node directory',
		href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
		role: 'The on-disk corpus; cards are embedded in each node.md, not stored separately.',
	},
];

/** Classify a node by its card count. */
function deriveState(cardCount: number): string {
	if (cardCount === 0) return STATE_NONE;
	if (cardCount >= NODE_CARD_RICH_MIN) return STATE_RICH;
	return STATE_THIN;
}

/**
 * Build the cards census. Walks every knowledge node, counts the cards in
 * its embedded `:::cards` blocks, and reports the rich / thin / none
 * distribution plus the total card count.
 */
export function cardsCensus(): CorpusCensus {
	const nodePaths = walkMarkdown(KNOWLEDGE_DIR, (basename) => basename === 'node.md');

	const items: CensusItem[] = [];
	let totalCards = 0;
	for (const path of nodePaths) {
		const { frontmatter, body } = parseMarkdownFile(path);
		const id = frontmatterString(frontmatter, 'id') ?? path;
		const title = frontmatterString(frontmatter, 'title') ?? id;
		const cardCount = countCardBlocks(body);
		totalCards += cardCount;
		items.push({
			id,
			label: title,
			derivedState: deriveState(cardCount),
			detail: `${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`,
		});
	}

	const totalNodes = items.length;
	const rich = items.filter((item) => item.derivedState === STATE_RICH).length;
	const thin = items.filter((item) => item.derivedState === STATE_THIN).length;
	const none = items.filter((item) => item.derivedState === STATE_NONE).length;
	const withDeck = rich + thin;

	const metrics: CensusMetric[] = [
		{
			key: 'total-cards',
			label: 'Total cards',
			value: totalCards,
			whatItMeasures:
				'The total count of spaced-repetition cards across every knowledge node -- each `- front:` entry in a `:::cards` block.',
			whyItMatters:
				'Cards are the retrieval-practice substrate. Every card is one item the review queue can schedule; the total is the size of the drillable pool a learner can be tested against.',
			whatToDo: {
				text: "Author cards inside a node's :::cards block; the build-time seeder picks them up automatically.",
				href: ROUTES.HANGAR_DOCS_PATH('libs/constants/src/markdown-directives.ts'),
			},
		},
		{
			key: 'nodes-with-cards',
			label: 'Nodes with a deck',
			value: `${withDeck} / ${totalNodes}`,
			whatItMeasures:
				'How many knowledge nodes carry at least one card. The complement -- nodes with no deck -- can be read but never drilled.',
			whyItMatters:
				'A node with no cards teaches a topic but gives the learner no retrieval rep on it. Reading builds recognition; only retrieval practice builds recall. A deckless node leaves that recall gap open.',
			whatToDo: {
				text: 'Add a :::cards block to the Practice phase of nodes that have none, starting with checkride-critical topics.',
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
		},
		{
			key: 'rich-decks',
			label: 'Rich decks',
			value: `${rich} / ${totalNodes}`,
			whatItMeasures: `How many nodes carry a rich deck -- ${NODE_CARD_RICH_MIN} cards or more, enough to test a topic from recall, application, and discrimination angles.`,
			whyItMatters:
				'A rich deck exercises a topic more than once way. A thin deck (one or two cards) tests one fact and calls the topic covered, which under-drills it -- the learner can pass the card without owning the concept.',
			whatToDo: {
				text: `Grow thin decks past ${NODE_CARD_RICH_MIN} cards by adding application and discriminator cards alongside the recall card.`,
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
		},
		{
			key: 'no-deck',
			label: 'Nodes with no deck',
			value: none,
			whatItMeasures: 'How many nodes carry no `:::cards` block at all -- the deckless tail of the knowledge graph.',
			whyItMatters:
				'These nodes are entirely outside the spaced-repetition system. A learner can study them but the platform will never resurface them for review, so whatever they learned there decays unmeasured.',
			whatToDo: {
				text: 'Triage deckless nodes by study priority; author at least a recall deck for every critical-priority node.',
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
		},
	];

	return {
		id: 'cards',
		label: 'Cards (spaced-rep)',
		whatItIs:
			'Spaced-repetition cards embedded across knowledge-node markdown -- YAML entries in `:::cards` directive blocks, surfaced through the review queue.',
		whyItExists:
			'Reading a node builds recognition; cards build recall. The :::cards deck on a node is its retrieval-practice layer -- the items the spaced-repetition scheduler resurfaces so knowledge sticks instead of decaying.',
		location: `${KNOWLEDGE_DIR}/**/node.md (:::cards blocks)`,
		mode: 'census',
		stateRule: `A node's deck is "rich" when it carries ${NODE_CARD_RICH_MIN} cards or more, "thin" when it has one or more but fewer than ${NODE_CARD_RICH_MIN}, and "none" when the node carries no :::cards block or an empty one.`,
		docs: CARDS_DOCS,
		items,
		metrics,
		gaps: [],
		next: [],
		layerTwoPending: layerTwoPending('Cards (spaced-rep)'),
	};
}
