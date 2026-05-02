/**
 * Body markdown for help page `concept-active-recall`.
 *
 * Hand-edit this file -- the body is the source of truth. Run
 * `bun scripts/help/split-content.ts` to re-sync the matching index
 * file (precomputed search haystack) after editing a body.
 */

import type { HelpPageBody } from '@ab/help';

export const conceptActiveRecallBody: HelpPageBody = {
	id: 'concept-active-recall',
	sections: [
		{
			id: 'what-it-is',
			title: 'What it is',
			body: `Active recall is the practice of generating an answer from memory instead of re-reading it. Cover the answer, attempt retrieval, _then_ check. Every flashcard, every quiz question, every oral-exam-style prompt is active recall.

The opposite -- passive review -- is reading the material again. Highlighting. Re-watching a lecture. Annotating notes. Passive review feels productive because the material becomes more familiar. Familiarity is not recall.

airboss is active-recall-first. Every card asks you to produce the answer before revealing it; every [[rep::concept-session-slices]] scenario demands a decision before showing the outcome.`,
		},
		{
			id: 'vs-rereading',
			title: 'Active recall vs rereading',
			body: `| Dimension                        | Rereading                                        | Active recall                                    |
| -------------------------------- | ------------------------------------------------ | ------------------------------------------------ |
| Effort                           | Low. Eyes skim familiar text.                    | High. Brain generates the answer or fails to.    |
| Felt productivity                | High. "I got through the chapter."               | Low. Failures feel like not-knowing.             |
| Measured retention (1 week)      | Baseline.                                        | ~50% higher in controlled studies.               |
| Measured retention (1 month)     | Baseline.                                        | Often 2x or more.                                |
| Transfer to novel problems       | Weak.                                            | Stronger, especially with varied practice.       |

> "Students consistently rate rereading as their most-used study technique. It is one of the least effective." (Dunlosky et al., 2013.)

The gap between felt productivity and actual retention is the core trap. The study session that _feels_ worst (you forgot a lot, you had to guess, it was slow) is often the one that worked best a week later.`,
		},
		{
			id: 'the-testing-effect',
			title: 'The testing effect',
			body: `The empirical name for "retrieval strengthens memory" is the _testing effect_. Karpicke & Roediger ran the now-classic demonstration in 2008:

:::example
Four groups studied the same passage. Group A reread 4 times. Group B reread 3 times then took a test. Group C reread once then took 3 tests. Group D took 4 tests with no rereading (after initial study).

One week later, retention ranked: **D > C > B > A.** More testing beat more rereading even when total time was equal.
:::

The mechanism isn't mysterious. Retrieving an item exercises the neural pathway that found it; rereading exercises the pathway that recognized it. The two are different, and recall is the one you need on a checkride or in the airplane.

Follow-up research has replicated the testing effect across domains (vocabulary, concepts, procedures, motor tasks), ages (children, adults, older adults), and delays (minutes to years). See [[spaced repetition::concept-spaced-rep]] for the complementary finding about _when_ to test.`,
		},
		{
			id: 'how-airboss-applies-it',
			title: 'How airboss applies it',
			body: `Every surface is structured to force retrieval before feedback.

:::tip
**Cards.** Question shown, answer hidden. You produce the answer (aloud, in your head, or on paper), then reveal and rate. The rate step _is_ the calibration signal -- see [[calibration::concept-calibration]].
:::

:::tip
**Reps.** A [scenario](/help/reps-session) poses a decision. You pick _before_ seeing the outcome. No peeking, no "what would you do if" -- commit, then see.
:::

:::tip
**Knowledge nodes.** Discovery-first pedagogy: the page leads with a question or situation, lets you reason toward the answer, _then_ reveals the regulation as confirmation. This applies active recall to the learning phase, not just review.
:::

:::warn
**Anti-patterns we actively avoid.** We don't show an answer next to a question. We don't let you "skip to the outcome" on a rep scenario. We don't lead knowledge nodes with "Per 14 CFR 91.109..." -- that's passive review pretending to be teaching.
:::`,
		},
	],
	externalRefs: [
		{
			title: 'Testing effect (Wikipedia)',
			url: 'https://en.wikipedia.org/wiki/Testing_effect',
			source: 'wikipedia',
			note: 'Overview of retrieval-practice research with key studies.',
		},
		{
			title: 'The critical importance of retrieval for learning (Karpicke & Roediger, 2008)',
			url: 'https://doi.org/10.1126/science.1152408',
			source: 'paper',
			note: 'Science. The canonical testing-effect demonstration.',
		},
		{
			title: 'Improving Students Learning With Effective Learning Techniques (Dunlosky et al., 2013)',
			url: 'https://doi.org/10.1177/1529100612453266',
			source: 'paper',
			note: 'Psychological Science in the Public Interest. Retrieval practice ranked high-utility; rereading ranked low.',
		},
	],
};
