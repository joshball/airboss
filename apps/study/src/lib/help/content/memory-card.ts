/**
 * Memory card detail help page.
 *
 * Wave 2a of the help-system fix pass
 * (docs/work/handoffs/20260424-help-system-fix-pass.md). Covers the
 * `/memory/[id]` detail surface: badges (domain, type, lifecycle,
 * source) and the schedule stats block (state, due, stability,
 * difficulty, reviews, lapses).
 *
 * Section ids are anchor targets for the upcoming InfoTip placement
 * pass; keep them stable. The placement spec points InfoTips at
 * `memory-card#domain`, `#type`, `#lifecycle`, `#source`, and the
 * per-stat anchors below.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const memoryCard: HelpPage = {
	id: 'memory-card',
	title: 'Memory card detail',
	summary:
		'What every badge and stat on the card detail page means: domain, type, lifecycle, source, and the FSRS schedule numbers.',
	documents: '/memory/[id]',
	tags: {
		appSurface: [APP_SURFACES.MEMORY],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: [
			'memory',
			'card',
			'detail',
			'domain',
			'type',
			'lifecycle',
			'source',
			'state',
			'stability',
			'difficulty',
			'reviews',
			'lapses',
			'suspend',
			'archive',
		],
	},
	related: ['memory-dashboard', 'memory-browse', 'memory-new', 'memory-review', 'concept-fsrs', 'concept-spaced-rep'],
	reviewedAt: '2026-04-24',
	sections: [
		{
			id: 'overview',
			title: 'Overview',
			body: `The card detail page shows one card's content, its lifecycle state, and the scheduler's current model of your memory for it. Badges along the top (domain, type, status, source) answer _what kind of card is this?_ The schedule stats block further down answers _when does the scheduler plan to show it again, and why?_

Most users never open this page: the review queue handles scheduling invisibly. Open a card when you need to fix its content, suspend it, archive it, or understand why the scheduler keeps bringing it back.`,
		},
		{
			id: 'domain',
			title: 'Domain',
			body: `The domain badge is the topic bucket this card belongs to (Weather, Regs, Procedures, Aerodynamics, Systems, etc.). It drives filtering on the [browse page](/help/memory-browse), per-domain metrics on the [dashboard](/help/memory-dashboard), and session mix when a plan weights domains differently.

See [[domain classification::memory-new]] for the authoring-side view -- how to pick the right domain when you write a card, and why the choice is not decorative.`,
		},
		{
			id: 'type',
			title: 'Type',
			body: `The type badge identifies the card's rendering and rating shape. Today every card is **Basic**: a front (cue), a back (answer), four FSRS ratings after reveal.

Cloze, image-occlusion, and typed-answer types are on the roadmap but not shipped. See [[type selector::memory-new]] on the new-card page for the full list and for why you should split awkward cards into two Basic cards rather than wait for a better type.`,
		},
		{
			id: 'lifecycle',
			title: 'Lifecycle',
			body: `Every card is in one of three lifecycle states. The detail page shows the current state as a badge and exposes the buttons that move between states.

| State      | In the scheduler? | Visible on dashboard counts? | Buttons available                    |
| ---------- | ----------------- | ---------------------------- | ------------------------------------ |
| Active     | Yes               | Yes                          | Suspend, Archive                     |
| Suspended  | No (held back)    | No (scheduler skips it)      | Reactivate, Archive                  |
| Archived   | No (retired)      | No                           | Reactivate                           |

**Suspend** holds the card back temporarily. FSRS state (stability, difficulty, due date) is preserved; the scheduler just skips this card until you reactivate. Use Suspend when you spot a wrong or outdated answer and plan to fix it.

**Archive** retires the card. It's excluded from counts and the scheduler, but not deleted. Archive cards you've outgrown or deprecated; reactivate if you change your mind.

**Reactivate** puts a Suspended or Archived card back in the Active state. For Suspended cards the scheduler resumes from where it left off (no memory-state reset). For Archived cards the same -- archiving doesn't erase FSRS history.

:::tip
Prefer Suspend or Archive to deleting. Deletion drops the card and its entire review history, which means you lose the scheduler's model and can't recover it.
:::`,
		},
		{
			id: 'source',
			title: 'Source',
			body: `The source badge marks where the card came from.

- **Personal** cards are cards you authored in [the new-card flow](/help/memory-new). You own them; you can edit everything.
- **Course** cards are ported from course content (a module's canonical question bank, a knowledge-graph node's built-in cards, etc.). They track a source of truth outside your deck. Most Course cards are read-only -- the front and back shouldn't drift from the course text -- but you can still suspend, archive, and review them like any Active card.

The distinction matters on the [browse page](/help/memory-browse): filter by Source to separate "cards I wrote" from "cards the platform gave me." It also matters when a course updates -- Course cards can pull corrected content; Personal cards never change under you.`,
		},
		{
			id: 'schedule-stats',
			title: 'Schedule stats',
			body: `The schedule block shows the scheduler's current model of your memory for this card. Six numbers, each with its own anchor below.

See [FSRS overview](/help/concept-fsrs) for the full model; the per-stat anchors below cover the one-line definitions.`,
		},
		{
			id: 'state',
			title: 'State',
			body: `The card's FSRS state: New, Learning, Review, or Relearning. See [FSRS states](/help/concept-fsrs#states) for the full definitions and transitions.

The short version: New = never reviewed; Learning = in the initial short-interval loop; Review = graduated and on long-interval spaced repetition; Relearning = lapsed from Review and back in a short-interval recovery loop.`,
		},
		{
			id: 'due',
			title: 'Due',
			body: `The next scheduled review date. If it's in the past, the card is in today's queue. If it's in the future, the card is not due yet and the scheduler will skip it in \`/memory/review\` until then.

The due date is derived from stability and the target retention rate (default 90%). See [[how FSRS picks intervals::concept-fsrs]] for the mechanism.`,
		},
		{
			id: 'stability',
			title: 'Stability',
			body: `How long, in days, it takes for your predicted recall of this card to decay to the target retention rate. Grows when you recall correctly at the right interval; collapses when you rate Again.

A card's stability is the single best summary of _how well you actually know it_. See [Stability and mastery](/help/concept-fsrs#stability-and-mastery) for the mastery threshold and what "mastered" means on this card.`,
		},
		{
			id: 'difficulty',
			title: 'Difficulty',
			body: `How hard this card is _for you_ specifically, on a 1-10 scale. Rises when you rate Again; drifts back toward your long-run average with Good.

High difficulty means the scheduler brings the card back frequently even when you're getting it right -- the model thinks you're close to the edge of forgetting. See [[stability vs difficulty::concept-fsrs]] for why these two variables measure different things.`,
		},
		{
			id: 'reviews',
			title: 'Reviews',
			body: `The total number of times you've rated this card across all ratings (Again / Hard / Good / Easy). A rough indicator of how much history the scheduler has to work with: a card with 2 reviews has a loose model; a card with 30 reviews has a tight one.`,
		},
		{
			id: 'lapses',
			title: 'Lapses',
			body: `The number of times you've rated this card Again after it was in Review state (i.e., it had graduated and you forgot it). Each lapse drops the card back into Relearning and collapses stability.

A high lapse count on a card usually means the card is too broad. See [[minimum-information::memory-new]] -- consider splitting it into two narrower cards rather than pounding the same wide card to memorization.`,
		},
	],
};
