/**
 * Body markdown for help page `concept-interleaving`.
 *
 * Hand-edit this file -- the body is the source of truth. Run
 * `bun scripts/help/split-content.ts` to re-sync the matching index
 * file (precomputed search haystack) after editing a body.
 */

import type { HelpPageBody } from '@ab/help';

export const conceptInterleavingBody: HelpPageBody = {
	id: 'concept-interleaving',
	sections: [
		{
			id: 'blocked-vs-interleaved',
			title: 'Blocked vs interleaved',
			body: `Two ways to structure a practice session:

:::example
**Blocked.** "I'll do 20 weather problems, then 20 performance problems, then 20 regulation problems." Each block is one topic, uninterrupted.

**Interleaved.** "I'll do 60 problems drawn randomly from weather, performance, and regulations." Consecutive problems bounce between topics.
:::

Blocked practice feels more productive. You "get good at" weather problems, then "get good at" performance. Accuracy within each block climbs smoothly.

Interleaved practice feels worse. You get one wrong, the next one is a different topic, you can't hit a groove. Accuracy within the session stays lower.

On a delayed test -- a week later, or at the checkride -- interleaved wins, often dramatically.`,
		},
		{
			id: 'evidence',
			title: 'Evidence',
			body: `The literature is consistent, with motor tasks, math, biology, and art history all producing the same pattern.

| Study                                      | Task                                                                  | Blocked performance                       | Interleaved performance                   |
| ------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| Rohrer & Taylor (2007)                     | Math: volume of 4 solid shapes.                                       | 89% during practice, 20% one week later.  | 60% during practice, 63% one week later. |
| Kornell & Bjork (2008)                     | Art: identifying painters' styles.                                    | Higher during learning.                   | Higher on novel-painting transfer test.  |
| Taylor & Rohrer (2010)                     | Math: linear equations (slope, y-intercept, etc.).                    | Higher on practice problems.              | 77% vs 38% on delayed test.              |

> "Interleaving feels harder. That's the feature, not the bug." (Bjork, repeatedly.)

The mechanism is _discrimination_: with items mixed, you have to first identify _what kind of problem this is_ before you solve it. Blocked practice hides that step; interleaving forces it. On the real test (or in the airplane), nothing tells you which problem you're looking at.`,
		},
		{
			id: 'how-airboss-mixes',
			title: 'How airboss mixes',
			body: `airboss sessions are interleaved by construction. A typical session draws across four [[slices::concept-session-slices]]:

| Slice      | What it pulls                                         | Typical mix                                  |
| ---------- | ----------------------------------------------------- | -------------------------------------------- |
| Continue   | Cards + reps from domains you studied recently.       | Same domains; different knowledge types.     |
| Strengthen | Items the engine thinks you're losing.                | Spans all your active domains.               |
| Expand     | Cards in new domains you haven't touched.             | Adds a novel topic to the mix.               |
| Diversify  | Domains that have been cold for weeks.                | Forces at least one wildcard per session.    |

A 30-card session might pull 6 cards + 2 reps from Weather (Continue), 8 cards from IFR procedures (Strengthen), 5 cards from Aircraft Systems (Expand), 4 cards from Regulations (Strengthen), 3 cards + 2 reps from ADM (Diversify). You bounce. That's the point.

:::tip
If a session feels jarring because a weather card lands right after a performance card, that's interleaving doing its job. Don't seek out blocked decks to "get comfortable" with a topic -- comfort is not the goal; retention at the checkride is.
:::`,
		},
	],
	externalRefs: [
		{
			title: 'Interleaving effect (Wikipedia)',
			url: 'https://en.wikipedia.org/wiki/Interleaved_practice',
			source: 'wikipedia',
			note: 'Overview with the motor-skill and academic studies.',
		},
		{
			title: 'The shuffling of mathematics problems improves learning (Rohrer & Taylor, 2007)',
			url: 'https://doi.org/10.1007/s11251-007-9015-8',
			source: 'paper',
			note: 'The 89%->20% vs 60%->63% study. Classic demonstration.',
		},
		{
			title: 'Bjork Learning and Forgetting Lab',
			url: 'https://bjorklab.psych.ucla.edu/research/',
			source: 'other',
			note: 'Robert and Elizabeth Bjork -- primary source for desirable-difficulty research including interleaving.',
		},
	],
};
