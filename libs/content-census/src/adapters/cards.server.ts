// @browser-globals: server-only -- never imported by client .svelte
/**
 * The cards census adapter -- a Phase-3 full reference adapter.
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
 * Phase-3 depth (this module): the adapter walks the same node corpus the
 * knowledge-nodes adapter does, but reports the corpus from the *deck's*
 * point of view. It derives:
 *
 *   - the rich / thin / none state per node (Layer 1),
 *   - the explained metrics over that distribution (Layer 1),
 *   - a real gap view -- deckless authored nodes, thin decks, and decks
 *     stranded on a skeleton node (a deck whose host node teaches nothing)
 *     -- each carrying the what / why / do triad (Phase-3 Layer-1 analysis),
 *   - a value-ranked next-list, ordered by the `study_priority` signal
 *     already on each node's frontmatter.
 *
 * Layer-2 scope note: the per-node content-intent `intent` block (ADR 028)
 * is NOT read here -- ADR 028 is still `proposed`, so no node carries that
 * frontmatter and authoring it would jump an unapproved contract. The gap
 * view and next-list below derive entirely from node content already on
 * disk. When ADR 028 is accepted, Layer-2 intent refines the next-list's
 * value ranking (today proxied from `study_priority`). This mirrors the
 * knowledge-nodes adapter's Layer-2 deferral exactly.
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import { NODE_CARD_RICH_MIN, ROUTES, STUDY_PRIORITIES } from '@ab/constants';
import type { CensusGap, CensusItem, CensusMetric, CensusNextItem, CorpusCensus, DocLink } from '../types';
import { authoredPhases, countCardBlocks, frontmatterString, parseMarkdownFile, walkMarkdown } from './markdown.server';

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
		label: 'ADR 028 -- Content-intent frontmatter',
		href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/028-content-intent-frontmatter.md'),
		role: 'The proposed Layer-2 intent block; once accepted, each node carries planned / wanted authoring intent that refines this next-list ranking.',
	},
	{
		label: 'Content census -- Phase 3 tasks',
		href: ROUTES.HANGAR_DOCS_PATH('docs/work-packages/hangar-content-census/tasks.md'),
		role: 'Tracks the per-corpus depth work; the gap view below is the cards Phase-3 Layer-1 analysis.',
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

/** One knowledge node, read for the cards census + deck-gap analysis. */
interface DeckRecord {
	/** Frontmatter `id`, or the path when the file has no id. */
	id: string;
	/** Frontmatter `title`, or the id when the file has no title. */
	title: string;
	/** The number of `:::cards` cards in the body. */
	cardCount: number;
	/** The derived rich / thin / none deck state. */
	state: string;
	/** Frontmatter `study_priority` (critical / standard / stretch), or null. */
	studyPriority: string | null;
	/** True when the host node has zero authored `:::phase` prose -- a skeleton. */
	hostIsSkeleton: boolean;
}

/** Read every node.md off disk into a `DeckRecord`. */
function readDecks(): DeckRecord[] {
	const nodePaths = walkMarkdown(KNOWLEDGE_DIR, (basename) => basename === 'node.md');
	const records: DeckRecord[] = [];
	for (const path of nodePaths) {
		const { frontmatter, body } = parseMarkdownFile(path);
		const id = frontmatterString(frontmatter, 'id') ?? path;
		const title = frontmatterString(frontmatter, 'title') ?? id;
		const cardCount = countCardBlocks(body);
		records.push({
			id,
			title,
			cardCount,
			state: deriveState(cardCount),
			studyPriority: frontmatterString(frontmatter, 'study_priority'),
			hostIsSkeleton: authoredPhases(body).length === 0,
		});
	}
	return records;
}

/**
 * Build the cards census. Walks every knowledge node, counts the cards in
 * its embedded `:::cards` blocks, derives the rich / thin / none
 * distribution, the explained metrics, the real gap view, and the
 * value-ranked next-list.
 */
