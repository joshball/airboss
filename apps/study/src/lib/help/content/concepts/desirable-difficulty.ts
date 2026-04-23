/**
 * Concept: Desirable difficulty.
 *
 * Bjork's principle: the things that make learning feel hard in the
 * session are often the same things that make it stick.
 */

import { APP_SURFACES, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const conceptDesirableDifficulty: HelpPage = {
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
	concept: true,
	related: ['concept-interleaving', 'concept-active-recall', 'concept-spaced-rep'],
	reviewedAt: '2026-04-23',
	sections: [
		{
			id: 'bjorks-principle',
			title: "Bjork's principle",
			body: `Robert Bjork's 1994 framing: there are _desirable_ difficulties and _undesirable_ difficulties. Desirable difficulties slow you down in the moment and produce better retention, transfer, and durability later. Undesirable difficulties just make the task harder with no upside.

> "Conditions that produce faster acquisition often produce poorer long-term retention. Conditions that slow acquisition often produce better long-term retention." -- Bjork (1994)

The distinction matters because our intuitions about learning are wired for short-term performance. A study session that goes smoothly _feels_ like learning. One where you stumble feels like failure. The Bjorks showed the reverse is often true on a delayed test.`,
		},
		{
			id: 'desirable-vs-undesirable',
			title: 'Desirable vs undesirable',
			body: `| Desirable difficulty                                                   | Undesirable difficulty                                         |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| Spacing reviews out so you nearly forget ([[spaced repetition::concept-spaced-rep]]). | A poorly lit room that makes the text hard to read.            |
| Interleaving topics so you must discriminate ([[interleaving::concept-interleaving]]). | A teacher who refuses to answer questions.                     |
| Testing yourself instead of rereading ([[active recall::concept-active-recall]]).     | Material presented in a language you don't speak fluently.     |
| Varying the context (different chairs, different times).               | A noisy environment that blocks encoding entirely.             |
| Generating answers before seeing them.                                 | Missing prerequisite knowledge.                                |

The rule of thumb: if the difficulty exercises a cognitive process you'll need later (retrieval, discrimination, judgment, context-independent recall), it's desirable. If it just adds noise, it's not.`,
		},
		{
			id: 'why-it-feels-bad',
			title: 'Why it feels bad',
			body: `Humans confuse _learning_ with _performance_. Performance is how well you do in the session. Learning is how well you retain and transfer later. The Bjorks distinguish them rigorously because they come apart.

:::example
Student A studies regulations in blocked chapters. Session performance: 92% correct. One month later on a cumulative quiz: 45%.

Student B studies the same regulations interleaved and with active recall. Session performance: 71% correct. One month later: 68%.

Student A leaves the session feeling great and performs worse. Student B leaves frustrated and performs far better. Both are predictable from the literature.
:::

airboss is built to expose this gap. Session-level metrics (rating distribution, today's accuracy) are deliberately de-emphasized; the metrics that matter (calibration trend, stability growth, domain coverage) are measured over weeks. Feeling bad about a session is normal. Feeling great about a session might mean it was too easy.

:::tip
If a session doesn't force at least some wrong answers, the [[scheduler::concept-fsrs]] has nothing to calibrate against. Aim for roughly 15-20% Again ratings. That's the sweet spot for desirable difficulty.
:::`,
		},
	],
	externalRefs: [
		{
			title: 'Desirable difficulty (Wikipedia)',
			url: 'https://en.wikipedia.org/wiki/Desirable_difficulty',
			source: 'wikipedia',
			note: 'Overview with pointers into the Bjork canon.',
		},
		{
			title: 'Making Things Hard on Yourself, But in a Good Way (Bjork & Bjork, 2011)',
			url: 'https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf',
			source: 'paper',
			note: 'The accessible summary chapter. Start here.',
		},
		{
			title: 'Bjork Learning and Forgetting Lab',
			url: 'https://bjorklab.psych.ucla.edu/',
			source: 'other',
			note: 'Papers, talks, and the New Theory of Disuse that grounds the framework.',
		},
	],
};
