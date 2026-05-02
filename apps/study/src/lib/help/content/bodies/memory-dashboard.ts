/**
 * Body markdown for help page `memory-dashboard`.
 *
 * Hand-edit this file -- the body is the source of truth. Run
 * `bun scripts/help/split-content.ts` to re-sync the matching index
 * file (precomputed search haystack) after editing a body.
 */

import type { HelpPageBody } from '@ab/help';

export const memoryDashboardBody: HelpPageBody = {
	id: 'memory-dashboard',
	sections: [
		{
			id: 'what-this-page-shows',
			title: 'What this page shows',
			body: `The memory overview is the top-level snapshot of your flashcard deck. Four stat tiles give you today's shape (what's due, what you've done, your streak, how big the deck is). A row of state pills breaks the deck down by [[FSRS state::concept-fsrs]] (New / Learning / Review / Relearning). A domain breakdown underneath shows coverage and mastery by topic.

Use this page to answer two questions before you start a session: _do I have work to do right now?_ (the Due-now tile), and _is the deck shaped the way I want it to be?_ (states + domain rows). The [memory review queue](/help/memory-review) is one click away when you want to actually run the cards.`,
		},
		{
			id: 'stat-tiles',
			title: 'Stat tiles',
			body: `Four tiles across the top summarize the state of the deck right now.

| Tile            | What it counts                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Due now         | Cards whose FSRS-scheduled next-review date is today or earlier. This is the review backlog.   |
| Reviewed today  | Cards you've rated since local midnight. Useful for "did I actually do my reps this morning?"  |
| Streak          | Consecutive days ending today on which you reviewed at least one card. Resets on missed days.  |
| Active cards    | Total cards with status Active (excludes Suspended and Archived). See [[lifecycle::memory-card]]. |

:::tip
Due now > 0 is the signal to run the review queue. Let the scheduler pick the cards; adding new cards when the backlog is deep just inflates tomorrow's load. See [[FSRS::concept-fsrs]] for how due dates are chosen.
:::`,
		},
		{
			id: 'state-groupings',
			title: 'State groupings',
			body: `The row of pills under the stat tiles breaks your active deck down by FSRS state. Click a pill to browse cards in that state; the count is the total, not the due-today count.

- **New** cards have never been reviewed. They haven't entered the scheduler yet.
- **Learning** cards are in their initial short-interval loop (minutes to hours) before graduating.
- **Review** cards have graduated and are on long-interval spaced repetition.
- **Relearning** cards were in Review but you rated Again; they drop back into a short-interval loop until they're stable again.

See [FSRS states](/help/concept-fsrs#states) for how cards transition between these buckets. The shape of the pill row tells you a lot: a fat Relearning pill means you're lapsing cards faster than the scheduler expects, which usually traces back to cards that aren't atomic enough.`,
		},
		{
			id: 'domain-breakdown',
			title: 'Domain breakdown',
			body: `Each row under the state pills represents one domain (Weather, Regs, Procedures, Aerodynamics, etc.). For every domain you see three numbers:

- **Total** -- count of active cards tagged to this domain.
- **Due** -- how many of those are due right now.
- **% mastered** -- the fraction whose FSRS stability clears the mastery threshold.

See [Stability and mastery](/help/concept-fsrs#stability-and-mastery) for the exact definition of mastered. The short version: a card is mastered when the scheduler is confident you'll still recall it a month from now without another review.

This row is how you notice coverage gaps. A domain with 3 cards and 0% mastered isn't a study problem; it's a _card-authoring_ problem. Author more cards in [the new-card flow](/help/memory-new) before pounding the same three to death.`,
		},
	],
};