export function cardsCensus(): CorpusCensus {
	const decks = readDecks();

	const items: CensusItem[] = decks.map((deck) => ({
		id: deck.id,
		label: deck.title,
		derivedState: deck.state,
		detail: `${deck.cardCount} ${deck.cardCount === 1 ? 'card' : 'cards'}`,
	}));

	const totalNodes = items.length;
	const totalCards = decks.reduce((sum, deck) => sum + deck.cardCount, 0);
	const richDecks = decks.filter((deck) => deck.state === STATE_RICH);
	const thinDecks = decks.filter((deck) => deck.state === STATE_THIN);
	const noneDecks = decks.filter((deck) => deck.state === STATE_NONE);
	const withDeck = richDecks.length + thinDecks.length;

	// A deckless node whose host node teaches nothing -- a skeleton -- needs
	// its prose first, not a deck. It is already flagged by the knowledge-
	// nodes skeleton gap. The cardless gap below counts only deckless nodes
	// whose host node is authored: a readable topic with no retrieval layer.
	const cardlessAuthored = noneDecks.filter((deck) => !deck.hostIsSkeleton);
	// A deck stranded on a skeleton node: cards exist, but the surrounding
	// node has no authored prose, so the learner is drilled on a topic the
	// platform never actually teaches.
	const decksOnSkeletons = decks.filter((deck) => deck.cardCount > 0 && deck.hostIsSkeleton);

	const isCritical = (deck: DeckRecord): boolean => deck.studyPriority === STUDY_PRIORITIES.CRITICAL;
	const criticalCardless = cardlessAuthored.filter(isCritical);
	const criticalThin = thinDecks.filter(isCritical);

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
			value: `${richDecks.length} / ${totalNodes}`,
			whatItMeasures: `How many nodes carry a rich deck -- ${NODE_CARD_RICH_MIN} cards or more, enough to test a topic from recall, application, and discrimination angles.`,
			whyItMatters:
				'A rich deck exercises a topic more than one way. A thin deck (one or two cards) tests one fact and calls the topic covered, which under-drills it -- the learner can pass the card without owning the concept.',
			whatToDo: {
				text: `Grow thin decks past ${NODE_CARD_RICH_MIN} cards by adding application and discriminator cards alongside the recall card.`,
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
		},
		{
			key: 'no-deck',
			label: 'Nodes with no deck',
			value: noneDecks.length,
			whatItMeasures: 'How many nodes carry no `:::cards` block at all -- the deckless tail of the knowledge graph.',
			whyItMatters:
				'These nodes are entirely outside the spaced-repetition system. A learner can study them but the platform will never resurface them for review, so whatever they learned there decays unmeasured.',
			whatToDo: {
				text: 'Triage deckless nodes by study priority; author at least a recall deck for every critical-priority node.',
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
		},
	];

	const gaps: CensusGap[] = [];

	if (cardlessAuthored.length > 0) {
		gaps.push({
			title: `${cardlessAuthored.length} authored nodes have no deck -- readable but never drilled`,
			whatItMeasures: `${cardlessAuthored.length} of ${totalNodes} nodes have authored prose but carry no \`:::cards\` block at all. ${criticalCardless.length} of them are study-priority critical. (Skeleton-node decks are excluded -- a skeleton needs its prose written before a deck.)`,
			whyItMatters:
				'A node with prose but no deck can be read once and is then never resurfaced. Reading builds recognition; only cards enter the spaced-repetition rotation and build durable recall. A cardless node is studied and then quietly forgotten -- the topic looks taught but the platform cannot keep it from decaying.',
			whatToDo: {
				text: `Author a :::cards deck on the ${cardlessAuthored.length} cardless authored nodes, the ${criticalCardless.length} critical-priority topics first, so every readable node has a retrieval-practice layer.`,
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
			severity: 'structural',
		});
	}

	if (thinDecks.length > 0) {
		gaps.push({
			title: `${thinDecks.length} ${thinDecks.length === 1 ? 'deck is' : 'decks are'} thin -- a topic drilled from only one angle`,
			whatItMeasures: `${thinDecks.length} of ${totalNodes} nodes carry a deck with one or more cards but fewer than ${NODE_CARD_RICH_MIN}. ${criticalThin.length} of them are study-priority critical.`,
			whyItMatters: `A thin deck tests one or two facts and calls the topic covered. The learner can clear the deck without owning the concept -- a single recall card never exercises application or discrimination. ${NODE_CARD_RICH_MIN} cards is the smallest deck that drills a topic from more than one angle.`,
			whatToDo: {
				text: `Grow the ${thinDecks.length} thin decks past ${NODE_CARD_RICH_MIN} cards, the ${criticalThin.length} critical-priority topics first, by adding application and discriminator cards alongside the recall card.`,
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			},
			severity: 'thin',
		});
	}

	if (decksOnSkeletons.length > 0) {
		const examples = decksOnSkeletons
			.slice(0, 3)
			.map((deck) => deck.id)
			.join(', ');
		gaps.push({
			title: `${decksOnSkeletons.length} ${decksOnSkeletons.length === 1 ? 'deck is' : 'decks are'} stranded on a skeleton node -- cards with no teaching behind them`,
			whatItMeasures: `${decksOnSkeletons.length} nodes carry a \`:::cards\` deck while their host node has zero authored \`:::phase\` prose -- the body is still the generated skeleton shell. Examples: ${examples}.`,
			whyItMatters:
				'A deck on a skeleton node drills the learner on a topic the platform never actually teaches. The card resurfaces in the review queue, but the node behind it is blank, so the learner cannot revise or derive the answer -- the discovery-first arc has nothing to discover. The card tests recall of content that was never presented.',
			whatToDo: {
				text: `Author the discovery-first phases on the ${decksOnSkeletons.length} skeleton ${decksOnSkeletons.length === 1 ? 'node' : 'nodes'} that already carry a deck -- they are the highest-leverage skeletons to write, because the retrieval layer is already in place.`,
				href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/011-knowledge-graph-learning-system/decision.md'),
			},
			severity: 'structural',
		});
	}

	// Next-list ranking. Layer 2 (ADR 028) will carry an explicit per-node
	// `value` signal; until that ADR is accepted, the ranking proxies value
	// from what is already on disk -- `study_priority`. A critical-priority
	// topic with no deck is the highest-value authoring target: it is the
	// content a learner most needs to retain, sitting entirely outside the
	// spaced-repetition system.
	const next: CensusNextItem[] = [];

	if (criticalCardless.length > 0) {
		next.push({
			text: `Author a deck on the ${criticalCardless.length} critical-priority cardless nodes`,
			rationale:
				'A checkride-critical topic with no deck is the worst cell in the cards corpus -- the content a learner most needs to retain, with nothing to resurface it. Highest retention value per deck authored.',
			href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			value: 'high',
		});
	}

	if (decksOnSkeletons.length > 0) {
		next.push({
			text: `Author the discovery-first prose on the ${decksOnSkeletons.length} skeleton ${decksOnSkeletons.length === 1 ? 'node' : 'nodes'} that already carry a deck`,
			rationale:
				'A deck on a skeleton node drills recall of content that was never taught. Writing the node phases is the smallest move that turns an unsupported card into a real discovery-first topic -- the retrieval layer is already done.',
			href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/011-knowledge-graph-learning-system/decision.md'),
			value: 'high',
		});
	}

	if (criticalThin.length > 0) {
		next.push({
			text: `Grow the ${criticalThin.length} critical-priority thin decks past ${NODE_CARD_RICH_MIN} cards`,
			rationale:
				'Each critical thin deck tests its topic from one angle only. Adding application and discriminator cards moves a one-fact deck to one that exercises the concept the learner has to own for the checkride.',
			href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			value: 'standard',
		});
	}

	const nonCriticalCardless = cardlessAuthored.length - criticalCardless.length;
	if (nonCriticalCardless > 0) {
		next.push({
			text: `Author a deck on the remaining ${nonCriticalCardless} non-critical cardless nodes`,
			rationale:
				'After the critical cardless nodes, the standard- and stretch-priority deckless nodes close the rest of the no-retrieval-layer gap. They still decay unmeasured today; they are just lower-traffic topics.',
			href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			value: 'standard',
		});
	}

	const nonCriticalThin = thinDecks.length - criticalThin.length;
	if (nonCriticalThin > 0) {
		next.push({
			text: `Grow the remaining ${nonCriticalThin} non-critical thin decks past ${NODE_CARD_RICH_MIN} cards`,
			rationale:
				'After the critical thin decks, the standard- and stretch-priority thin decks finish the under-drilled tail. Each is a lower-effort enhancement -- the deck already exists, it just needs more angles.',
			href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/'),
			value: 'low',
		});
	}

	return {
		id: 'cards',
		label: 'Cards (spaced-rep)',
		whatItIs:
			'Spaced-repetition cards embedded across knowledge-node markdown -- YAML entries in `:::cards` directive blocks, surfaced through the review queue.',
		whyItExists:
			'Reading a node builds recognition; cards build recall. The :::cards deck on a node is its retrieval-practice layer -- the items the spaced-repetition scheduler resurfaces so knowledge sticks instead of decaying.',
		location: `${KNOWLEDGE_DIR}/**/node.md (:::cards blocks)`,
		mode: 'full',
		stateRule: `A node's deck is "rich" when it carries ${NODE_CARD_RICH_MIN} cards or more, "thin" when it has one or more but fewer than ${NODE_CARD_RICH_MIN}, and "none" when the node carries no :::cards block or an empty one.`,
		docs: CARDS_DOCS,
		items,
		metrics,
		gaps,
		next,
	};
}
