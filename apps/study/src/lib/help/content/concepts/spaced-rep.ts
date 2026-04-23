/**
 * Concept: Spaced repetition.
 *
 * The principle beneath every scheduler. Covers the forgetting curve,
 * the evidence base, and airboss's take on how rigidly to follow it.
 */

import { APP_SURFACES, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const conceptSpacedRep: HelpPage = {
	id: 'concept-spaced-rep',
	title: 'Spaced repetition',
	summary: 'Reviewing material at expanding intervals so each review strengthens long-term memory more than the last.',
	tags: {
		appSurface: [APP_SURFACES.MEMORY],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.LEARNING_SCIENCE,
		keywords: ['spaced repetition', 'forgetting curve', 'ebbinghaus', 'spacing effect', 'memory'],
	},
	concept: true,
	related: ['concept-fsrs', 'concept-active-recall', 'concept-desirable-diff', 'memory-review'],
	reviewedAt: '2026-04-23',
	sections: [
		{
			id: 'what-it-is',
			title: 'What it is',
			body: `Spaced repetition is a study method: review each item at expanding intervals (1 day, 3 days, 1 week, 3 weeks, ...) rather than cramming every item every session. Each review at an interval you're about to forget _strengthens_ the memory more than a review while the item is still fresh.

It is the engine behind every serious flashcard tool (Anki, SuperMemo, Quizlet's "Learn" mode, airboss) and is one of the best-replicated findings in cognitive psychology. See [[FSRS::concept-fsrs]] for the specific scheduler airboss uses.`,
		},
		{
			id: 'the-forgetting-curve',
			title: 'The forgetting curve',
			body: `Hermann Ebbinghaus ran experiments on himself in 1885, memorizing lists of nonsense syllables and measuring recall at various delays. The result -- the "forgetting curve" -- shows memory decaying roughly exponentially with time since learning.

> After one hour, about 50% retention. After one day, about 30%. After a week, about 20%. Then it flattens.

The curve was the first quantitative model of forgetting. Modern replications confirm the shape (exponential decay, not linear) while refining the constants.

The _spacing effect_ adds the crucial second finding: each successful recall at the point of near-forgetting flattens the curve. After several successful spaced reviews, the "half-life" of the memory extends from hours to days to months.

:::example
Review a card on day 1. Retention on day 2 is ~50%.

Review the same card on day 2 (you just rescued it from forgetting). Retention on day 7 is ~60% -- higher than after the first review.

Review again on day 7. Retention on day 30 is ~70%.

Each review extends the half-life. That's the whole idea.
:::`,
		},
		{
			id: 'evidence',
			title: 'Evidence',
			body: `Spaced repetition is one of the most-replicated findings in education research. A non-exhaustive list:

| Study / review                                                | Finding                                                                                 |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Cepeda et al. (2006), meta-analysis of 317 experiments        | Spaced practice outperforms massed practice (cramming) at every retention interval.     |
| Dunlosky et al. (2013), Psychological Science in the Public Interest | Ranked "distributed practice" as a high-utility learning technique, one of two. |
| Kang (2016), Policy Insights from the Behavioral Brain Sciences | Effects hold across ages, domains, and task types.                                    |

The finding is robust enough that US medical schools, law schools, and language programs teach with it by default. For aviation knowledge (regulations, systems, procedures) it's a direct fit: large body of stable facts, long retention window required, periodic re-sharpening needed (flight reviews, IPC, recurrent training).`,
		},
		{
			id: 'airbosss-take',
			title: "airboss's take",
			body: `airboss is built on spaced repetition but refuses to be rigid about it. Two practical stances:

:::note
**We don't gate you on the queue.** If FSRS says you have 23 cards due today and you don't feel like reviewing, that's fine. Cards stay due. Your future self does the work. We don't shame you for missing a day.
:::

:::warn
**We don't replace judgment with the queue either.** If you just returned from a 6-month break, rating honestly will show catastrophic stability collapse on most cards. That's the scheduler doing its job -- it's the truth about your memory. Re-learn them. Don't rate Good to make the numbers look better.
:::

Spaced repetition is a tool. The goal is staying safe in an airplane and passing checkrides with margin, not optimizing a graph. See [[desirable difficulty::concept-desirable-diff]] for the flip side: sometimes the scheduler feeling hard is exactly what you want.`,
		},
	],
	externalRefs: [
		{
			title: 'Spaced repetition (Wikipedia)',
			url: 'https://en.wikipedia.org/wiki/Spaced_repetition',
			source: 'wikipedia',
			note: 'Overview of method, history, and modern software implementations.',
		},
		{
			title: 'Forgetting curve (Wikipedia)',
			url: 'https://en.wikipedia.org/wiki/Forgetting_curve',
			source: 'wikipedia',
			note: 'Ebbinghaus and the exponential-decay model.',
		},
		{
			title: 'How to remember anything forever-ish (Nicky Case)',
			url: 'https://ncase.me/remember/',
			source: 'other',
			note: 'Interactive comic explaining spaced repetition. Best 20 minutes you can spend on the topic.',
		},
		{
			title: 'Distributed practice in verbal recall tasks (Cepeda et al., 2006)',
			url: 'https://doi.org/10.1037/0033-2909.132.3.354',
			source: 'paper',
			note: 'Meta-analysis that pinned down the spacing effect empirically.',
		},
	],
};
