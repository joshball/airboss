/**
 * Memory review help page.
 *
 * UX gaps addressed (docs/work/reviews/2026-04-22-app-wide-ux.md):
 *   - MAJOR "Review rating mistakes have no undo" -- explains rating
 *     semantics, documents the current workaround, notes planned undo.
 *   - MINOR "Confidence slider skip" and "Reps session confidence prompt
 *     is invisible when not shown" -- same underlying gap (confidence
 *     prompt feels random). This page explains the djb2 per-card-per-day
 *     deterministic sampling so the user can predict when it appears.
 *   - MINOR "Empty state copy doesn't differentiate 'no cards due' from
 *     'queue just completed'" -- covered in the "after the queue" section.
 *   - MINOR "New card form Cmd+Enter submits, Enter does not - undocumented"
 *     -- pointed at from here, full table in [Keyboard shortcuts].
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const memoryReview: HelpPage = {
	id: 'memory-review',
	title: 'Memory review',
	summary: 'How FSRS-5 scheduling, the four rating buttons, and the confidence prompt work.',
	documents: '/memory/review',
	tags: {
		appSurface: [APP_SURFACES.MEMORY],
		helpKind: HELP_KINDS.HOW_TO,
		keywords: ['fsrs', 'spaced-repetition', 'flashcards', 'rating', 'confidence', 'again', 'hard', 'good', 'easy'],
	},
	related: ['reps-session', 'calibration', 'keyboard-shortcuts', 'getting-started'],
	reviewedAt: '2026-04-22',
	sections: [
		{
			id: 'fsrs-in-one-paragraph',
			title: 'FSRS in one paragraph',
			body: `airboss schedules flashcards using [[FSRS::]] (Free Spaced Repetition Scheduler, version 5). Instead of a fixed ladder (1 day, 3 days, 7 days, ...), FSRS models each card's memory state as a stability value and updates it after every review based on how you rated your recall. The next due date is \`f(stability, recall rating, prior history)\`. A card you rate Good at the right interval grows in stability and pushes further out; a card you rate Again collapses toward short intervals until you reliably recall it. FSRS-5 is the current industry-standard scheduler for spaced repetition.`,
		},
		{
			id: 'the-four-ratings',
			title: 'Again, Hard, Good, Easy',
			body: `After the answer is revealed, rate your recall with one of four buttons:

| Button | Meaning                                                                           | Scheduling effect                                              |
| ------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Again  | You forgot. The answer surprised you.                                             | Stability collapses; card returns to short intervals.          |
| Hard   | You recalled it with effort or got it partially right.                            | Stability grows slightly; next interval short but not reset.   |
| Good   | You recalled it correctly with a reasonable effort.                               | Standard stability gain; next interval matches the model.      |
| Easy   | You recalled it instantly without effort.                                         | Above-standard stability gain; next interval pushed further.   |

Again is not a failure. The scheduler expects a non-zero forgetting rate - that is how it learns which cards are stable. Forcing yourself to rate Good when you actually forgot teaches the scheduler the wrong stability and corrupts the queue. Rate what happened.

Keyboard: \`1\` Again, \`2\` Hard, \`3\` Good, \`4\` Easy.`,
		},
		{
			id: 'confidence-sampling',
			title: 'Why the confidence prompt is sometimes there and sometimes not',
			body: `About half of your reviews also ask for a 1-5 confidence rating before you reveal the answer. This is used by the calibration system to measure how well your confidence tracks your accuracy.

The prompt is not random. It is deterministic: airboss hashes \`cardId + today's date\` through a djb2 variant and prompts when the hash falls in the sampled half. Two consequences:

1. **Per-card-per-day determinism.** The same card on the same day will always or never prompt for confidence; reload does not change the decision.
2. **Per-card-across-days rotation.** Over a week, each card is sampled for confidence about half the time, so the calibration signal is evenly spread.

The sampling rate is 50%. It is a cost/benefit compromise: every card prompting all the time slows down the queue; zero prompts starves the calibration system.

If you see the prompt, pick the confidence that matches how sure you feel *before* you see the answer. Skip the prompt only when you genuinely do not know what your confidence is - do not skip to go faster, because skipping weakens the [Calibration](/help/calibration) signal.`,
		},
		{
			id: 'mis-rated',
			title: 'I mis-rated - can I undo?',
			body: `Today: no. Once you click a rating the review is written and the next card loads. The fix-in-progress is a 2-second "Rated {X} - undo" toast that keeps the submit pending before advancing (see the UX review, MAJOR finding on review rating undo). Until that ships, use the workaround below.

**Workaround.** A mis-rated card will re-appear when it is next due. When it does, rate it the way you meant to last time. For a single mis-rated card this costs one or two extra reviews; the scheduler will settle back to the right interval within a card or two.

**If you mis-rated a lot of cards in one session** (say you rated Easy on everything by accident), flag the session date - there is no bulk undo. The scheduler will re-learn across a few subsequent review cycles, which takes longer than individual recovery.`,
		},
		{
			id: 'keyboard-shortcuts',
			title: 'Keyboard shortcuts',
			body: `During review:

- \`Space\` - reveal answer (and advance after rating on some keyboard layouts).
- \`1\` - rate Again.
- \`2\` - rate Hard.
- \`3\` - rate Good.
- \`4\` - rate Easy.

The keydown handler guards against IME composition events (Korean / Japanese / Chinese input), so composing a character will not accidentally rate a card. See [Keyboard shortcuts](/help/keyboard-shortcuts) for the full table including new-card and palette shortcuts.`,
		},
		{
			id: 'after-the-queue',
			title: 'After the queue',
			body: `When you finish a session, the page shows a completion summary ("Session complete - N reviewed"). When you land on the review page with nothing due, the page shows "You're caught up." These are two distinct states - the heading tells you which.

"Caught up" means the FSRS scheduler has no due reviews for you right now. More will come due as prior reviews age past their due dates. If you finish the queue and want more practice, the right move is a [Reps session](/help/reps-session), not forcing cards that are not due. Forcing reviews of non-due cards corrupts the scheduler's stability estimate.`,
		},
	],
};
