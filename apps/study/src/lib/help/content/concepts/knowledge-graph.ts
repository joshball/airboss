/**
 * Concept: Knowledge graph.
 *
 * Airboss architecture concept: nodes (facts, procedures, teach units),
 * edges (prerequisites, related), and how the graph drives sessions.
 */

import { APP_SURFACES, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const conceptKnowledgeGraphIndex: HelpPageIndex = {
	id: 'concept-knowledge-graph',
	title: 'Knowledge graph',
	summary: "airboss's model of aviation knowledge: typed nodes, typed edges, and what the engine does with them.",
	tags: {
		appSurface: [APP_SURFACES.KNOWLEDGE],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.AIRBOSS_ARCHITECTURE,
		keywords: ['knowledge graph', 'node', 'edge', 'prerequisite', 'topic', 'procedure', 'teach node'],
	},
	sections: [
		{ id: 'overview', title: 'Overview' },
		{ id: 'node-types', title: 'Node types' },
		{ id: 'edges-and-prerequisites', title: 'Edges and prerequisites' },
		{ id: 'what-the-engine-does', title: 'What the engine does with it' },
	],
	searchHaystack:
		'airboss\'s model of aviation knowledge: typed nodes, typed edges, and what the engine does with them. aviation knowledge isn\'t a flat list of facts -- it\'s a web. knowing "vy" is useful only when linked to "climb performance," "density altitude," and "engine-failure-after-takeoff" procedures. airboss models this web explicitly as a _knowledge graph_: a set of typed nodes connected by typed edges.\n\nthe graph drives three things:\n\n1. **authoring.** content authors write one node at a time, declaring its prerequisites. the graph emerges from those declarations.\n2. **sessions.** the session engine walks the graph to decide what to surface (unstarted prerequisites before their dependents, cold domains when diversifying, etc.).\n3. **pages.** each knowledge-graph page in the app renders a node with its immediate neighbors, letting you navigate along edges. three kinds of nodes, each with different authoring and scheduling rules.\n\n| type           | purpose                                                                         | example                                                                 | has cards? |\n| -------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------- |\n| **topic**      | an aviation concept. the unit of knowledge the graph is built around.           | "density altitude", "ils approach", "uncontrolled airspace procedures". | yes        |\n| **procedure**  | an ordered set of steps tied to a scenario or action.                           | "engine-failure-after-takeoff response", "vor cross-check".             | yes        |\n| **teach node** | a learning unit: one objective, built from several topic/procedure nodes.       | "understand how to plan a vfr cross-country in mountainous terrain."    | indirect   |\n\ntopic and procedure nodes are the atoms. teach nodes are the compositions: each one cites the topic/procedure nodes it teaches and defines the pedagogy (scenarios, guided discovery, check questions).\n\n:::tip\ndiscovery-first pedagogy applies at the teach-node level. topic nodes present the concept directly; teach nodes lead with a situation or question and let the learner reason toward the same concept. see [adr 011](/knowledge) for the full principle.\n::: edges carry type too. the most important one is _prerequisite_.\n\n| edge type     | meaning                                                                | effect on sessions                                                    |\n| ------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |\n| prerequisite  | a -> b means "you should understand a before b is meaningful."         | expand/diversify won\'t surface b if a is unstarted.                   |\n| related       | bidirectional. "these nodes come up together."                         | drives "see also" suggestions on node pages.                          |\n| subsumes      | a -> b means "a covers everything in b plus more."                     | avoids double-counting coverage metrics.                              |\n\n> "a graph without prerequisites is just a list. a graph without _related_ edges is just a tree. we need both." -- authoring-system design notes\n\n:::example\nnode: "localizer back-course approaches." prerequisites: "ils basics," "reverse sensing concept." related: "ndb approaches," "circling minimums." subsumes: (none).\n\na session that tries to expand this node will refuse to surface it until both prerequisites are done. a session that has just surfaced it will suggest the related nodes as next steps.\n::: the session engine treats the graph as a live picture of your knowledge and picks items against it.\n\n:::note\n**coverage.** the engine tracks which nodes you have _started_ (at least one card reviewed), which are _progressing_ (cards not yet mature), and which are _mature_ (fsrs stability above threshold). domain-level rollups drive the "unused domain" and "cold domain" signals.\n:::\n\n:::note\n**prerequisites in action.** if expand wants to add a new node and all candidates have unstarted prerequisites, the engine instead surfaces the prerequisite. you rarely need to think about this; it just means sessions feel "connected" instead of scattershot.\n:::\n\n:::note\n**teach-node coverage.** when a teach-node is authored as a session module, completing it requires mastery of each cited topic/procedure node. the rollup is automatic; the authoring surface never duplicates cards.\n::: knowledge graph node edge prerequisite topic procedure teach node',
	related: ['concept-session-slices', 'concept-spaced-rep', 'knowledge-graph'],
	reviewedAt: '2026-04-23',
	concept: true,
};
