/**
 * Concept: Desirable difficulty.
 *
 * Bjork's principle: the things that make learning feel hard in the
 * session are often the same things that make it stick.
 */

import { APP_SURFACES, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const conceptDesirableDifficultyIndex: HelpPageIndex = {
	id: 'concept-desirable-diff',
	title: 'Desirable difficulty',
	summary:
		"Bjork's principle: the conditions that slow acquisition often accelerate long-term retention. Hard is a feature.",
	tags: {
		appSurface: [APP_SURFACES.MEMORY],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.LEARNING_SCIENCE,
		keywords: ['desirable difficulty', 'bjork', 'learning vs performance', 'retrieval strength', 'storage strength'],
	},
	sections: [
		{ id: 'bjorks-principle', title: "Bjork's principle" },
		{ id: 'desirable-vs-undesirable', title: 'Desirable vs undesirable' },
		{ id: 'why-it-feels-bad', title: 'Why it feels bad' },
	],
	searchHaystack:
		"bjork's principle: the conditions that slow acquisition often accelerate long-term retention. hard is a feature. robert bjork's 1994 framing: there are _desirable_ difficulties and _undesirable_ difficulties. desirable difficulties slow you down in the moment and produce better retention, transfer, and durability later. undesirable difficulties just make the task harder with no upside.\n\n> \"conditions that produce faster acquisition often produce poorer long-term retention. conditions that slow acquisition often produce better long-term retention.\" -- bjork (1994)\n\nthe distinction matters because our intuitions about learning are wired for short-term performance. a study session that goes smoothly _feels_ like learning. one where you stumble feels like failure. the bjorks showed the reverse is often true on a delayed test. | desirable difficulty                                                   | undesirable difficulty                                         |\n| ---------------------------------------------------------------------- | -------------------------------------------------------------- |\n| spacing reviews out so you nearly forget (spaced repetition). | a poorly lit room that makes the text hard to read.            |\n| interleaving topics so you must discriminate (interleaving). | a teacher who refuses to answer questions.                     |\n| testing yourself instead of rereading (active recall).     | material presented in a language you don't speak fluently.     |\n| varying the context (different chairs, different times).               | a noisy environment that blocks encoding entirely.             |\n| generating answers before seeing them.                                 | missing prerequisite knowledge.                                |\n\nthe rule of thumb: if the difficulty exercises a cognitive process you'll need later (retrieval, discrimination, judgment, context-independent recall), it's desirable. if it just adds noise, it's not. humans confuse _learning_ with _performance_. performance is how well you do in the session. learning is how well you retain and transfer later. the bjorks distinguish them rigorously because they come apart.\n\n:::example\nstudent a studies regulations in blocked chapters. session performance: 92% correct. one month later on a cumulative quiz: 45%.\n\nstudent b studies the same regulations interleaved and with active recall. session performance: 71% correct. one month later: 68%.\n\nstudent a leaves the session feeling great and performs worse. student b leaves frustrated and performs far better. both are predictable from the literature.\n:::\n\nairboss is built to expose this gap. session-level metrics (rating distribution, today's accuracy) are deliberately de-emphasized; the metrics that matter (calibration trend, stability growth, domain coverage) are measured over weeks. feeling bad about a session is normal. feeling great about a session might mean it was too easy.\n\n:::tip\nif a session doesn't force at least some wrong answers, the scheduler has nothing to calibrate against. aim for roughly 15-20% again ratings. that's the sweet spot for desirable difficulty.\n::: desirable difficulty bjork learning vs performance retrieval strength storage strength",
	related: ['concept-interleaving', 'concept-active-recall', 'concept-spaced-rep'],
	reviewedAt: '2026-04-23',
	concept: true,
};
