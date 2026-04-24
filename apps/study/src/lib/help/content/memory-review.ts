/**
 * Memory review help page.
 *
 * Phase 3 of the session-legibility-and-help-expansion work package:
 * rebuilt on the rich-markdown pattern used by the concept pages. Covers
 * what the `/memory/review` route is for, the four ratings, how FSRS
 * schedules cards, the confidence prompt, active recall, and a short
 * list of review tips. Cross-links out to the full deep-dive concept
 * pages rather than duplicating their content here.
 *
 * UX gaps addressed (docs/work/reviews/2026-04-22-app-wide-ux.md):
 *   - MAJOR "Review rating mistakes have no undo" -- the undo toast is
 *     now implemented in the page; this help doc frames rating honesty
 *     and points at the undo affordance.
 *   - MINOR "Confidence slider skip" and "Reps session confidence prompt
 *     is invisible when not shown" -- explains the deterministic sampling
 *     so the prompt feels predictable, not random.
 *   - MINOR "Empty state copy doesn't differentiate 'no cards due' from
 *     'queue just completed'" -- covered in the overview.
 */

import { APP_SURFACES, HELP_KINDS, ROUTES } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const memoryReview: HelpPage = {
	id: 'memory-review',
	title: 'Memory review',
	summary:
		'What the memory review queue is for, how the four ratings drive FSRS scheduling, and how the confidence prompt feeds calibration.',
	documents: ROUTES.MEMORY_REVIEW,
	tags: {
		appSurface: [APP_SURFACES.MEMORY],
		helpKind: HELP_KINDS.HOW_TO,
		keywords: [
			'memory',
			'review',
			'fsrs',
			'spaced-repetition',
			'flashcards',
			'rating',
			'again',
			'good',
			'easy',
			'confidence',
			'calibration',
			'active-recall',
		],
	},
	related: [
		'concept-fsrs',
		'concept-spaced-rep',
		'concept-active-recall',
		'concept-calibration',
		'reps-session',
		'calibration',
		'keyboard-shortcuts',
		'getting-started',
	],
	reviewedAt: '2026-04-23',
	sections: [
		{
			id: 'overview',
			title: 'Overview',
			body: `The memory review queue is where airboss hands you the flashcards the scheduler thinks you're about to forget. One card at a time: you try to recall the back from the front, you reveal, and you rate how it actually went. The rating feeds back into the scheduler, which decides when the card comes due again.

This is the core loop of [[spaced repetition::concept-spaced-rep]]: short, daily sessions beat massed cramming, because each well-timed recall grows the interval the card survives before you next need it.

:::tip
Review a few cards a day; consistency beats cramming. Ten minutes every morning will push your due queue farther out and make each session shorter than one 90-minute marathon per week ever will.
:::

When the queue runs out, the page tells you which of two things happened. **"Session complete"** means you worked through what was scheduled for now. **"You're caught up"** means nothing is due yet -- come back later or write new cards. Forcing reviews on cards that aren't due corrupts the scheduler's stability estimate; don't do it.`,
		},
		{
			id: 'the-four-ratings',
			title: 'The four ratings',
			body: `After the answer is revealed you pick one of four buttons. The rating is the scheduler's only signal: rate what happened, not what you wish had happened. "Good" when you forgot teaches [[FSRS::concept-fsrs]] a lie about that card, and you'll pay for it in two weeks.

| Rating | When to pick it                                                          | What happens to scheduling                                                           |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Again  | You forgot. The answer surprised you, or you drew a blank.               | Stability collapses. The card returns in minutes to under a day.                     |
| Hard   | You recalled it, but with effort, hesitation, or only partially right.   | Stability grows a little. Next interval is shorter than Good would have given.       |
| Good   | You recalled it correctly with reasonable effort. This is the default.   | Standard stability gain. Next interval matches the scheduler's model for this card.  |
| Easy   | You recalled it instantly, no effort at all.                             | Larger stability gain. Next interval is stretched further than Good.                 |

Keyboard: \`1\` Again, \`2\` Hard, \`3\` Good, \`4\` Easy. \`Space\` reveals the answer.

If you mis-click, a 2.5-second "Rated X -- Undo" toast appears at the top of the page. Press \`U\` (or \`Cmd/Ctrl+Z\`) or click Undo to roll the review back and restore the card to the top of the queue. Past the toast window, a mis-rated card will self-correct within a review or two because it comes back when due and you can rate it correctly then.`,
		},
		{
			id: 'how-scheduling-works',
			title: 'How scheduling works',
			body: `airboss schedules every card with [[FSRS-5::concept-fsrs]] (Free Spaced Repetition Scheduler, version 5). Instead of a fixed ladder (1 day, 3 days, 7 days, ...), FSRS maintains a live memory model for each card and picks the next due date so your predicted recall probability lands at a target rate (default 90%).

The scheduler tracks two things per card that are easy to confuse:

:::note
**Stability** is how long, in days, it would take for your recall of _this_ card to decay to the target rate. Rate Good at the right interval and stability grows; rate Again and it collapses back toward hours.

**Difficulty** is how hard this card is _for you_, on a 1-10 scale. It rises when you rate Again and drifts back toward your average with Good. A card with high difficulty comes back more frequently even when you're getting it right -- the model thinks you're close to the edge.
:::

So when a card reappears in two days despite a Good rating, that's the model saying "difficulty is high; I need one more data point to push the interval out." Trust it. Don't rate Easy to shove it further; let the scheduler earn the stretch.

Write cards small enough that a single Good rating actually means "I know this." One card, one fact.`,
		},
		{
			id: 'calibration',
			title: 'Calibration',
			body: `About half of your reviews also ask for a 1-5 confidence rating _before_ you reveal the answer. This feeds [[calibration::concept-calibration]] -- the match between how sure you are and how often you're actually right. It does not change FSRS scheduling; it's a separate system with its own readout in the calibration dashboard.

The prompt isn't random. airboss hashes \`cardId + today's date\` and shows the prompt when the hash lands in the sampled half. Two consequences:

1. **Same card, same day, same decision.** Reloading the page won't flip whether the prompt appears.
2. **Across a week, every card gets sampled about half the time.** The calibration signal stays evenly spread across your deck.

If the prompt appears, pick the number that matches how confident you feel _before_ you see the answer. Skip only when you genuinely can't tell -- skipping to go faster weakens the signal, and overconfidence in aviation is the calibration failure mode that kills people. Worth the extra beat.`,
		},
		{
			id: 'active-recall',
			title: 'Active recall',
			body: `The review format looks trivial -- front, try, back, rate -- but the "try" step is doing all the work. [[Active recall::concept-active-recall]] (generating the answer yourself before checking it) is one of the most robust findings in the learning-science literature: it beats re-reading, highlighting, and passive review by wide margins on long-term retention.

The effort matters. Staring at the front for three seconds and flipping to the back does almost nothing. Committing to an answer -- saying it out loud, writing it in a notebook, or picturing the procedure step-by-step -- is what builds durable memory, even (especially) on the cards you get wrong.

So: pause. Answer first. _Then_ reveal. The scheduler assumes this is what you're doing. If you skim, the intervals it picks won't match what your memory can actually hold.`,
		},
		{
			id: 'tips',
			title: 'Tips for effective reviews',
			body: `A handful of habits that make the queue work for you instead of against you.

:::example
- **Review daily, even briefly.** Ten cards a day keeps the queue small and the intervals honest. A missed day compounds; a missed week is painful.
- **Say answers out loud.** Forces commitment before the reveal and makes active recall harder to fake.
- **Rate honestly, especially Again.** Forgetting is data. The scheduler needs it to learn which cards are stable.
- **Stop when you're tired.** Rating quality decays fast when you're fried, and bad ratings corrupt the queue for days.
:::

:::warn
Don't pick Easy just to finish faster. FSRS reads Easy as a signal to stretch the next interval, and you'll regret it in two weeks when the card comes due cold and you've lost it. If it was Good, rate Good.
:::`,
		},
	],
	externalRefs: [
		{
			title: 'Optimizing Spaced Repetition Schedule by Capturing the Dynamics of Memory (arXiv)',
			url: 'https://arxiv.org/abs/2402.12291',
			source: 'paper',
			note: 'Ye et al. -- the DSR (Difficulty, Stability, Retrievability) model behind FSRS.',
		},
		{
			title: 'SM-2 algorithm (SuperMemo, 1990)',
			url: 'https://www.supermemo.com/en/archives1990-2015/english/ol/sm2',
			source: 'other',
			note: "Piotr Wozniak's original spaced-repetition algorithm. Useful historical contrast to FSRS.",
		},
		{
			title: 'How to Remember Anything Forever-ish (Nicky Case)',
			url: 'https://ncase.me/remember/',
			source: 'other',
			note: 'Playable interactive explainer covering spacing, active recall, and the forgetting curve.',
		},
	],
};
