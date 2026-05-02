/**
 * Concept: Active recall.
 *
 * The "pulling out" half of learning. Covers the testing effect, why
 * rereading feels productive and isn't, and how airboss applies it.
 */

import { APP_SURFACES, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const conceptActiveRecallIndex: HelpPageIndex = {
	id: 'concept-active-recall',
	title: 'Active recall',
	summary: 'Testing yourself beats rereading. Retrieving an answer strengthens memory more than seeing it again.',
	tags: {
		appSurface: [APP_SURFACES.MEMORY],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.LEARNING_SCIENCE,
		keywords: ['active recall', 'testing effect', 'retrieval practice', 'rereading', 'study technique'],
	},
	sections: [
		{ id: 'what-it-is', title: 'What it is' },
		{ id: 'vs-rereading', title: 'Active recall vs rereading' },
		{ id: 'the-testing-effect', title: 'The testing effect' },
		{ id: 'how-airboss-applies-it', title: 'How airboss applies it' },
	],
	searchHaystack:
		'testing yourself beats rereading. retrieving an answer strengthens memory more than seeing it again. active recall is the practice of generating an answer from memory instead of re-reading it. cover the answer, attempt retrieval, _then_ check. every flashcard, every quiz question, every oral-exam-style prompt is active recall.\n\nthe opposite -- passive review -- is reading the material again. highlighting. re-watching a lecture. annotating notes. passive review feels productive because the material becomes more familiar. familiarity is not recall.\n\nairboss is active-recall-first. every card asks you to produce the answer before revealing it; every rep scenario demands a decision before showing the outcome. | dimension                        | rereading                                        | active recall                                    |\n| -------------------------------- | ------------------------------------------------ | ------------------------------------------------ |\n| effort                           | low. eyes skim familiar text.                    | high. brain generates the answer or fails to.    |\n| felt productivity                | high. "i got through the chapter."               | low. failures feel like not-knowing.             |\n| measured retention (1 week)      | baseline.                                        | ~50% higher in controlled studies.               |\n| measured retention (1 month)     | baseline.                                        | often 2x or more.                                |\n| transfer to novel problems       | weak.                                            | stronger, especially with varied practice.       |\n\n> "students consistently rate rereading as their most-used study technique. it is one of the least effective." (dunlosky et al., 2013.)\n\nthe gap between felt productivity and actual retention is the core trap. the study session that _feels_ worst (you forgot a lot, you had to guess, it was slow) is often the one that worked best a week later. the empirical name for "retrieval strengthens memory" is the _testing effect_. karpicke & roediger ran the now-classic demonstration in 2008:\n\n:::example\nfour groups studied the same passage. group a reread 4 times. group b reread 3 times then took a test. group c reread once then took 3 tests. group d took 4 tests with no rereading (after initial study).\n\none week later, retention ranked: **d > c > b > a.** more testing beat more rereading even when total time was equal.\n:::\n\nthe mechanism isn\'t mysterious. retrieving an item exercises the neural pathway that found it; rereading exercises the pathway that recognized it. the two are different, and recall is the one you need on a checkride or in the airplane.\n\nfollow-up research has replicated the testing effect across domains (vocabulary, concepts, procedures, motor tasks), ages (children, adults, older adults), and delays (minutes to years). see spaced repetition for the complementary finding about _when_ to test. every surface is structured to force retrieval before feedback.\n\n:::tip\n**cards.** question shown, answer hidden. you produce the answer (aloud, in your head, or on paper), then reveal and rate. the rate step _is_ the calibration signal -- see calibration.\n:::\n\n:::tip\n**reps.** a [scenario](/help/reps-session) poses a decision. you pick _before_ seeing the outcome. no peeking, no "what would you do if" -- commit, then see.\n:::\n\n:::tip\n**knowledge nodes.** discovery-first pedagogy: the page leads with a question or situation, lets you reason toward the answer, _then_ reveals the regulation as confirmation. this applies active recall to the learning phase, not just review.\n:::\n\n:::warn\n**anti-patterns we actively avoid.** we don\'t show an answer next to a question. we don\'t let you "skip to the outcome" on a rep scenario. we don\'t lead knowledge nodes with "per 14 cfr 91.109..." -- that\'s passive review pretending to be teaching.\n::: active recall testing effect retrieval practice rereading study technique',
	related: ['concept-spaced-rep', 'concept-fsrs', 'concept-desirable-diff', 'memory-review'],
	reviewedAt: '2026-04-23',
	concept: true,
};
