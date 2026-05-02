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

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const memoryReviewIndex: HelpPageIndex = {
	id: 'memory-review',
	title: 'Memory review',
	summary:
		'What the memory review queue is for, how the four ratings drive FSRS scheduling, and how the confidence prompt feeds calibration.',
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
	sections: [
		{ id: 'overview', title: 'Overview' },
		{ id: 'the-four-ratings', title: 'The four ratings' },
		{ id: 'how-scheduling-works', title: 'How scheduling works' },
		{ id: 'calibration', title: 'Calibration' },
		{ id: 'active-recall', title: 'Active recall' },
		{ id: 'tips', title: 'Tips for effective reviews' },
	],
	searchHaystack:
		"what the memory review queue is for, how the four ratings drive fsrs scheduling, and how the confidence prompt feeds calibration. the memory review queue is where airboss hands you the flashcards the scheduler thinks you're about to forget. one card at a time: you try to recall the back from the front, you reveal, and you rate how it actually went. the rating feeds back into the scheduler, which decides when the card comes due again.\n\nthis is the core loop of spaced repetition: short, daily sessions beat massed cramming, because each well-timed recall grows the interval the card survives before you next need it.\n\n:::tip\nreview a few cards a day; consistency beats cramming. ten minutes every morning will push your due queue farther out and make each session shorter than one 90-minute marathon per week ever will.\n:::\n\nwhen the queue runs out, the page tells you which of two things happened. **\"session complete\"** means you worked through what was scheduled for now. **\"you're caught up\"** means nothing is due yet -- come back later or write new cards. forcing reviews on cards that aren't due corrupts the scheduler's stability estimate; don't do it. after the answer is revealed you pick one of four buttons. the rating is the scheduler's only signal: rate what happened, not what you wish had happened. \"good\" when you forgot teaches fsrs a lie about that card, and you'll pay for it in two weeks.\n\n| rating | when to pick it                                                          | what happens to scheduling                                                           |\n| ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |\n| again  | you forgot. the answer surprised you, or you drew a blank.               | stability collapses. the card returns in minutes to under a day.                     |\n| hard   | you recalled it, but with effort, hesitation, or only partially right.   | stability grows a little. next interval is shorter than good would have given.       |\n| good   | you recalled it correctly with reasonable effort. this is the default.   | standard stability gain. next interval matches the scheduler's model for this card.  |\n| easy   | you recalled it instantly, no effort at all.                             | larger stability gain. next interval is stretched further than good.                 |\n\nkeyboard: `1` again, `2` hard, `3` good, `4` easy. `space` reveals the answer.\n\nif you mis-click, a 2.5-second \"rated x -- undo\" toast appears at the top of the page. press `u` (or `cmd/ctrl+z`) or click undo to roll the review back and restore the card to the top of the queue. past the toast window, a mis-rated card will self-correct within a review or two because it comes back when due and you can rate it correctly then. airboss schedules every card with fsrs-5 (free spaced repetition scheduler, version 5). instead of a fixed ladder (1 day, 3 days, 7 days, ...), fsrs maintains a live memory model for each card and picks the next due date so your predicted recall probability lands at a target rate (default 90%).\n\nthe scheduler tracks two things per card that are easy to confuse:\n\n:::note\n**stability** is how long, in days, it would take for your recall of _this_ card to decay to the target rate. rate good at the right interval and stability grows; rate again and it collapses back toward hours.\n\n**difficulty** is how hard this card is _for you_, on a 1-10 scale. it rises when you rate again and drifts back toward your average with good. a card with high difficulty comes back more frequently even when you're getting it right -- the model thinks you're close to the edge.\n:::\n\nso when a card reappears in two days despite a good rating, that's the model saying \"difficulty is high; i need one more data point to push the interval out.\" trust it. don't rate easy to shove it further; let the scheduler earn the stretch.\n\nwrite cards small enough that a single good rating actually means \"i know this.\" one card, one fact. about half of your reviews also ask for a 1-5 confidence rating _before_ you reveal the answer. this feeds calibration -- the match between how sure you are and how often you're actually right. it does not change fsrs scheduling; it's a separate system with its own readout in the calibration dashboard.\n\nthe prompt isn't random. airboss hashes `cardid + today's date` and shows the prompt when the hash lands in the sampled half. two consequences:\n\n1. **same card, same day, same decision.** reloading the page won't flip whether the prompt appears.\n2. **across a week, every card gets sampled about half the time.** the calibration signal stays evenly spread across your deck.\n\nif the prompt appears, pick the number that matches how confident you feel _before_ you see the answer. skip only when you genuinely can't tell -- skipping to go faster weakens the signal, and overconfidence in aviation is the calibration failure mode that kills people. worth the extra beat. the review format looks trivial -- front, try, back, rate -- but the \"try\" step is doing all the work. active recall (generating the answer yourself before checking it) is one of the most robust findings in the learning-science literature: it beats re-reading, highlighting, and passive review by wide margins on long-term retention.\n\nthe effort matters. staring at the front for three seconds and flipping to the back does almost nothing. committing to an answer -- saying it out loud, writing it in a notebook, or picturing the procedure step-by-step -- is what builds durable memory, even (especially) on the cards you get wrong.\n\nso: pause. answer first. _then_ reveal. the scheduler assumes this is what you're doing. if you skim, the intervals it picks won't match what your memory can actually hold. a handful of habits that make the queue work for you instead of against you.\n\n:::example\n- **review daily, even briefly.** ten cards a day keeps the queue small and the intervals honest. a missed day compounds; a missed week is painful.\n- **say answers out loud.** forces commitment before the reveal and makes active recall harder to fake.\n- **rate honestly, especially again.** forgetting is data. the scheduler needs it to learn which cards are stable.\n- **stop when you're tired.** rating quality decays fast when you're fried, and bad ratings corrupt the queue for days.\n:::\n\n:::warn\ndon't pick easy just to finish faster. fsrs reads easy as a signal to stretch the next interval, and you'll regret it in two weeks when the card comes due cold and you've lost it. if it was good, rate good.\n::: memory review fsrs spaced-repetition flashcards rating again good easy confidence calibration active-recall",
	documents: '/memory/review',
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
};
