/**
 * Concept: Spaced repetition.
 *
 * The principle beneath every scheduler. Covers the forgetting curve,
 * the evidence base, and airboss's take on how rigidly to follow it.
 */

import { APP_SURFACES, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const conceptSpacedRepIndex: HelpPageIndex = {
	id: 'concept-spaced-rep',
	title: 'Spaced repetition',
	summary: 'Reviewing material at expanding intervals so each review strengthens long-term memory more than the last.',
	tags: {
		appSurface: [APP_SURFACES.MEMORY],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.LEARNING_SCIENCE,
		keywords: ['spaced repetition', 'forgetting curve', 'ebbinghaus', 'spacing effect', 'memory'],
	},
	sections: [
		{ id: 'what-it-is', title: 'What it is' },
		{ id: 'the-forgetting-curve', title: 'The forgetting curve' },
		{ id: 'evidence', title: 'Evidence' },
		{ id: 'airbosss-take', title: "airboss's take" },
	],
	searchHaystack:
		"reviewing material at expanding intervals so each review strengthens long-term memory more than the last. spaced repetition is a study method: review each item at expanding intervals (1 day, 3 days, 1 week, 3 weeks, ...) rather than cramming every item every session. each review at an interval you're about to forget _strengthens_ the memory more than a review while the item is still fresh.\n\nit is the engine behind every serious flashcard tool (anki, supermemo, quizlet's \"learn\" mode, airboss) and is one of the best-replicated findings in cognitive psychology. see fsrs for the specific scheduler airboss uses. hermann ebbinghaus ran experiments on himself in 1885, memorizing lists of nonsense syllables and measuring recall at various delays. the result -- the \"forgetting curve\" -- shows memory decaying roughly exponentially with time since learning.\n\n> after one hour, about 50% retention. after one day, about 30%. after a week, about 20%. then it flattens.\n\nthe curve was the first quantitative model of forgetting. modern replications confirm the shape (exponential decay, not linear) while refining the constants.\n\nthe _spacing effect_ adds the crucial second finding: each successful recall at the point of near-forgetting flattens the curve. after several successful spaced reviews, the \"half-life\" of the memory extends from hours to days to months.\n\n:::example\nreview a card on day 1. retention on day 2 is ~50%.\n\nreview the same card on day 2 (you just rescued it from forgetting). retention on day 7 is ~60% -- higher than after the first review.\n\nreview again on day 7. retention on day 30 is ~70%.\n\neach review extends the half-life. that's the whole idea.\n::: spaced repetition is one of the most-replicated findings in education research. a non-exhaustive list:\n\n| study / review                                                | finding                                                                                 |\n| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |\n| cepeda et al. (2006), meta-analysis of 317 experiments        | spaced practice outperforms massed practice (cramming) at every retention interval.     |\n| dunlosky et al. (2013), psychological science in the public interest | ranked \"distributed practice\" as a high-utility learning technique, one of two. |\n| kang (2016), policy insights from the behavioral brain sciences | effects hold across ages, domains, and task types.                                    |\n\nthe finding is robust enough that us medical schools, law schools, and language programs teach with it by default. for aviation knowledge (regulations, systems, procedures) it's a direct fit: large body of stable facts, long retention window required, periodic re-sharpening needed (flight reviews, ipc, recurrent training). airboss is built on spaced repetition but refuses to be rigid about it. two practical stances:\n\n:::note\n**we don't gate you on the queue.** if fsrs says you have 23 cards due today and you don't feel like reviewing, that's fine. cards stay due. your future self does the work. we don't shame you for missing a day.\n:::\n\n:::warn\n**we don't replace judgment with the queue either.** if you just returned from a 6-month break, rating honestly will show catastrophic stability collapse on most cards. that's the scheduler doing its job -- it's the truth about your memory. re-learn them. don't rate good to make the numbers look better.\n:::\n\nspaced repetition is a tool. the goal is staying safe in an airplane and passing checkrides with margin, not optimizing a graph. see desirable difficulty for the flip side: sometimes the scheduler feeling hard is exactly what you want. spaced repetition forgetting curve ebbinghaus spacing effect memory",
	related: ['concept-fsrs', 'concept-active-recall', 'concept-desirable-diff', 'memory-review'],
	reviewedAt: '2026-04-23',
	concept: true,
};
