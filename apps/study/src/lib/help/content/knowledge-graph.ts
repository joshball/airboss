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

import { APP_SURFACES, HELP_KINDS, ROUTES } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const knowledgeGraph: HelpPage = {
	id: 'knowledge-graph',
	title: 'Knowledge graph',
	summary: 'The seven discovery-first phases and how dual-gate mastery works.',
	documents: ROUTES.KNOWLEDGE,
	tags: {
		appSurface: [APP_SURFACES.KNOWLEDGE],
		helpKind: HELP_KINDS.CONCEPT,
		keywords: ['knowledge-graph', 'phases', 'mastery', 'discovery', 'adr-011', 'node', 'learn', 'stepper'],
	},
	concept: true,
	related: ['memory-review', 'reps-session', 'getting-started'],
	reviewedAt: '2026-04-22',
	sections: [
		{
			id: 'what-it-is',
			title: 'What the knowledge graph is',
			body: `The knowledge graph is a set of aviation-topic nodes with typed relationships between them. Each node is one coherent piece of pilot knowledge (for example: "VFR weather minimums for Class E below 10,000 ft," "why manifold pressure drops with altitude on a normally-aspirated engine," "the go-around decision point on a stabilized approach"). Nodes link to each other by prerequisite, related-topic, and expansion.

The graph is the structural spine airboss uses to track what you know. Cards and reps both attach to nodes. Mastery is measured per-node. Coverage against a target cert (PPL / IR / CPL / CFI) is the set of nodes the cert syllabus requires.

Browse the graph at \`/knowledge\`. Each node has a detail page at \`/knowledge/[slug]\` and a guided-learn stepper at \`/knowledge/[slug]/learn\`.`,
		},
		{
			id: 'seven-phases',
			title: 'The seven phases',
			body: `Every node has the same seven-phase learn stepper. The order is deliberate and follows ADR 011's discovery-first pedagogy: lead with WHY, let the learner derive the answer, reveal the regulation as confirmation of reasoning rather than as an arbitrary rule.

| # | Phase    | Purpose                                                                            |
| - | -------- | ---------------------------------------------------------------------------------- |
| 1 | Context  | The real-world situation where this knowledge matters. Pilot-voice, scenario-led. |
| 2 | Problem  | The decision or question this node answers. Poses the challenge, not the answer.  |
| 3 | Discover | Guided reasoning. Learner works toward the answer from first principles.          |
| 4 | Reveal   | The answer. Regulation, procedure, or explanation - confirms the reasoning.        |
| 5 | Practice | Worked examples. Apply the answer to varying cases.                                |
| 6 | Connect  | How this node relates to neighbors. Links in the graph become links in the mind.   |
| 7 | Verify   | Check the mastery gates. Do you have enough cards and reps at the required level? |

The stepper shows which phases are authored and which are skeleton. A node whose Discover phase is empty still renders the stepper; that phase shows a "not yet authored" note. Nothing blocks navigation. Per-phase visited-state persistence is planned but not yet wired.`,
		},
		{
			id: 'dual-gate-mastery',
			title: 'Dual-gate mastery',
			body: `A node is mastered when both gates pass:

**Card gate** - at least 3 cards attached to the node AND mastery ratio >= 80%. "Mastered" per card means FSRS stability above a threshold (roughly: the card is on an interval long enough to be safe).

**Rep gate** - at least 3 decision reps attached to the node AND accuracy >= 70% over the most recent attempts.

Both gates are required. A node with great card mastery but failed reps is not mastered - it means you have the facts but not the judgment. A node with great rep accuracy but weak card mastery is also not mastered - it means you are guessing right without the underlying knowledge to transfer.

The two gates together approximate Bloom's distinction between recall (cards) and application (reps). The dashboard's cert-progress panel counts only fully-mastered nodes.`,
		},
		{
			id: 'knowledge-only-nodes',
			title: 'Knowledge-only nodes',
			body: `Some nodes have zero decision reps attached and never will - for example, a pure definition node like "what does Va mean" ([[Va::va-aircraft]]). For these nodes the rep gate is \`not_applicable\` and card-gate mastery alone determines the node's mastery state.

The detail page labels these nodes "knowledge-only" so the missing rep gate does not look like a bug. If a node you would expect to have scenarios shows knowledge-only, that is a content gap worth reporting - a node that ends in decision-making (go-around timing, fuel-reserve call) should have reps.`,
		},
		{
			id: 'navigation',
			title: 'Navigating the graph',
			body: `Three entry paths:

- **\`/knowledge\`** - browse. Filterable by topic, cert target, mastery state, and authoring status. Returns a list of node cards with their current mastery state.
- **\`/knowledge/[slug]\`** - detail. One node, showing prerequisites, neighbors, attached cards, attached reps, and current mastery against both gates. Also surfaces "review cards for this node" (links to \`/memory/review?node=...\`).
- **\`/knowledge/[slug]/learn\`** - guided learn. The 7-phase stepper. The URL can pin a phase with \`?step=discover\` for deep-links from external references.

Authoring state appears on both browse and detail:

- **Skeleton** - node exists in the graph but has no authored content in any phase.
- **Started** - at least one phase authored; stepper renders partial content.
- **Complete** - all seven phases authored and reviewed.

Skeleton nodes are deliberately listed. They tell you what the graph *will* cover even before the content exists, which matters for cert coverage planning.`,
		},
		{
			id: 'discovery-first',
			title: 'Why discovery-first',
			body: `ADR 011 ([[discovery-first pedagogy::]]) decided that knowledge nodes lead with WHY, not WHAT. A node on VFR weather minimums does not open with "14 CFR 91.155 says." It opens with a scenario where the minimum matters, asks the learner to reason about what margin would be safe, and only then reveals the regulation.

Rationale: pilots who derived the rule from first principles apply it in edge cases; pilots who memorized the rule apply it mechanically and miss edges. The FAA has arrived at roughly the same conclusion in ACS standards and in AC 61-83K (the FIRC guidance): teach *why*, not *what*.

Cards and reps reinforce the discovered knowledge through spaced repetition. The graph is the spine; the cards and reps are the proficiency surface. They work together.`,
		},
	],
	externalRefs: [
		{
			title: 'ADR 011 -- Knowledge Graph Learning System',
			url: 'https://github.com/joshball/airboss/blob/main/docs/decisions/011-knowledge-graph-learning-system/decision.md',
			source: 'other',
			note: 'The internal architecture decision record that defines the seven-phase stepper, dual-gate mastery, and the discovery-first pedagogy this page documents.',
		},
		{
			title: 'Airman Certification Standards (ACS) -- Private Pilot Airplane',
			url: 'https://www.faa.gov/training_testing/testing/acs',
			source: 'faa',
			note: 'The ACS framework integrates knowledge, risk management, and skill into a single standard. The dual-gate mastery model (cards for knowledge, reps for application) maps to that integration.',
		},
		{
			title: 'AC 61-83K -- Industry-Conducted FIRC guidance on adult learning principles',
			url: 'https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentID/1041665',
			source: 'faa',
			note: 'The FAA guidance that explicitly endorses scenario-based, discovery-led instruction over rote regulation memorization. Discovery-first pedagogy aligns with this guidance.',
		},
	],
};
