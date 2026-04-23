/**
 * Concept: Knowledge graph.
 *
 * Airboss architecture concept: nodes (facts, procedures, teach units),
 * edges (prerequisites, related), and how the graph drives sessions.
 */

import { APP_SURFACES, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const conceptKnowledgeGraph: HelpPage = {
	id: 'concept-knowledge-graph',
	title: 'Knowledge graph',
	summary: "airboss's model of aviation knowledge: typed nodes, typed edges, and what the engine does with them.",
	tags: {
		appSurface: [APP_SURFACES.KNOWLEDGE],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.AIRBOSS_ARCHITECTURE,
		keywords: ['knowledge graph', 'node', 'edge', 'prerequisite', 'topic', 'procedure', 'teach node'],
	},
	concept: true,
	related: ['concept-session-slices', 'concept-spaced-rep', 'knowledge-graph'],
	reviewedAt: '2026-04-23',
	sections: [
		{
			id: 'overview',
			title: 'Overview',
			body: `Aviation knowledge isn't a flat list of facts -- it's a web. Knowing "Vy" is useful only when linked to "climb performance," "density altitude," and "engine-failure-after-takeoff" procedures. airboss models this web explicitly as a _knowledge graph_: a set of typed nodes connected by typed edges.

The graph drives three things:

1. **Authoring.** Content authors write one node at a time, declaring its prerequisites. The graph emerges from those declarations.
2. **Sessions.** The [[session engine::concept-session-slices]] walks the graph to decide what to surface (unstarted prerequisites before their dependents, cold domains when diversifying, etc.).
3. **Pages.** Each knowledge-graph page in the app renders a node with its immediate neighbors, letting you navigate along edges.`,
		},
		{
			id: 'node-types',
			title: 'Node types',
			body: `Three kinds of nodes, each with different authoring and scheduling rules.

| Type           | Purpose                                                                         | Example                                                                 | Has cards? |
| -------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------- |
| **Topic**      | An aviation concept. The unit of knowledge the graph is built around.           | "Density altitude", "ILS approach", "Uncontrolled airspace procedures". | Yes        |
| **Procedure**  | An ordered set of steps tied to a scenario or action.                           | "Engine-failure-after-takeoff response", "VOR cross-check".             | Yes        |
| **Teach node** | A learning unit: one objective, built from several topic/procedure nodes.       | "Understand how to plan a VFR cross-country in mountainous terrain."    | Indirect   |

Topic and procedure nodes are the atoms. Teach nodes are the compositions: each one cites the topic/procedure nodes it teaches and defines the pedagogy (scenarios, guided discovery, check questions).

:::tip
Discovery-first pedagogy applies at the teach-node level. Topic nodes present the concept directly; teach nodes lead with a situation or question and let the learner reason toward the same concept. See [ADR 011](/knowledge) for the full principle.
:::`,
		},
		{
			id: 'edges-and-prerequisites',
			title: 'Edges and prerequisites',
			body: `Edges carry type too. The most important one is _prerequisite_.

| Edge type     | Meaning                                                                | Effect on sessions                                                    |
| ------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| prerequisite  | A -> B means "you should understand A before B is meaningful."         | Expand/Diversify won't surface B if A is unstarted.                   |
| related       | Bidirectional. "These nodes come up together."                         | Drives "see also" suggestions on node pages.                          |
| subsumes      | A -> B means "A covers everything in B plus more."                     | Avoids double-counting coverage metrics.                              |

> "A graph without prerequisites is just a list. A graph without _related_ edges is just a tree. We need both." -- authoring-system design notes

:::example
Node: "Localizer back-course approaches." Prerequisites: "ILS basics," "Reverse sensing concept." Related: "NDB approaches," "Circling minimums." Subsumes: (none).

A session that tries to Expand this node will refuse to surface it until both prerequisites are done. A session that has just surfaced it will suggest the related nodes as next steps.
:::`,
		},
		{
			id: 'what-the-engine-does',
			title: 'What the engine does with it',
			body: `The session engine treats the graph as a live picture of your knowledge and picks items against it.

:::note
**Coverage.** The engine tracks which nodes you have _started_ (at least one card reviewed), which are _progressing_ (cards not yet mature), and which are _mature_ (FSRS stability above threshold). Domain-level rollups drive the "Unused domain" and "Cold domain" signals.
:::

:::note
**Prerequisites in action.** If Expand wants to add a new node and all candidates have unstarted prerequisites, the engine instead surfaces the prerequisite. You rarely need to think about this; it just means sessions feel "connected" instead of scattershot.
:::

:::note
**Teach-node coverage.** When a teach-node is authored as a session module, completing it requires mastery of each cited topic/procedure node. The rollup is automatic; the authoring surface never duplicates cards.
:::`,
		},
	],
	externalRefs: [
		{
			title: 'Knowledge graph (Wikipedia)',
			url: 'https://en.wikipedia.org/wiki/Knowledge_graph',
			source: 'wikipedia',
			note: 'General definition of typed-node/typed-edge knowledge bases.',
		},
		{
			title: 'Concept map (Wikipedia)',
			url: 'https://en.wikipedia.org/wiki/Concept_map',
			source: 'wikipedia',
			note: "Ausubel's pedagogical roots of the graph-based knowledge representation used here.",
		},
	],
};
