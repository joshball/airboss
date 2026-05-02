/**
 * Memory dashboard help page.
 *
 * Wave 2a of the help-system fix pass
 * (docs/work/handoffs/20260424-help-system-fix-pass.md). Covers the
 * `/memory` overview surface: the four stat tiles, the state pills that
 * group cards by FSRS state, and the per-domain breakdown.
 *
 * Section ids are anchor targets for upcoming InfoTip placements; keep
 * them stable.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const memoryDashboardIndex: HelpPageIndex = {
	id: 'memory-dashboard',
	title: 'Memory dashboard',
	summary:
		"What the memory overview shows: due counts, today's progress, streak, active cards, state groupings, and the per-domain breakdown.",
	tags: {
		appSurface: [APP_SURFACES.MEMORY],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: [
			'memory',
			'dashboard',
			'overview',
			'due',
			'streak',
			'active',
			'reviewed-today',
			'states',
			'domain',
			'mastered',
		],
	},
	sections: [
		{ id: 'what-this-page-shows', title: 'What this page shows' },
		{ id: 'stat-tiles', title: 'Stat tiles' },
		{ id: 'state-groupings', title: 'State groupings' },
		{ id: 'domain-breakdown', title: 'Domain breakdown' },
	],
	searchHaystack:
		"what the memory overview shows: due counts, today's progress, streak, active cards, state groupings, and the per-domain breakdown. the memory overview is the top-level snapshot of your flashcard deck. four stat tiles give you today's shape (what's due, what you've done, your streak, how big the deck is). a row of state pills breaks the deck down by fsrs state (new / learning / review / relearning). a domain breakdown underneath shows coverage and mastery by topic.\n\nuse this page to answer two questions before you start a session: _do i have work to do right now?_ (the due-now tile), and _is the deck shaped the way i want it to be?_ (states + domain rows). the [memory review queue](/help/memory-review) is one click away when you want to actually run the cards. four tiles across the top summarize the state of the deck right now.\n\n| tile            | what it counts                                                                                 |\n| --------------- | ---------------------------------------------------------------------------------------------- |\n| due now         | cards whose fsrs-scheduled next-review date is today or earlier. this is the review backlog.   |\n| reviewed today  | cards you've rated since local midnight. useful for \"did i actually do my reps this morning?\"  |\n| streak          | consecutive days ending today on which you reviewed at least one card. resets on missed days.  |\n| active cards    | total cards with status active (excludes suspended and archived). see lifecycle. |\n\n:::tip\ndue now > 0 is the signal to run the review queue. let the scheduler pick the cards; adding new cards when the backlog is deep just inflates tomorrow's load. see fsrs for how due dates are chosen.\n::: the row of pills under the stat tiles breaks your active deck down by fsrs state. click a pill to browse cards in that state; the count is the total, not the due-today count.\n\n- **new** cards have never been reviewed. they haven't entered the scheduler yet.\n- **learning** cards are in their initial short-interval loop (minutes to hours) before graduating.\n- **review** cards have graduated and are on long-interval spaced repetition.\n- **relearning** cards were in review but you rated again; they drop back into a short-interval loop until they're stable again.\n\nsee [fsrs states](/help/concept-fsrs#states) for how cards transition between these buckets. the shape of the pill row tells you a lot: a fat relearning pill means you're lapsing cards faster than the scheduler expects, which usually traces back to cards that aren't atomic enough. each row under the state pills represents one domain (weather, regs, procedures, aerodynamics, etc.). for every domain you see three numbers:\n\n- **total** -- count of active cards tagged to this domain.\n- **due** -- how many of those are due right now.\n- **% mastered** -- the fraction whose fsrs stability clears the mastery threshold.\n\nsee [stability and mastery](/help/concept-fsrs#stability-and-mastery) for the exact definition of mastered. the short version: a card is mastered when the scheduler is confident you'll still recall it a month from now without another review.\n\nthis row is how you notice coverage gaps. a domain with 3 cards and 0% mastered isn't a study problem; it's a _card-authoring_ problem. author more cards in [the new-card flow](/help/memory-new) before pounding the same three to death. memory dashboard overview due streak active reviewed-today states domain mastered",
	documents: '/memory',
	related: ['memory-review', 'memory-browse', 'memory-new', 'memory-card', 'concept-fsrs', 'concept-spaced-rep'],
	reviewedAt: '2026-04-24',
};
