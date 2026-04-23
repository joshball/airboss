/**
 * Concept: FSRS-5.
 *
 * The scheduler that decides when every memory card comes due. Explains
 * stability vs difficulty, the rating -> scheduling feedback loop, and
 * why airboss uses FSRS instead of SM-2.
 */

import { APP_SURFACES, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const conceptFsrs: HelpPage = {
	id: 'concept-fsrs',
	title: 'FSRS-5',
	summary: 'The Free Spaced Repetition Scheduler -- how airboss models your memory of every card.',
	tags: {
		appSurface: [APP_SURFACES.MEMORY],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.LEARNING_SCIENCE,
		keywords: ['fsrs', 'fsrs-5', 'scheduler', 'stability', 'difficulty', 'retrievability', 'sm-2', 'anki'],
	},
	concept: true,
	related: ['concept-spaced-rep', 'concept-active-recall', 'concept-calibration', 'memory-review'],
	reviewedAt: '2026-04-23',
	sections: [
		{
			id: 'overview',
			title: 'Overview',
			body: `FSRS (Free Spaced Repetition Scheduler) is a modern spaced-repetition algorithm that predicts, for every card you review, how likely you are to recall it at any future moment. airboss uses FSRS-5, the fifth-generation public model maintained by the open-source spaced-repetition community.

Unlike a fixed ladder scheduler (1 day, 3 days, 7 days, ...), FSRS maintains a per-card memory model with three live variables and updates them after every review based on how you rated your recall. See [[spaced repetition::concept-spaced-rep]] for the underlying idea and [[active recall::concept-active-recall]] for why the rating matters.

:::tip
You don't need to know the math to use the scheduler. You do need to rate honestly. "Good" when you forgot corrupts the model for that card for weeks.
:::`,
		},
		{
			id: 'the-algorithm',
			title: 'The algorithm',
			body: `FSRS tracks three per-card state variables:

| Variable          | What it represents                                                                           | How it changes                                                   |
| ----------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Stability (S)     | How long, in days, it takes for retrievability to drop to the target recall rate.            | Grows when you recall; collapses when you rate Again.            |
| Difficulty (D)    | How "hard" this card is for you personally, on a 1-10 scale. Rises with Again, falls with Easy. | Drifts toward your long-run average difficulty over time.      |
| Retrievability (R) | The model's estimate, right now, of your probability of recalling this card.               | A function of stability and elapsed time since last review.      |

The scheduler picks the next due date by solving for the time at which retrievability hits a target (default 0.9 -- 90% recall). That gives an interval personalized to both the card's stability and the target recall rate the user picks.

Pseudocode for the rating update:

\`\`\`text
on rate(card, rating, elapsed_days):
  R = retrievability(card.S, elapsed_days)
  S_new = next_stability(card.S, card.D, R, rating)
  D_new = next_difficulty(card.D, rating)
  due   = invert_recall(S_new, target=0.9)   // days until R falls to 0.9
  persist(card, S_new, D_new, due)
\`\`\`

:::note
The real FSRS-5 update uses 19 trained weights (\`w[0]..w[18]\`) fit by gradient descent against large review datasets. Default weights work well for most users; advanced users can retrain against their own history. airboss ships the defaults.
:::`,
		},
		{
			id: 'stability-vs-difficulty',
			title: 'Stability vs difficulty',
			body: `These two variables get confused a lot. They measure different things.

:::example
A ground-school regulation you mostly have down: stability grows fast (days -> weeks -> months) and difficulty stays low. After a few correct reviews the card is pushed months out.

A procedure you keep mis-sequencing: stability stays stuck in the single-digit days, and difficulty climbs toward 10. The scheduler brings it back frequently until difficulty falls again.
:::

Stability is a property of _this particular card in your head right now_. Difficulty is a running estimate of how much work this card takes _you_ compared to your average card. Two pilots studying the same deck will end up with different difficulty values on the same card.

When you see a card every two days for weeks despite rating Good, that's high difficulty (not low stability) -- the model thinks you're about to forget if pushed further. Trust it.`,
		},
		{
			id: 'why-not-sm-2',
			title: 'Why not SM-2',
			body: `SM-2 (SuperMemo 2, 1988) is the algorithm Anki shipped with for decades. It's simpler and well-understood, but it has two structural problems FSRS fixes.

| Problem                                                                        | SM-2                                                            | FSRS-5                                                           |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| No explicit memory model; "ease factor" conflates difficulty and interval.     | Single ease factor drifts; lapses spiral into "ease hell."      | Separates stability (memory) from difficulty (card hardness).    |
| Schedules don't adapt to the user's target retention rate.                     | Fixed multipliers.                                              | Target retention is a first-class knob (0.9 default).            |
| "Ease hell": repeated lapses tank a card's ease and it comes up forever.        | Common; reset-ease workarounds pile up in community decks.      | Difficulty recovers toward mean over time; no spiral.            |
| Limited signal from new rating buttons.                                        | Ratings (Again/Hard/Good/Easy) map linearly to ease changes.    | Ratings feed into a trained model; non-linear, context-sensitive. |

> Scheduling is not curve-fitting to review history. It is modelling human memory and then asking when retrievability will hit a target. The two are mathematically related and operationally very different.

FSRS-5 also benefits from a growing public dataset: the open-source community retrains the default weights regularly against anonymized review logs across millions of cards. SM-2 hasn't changed since Piotr Wozniak published it.`,
		},
		{
			id: 'what-this-means-for-you',
			title: 'What this means for you',
			body: `Three practical consequences:

:::tip
1. **Rate what happened, not what you wish happened.** Again is not a failure -- the scheduler _needs_ to see forgetting to estimate stability. Forcing Good when you forgot teaches the model a lie.
2. **Don't chase intervals.** If the scheduler brings a card back in 2 days and you think it should be 2 weeks, it has more data than you do. Let it run.
3. **Calibration feeds the model, not the scheduler.** Your confidence rating doesn't change FSRS. It feeds [[calibration::concept-calibration]], a separate system.
:::`,
		},
	],
	externalRefs: [
		{
			title: 'Free Spaced Repetition Scheduler (Wikipedia)',
			url: 'https://en.wikipedia.org/wiki/Free_Spaced_Repetition_Scheduler',
			source: 'wikipedia',
			note: 'Overview of FSRS family, including FSRS-5. Good starting point.',
		},
		{
			title: 'Optimizing Spaced Repetition Schedule by Capturing the Dynamics of Memory (arXiv)',
			url: 'https://arxiv.org/abs/2402.12291',
			source: 'paper',
			note: 'Ye et al. -- the DSR (Difficulty, Stability, Retrievability) model behind FSRS.',
		},
		{
			title: 'open-spaced-repetition/fsrs4anki (GitHub)',
			url: 'https://github.com/open-spaced-repetition/fsrs4anki/wiki',
			source: 'other',
			note: 'Reference implementation wiki. Parameter meanings, retraining guide.',
		},
		{
			title: 'Spaced Repetition Algorithm: A Three-Day Journey from Novice to Expert',
			url: 'https://github.com/open-spaced-repetition/fsrs4anki/wiki/Spaced-Repetition-Algorithm:-A-Three-Day-Journey-from-Novice-to-Expert',
			source: 'other',
			note: 'Jarrett Ye -- accessible three-part primer on FSRS design.',
		},
	],
};
