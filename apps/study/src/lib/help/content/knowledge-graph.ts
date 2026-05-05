/**
 * Knowledge graph help page.
 *
 * UX gaps addressed (docs/work/reviews/2026-04-22-app-wide-ux.md):
 *   - MAJOR "/knowledge/[slug]/learn has no completion tracking per phase"
 *     -- this page explains the 7 phases + dual-gate mastery so users can
 *     read the stepper correctly even without visited-state tracking.
 *   - Discovery-first pedagogy (ADR 011) is a core design principle that
 *     is not explained to users anywhere in the app. This page covers it.
 *   - Dual-gate mastery (card gate AND rep gate, both required) is
 *     unexplained in the UI. This page is the explainer.
 *   - Knowledge-only nodes (zero scenarios -> rep gate n/a) is a special
 *     case that needs documentation.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const knowledgeGraphIndex: HelpPageIndex = {
	id: 'knowledge-graph',
	title: 'Knowledge graph',
	summary: 'The seven discovery-first phases and how dual-gate mastery works.',
	tags: {
		appSurface: [APP_SURFACES.KNOWLEDGE],
		helpKind: HELP_KINDS.CONCEPT,
		keywords: ['knowledge-graph', 'phases', 'mastery', 'discovery', 'adr-011', 'node', 'learn', 'stepper'],
	},
	sections: [
		{ id: 'what-it-is', title: 'What the knowledge graph is' },
		{ id: 'seven-phases', title: 'The seven phases' },
		{ id: 'dual-gate-mastery', title: 'Dual-gate mastery' },
		{ id: 'knowledge-only-nodes', title: 'Knowledge-only nodes' },
		{ id: 'navigation', title: 'Navigating the graph' },
		{ id: 'discovery-first', title: 'Why discovery-first' },
	],
	searchHaystack:
		'the seven discovery-first phases and how dual-gate mastery works. the knowledge graph is a set of aviation-topic nodes with typed relationships between them. each node is one coherent piece of pilot knowledge (for example: "vfr weather minimums for class e below 10,000 ft," "why manifold pressure drops with altitude on a normally-aspirated engine," "the go-around decision point on a stabilized approach"). nodes link to each other by prerequisite, related-topic, and expansion.\n\nthe graph is the structural spine airboss uses to track what you know. cards and reps both attach to nodes. mastery is measured per-node. coverage against a target cert (ppl / ir / cpl / cfi) is the set of nodes the cert syllabus requires.\n\nbrowse the graph at `/knowledge`. each node has a detail page at `/knowledge/[slug]` and a guided-learn stepper at `/knowledge/[slug]/learn`. every node has the same seven-phase learn stepper. the order is deliberate and follows adr 011\'s discovery-first pedagogy: lead with why, let the learner derive the answer, reveal the regulation as confirmation of reasoning rather than as an arbitrary rule.\n\n| # | phase    | purpose                                                                            |\n| - | -------- | ---------------------------------------------------------------------------------- |\n| 1 | context  | the real-world situation where this knowledge matters. pilot-voice, scenario-led. |\n| 2 | problem  | the decision or question this node answers. poses the challenge, not the answer.  |\n| 3 | discover | guided reasoning. learner works toward the answer from first principles.          |\n| 4 | reveal   | the answer. regulation, procedure, or explanation - confirms the reasoning.        |\n| 5 | practice | worked examples. apply the answer to varying cases.                                |\n| 6 | connect  | how this node relates to neighbors. links in the graph become links in the mind.   |\n| 7 | verify   | check the mastery gates. do you have enough cards and reps at the required level? |\n\nthe stepper shows which phases are authored and which are skeleton. a node whose discover phase is empty still renders the stepper; that phase shows a "not yet authored" note. nothing blocks navigation. per-phase visited-state persistence is planned but not yet wired. a node is mastered when both gates pass:\n\n**card gate** - at least 3 cards attached to the node and mastery ratio >= 80%. "mastered" per card means fsrs stability above a threshold (roughly: the card is on an interval long enough to be safe).\n\n**rep gate** - at least 3 decision reps attached to the node and accuracy >= 70% over the most recent attempts.\n\nboth gates are required. a node with great card mastery but failed reps is not mastered - it means you have the facts but not the judgment. a node with great rep accuracy but weak card mastery is also not mastered - it means you are guessing right without the underlying knowledge to transfer.\n\nthe two gates together approximate bloom\'s distinction between recall (cards) and application (reps). the dashboard\'s cert-progress panel counts only fully-mastered nodes. some nodes have zero decision reps attached and never will - for example, a pure definition node like "what does va mean" (va). for these nodes the rep gate is `not_applicable` and card-gate mastery alone determines the node\'s mastery state.\n\nthe detail page labels these nodes "knowledge-only" so the missing rep gate does not look like a bug. if a node you would expect to have scenarios shows knowledge-only, that is a content gap worth reporting - a node that ends in decision-making (go-around timing, fuel-reserve call) should have reps. three entry paths:\n\n- **`/knowledge`** - browse. filterable by topic, cert target, mastery state, and authoring status. returns a list of node cards with their current mastery state.\n- **`/knowledge/[slug]`** - detail. one node, showing prerequisites, neighbors, attached cards, attached reps, and current mastery against both gates. also surfaces "review cards for this node" (links to `/memory/review?node=...`).\n- **`/knowledge/[slug]/learn`** - guided learn. the 7-phase stepper. the url can pin a phase with `?step=discover` for deep-links from external references.\n\nauthoring state appears on both browse and detail:\n\n- **skeleton** - node exists in the graph but has no authored content in any phase.\n- **started** - at least one phase authored; stepper renders partial content.\n- **complete** - all seven phases authored and reviewed.\n\nskeleton nodes are deliberately listed. they tell you what the graph *will* cover even before the content exists, which matters for cert coverage planning. adr 011 ([[discovery-first pedagogy::]]) decided that knowledge nodes lead with why, not what. a node on vfr weather minimums does not open with "14 cfr 91.155 says." it opens with a scenario where the minimum matters, asks the learner to reason about what margin would be safe, and only then reveals the regulation.\n\nrationale: pilots who derived the rule from first principles apply it in edge cases; pilots who memorized the rule apply it mechanically and miss edges. the faa has arrived at roughly the same conclusion in acs standards and in ac 61-83k (the firc guidance): teach *why*, not *what*.\n\ncards and reps reinforce the discovered knowledge through spaced repetition. the graph is the spine; the cards and reps are the proficiency surface. they work together. knowledge-graph phases mastery discovery adr-011 node learn stepper',
	documents: '/reference/knowledge',
	related: ['memory-review', 'reps-session', 'getting-started'],
	reviewedAt: '2026-04-22',
	concept: true,
};
