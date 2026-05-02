/**
 * Concept: Interleaving.
 *
 * Mixing topics within a study session outperforms blocking (one topic
 * at a time). Core to how airboss assembles sessions.
 */

import { APP_SURFACES, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const conceptInterleavingIndex: HelpPageIndex = {
	id: 'concept-interleaving',
	title: 'Interleaving',
	summary:
		'Mixing topics within a session beats studying one topic at a time. The practice feels worse and works better.',
	tags: {
		appSurface: [APP_SURFACES.SESSION],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.LEARNING_SCIENCE,
		keywords: ['interleaving', 'blocked practice', 'mixed practice', 'discrimination', 'transfer'],
	},
	sections: [
		{ id: 'blocked-vs-interleaved', title: 'Blocked vs interleaved' },
		{ id: 'evidence', title: 'Evidence' },
		{ id: 'how-airboss-mixes', title: 'How airboss mixes' },
	],
	searchHaystack:
		'mixing topics within a session beats studying one topic at a time. the practice feels worse and works better. two ways to structure a practice session:\n\n:::example\n**blocked.** "i\'ll do 20 weather problems, then 20 performance problems, then 20 regulation problems." each block is one topic, uninterrupted.\n\n**interleaved.** "i\'ll do 60 problems drawn randomly from weather, performance, and regulations." consecutive problems bounce between topics.\n:::\n\nblocked practice feels more productive. you "get good at" weather problems, then "get good at" performance. accuracy within each block climbs smoothly.\n\ninterleaved practice feels worse. you get one wrong, the next one is a different topic, you can\'t hit a groove. accuracy within the session stays lower.\n\non a delayed test -- a week later, or at the checkride -- interleaved wins, often dramatically. the literature is consistent, with motor tasks, math, biology, and art history all producing the same pattern.\n\n| study                                      | task                                                                  | blocked performance                       | interleaved performance                   |\n| ------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------- |\n| rohrer & taylor (2007)                     | math: volume of 4 solid shapes.                                       | 89% during practice, 20% one week later.  | 60% during practice, 63% one week later. |\n| kornell & bjork (2008)                     | art: identifying painters\' styles.                                    | higher during learning.                   | higher on novel-painting transfer test.  |\n| taylor & rohrer (2010)                     | math: linear equations (slope, y-intercept, etc.).                    | higher on practice problems.              | 77% vs 38% on delayed test.              |\n\n> "interleaving feels harder. that\'s the feature, not the bug." (bjork, repeatedly.)\n\nthe mechanism is _discrimination_: with items mixed, you have to first identify _what kind of problem this is_ before you solve it. blocked practice hides that step; interleaving forces it. on the real test (or in the airplane), nothing tells you which problem you\'re looking at. airboss sessions are interleaved by construction. a typical session draws across four slices:\n\n| slice      | what it pulls                                         | typical mix                                  |\n| ---------- | ----------------------------------------------------- | -------------------------------------------- |\n| continue   | cards + reps from domains you studied recently.       | same domains; different knowledge types.     |\n| strengthen | items the engine thinks you\'re losing.                | spans all your active domains.               |\n| expand     | cards in new domains you haven\'t touched.             | adds a novel topic to the mix.               |\n| diversify  | domains that have been cold for weeks.                | forces at least one wildcard per session.    |\n\na 30-card session might pull 6 cards + 2 reps from weather (continue), 8 cards from ifr procedures (strengthen), 5 cards from aircraft systems (expand), 4 cards from regulations (strengthen), 3 cards + 2 reps from adm (diversify). you bounce. that\'s the point.\n\n:::tip\nif a session feels jarring because a weather card lands right after a performance card, that\'s interleaving doing its job. don\'t seek out blocked decks to "get comfortable" with a topic -- comfort is not the goal; retention at the checkride is.\n::: interleaving blocked practice mixed practice discrimination transfer',
	related: ['concept-desirable-diff', 'concept-session-slices', 'concept-spaced-rep'],
	reviewedAt: '2026-04-23',
	concept: true,
};
